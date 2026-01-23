import http from "http";
import WebSocket from "ws";

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Twilio -> this server -> OpenAI Realtime
wss.on("connection", async (twilioWs) => {
  console.log("📞 Twilio connected");

  const openaiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  openaiWs.on("open", () => {
    console.log("🤖 OpenAI connected");
  });

  // Twilio -> OpenAI
  twilioWs.on("message", (msg) => {
    const d = JSON.parse(msg);
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
    if (d.type === "output_audio.delta") {
      twilioWs.send(JSON.stringify({
        event: "media",
        media: { payload: d.delta }
      }));
    }
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
