import { useEffect } from "react";
import socket from "../socket";

export default function TestSocket() {

  useEffect(() => {
    socket.on("user-joined", (id) => {
      console.log("User joined:", id);
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.log("Connection error:", err.message);
    });

    return () => {
      socket.off("user-joined");
      socket.off("connect");
      socket.off("connect_error");
    };
  }, []);

  const joinRoom = () => {
    socket.emit("join-room", "room1");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Socket Test</h2>
      <button onClick={joinRoom}>
        Join Room
      </button>
    </div>
  );
}