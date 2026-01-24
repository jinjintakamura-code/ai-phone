import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";

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
  console.log("🧱 total bytes:", audio.length);

  const wavAudio = await mulawToWav(audio);
  console.log("🎧 wav bytes:", wavAudio.length);

  const form = new FormData();
  form.append("file", wavAudio, "audio.wav");
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
