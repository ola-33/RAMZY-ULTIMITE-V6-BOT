# RAMZY ULTIMATE V6 BOT

RAMZY ULTIMATE V6 BOT includes a simple website/loading screen and a starter WhatsApp bot using Baileys.

## Current commands
- `.menu` / `.help`
- `.ping`
- `.time`
- `.owner`
- `.groupinfo` (groups only)

## Deploy on Render
Create a **Web Service** connected to this repository.
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

## Required Render environment variables
Open your Render service → **Environment** and add:
- `PHONE_NUMBER`: your WhatsApp number with country code, digits only (example format: `2348012345678`; use your own number)
- `OWNER_NUMBER`: owner number with country code, digits only (optional; defaults to PHONE_NUMBER)
- `PREFIX`: optional command prefix, default is `.`
- `TIMEZONE`: optional timezone, default is `Africa/Lagos`
- `AUTH_DIR`: optional auth folder path; if using a persistent disk, set this to a folder on that disk, such as `/var/data/ramzy-auth`

## Pair WhatsApp
1. Add the environment variables above and save them.
2. Redeploy/restart the service.
3. In Render, open **Logs** and find `RAMZY ULTIMATE V6 WHATSAPP PAIRING CODE`.
4. On your own phone, open WhatsApp → Linked devices → Link a device → Link with phone number, then enter the code.
5. Send `.menu` to the bot to test it.

## Session storage warning
WhatsApp login credentials are sensitive. Never commit the auth folder or share pairing codes. Render's local filesystem may be temporary; for persistent login, attach a persistent disk if your plan supports it and set `AUTH_DIR` to a path on that disk. If the service loses its auth folder, you may need to pair again.

## Safety and limitations
- Use only with a WhatsApp account you control and follow WhatsApp's terms.
- This is an early version; media, stickers, AI, and group moderation commands are not included yet.
- Keep API keys and session credentials out of GitHub.