import express from "express";
import http from "http";
import fs from "fs";
import path from "path";

const app = express();
app.use("/public", express.static("public"));
const server = http.createServer(app);

app.post("/voice", async (req, res) => {
  // 仮テキスト
  const replyText = "お電話ありがとうございます。ご用件をお伺いします。";

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
  if (!fs.existsSync("public")) fs.mkdirSync("public");
  fs.writeFileSync("public/reply.wav", buf);

  res.type("text/xml").send(`
<Response>
  <Play>https://ai-phone-final.onrender.com/public/reply.wav</Play>
</Response>
`);
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
