import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import { desktopBridge } from './lib/desktopApi';
import { bindDesktopBridge } from '../store/repository';
import { ErrorBoundary } from './components/system/ErrorBoundary';

bindDesktopBridge(desktopBridge);

window.addEventListener('error', (event) => {
  console.error('[Atlas renderer window error]', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Atlas renderer unhandled rejection]', event.reason);
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HashRouter>
  </React.StrictMode>,
);
