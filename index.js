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

  // ⑤ Whisper（聞く）
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", ...);
  const j = await r.json();
  console.log("🧪 Whisper raw response:", j);
  console.log("📝 Whisper:", j.text);

  // ⑥ ChatGPT（考える） ← あなたが今入れたコード
  const prompt = `
  あなたは飲食店の電話受付AIです。
  お客さまの発話:
  ${j.text}
  `;

  const cr = await fetch("https://api.openai.com/v1/chat/completions", ...);
  const cj = await cr.json();
  console.log("🤖 AIの返答:", cj.choices[0].message.content);
}


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
// ===== C: TTS（AIが喋る）=====
const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: replyText
  })
});

const audioArrayBuffer = await ttsRes.arrayBuffer();
const audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");

// 電話に音声を返す
ws.send(JSON.stringify({
  event: "media",
  media: {
    payload: audioBase64
  }
}));
server.on("upgrade", (req, s, h) => {
  if (req.url === "/stream") wss.handleUpgrade(req, s, h, ws => wss.emit("connection", ws));
  else s.destroy();
});

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
