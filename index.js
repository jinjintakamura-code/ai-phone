import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  const userSpeech = req.body.SpeechResult;

  let message = "ご用件をどうぞ。";

  if (userSpeech) {
    message = `「${userSpeech}」ですね。ありがとうございます。`;
  }

  res.set("Content-Type", "text/xml");
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="ja-JP" timeout="5">
    <Say language="ja-JP">${message}</Say>
  </Gather>
</Response>`
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
