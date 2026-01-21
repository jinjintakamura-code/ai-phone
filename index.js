import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let audioChunks = [];

wss.on("connection", (ws) => {
  console.log("📞 WebSocket 接続");

  ws.on("message", async (msg) => {
    const data = JSON.parse(msg);

    if (data.event === "start") {
      console.log("▶️ 通話開始");
      audioChunks = [];
    }

    if (data.event === "media") {
      const audio = Buffer.from(data.media.payload, "base64");
      audioChunks.push(audio);
    }

    if (data.event === "stop") {
      console.log("⏹ 通話終了 → Whisper送信");

      const audioBuffer = Buffer.concat(audioChunks);

      const form = new FormData();
      form.append("file", audioBuffer, {
        filename: "audio.wav",
        contentType: "audio/wav"
      });
      form.append("model", "whisper-1");
      form.append("language", "ja");

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: form
        }
      );

      const result = await response.json();

console.log("🧪 Whisper生レス:", result);   // ★ここ
console.log("📝 Whisper結果:", result.text);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running");
});
