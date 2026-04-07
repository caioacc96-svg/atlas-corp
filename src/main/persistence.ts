import fs from 'node:fs/promises';
import path from 'node:path';
import { app, shell } from 'electron';
import { defaultAppData } from '../data/defaultAppData';
import { sanitizeAppData } from '../shared/guards';
import { AppData, BootstrapPayload } from '../shared/types';

const FILE_NAME = 'atlas-corp-data.json';

function getDataFilePath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

async function ensureDataFolder() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
}

async function writeRawData(filePath: string, data: AppData) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadAppBootstrap(): Promise<BootstrapPayload> {
  const filePath = getDataFilePath();

  try {
    await ensureDataFolder();
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const { normalized, wasNormalized } = sanitizeAppData(parsed);

    if (wasNormalized) {
      await writeRawData(filePath, normalized);
      return {
        data: normalized,
        status: {
          kind: 'normalized',
          severity: 'warning',
          title: 'Dados normalizados',
          message: 'O Atlas encontrou dados fora do domínio esperado e aplicou normalização segura.',
        },
      };
    }

    return {
      data: normalized,
      status: {
        kind: 'loaded',
        severity: 'success',
        title: 'Base carregada',
        message: 'A base local foi carregada de forma íntegra.',
      },
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      await ensureDataFolder();
      await writeRawData(filePath, defaultAppData);
      return {
        data: defaultAppData,
        status: {
          kind: 'created-default',
          severity: 'info',
          title: 'Base inicial criada',
          message: 'Nenhum arquivo de dados foi encontrado. O Atlas criou uma base inicial segura.',
        },
      };
    }

    if (error instanceof SyntaxError) {
      const backupPath = path.join(app.getPath('userData'), `atlas-corp-data.corrupted-${Date.now()}.bak.json`);
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        await fs.writeFile(backupPath, raw, 'utf-8');
      } catch {
        // noop
      }
      await writeRawData(filePath, defaultAppData);
      return {
        data: defaultAppData,
        status: {
          kind: 'recovered-corrupted',
          severity: 'warning',
          title: 'Base recuperada após corrupção',
          message: 'O Atlas detectou corrupção no arquivo local, preservou um backup e recriou uma base segura.',
          backupPath,
        },
      };
    }

    return {
      data: defaultAppData,
      status: {
        kind: 'io-error',
        severity: 'error',
        title: 'Falha inesperada de leitura',
        message: 'O Atlas encontrou um erro de I/O e iniciou com base segura para preservar a continuidade.',
        details: nodeError.message,
      },
    };
  }
}

export async function writeAppData(data: AppData): Promise<AppData> {
  const filePath = getDataFilePath();
  await ensureDataFolder();
  const { normalized } = sanitizeAppData(data);
  await writeRawData(filePath, normalized);
  return normalized;
}

export async function openAppDataFolder() {
  await ensureDataFolder();
  await shell.openPath(app.getPath('userData'));
}
