import { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

const HUB_URL = 'http://localhost:5131/chessHub';

// 🔥 Global connection - برای اینکه وقتی صفحه عوض می‌شود connection قطع نشود
let globalConnection: signalR.HubConnection | null = null;

export function useSignalR() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>('');
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    console.log('🎯 useSignalR hook mounted');

    // اگر connection جهانی وجود دارد، از آن استفاده کن
    if (globalConnection && globalConnection.state === signalR.HubConnectionState.Connected) {
      console.log('✅ Using existing global connection');
      connectionRef.current = globalConnection;
      setIsConnected(true);
      return;
    }

    const startConnection = async () => {
      if (isConnecting) return;

      try {
        setIsConnecting(true);
        setError('');

        console.log('🚀 Creating new SignalR connection...');
        
        const hubConnection = new signalR.HubConnectionBuilder()
          .withUrl(HUB_URL)
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(signalR.LogLevel.Warning)
          .build();

        hubConnection.on('Connected', (data: any) => {
          console.log('✅ Connected to server:', data);
          setIsConnected(true);
          setError('');
        });

        hubConnection.onclose((err) => {
          console.log('🔌 Connection closed:', err);
          setIsConnected(false);
          if (err) {
            setError(`Connection error: ${err.message}`);
          }
          // تلاش مجدد
          setTimeout(() => startConnection(), 3000);
        });

        hubConnection.onreconnecting((err) => {
          console.log('🔄 Reconnecting...', err);
          setIsConnected(false);
        });

        hubConnection.onreconnected((connectionId) => {
          console.log('✅ Reconnected:', connectionId);
          setIsConnected(true);
        });

        await hubConnection.start();
        
        console.log('✅ SignalR connected successfully!');
        console.log('📊 Connection ID:', hubConnection.connectionId);
        
        connectionRef.current = hubConnection;
        globalConnection = hubConnection; // ذخیره به صورت global
        setIsConnected(true);
        setIsConnecting(false);

      } catch (err: any) {
        console.error('❌ Failed to connect:', err);
        setError(`Connection failed: ${err.message}`);
        setIsConnected(false);
        setIsConnecting(false);
        
        // تلاش مجدد بعد از 5 ثانیه
        setTimeout(() => startConnection(), 5000);
      }
    };

    startConnection();

    // تمیزکاری
    return () => {
      console.log('🧹 useSignalR cleanup - NOT destroying connection (keeping it global)');
      // ❌ connection رو destroy نکن چون global است
    };
  }, []);

  return {
    connection: connectionRef.current,
    isConnected,
    isConnecting,
    error
  };
}

function getPlayerId() {
  let id = localStorage.getItem("playerId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("playerId", id);
  }
  return id;
}
export default getPlayerId;