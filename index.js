import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post("/voice", (req, res) => {
  res.type("text/xml");
  res.send(`
  <Response>
    <Gather input="speech"
            action="https://あなたのRenderURL.onrender.com/voice"
            language="ja-JP"
            timeout="5">
      <Say language="ja-JP">起動確認できました。ご用件をどうぞ。</Say>
    </Gather>
  </Response>
`);
});
app.get("/voice", (req, res) => {
  res.send("サーバーは正常に動いています（GET）");
});
// 🔴 Render必須：PORTを環境から受け取る
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
