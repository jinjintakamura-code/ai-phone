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

/* ===== ここが大事：Twilioが最初に叩く ===== */
app.post("/voice", (req, res) => {
  if (lastReplyFile) {
    const f = lastReplyFile;
    lastReplyFile = null;

    // 直前に作ったTTS音声を再生
    res.type("text/xml").send(`
<Response>
  <Play>https://ai-phone-final.onrender.com/public/${f}</Play>
</Response>
`);
  } else {
    // まだ返答が無いときは“聞く”
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
/* ========================================= */

// WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, ws =>
      wss.emit("connection", ws)
    );
  } else socket.destroy();
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

// Media Streams
wss.on("connection", ws => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async msg => {
    const d = JSON.parse(msg);

    if (d.event === "start") chunks = [];
    if (d.event === "media")
      chunks.push(Buffer.from(d.media.payload, "base64"));

    if (d.event === "stop") {
      console.log("⏹ 通話終了");

      const audio = Buffer.concat(chunks);
      const wavAudio = await mulawToWav(audio);

      // Whisper
      const form = new FormData();
      form.append("file", wavAudio, "audio.wav");
      form.append("model", "whisper-1");
      form.append("language", "ja");

      const r = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: form
        }
      );
      const j = await r.json();
      console.log("📝 Whisper:", j.text);
      if (!j.text) return;

      // ChatGPT
      const cr = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: j.text }]
          })
        }
      );
      const cj = await cr.json();
      const replyText = cj.choices[0].message.content;
      console.log("🤖 AIの返答:", replyText);

      // TTS
      const ttsRes = await fetch(
        "https://api.openai.com/v1/audio/speech",
        {
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
        }
      );

      const wavBuf = Buffer.from(await ttsRes.arrayBuffer());
      const filename = `reply-${Date.now()}.wav`;
      const filePath = path.join(__dirname, "public", filename);
      fs.writeFileSync(filePath, wavBuf);
      lastReplyFile = filename;
    }
  });
});

// Start
server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
