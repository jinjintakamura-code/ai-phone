import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`
    <Response>
      <Say language="ja-JP">ここまで来ています。</Say>
    </Response>
  `);
});

app.listen(3000);
