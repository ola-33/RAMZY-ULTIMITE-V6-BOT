const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "RAMZY ULTIMATE V6 BOT" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RAMZY ULTIMATE V6 BOT web starter listening on port ${PORT}`);
});