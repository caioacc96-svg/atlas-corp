import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { loadAppBootstrap, openAppDataFolder, writeAppData } from './persistence';
import { AppData } from '../shared/types';

type BackendMode = 'embedded' | 'disabled';
type BackendStatus = 'booting' | 'ok' | 'degraded';

type BackendStatusPayload = {
  status: BackendStatus;
  mode: BackendMode;
  host: string;
  port: number;
  entry: string | null;
  message: string | null;
};

type AtlasBackendModule = {
  startAtlasBackendServer?: (options?: { host?: string; port?: number }) => Promise<() => Promise<void>>;
};

let mainWindow: BrowserWindow | null = null;
let stopEmbeddedBackend: (() => Promise<void>) | null = null;

const backendHost = process.env.ATLAS_BACKEND_HOST || '127.0.0.1';
const backendPort = Number(process.env.ATLAS_BACKEND_PORT || 4467);

const backendState: BackendStatusPayload = {
  status: 'booting',
  mode: process.env.VITE_DEV_SERVER_URL ? 'disabled' : 'embedded',
  host: backendHost,
  port: backendPort,
  entry: null,
  message: null,
};

function setBackendState(next: Partial<BackendStatusPayload>) {
  Object.assign(backendState, next);
}

function emitBackendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('atlas:backend-status', backendState);
}

function resolveBackendCandidates() {
  const appPath = app.getAppPath();
  const resourcesPath = process.resourcesPath;

  return [
    path.join(appPath, 'dist-backend', 'backend', 'src', 'server.js'),
    path.join(appPath, 'dist-backend', 'backend', 'src', 'app.js'),
    path.join(resourcesPath, 'app.asar.unpacked', 'dist-backend', 'backend', 'src', 'server.js'),
    path.join(resourcesPath, 'app.asar.unpacked', 'dist-backend', 'backend', 'src', 'app.js'),
  ];
}

function tryLoadBackendModule() {
  const failures: string[] = [];

  for (const candidate of resolveBackendCandidates()) {
    try {
      if (!fs.existsSync(candidate)) {
        failures.push(`${candidate} :: arquivo ausente`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const loaded = require(candidate) as AtlasBackendModule;

      if (typeof loaded.startAtlasBackendServer !== 'function') {
        failures.push(`${candidate} :: export startAtlasBackendServer ausente`);
        continue;
      }

      return { entry: candidate, module: loaded };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate} :: ${message}`);
    }
  }

  throw new Error(failures.join(' | '));
}

async function probeExistingBackend(host: string, port: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`http://${host}:${port}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function stopEmbeddedBackendIfRunning() {
  if (!stopEmbeddedBackend) return;

  try {
    await stopEmbeddedBackend();
  } catch (error) {
    console.error('[Atlas embedded backend stop failed]', error);
  } finally {
    stopEmbeddedBackend = null;
  }
}

async function startEmbeddedBackendIfNeeded() {
  if (process.env.VITE_DEV_SERVER_URL) {
    setBackendState({
      status: 'ok',
      mode: 'disabled',
      message: 'Renderer em modo dev. Backend embutido nao e iniciado neste modo.',
      entry: null,
    });
    return;
  }

  try {
    process.env.ATLAS_DATA_DIR = path.join(app.getPath('userData'), 'chat-data');
    process.env.ATLAS_CONFIG_FILE = path.join(process.env.ATLAS_DATA_DIR, 'atlas.config.json');

    const loaded = tryLoadBackendModule();

    try {
      stopEmbeddedBackend = await loaded.module.startAtlasBackendServer!({
        host: backendHost,
        port: backendPort,
      });

      setBackendState({
        status: 'ok',
        mode: 'embedded',
        entry: loaded.entry,
        message: null,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('EADDRINUSE')) {
        const alive = await probeExistingBackend(backendHost, backendPort);

        if (alive) {
          setBackendState({
            status: 'ok',
            mode: 'embedded',
            entry: loaded.entry,
            message: `Backend ja existente reutilizado em ${backendHost}:${backendPort}`,
          });
          return;
        }
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setBackendState({
      status: 'degraded',
      mode: 'embedded',
      entry: null,
      message,
    });
    console.error('[Atlas embedded backend boot failed]', error);
  }
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1220,
    minHeight: 760,
    show: true,
    title: 'Atlas Corp',
    backgroundColor: '#FBFEFF',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.webContents.once('did-finish-load', () => {
    emitBackendState();
  });
};

app.whenReady().then(async () => {
  ipcMain.handle('atlas:load-data', async () => loadAppBootstrap());
  ipcMain.handle('atlas:save-data', async (_event, data: AppData) => writeAppData(data));
  ipcMain.handle('atlas:open-data-folder', async () => openAppDataFolder());
  ipcMain.handle('atlas:get-backend-status', async () => backendState);
  ipcMain.handle('atlas:restart-backend', async () => {
    await stopEmbeddedBackendIfRunning();
    setBackendState({ status: 'booting', message: null, entry: null });
    await startEmbeddedBackendIfNeeded();
    emitBackendState();
    return backendState;
  });

  await startEmbeddedBackendIfNeeded();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', async () => {
  await stopEmbeddedBackendIfRunning();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});