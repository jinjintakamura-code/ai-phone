import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`
    <Response>
      <Say language="ja-JP">サーバーは正常に動いています。</Say>
    </Response>
  `);
});

// 🔴 Render必須：PORTを環境から受け取る
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
