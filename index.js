import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import http from "http";
import { WebSocketServer } from "ws";
import FormData from "form-data";
const wavAudio = await mulawToWav(audio);
// ===== μ-law → WAV 変換関数 =====
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

    const chunks = [];
    ff.stdout.on("data", d => chunks.push(d));
    ff.on("close", () => resolve(Buffer.concat(chunks)));
    ff.on("error", reject);

    ff.stdin.write(mulawBuffer);
    ff.stdin.end();
  });
}
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
});

const wss = new WebSocketServer({ noServer: true });
let chunks = [];

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async (msg) => {
    const d = JSON.parse(msg);

    if (d.event === "start") {
      chunks = [];
    }

    if (d.event === "media") {
      chunks.push(Buffer.from(d.media.payload, "base64"));
    }

    if (d.event === "stop") {
      console.log("⏹ 通話終了");

      /* ===== A: Whisper ===== */
      const audio = Buffer.concat(chunks);

      const form = new FormData();
      form.append("file", audio, {
        filename: "audio.raw",
        contentType: "audio/basic"
      });
      form.append("model", "whisper-1");
      form.append("language", "ja");

      const r = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders()
          },
          body: form
        }
      );

      const j = await r.json();
      console.log("🧪 Whisper raw:", j);
      console.log("📝 Whisper:", j.text);

      if (!j.text) return;

      /* ===== B: ChatGPT ===== */
      const prompt = `
あなたは飲食店の電話受付AIです。
丁寧な標準語で対応してください。

お客さまの発話:
${j.text}
`;

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
            messages: [{ role: "user", content: prompt }]
          })
        }
      );

      const cj = await cr.json();
      const replyText = cj.choices[0].message.content;
      console.log("🤖 AIの返答:", replyText);

      /* ===== C: TTS ===== */
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
            input: replyText
          })
        }
      );

      const audioBuf = Buffer.from(await ttsRes.arrayBuffer()).toString("base64");

      ws.send(
        JSON.stringify({
          event: "media",
          media: { payload: audioBuf }
        })
      );
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/stream") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
