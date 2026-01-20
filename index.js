import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ja-JP">お電話ありがとうございます。現在AIが対応しています。</Say>

  <!-- これが最重要：Twilioに「切るな、待て」と命令 -->
  <Pause length="60"/>

</Response>`
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
