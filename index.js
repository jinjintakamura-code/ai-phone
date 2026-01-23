import express from "express";
const app = express();

app.get("/", (req, res) => {
  res.send("ok");
});
import http from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const OPENAI_KEY = process.env.OPENAI_API_KEY;

wss.on("connection", (twilioWs) => {
  console.log("📞 Twilio connected");

  let streamSid = null;

  const openaiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  openaiWs.on("open", () => {
    console.log("🤖 OpenAI connected");
// ===== OpenAI TTSをファイルにする =====
const tts = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: replyText,
    format: "wav"
  })
});

const buf = Buffer.from(await tts.arrayBuffer());

// public フォルダに保存
if (!fs.existsSync("public")) fs.mkdirSync("public");
fs.writeFileSync("public/reply.wav", buf);

  // Twilio -> OpenAI
  twilioWs.on("message", (msg) => {
    const d = JSON.parse(msg);

    if (d.event === "start") {
      streamSid = d.streamSid;
    }

    if (d.event === "media") {
      openaiWs.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: d.media.payload
      }));
    }

    if (d.event === "stop") {
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      openaiWs.send(JSON.stringify({ type: "response.create" }));
    }
  });

  // OpenAI -> Twilio
  openaiWs.on("message", (msg) => {
    const d = JSON.parse(msg);

    const audio =
      d.delta ||
      d.audio ||
      d.output_audio?.delta ||
      d.response?.output_audio?.delta;

    if (audio && streamSid) {
      console.log("🔊 audio chunk");
      twilioWs.send(JSON.stringify({
        event: "media",
        streamSid,
        media: {
          payload: audio,
          track: "outbound"
        }
      }));
      twilioWs.send(JSON.stringify({
  event: "twiml",
  twiml: `<Response><Play>https://ai-phone-final.onrender.com/public/reply.wav</Play></Response>`
}));
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
