const express = require("express");
const path = require("path");
const { startWhatsAppBot } = require("./bot");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "RAMZY ULTIMATE V6 BOT",
    whatsapp: global.ramzyWhatsAppStatus || "starting"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RAMZY ULTIMATE V6 BOT web service listening on port ${PORT}`);
});

startWhatsAppBot().catch((err) => {
  console.error("WhatsApp bot failed to start:", err?.message || err);
});