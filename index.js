import http from "http";
import { WebSocketServer } from "ws";
import FormData from "form-data";

const server = http.createServer((req, res) => {
  res.writeHead(200); res.end("ok");
});

const wss = new WebSocketServer({ noServer: true });
let chunks = [];

wss.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    const d = JSON.parse(msg);
    if (d.event === "start") chunks = [];
    if (d.event === "media") chunks.push(Buffer.from(d.media.payload, "base64"));
    if (d.event === "stop") {
      const audio = Buffer.concat(chunks);
      const form = new FormData();
      form.append("file", audio, { filename: "audio.raw", contentType: "audio/basic" });
      form.append("model", "whisper-1");
      form.append("language", "ja");

      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
        body: form
      });
      const j = await r.json();
      console.log("📝 Whisper:", j.text);
    }
  });
});

server.on("upgrade", (req, s, h) => {
  if (req.url === "/stream") wss.handleUpgrade(req, s, h, ws => wss.emit("connection", ws));
  else s.destroy();
});

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
