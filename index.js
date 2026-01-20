import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/voice", async (req, res) => {
  const ai = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "あなたは飲食店の電話受付です。丁寧な日本語で一言だけ返してください。"
      }
    ]
  });

  const text = ai.choices[0].message.content;

  res.type("text/xml");
  res.send(`
    <Response>
      <Say language="ja-JP">
        ${text}
      </Say>
    </Response>
  `);
});

app.listen(3000);
