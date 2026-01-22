import http from "http";
import { WebSocketServer } from "ws";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import express from "express";

const app = express();
app.use("/public", express.static("public"));
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
});

const wss = new WebSocketServer({ noServer: true });
let chunks = [];

// μ-law → WAV
function mulawToWav(mulawBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, [
      "-f", "mulaw",
      "-ar", "8000",
      "-ac", "1",
      "-i", "pipe:0",
      "-f", "wav",
      "pipe:1"
    ]);
    const out = [];
    ff.stdout.on("data", d => out.push(d));
    ff.on("close", () => resolve(Buffer.concat(out)));
    ff.on("error", reject);
    ff.stdin.write(mulawBuffer);
    ff.stdin.end();
  });
}

// WAV → μ-law
function wavToMulaw(wavBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, [
      "-i", "pipe:0",
      "-ar", "8000",
      "-ac", "1",
      "-f", "mulaw",
      "pipe:1"
    ]);
    const out = [];
    ff.stdout.on("data", d => out.push(d));
    ff.on("close", () => resolve(Buffer.concat(out)));
    ff.on("error", reject);
    ff.stdin.write(wavBuffer);
    ff.stdin.end();
  });
}

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async (msg) => {
    const d = JSON.parse(msg);

    if (d.event === "start") chunks = [];
    if (d.event === "media") chunks.push(Buffer.from(d.media.payload, "base64"));

    if (d.event === "stop") {
      console.log("⏹ 通話終了");

      // A: Whisper
      const audio = Buffer.concat(chunks);
      const wavAudio = await mulawToWav(audio);

      const form = new FormData();
      const blob = new Blob([wavAudio], { type: "audio/wav" });
      form.append("file", blob, "audio.wav");
      form.append("model", "whisper-1");
      form.append("language", "ja");

      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form
      });

      const j = await r.json();
      console.log("📝 Whisper:", j.text);
      if (!j.text) return;

      // B: ChatGPT
      const cr = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: j.text }]
        })
      });

      const cj = await cr.json();
      const replyText = cj.choices[0].message.content;
      console.log("🤖 AIの返答:", replyText);

      // C: TTS
      import fs from "fs";
import path from "path";

const __dirname = new URL('.', import.meta.url).pathname;

// C: TTS
const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "wav",
    input: replyText
  })
});

const wavBuf = Buffer.from(await ttsRes.arrayBuffer());

// ファイル保存
const filename = `reply-${Date.now()}.wav`;
const filePath = path.join(__dirname, "public", filename);
fs.writeFileSync(filePath, wavBuf);

// Twilioに再生指示を返す
ws.send(JSON.stringify({
  event: "twiml",
  twiml: `<Response><Play>${process.env.BASE_URL}/public/${filename}</Play></Response>`
}));

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws));
  } else socket.destroy();
});

server.listen(process.env.PORT || 3000, () => console.log("Server running"));
