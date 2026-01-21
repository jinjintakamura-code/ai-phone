import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer((req, res) => {
  // ★ Render対策：HTTPで必ず応答する
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log("event:", data.event);
    } catch {
      console.log("raw:", msg.toString().slice(0, 50));
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  console.log("⬆️ upgrade:", req.url);

  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
