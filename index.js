import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
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
const app = express();
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

let chunks = [];
let streamSid = null;

/* Twilioが最初に叩く */
app.post("/voice", (req, res) => {
  res.type("text/xml").send(`
<Response>
  <Start>
    <Stream url="wss://ai-phone-final.onrender.com/stream" />
  </Start>
  <Pause length="600"/>
</Response>
`);
});

/* WebSocket */
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit("connection", ws);
    });
  } else socket.destroy();
});

/* μ-law → wav */
function mulawToWav(mulawBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, [
      "-f","mulaw","-ar","8000","-ac","1","-i","pipe:0",
      "-f","wav","pipe:1"
    ]);
    const out = [];
    ff.stdout.on("data", d => out.push(d));
    ff.on("close", () => resolve(Buffer.concat(out)));
    ff.stdin.write(mulawBuffer);
    ff.stdin.end();
  });
}
function sendToTwilio(ws, streamSid, audioBuf) {
  const FRAME = 160; // 20ms
  let offset = 0;

  while (offset < audioBuf.length) {
    const chunk = audioBuf.slice(offset, offset + FRAME);

    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: {
        payload: chunk.toString("base64"),
        track: "outbound"
      }
    }));

    offset += FRAME;
  }
}
/* Media Streams */
wss.on("connection", ws => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async msg => {
    const d = JSON.parse(msg);

    if (d.event === "start") {
  streamSid = d.streamSid;
  console.log("▶️ 通話開始:", streamSid);
}

    if (d.event === "media") {
      chunks.push(Buffer.from(d.media.payload, "base64"));
    }

    if (d.event === "stop") {
      console.log("⏹ 通話終了");

      const audio = Buffer.concat(chunks);
      const wavAudio = await mulawToWav(audio);

      const blob = new Blob([wavAudio], { type: "audio/wav" });

const form = new FormData();
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
      console.log("📝 Whisper:", j.text);
      if (!j.text) return;

      const cr = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "あなたは飲食店の電話受付AIです。丁寧な標準語で対応してください。" },
            { role: "user", content: j.text }
          ]
        })
      });

      const cj = await cr.json();
      const replyText = cj.choices[0].message.content;
      console.log("🤖 AI:", replyText);

// ===== C: TTS (Twilio向けraw mulaw) =====
const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mulaw",   // ★ここが最重要
    input: replyText
  })
});

const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
const audioBase64 = audioBuf.toString("base64");

console.log("🔊 返す音声サイズ:", audioBase64.length);

// ===== Twilioへ送信 =====
sendToTwilio(ws, streamSid, mulaw);
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
