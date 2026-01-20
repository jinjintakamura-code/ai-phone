import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  const digits = req.body.Digits;

  let text = "1を押してください。";

  if (digits) {
    text = `「${digits}」が押されました。`;
  }

  res.set("Content-Type", "text/xml");
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="5">
    <Say language="ja-JP">${text}</Say>
  </Gather>
</Response>`
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
