import { io } from "socket.io-client";

const socket = io("https://real-time-communication-app-1-dniy.onrender.com", {
  autoConnect: false,
  withCredentials: true,
});

export default socket;