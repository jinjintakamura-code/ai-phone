import express from "express";
import { WebSocketServer } from "ws";
import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const __dirname = new URL(".", import.meta.url).pathname;

const app = express();
app.use("/public", express.static("public"));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  } else socket.destroy();
});

let chunks = [];

// μ-law → WAV
function mulawToWav(buf) {
  return new Promise((res, rej) => {
    const ff = spawn(ffmpeg, ["-f","mulaw","-ar","8000","-ac","1","-i","pipe:0","-f","wav","pipe:1"]);
    const out=[]; ff.stdout.on("data",d=>out.push(d));
    ff.on("close",()=>res(Buffer.concat(out))); ff.on("error",rej);
    ff.stdin.write(buf); ff.stdin.end();
  });
}

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async (msg) => {
    const d = JSON.parse(msg);

    if (d.event === "start") chunks = [];
    if (d.event === "media") chunks.push(Buffer.from(d.media.payload, "base64"));

    if (d.event === "stop") {
      const audio = Buffer.concat(chunks);
      const wav = await mulawToWav(audio);

      const form = new FormData();
      const blob = new Blob([wav], { type: "audio/wav" });
      form.append("file", blob, "audio.wav");
      form.append("model", "whisper-1");

      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
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

      // TTS → ファイル保存
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
      const file = path.join(__dirname, "public", name);
      fs.writeFileSync(file, buf);

      // Twilioへ再生指示
      ws.send(JSON.stringify({
        event: "twiml",
        twiml: `<Response><Play>${process.env.BASE_URL}/public/${name}</Play></Response>`
      }));
    }
  });
});
