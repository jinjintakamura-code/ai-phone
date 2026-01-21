import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer((req, res) => {
  console.log("HTTP request:", req.method, req.url);
  res.writeHead(200);
  res.end("ok");
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, request) => {
  console.log("📞 WebSocket 接続（確定）", request.url);

  ws.on("message", (msg) => {
    console.log("WS message raw:", msg.toString().slice(0, 50));
  });
});

server.on("upgrade", (req, socket, head) => {
  console.log("⬆️ upgrade request 来た:", req.url);
  console.log("headers:", req.headers);

  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    console.log("❌ URL不一致で破棄");
    socket.destroy();
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
