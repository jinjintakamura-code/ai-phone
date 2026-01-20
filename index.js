import express from "express";
import OpenAI from "openai";

const app = express();

// 🔴 これ超重要（Twilio用）
app.use(express.urlencoded({ extended: false }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let memory = [];

app.post("/voice", async (req, res) => {
  const userText = req.body.SpeechResult || "もしもし";

  memory.push({ role: "user", content: userText });

  const ai = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "あなたは飲食店の電話受付です。自然な会話を続けてください。"
      },
      ...memory
    ]
  });

  const reply = ai.choices[0].message.content;
  memory.push({ role: "assistant", content: reply });

  res.type("text/xml");
  res.send(`
    <Response>
      <Gather input="speech"
              action="https://xxxxx.onrender.com/voice"
              language="ja-JP"
              timeout="5">
        <Say language="ja-JP">${reply}</Say>
      </Gather>
    </Response>
  `);
});

app.listen(3000);
