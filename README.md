# RAMZY ULTIMITE V6 BOT

RAMZY ULTIMITE V6 BOT includes a website/loading screen and a WhatsApp bot starter built with Baileys.

## Commands added
- `.menu` / `.help` — command list
- `.ping` — test response
- `.time` — local time (Africa/Lagos by default)
- `.ai <question>` — AI assistant (requires an API key)
- Reply to an image with `.sticker` — convert it to a WhatsApp sticker
- Reply to media with `.getmedia` — return it as a file
- `.groupinfo` — group details
- `.admins` — mention/list group admins
- `.tagall` — mention group members; limited to 100-member groups and only group admins or bot owner
- `.guess` — start a number guessing game
- `.quiz` then `.answer <answer>` — quick quiz
- `.owner` — owner contact
- `.botstatus` — bot status (owner only)

## Deploy on Render
Create a **Web Service** connected to this repository.
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

## WhatsApp is intentionally disabled for now
The bot will **not** start a WhatsApp connection unless you explicitly set `ENABLE_WHATSAPP=true`.

When you are ready to pair later, add `PHONE_NUMBER` with your country code and digits only (example format: `2348012345678`), set `ENABLE_WHATSAPP=true`, then redeploy. The pairing code will appear in Render Logs. Do not share it.

## Optional Render environment variables
- `ENABLE_WHATSAPP`: set to `true` only when ready to pair; defaults to `false`
- `PHONE_NUMBER`: WhatsApp number with country code, digits only
- `OWNER_NUMBER`: owner number with country code, digits only; defaults to PHONE_NUMBER
- `PREFIX`: command prefix; default is a dot
- `TIMEZONE`: timezone; default `Africa/Lagos`
- `AUTH_DIR`: auth folder path; for persistent disk, use a path on that disk, e.g. `/var/data/ramzy-auth`
- `AI_API_KEY`: required to enable AI replies; keep secret and do not put it in GitHub
- `AI_MODEL`: optional model name; defaults to `gpt-4o-mini`
- `AI_BASE_URL`: optional OpenAI-compatible API base URL; defaults to `https://api.openai.com/v1`

## Session storage warning
WhatsApp login credentials are sensitive. Never commit the auth folder or share pairing codes. Render's local filesystem may be temporary; for persistent login, attach a persistent disk if your plan supports it and set `AUTH_DIR` to a path on that disk. If the service loses its auth folder, you may need to pair again.

## Safety and limitations
- Use only with a WhatsApp account you control and follow WhatsApp's terms.
- AI requires a valid provider API key and may incur separate charges.
- Sticker conversion currently supports replying to an image; video-to-sticker is not implemented yet.
- Media retrieval supports quoted images, videos, audio, and documents. Use only media you have permission to download/share.
- Games are in-memory and reset when the service restarts.
- This is a starter bot, not yet a fully tested production bot.