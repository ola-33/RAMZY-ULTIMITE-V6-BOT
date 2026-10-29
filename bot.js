const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const authDir = process.env.AUTH_DIR || path.join(__dirname, "auth_info_baileys");
const phoneNumber = (process.env.PHONE_NUMBER || "").replace(/[^0-9]/g, "");
const ownerNumber = (process.env.OWNER_NUMBER || phoneNumber).replace(/[^0-9]/g, "");
const prefix = process.env.PREFIX || ".";
const timezone = process.env.TIMEZONE || "Africa/Lagos";
const games = new Map();

global.ramzyWhatsAppStatus = "pairing_disabled";

function getText(message) {
  const m = message?.message;
  if (!m) return "";
  const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m;
  return inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    inner.buttonsResponseMessage?.selectedButtonId ||
    inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
    "";
}

function unwrapMessage(message) {
  let current = message;
  while (current?.ephemeralMessage?.message || current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message) {
    current = current.ephemeralMessage?.message || current.viewOnceMessage?.message || current.viewOnceMessageV2?.message;
  }
  return current || {};
}

function getQuotedMessage(msg) {
  const base = unwrapMessage(msg.message);
  const context = base.extendedTextMessage?.contextInfo ||
    base.imageMessage?.contextInfo ||
    base.videoMessage?.contextInfo ||
    base.documentMessage?.contextInfo;
  if (!context?.quotedMessage) return null;
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      id: context.stanzaId,
      participant: context.participant,
      fromMe: false
    },
    message: context.quotedMessage
  };
}

async function askAI(prompt) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return "🤖 AI chat is not configured yet. The bot owner must add AI_API_KEY in Render Environment. Optional: set AI_MODEL and AI_BASE_URL too.";
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are RAMZY ULTIMATE V6, a helpful WhatsApp assistant. Keep answers clear and concise." },
        { role: "user", content: prompt.slice(0, 6000) }
      ],
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("AI provider returned HTTP " + response.status);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "I couldn't generate an answer just now.";
}

function getSenderNumber(msg) {
  const sender = msg.key.participant || msg.key.remoteJid || "";
  return sender.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

async function startWhatsAppBot() {
  // Pairing is intentionally off until the owner chooses to enable it.
  if (String(process.env.ENABLE_WHATSAPP || "false").toLowerCase() !== "true") {
    global.ramzyWhatsAppStatus = "pairing_disabled";
    console.log("WhatsApp pairing is disabled. Set ENABLE_WHATSAPP=true when you are ready to connect.");
    return null;
  }

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
  });

  if (!state.creds.registered && phoneNumber) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("\n========================================");
        console.log("RAMZY ULTIMATE V6 WHATSAPP PAIRING CODE");
        console.log(code);
        console.log("Keep this code private.");
        console.log("========================================\n");
      } catch (err) {
        console.error("Could not create pairing code:", err?.message || err);
      }
    }, 3000);
  } else if (!phoneNumber && !state.creds.registered) {
    console.log("Set PHONE_NUMBER in Render Environment when you are ready to pair.");
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
        const senderNumber = getSenderNumber(msg);
        const isOwner = Boolean(ownerNumber && senderNumber === ownerNumber);
        const isGroup = jid.endsWith("@g.us");
        let reply = "";
        let mentions;

        switch (command) {
          case "menu":
          case "help":
            reply = [
              "╭━━━〔 RAMZY ULTIMATE V6 〕━━━╮",
              "│ 🤖 MULTIPURPOSE WHATSAPP BOT",
              "├────────────────────",
              "│ GENERAL",
              "│ .menu / .help  - Commands",
              "│ .ping           - Response test",
              "│ .time           - Local time",
              "│ .ai <question>  - AI assistant",
              "│ .sticker        - Sticker from quoted image",
              "│ .getmedia       - Return quoted media as file",
              "│ .groupinfo      - Group details",
              "│ .admins         - List group admins",
              "│ .guess          - Start number game",
              "│ .quiz           - Quick quiz",
              "│ .answer <text>  - Answer quiz",
              "│ .owner          - Owner contact",
              "│ .botstatus      - Bot status (owner)",
              "│ .tagall         - Mention members (admin/owner)",
              "╰────────────────────",
              "Prefix: " + prefix,
              "AI requires AI_API_KEY in Render Environment."
            ].join("\n");
            break;
          case "ping":
            reply = "🏓 RAMZY ULTIMATE V6 is online!";
            break;
          case "time":
            reply = "🕒 " + new Date().toLocaleString("en-GB", { timeZone: timezone }) + " (" + timezone + ")";
            break;
          case "owner":
            reply = ownerNumber ? "👑 Bot owner: https://wa.me/" + ownerNumber : "Owner number is not configured yet.";
            break;
          case "botstatus":
            if (!isOwner) { reply = "⛔ Owner only."; break; }
            reply = "👑 RAMZY ULTIMATE V6\nWhatsApp: " + (global.ramzyWhatsAppStatus || "unknown") +
              "\nNode: " + process.version + "\nUptime: " + Math.floor(process.uptime()) + " seconds";
            break;
          case "ai":
          case "ask":
            if (!args.length) { reply = "Usage: " + prefix + "ai What is photosynthesis?"; break; }
            reply = await askAI(args.join(" "));
            break;
          case "sticker": {
            const quoted = getQuotedMessage(msg);
            const quotedBody = unwrapMessage(quoted?.message);
            const image = quotedBody.imageMessage;
            if (!quoted || !image) {
              reply = "Reply to an image with " + prefix + "sticker. Image stickers are supported in this starter version.";
              break;
            }
            const buffer = await downloadMediaMessage(quoted, "buffer", {}, {
              logger: pino({ level: "silent" }),
              reuploadRequest: sock.updateMediaMessage
            });
            const webp = await sharp(buffer, { limitInputPixels: 16000000 })
              .resize(512, 512, { fit: "inside", withoutEnlargement: true })
              .webp({ quality: 82 })
              .toBuffer();
            await sock.sendMessage(jid, { sticker: webp }, { quoted: msg });
            continue;
          }
          case "getmedia": {
            const quoted = getQuotedMessage(msg);
            if (!quoted) { reply = "Reply to an image, video, audio, or document with " + prefix + "getmedia."; break; }
            const q = unwrapMessage(quoted.message);
            const type = Object.keys(q).find(k => ["imageMessage", "videoMessage", "audioMessage", "documentMessage"].includes(k));
            if (!type) { reply = "That quoted message does not contain supported media."; break; }
            const mediaBuffer = await downloadMediaMessage(quoted, "buffer", {}, {
              logger: pino({ level: "silent" }),
              reuploadRequest: sock.updateMediaMessage
            });
            const media = q[type];
            const mimetype = media.mimetype || (type === "imageMessage" ? "image/jpeg" : type === "videoMessage" ? "video/mp4" : type === "audioMessage" ? "audio/mpeg" : "application/octet-stream");
            const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
            await sock.sendMessage(jid, {
              document: mediaBuffer,
              mimetype,
              fileName: media.fileName || ("ramzy-media." + ext),
              caption: "📥 Media returned by RAMZY ULTIMATE V6"
            }, { quoted: msg });
            continue;
          }
          case "groupinfo":
          case "admins":
          case "tagall": {
            if (!isGroup) { reply = "This command works inside a WhatsApp group."; break; }
            const metadata = await sock.groupMetadata(jid);
            const participant = metadata.participants.find(p => p.id === msg.key.participant || p.id.split(":")[0] === msg.key.participant);
            const senderIsAdmin = Boolean(participant?.admin);
            if (command === "groupinfo") {
              reply = ["📋 GROUP INFO", "Name: " + metadata.subject, "Members: " + metadata.participants.length, "Group ID: " + jid].join("\n");
            } else if (command === "admins") {
              const admins = metadata.participants.filter(p => p.admin);
              reply = "🛡️ GROUP ADMINS\n" + admins.map(p => "• @" + p.id.split("@")[0].split(":")[0]).join("\n");
              mentions = admins.map(p => p.id);
            } else {
              if (!isOwner && !senderIsAdmin) { reply = "⛔ Only group admins or the bot owner can use .tagall."; break; }
              if (metadata.participants.length > 100) { reply = "Group is large; tagall is limited to groups with 100 members or fewer."; break; }
              mentions = metadata.participants.map(p => p.id);
              reply = "📢 Attention everyone!\n" + mentions.map(id => "@" + id.split("@")[0].split(":")[0]).join(" ");
            }
            break;
          }
          case "guess": {
            const number = Math.floor(Math.random() * 10) + 1;
            games.set(jid, { type: "guess", answer: String(number), expires: Date.now() + 120000 });
            reply = "🎮 Guess the number from 1 to 10! Send " + prefix + "answer <number>. You have 2 minutes.";
            break;
          }
          case "quiz": {
            const questions = [
              { q: "Which planet is known as the Red Planet?", a: "mars" },
              { q: "How many days are in a leap year?", a: "366" },
              { q: "What is 9 × 7?", a: "63" },
              { q: "What is the capital of Nigeria?", a: "abuja" }
            ];
            const chosen = questions[Math.floor(Math.random() * questions.length)];
            games.set(jid, { type: "quiz", answer: chosen.a, expires: Date.now() + 120000 });
            reply = "🧠 QUICK QUIZ\n" + chosen.q + "\nReply with " + prefix + "answer <your answer>. You have 2 minutes.";
            break;
          }
          case "answer": {
            const game = games.get(jid);
            if (!game || game.expires < Date.now()) {
              games.delete(jid);
              reply = "No active game. Start one with " + prefix + "guess or " + prefix + "quiz.";
              break;
            }
            const answer = args.join(" ").trim().toLowerCase();
            if (answer === game.answer.toLowerCase()) {
              games.delete(jid);
              reply = "🎉 Correct! You win. Start another round with " + prefix + "guess or " + prefix + "quiz.";
            } else {
              reply = "❌ Not quite. Try again!";
            }
            break;
          }
          default:
            continue;
        }

        if (reply) await sock.sendMessage(jid, { text: reply, ...(mentions?.length ? { mentions } : {}) }, { quoted: msg });
      } catch (err) {
        console.error("Command error:", err?.message || err);
        try {
          await sock.sendMessage(msg.key.remoteJid, { text: "⚠️ That command failed. Check Render Logs for details." }, { quoted: msg });
        } catch {}
      }
    }
  });
  return sock;
}

module.exports = { startWhatsAppBot };