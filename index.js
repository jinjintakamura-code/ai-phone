import http from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const server = http.createServer();
const wss = new WebSocketServer({ server });
const __dirname = new URL(".", import.meta.url).pathname;

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

    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: "あなたは飲食店の電話受付AIです。丁寧な標準語で対応してください。",
        voice: "alloy",
        audio_format: "mulaw",
        input_audio_format: "mulaw",
        turn_detection: { type: "server_vad" }
      }
    }));
  });

  // Twilio → OpenAI
  twilioWs.on("message", (msg) => {
    const d = JSON.parse(msg);
    if (d.event === "start") streamSid = d.streamSid;

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

  // OpenAI → Twilio
  openaiWs.on("message", async (msg) => {
    const d = JSON.parse(msg);

    const audio =
      d.delta ||
      d.audio ||
      d.output_audio?.delta ||
      d.response?.output_audio?.delta;

    if (audio && streamSid) {
      console.log("🔊 audio chunk");

      // ① Twilioへ返す
      twilioWs.send(JSON.stringify({
        event: "media",
        streamSid,
        media: {
          payload: audio,
          track: "outbound"
        }
      }));
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
