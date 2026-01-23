import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static("public"));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const __dirname = new URL(".", import.meta.url).pathname;

let chunks = [];
let lastReplyFile = null;

// ===== Twilio webhook =====
app.post("/voice", (req, res) => {
  if (lastReplyFile) {
    const f = lastReplyFile;
    lastReplyFile = null;
    res.type("text/xml").send(`
<Response>
  <Play>https://ai-phone-final.onrender.com/public/${f}</Play>
</Response>
`);
  } else {
    res.type("text/xml").send(`
<Response>
  <Start>
    <Stream url="wss://ai-phone-final.onrender.com/stream" />
  </Start>
  <Pause length="600"/>
</Response>
`);
  }
});

// ===== WebSocket upgrade =====
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws =>
      wss.emit("connection", ws)
    );
  } else socket.destroy();
});

// ===== μ-law → WAV（ファイル経由で安全変換）=====
async function mulawToWav(buf) {
  const raw = path.join(__dirname, "in.mulaw");
  const wav = path.join(__dirname, "out.wav");
  fs.writeFileSync(raw, buf);

  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, [
      "-f","mulaw",
      "-ar","8000",
      "-ac","1",
      "-i", raw,
      "-acodec","pcm_s16le",
      "-ar","16000",
      "-ac","1",
      wav
    ]);
    ff.on("close", code => code === 0 ? resolve() : reject());
  });

  return fs.readFileSync(wav);
}

// ===== Media Streams =====
wss.on("connection", ws => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async msg => {
    const d = JSON.parse(msg);

    if (d.event === "start") chunks = [];

    if (d.event === "media") {
      const b = Buffer.from(d.media.payload, "base64");
      console.log("🎧 media bytes:", b.length);
      chunks.push(b);
    }

    if (d.event === "stop") {
      console.log("🧱 total bytes:", Buffer.concat(chunks).length);

      const audio = Buffer.concat(chunks);
      const wavAudio = await mulawToWav(audio);

      const form = new FormData();
      form.append("file", fs.createReadStream(path.join(__dirname, "out.wav")));
      form.append("model", "whisper-1");
      form.append("language", "ja");

      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders()
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
          messages: [{ role: "user", content: j.text }]
        })
      });
      const cj = await cr.json();
      const reply = cj.choices[0].message.content;
      console.log("🤖 AIの返答:", reply);

      const tts = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          format: "wav",
          input: reply
        })
      });

      const buf = Buffer.from(await tts.arrayBuffer());
      const name = `reply-${Date.now()}.wav`;
      fs.writeFileSync(path.join(__dirname,"public",name), buf);
      lastReplyFile = name;
    }
  });
});

// ===== Start =====
server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
