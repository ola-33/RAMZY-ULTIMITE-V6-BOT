const express = require("express");
const path = require("path");
const { startWhatsAppBot } = require("./bot");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
app.use(express.json({ limit: "2kb" }));
let lastPairingRequestAt = 0;

// Basic security headers for the public website.
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});

app.use(express.static(publicDir, {
  dotfiles: "deny",
  index: "index.html",
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.post("/api/pairing-code", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const configuredSecret = process.env.PAIRING_SECRET || "";
  if (!configuredSecret || String(req.body?.secret || "") !== configuredSecret) {
    return res.status(401).json({ ok: false, error: "Pairing authorization failed. Set your private PAIRING_SECRET in Render Environment and enter it here." });
  }
  const phoneNumber = String(req.body?.phoneNumber || "").replace(/[^0-9]/g, "");
  if (phoneNumber.length < 8 || phoneNumber.length > 15) {
    return res.status(400).json({ ok: false, error: "Enter your full phone number with country code, digits only." });
  }
  if (Date.now() - lastPairingRequestAt < 30000) {
    return res.status(429).json({ ok: false, error: "Please wait 30 seconds before requesting another pairing code." });
  }
  if (typeof global.ramzyPairingRequest !== "function") {
    return res.status(503).json({ ok: false, error: "WhatsApp pairing is not ready. Ensure ENABLE_WHATSAPP=true in Render Environment and wait for the service to restart." });
  }
  lastPairingRequestAt = Date.now();
  try {
    const code = await global.ramzyPairingRequest(phoneNumber);
    return res.status(200).json({ ok: true, code });
  } catch (err) {
    console.error("Pairing-code request failed:", err?.message || err);
    return res.status(400).json({ ok: false, error: err?.message || "Could not create a pairing code. Check Render Logs." });
  }
});

app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    name: "RAMZY ULTIMITE V6 BOT",
    whatsapp: global.ramzyWhatsAppStatus || "pairing_disabled"
  });
});

// Do not expose stack traces or environment details to visitors.
app.use((err, _req, res, _next) => {
  console.error("Web request error:", err?.message || "Unknown error");
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RAMZY ULTIMITE V6 BOT web service listening on port ${PORT}`);
});

// WhatsApp remains disabled unless ENABLE_WHATSAPP=true is explicitly set.
startWhatsAppBot().catch((err) => {
  console.error("WhatsApp bot failed to start:", err?.message || err);
});
