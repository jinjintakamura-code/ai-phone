import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

// WebSocketは noServer で作る
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.event === "start") console.log("▶️ 通話開始");
    if (data.event === "media") console.log("🎧 音声データ来た");
    if (data.event === "stop") console.log("⏹ 通話終了");
  });
});

// ★ ここが超重要：upgrade を明示的に処理
server.on("upgrade", (request, socket, head) => {
  if (request.url === "/stream") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running");
});
