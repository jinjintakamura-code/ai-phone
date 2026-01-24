import express from "express";
import http from "http";

const app = express();
app.use(express.urlencoded({ extended: true }));

app.post("/voice", (req, res) => {
  res.type("text/xml").send(`
<Response>
  <Start>
    <Stream url="wss://ai-phone-final.onrender.com/stream" />
  </Start>
  <Pause length="600"/>
</Response>

app.get("/voice", (req, res) => {
  res.type("text/xml").send(`
<Response>
  <Say voice="alice">テストです。聞こえますか？</Say>
</Response>
`);
});

const server = http.createServer(app);
// --- ここから追加 ---
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws =>
      wss.emit("connection", ws)
    );
  } else socket.destroy();
});

wss.on("connection", ws => {
  console.log("📞 WebSocket 接続");

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    if (data.event === "media") {
      console.log("🎧 音声パケット受信");
    }
  });
});
// --- ここまで追加 ---
server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
