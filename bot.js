const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const authDir = process.env.AUTH_DIR || path.join(__dirname, "auth_info_baileys");
const phoneNumber = (process.env.PHONE_NUMBER || "").replace(/[^0-9]/g, "");
const ownerNumber = (process.env.OWNER_NUMBER || phoneNumber).replace(/[^0-9]/g, "");
const prefix = process.env.PREFIX || ".";

global.ramzyWhatsAppStatus = "initializing";

function getText(message) {
  const m = message?.message;
  if (!m) return "";
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    "";
}

async function startWhatsAppBot() {
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    console.warn("Could not fetch latest WhatsApp Web version; using library default.");
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["RAMZY ULTIMATE V6 BOT", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      global.ramzyWhatsAppStatus = "connecting";
      console.log("Connecting to WhatsApp...");
    }

    if (connection === "open") {
      global.ramzyWhatsAppStatus = "connected";
      console.log("RAMZY ULTIMATE V6 BOT is connected to WhatsApp.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      global.ramzyWhatsAppStatus = loggedOut ? "logged_out" : "disconnected";
      if (loggedOut) {
        console.error("WhatsApp logged out. Clear the saved auth folder and pair again.");
      } else {
        console.log("WhatsApp connection closed; reconnecting...");
        setTimeout(() => startWhatsAppBot().catch(console.error), 5000);
      }
    }

    if (update.qr) {
      console.log("WhatsApp QR received. Use PHONE_NUMBER pairing on a fresh session.");
    }
  });

  // On a fresh session, Baileys can issue a pairing code for your own number.
  // PHONE_NUMBER must be set in Render Environment (country code + number, digits only).
  if (!state.creds.registered && phoneNumber) {
    setTimeout(async () => {
      try {
        if (!sock.authState.creds.registered) {
          const code = await sock.requestPairingCode(phoneNumber);
          console.log("\n========================================");
          console.log("RAMZY ULTIMATE V6 WHATSAPP PAIRING CODE");
          console.log(code);
          console.log("Open WhatsApp > Linked devices > Link a device > Link with phone number.");
          console.log("========================================\n");
        }
      } catch (err) {
        console.error("Could not create pairing code:", err?.message || err);
      }
    }, 3000);
  } else if (!phoneNumber && !state.creds.registered) {
    console.log("Set PHONE_NUMBER in Render Environment to receive a WhatsApp pairing code.");
  }

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        if (!jid || jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;

        const body = getText(msg.message).trim();
        if (!body.startsWith(prefix)) continue;

        const parts = body.slice(prefix.length).trim().split(/\s+/);
        const command = (parts.shift() || "").toLowerCase();
        const args = parts;
        let reply = "";

        switch (command) {
          case "menu":
          case "help":
            reply = [
              "╭━━━〔 RAMZY ULTIMATE V6 〕━━━╮",
              "│ 🤖 Multipurpose WhatsApp Bot",
              "├────────────────────",
              "│ .menu  - Show commands",
              "│ .ping  - Check response",
              "│ .time  - Current server time",
              "│ .owner - Bot owner contact",
              "│ .groupinfo - Group details",
              "╰────────────────────",
              "More features will be added in future updates."
            ].join("\n");
            break;
          case "ping":
            reply = "🏓 RAMZY ULTIMATE V6 is online!";
            break;
          case "time":
            reply = "🕒 Server time: " + new Date().toLocaleString("en-GB", { timeZone: process.env.TIMEZONE || "Africa/Lagos" }) + " (" + (process.env.TIMEZONE || "Africa/Lagos") + ")";
            break;
          case "owner":
            reply = ownerNumber
              ? "👑 Bot owner: https://wa.me/" + ownerNumber
              : "Owner number is not configured yet.";
            break;
          case "groupinfo":
            if (!jid.endsWith("@g.us")) {
              reply = "This command works inside a WhatsApp group.";
              break;
            }
            const metadata = await sock.groupMetadata(jid);
            reply = [
              "📋 GROUP INFO",
              "Name: " + metadata.subject,
              "Members: " + metadata.participants.length,
              "Group ID: " + jid
            ].join("\n");
            break;
          default:
            continue;
        }

        await sock.sendMessage(jid, { text: reply }, { quoted: msg });
      } catch (err) {
        console.error("Command error:", err?.message || err);
      }
    }
  });

  return sock;
}

module.exports = { startWhatsAppBot };