import express from "express";
import http from "http";

const app = express();
app.use(express.urlencoded({ extended: true }));

app.post("/voice", (req, res) => {
  res.type("text/xml").send(`
<Response>
  <Say voice="alice">テストです。聞こえますか？</Say>
</Response>
`);
});

app.get("/voice", (req, res) => {
  res.type("text/xml").send(`
<Response>
  <Say voice="alice">テストです。聞こえますか？</Say>
</Response>
`);
});

const server = http.createServer(app);
server.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
