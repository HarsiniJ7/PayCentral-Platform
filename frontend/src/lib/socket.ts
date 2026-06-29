import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "../api/client";

const SOCKET_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

let socket: Socket | null = null;
let refCount = 0;

function acquireSocket(): Socket {
  if (!socket) {
    const token = getToken();
    socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });
  }
  refCount += 1;
  return socket;
}

function releaseSocket() {
  refCount -= 1;
  if (refCount <= 0 && socket) {
    socket.disconnect();
    socket = null;
    refCount = 0;
  }
}


export function useRealtime() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    const s = acquireSocket();
    setConnected(s.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onDisconnect);
      releaseSocket();
    };
  }, []);

  return { connected };
}


export function useRealtimeEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    if (!getToken()) return;
    const s = acquireSocket();
    s.on(event, handler);

    return () => {
      s.off(event, handler);
      releaseSocket();
    };
    
  }, [event]);
}
