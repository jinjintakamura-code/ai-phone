import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

const twiml = `
<Response>
  <Start>
    <Stream url="wss://ai-phone-final.onrender.com/stream" />
  </Start>
  <Pause length="600"/>
</Response>
`;

app.post("/voice", (req, res) => {
  res.type("text/xml").send(twiml);
});

app.get("/voice", (req, res) => {
  res.type("text/xml").send(twiml);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit("connection", ws);
    });
  } else socket.destroy();
});

let chunks = [];

wss.on("connection", ws => {
  console.log("📞 WebSocket 接続");

  ws.on("message", msg => {
    const d = JSON.parse(msg);

    if (d.event === "start") {
      chunks = [];
      console.log("▶️ 通話開始");
    }

    if (d.event === "media") {
      const buf = Buffer.from(d.media.payload, "base64");
      chunks.push(buf);
    }

    if (d.event === "stop") {
      console.log("⏹ 通話終了");
      console.log("🧱 total bytes:", Buffer.concat(chunks).length);
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
