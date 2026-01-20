import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  const digits = req.body.Digits;

  let message = `
ご予約は1番、
営業時間は2番、
その他のお問い合わせは3番を押してください。
`;

  if (digits === "1") {
    message = "ご予約はお電話では承っておりません。食べログをご利用ください。";
  } else if (digits === "2") {
    message = "営業時間は午後5時から午後11時までです。";
  } else if (digits === "3") {
    message = "恐れ入りますが、営業時間内におかけ直しください。";
  }

  res.set("Content-Type", "text/xml");
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="7">
    <Say language="ja-JP">${message}</Say>
  </Gather>
</Response>`
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
