import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import { Blob } from "buffer";
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

const wss = new WebSocketServer({ noServer: true });
let chunks = [];

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit("connection", ws);
    });
  } else socket.destroy();
});

wss.on("connection", ws => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async msg => {
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

  const audio = Buffer.concat(chunks);
const wavAudio = await mulawToWav(audio);

const form = new FormData();
const blob = new Blob([wavAudio], { type: "audio/wav" });

form.append("file", blob, "audio.wav");
form.append("model", "whisper-1");
form.append("language", "ja");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

const j = await r.json();
console.log("🧪 Whisper raw:", j);
console.log("📝 Whisper:", j.text);

if (!j.text) return;

// ===== B: ChatGPTで返答を作る =====
const cr = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "あなたは飲食店の電話受付AIです。丁寧な標準語で対応してください。"
      },
      { role: "user", content: j.text }
    ]
  })
});

const cj = await cr.json();
const replyText = cj.choices[0].message.content;
console.log("🤖 AIの返答:", replyText);

// ===== C: TTS（喋らせる）=====
const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mulaw",   // Twilio向け
    input: replyText
  })
});

const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
const audioBase64 = audioBuf.toString("base64");

// ===== 電話に音声を返す =====
ws.send(JSON.stringify({
  event: "media",
  media: {
    payload: audioBase64
  }
}));
      if (j.text) {
        console.log("📝 Whisper:", j.text);
      } else {
        console.log("❌ Whisper failed");
      }
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
