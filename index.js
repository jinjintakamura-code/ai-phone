import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log("event:", data.event);
    } catch {
      console.log("raw:", msg.toString());
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running");
});
