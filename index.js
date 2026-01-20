import express from "express";
import http from "http";
import WebSocket from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.event === "start") console.log("📞 通話開始");
    if (data.event === "media") console.log("🎧 音声データ来た");
    if (data.event === "stop") console.log("❌ 通話終了");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running");
});
