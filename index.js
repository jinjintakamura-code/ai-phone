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
// ===== B: ChatGPTで返答を考える =====
const prompt = `
あなたは飲食店の電話受付AIです。
丁寧な標準語で対応してください。
予約、営業時間、場所、混雑状況に答えます。
不明点は聞き返してください。
クレームは謝罪→要点確認→店に伝える流れ。
深夜帯は簡潔に。

お客さまの発話:
${j.text}
`;

const cr = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  })
});

const cj = await cr.json();
const replyText = cj.choices[0].message.content;

console.log("🤖 AIの返答:", replyText);
server.on("upgrade", (req, s, h) => {
  if (req.url === "/stream") wss.handleUpgrade(req, s, h, ws => wss.emit("connection", ws));
  else s.destroy();
});

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
