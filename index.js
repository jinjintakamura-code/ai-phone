import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  const speech = req.body.SpeechResult;

  let text = "ご用件をどうぞ。";

  if (speech) {
    text = `「${speech}」ですね。ありがとうございます。`;
  }

  res.set("Content-Type", "text/xml");
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech"
          language="ja-JP"
          timeout="5"
          speechTimeout="auto">
    <Say language="ja-JP">${text}</Say>
  </Gather>
</Response>`
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
