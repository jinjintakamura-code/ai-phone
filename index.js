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
              timeout="5"
              actionOnEmptyResult="true">
        <Say language="ja-JP">
          ご用件をどうぞ。
        </Say>
      </Gather>

      <!-- ここが超重要：無音でも必ず戻す -->
      <Redirect method="POST">
        https://ai-phone-1.onrender.com/voice
      </Redirect>
    </Response>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);
