# Contact the car owner

A page for a QR sticker on the car: someone next to the car can call the owner,
open Telegram, or send a short report (what happened, a comment, a photo and,
optionally, their location). Live: https://kyrylohn.github.io/car-link-bio/

## How it works

- `index.html`, `css/style.css`, `js/script.js`: static page, Ukrainian and English,
  light and dark themes. No build step.
- `worker/`: Cloudflare Worker `car-notify` that forwards reports and visit
  notifications to a Telegram group. The bot token lives only in the Worker as a secret.

The Worker exposes:

- `POST /report`: multipart form with `issue`, `text`, `name`, `lang`, optional `photo`
  and `lat`/`lon`/`acc`; sends a message or photo, plus a map pin if a location was shared
- `POST /visit`: sends a "page opened" message (location by IP, network, device), returns a signed `ref`
- `POST /update`: edits that message with time on page and actions (call, Telegram, report)
- `GET /status?t=ticket`: the owner's reply to a report, shown live on the page
- `POST /tg`: Telegram webhook for the reply buttons under each report ("coming in 5 min" etc.), stored in KV

## Deploy the Worker

```bash
cd worker
npx wrangler deploy
npx wrangler secret put BOT_TOKEN        # Telegram bot token, never commit it
npx wrangler secret put WEBHOOK_SECRET   # random string, also passed to setWebhook as secret_token
```

Set `CHAT_ID` in `wrangler.toml` to the Telegram group ID.

## QR code

Point the QR code at `https://kyrylohn.github.io/car-link-bio/?qr=windshield`.
The `qr` value shows up in the visit notification, so different stickers can be told apart.

## License

MIT, see [LICENSE](LICENSE).
