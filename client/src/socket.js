import { io } from "socket.io-client";
import { API_BASE } from './config';

const socket = io(API_BASE, {
  transports: ["websocket", "polling"]
});

export default socket;