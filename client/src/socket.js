import { io } from "socket.io-client";

const socket = io("http://localhost:5001", {
  transports: ["websocket", "polling"]
});

export default socket;