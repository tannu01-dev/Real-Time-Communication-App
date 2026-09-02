
import { io } from "socket.io-client";

const SOCKET_URL = "https://real-time-communication-app-ipnm.onrender.com";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,

  // WebSocket first, polling fallback
  transports: ["websocket", "polling"],

  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("🟢 SOCKET CONNECTED:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔴 SOCKET DISCONNECTED:", reason);
});

socket.on("connect_error", (error) => {
  console.error("❌ SOCKET CONNECTION ERROR:", error.message);
});

socket.on("reconnect", (attempt) => {
  console.log("🔄 SOCKET RECONNECTED:", attempt, socket.id);
});

export default socket;

