import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";

const HUB_URL = "http://localhost:5131/chessHub";

// global connection
let globalConnection: signalR.HubConnection | null = null;

export function useSignalR() {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;

    const start = async () => {
      if (stopped) return;
      if (isConnecting) return;

      // reuse
      if (globalConnection) {
        setConnection(globalConnection);
        setIsConnected(globalConnection.state === signalR.HubConnectionState.Connected);
        if (globalConnection.state === signalR.HubConnectionState.Connected) return;
      }

      try {
        setIsConnecting(true);
        setError("");

        const hub = new signalR.HubConnectionBuilder()
          .withUrl(HUB_URL, {
            withCredentials: true
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(signalR.LogLevel.Information)
          .build();

        hub.on("Connected", (data: any) => {
          setIsConnected(true);
          setError("");
          // eslint-disable-next-line no-console
          console.log("✅ Connected event:", data);
        });

        hub.onclose((err) => {
          setIsConnected(false);
          if (err) setError(err.message || "Connection closed");
        });

        hub.onreconnecting(() => {
          setIsConnected(false);
        });

        hub.onreconnected(() => {
          setIsConnected(true);
        });

        await hub.start();

        globalConnection = hub;
        setConnection(hub);
        setIsConnected(true);
      } catch (e: any) {
        setError(e?.message || "Connection failed");
        setIsConnected(false);
        // retry
        setTimeout(() => {
          if (!stopped) start();
        }, 3000);
      } finally {
        setIsConnecting(false);
      }
    };

    start();

    return () => {
      stopped = true;
      // intentionally keep globalConnection alive
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connection, isConnected, isConnecting, error };
}
