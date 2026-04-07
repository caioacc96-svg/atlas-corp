/// <reference types="vite/client" />

import { DesktopBridge } from '../shared/types';

declare global {
  interface Window {
    atlasDesktop?: DesktopBridge;
  }
}

export {};
