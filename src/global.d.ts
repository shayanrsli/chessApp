// src/global.d.ts
import { HubConnection } from '@microsoft/signalr';

declare global {
  interface Window {
    signalRConnection?: HubConnection;
  }
}

export {};