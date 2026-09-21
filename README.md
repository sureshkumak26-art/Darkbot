# Dark Market

Premium cyberpunk digital-goods marketplace with a React storefront, Express API, MongoDB, and Discord.js v14 bot.

## Scope
- Authorized digital goods only
- Server-side payment verification
- Automatic delivery after verified payment
- Discord support and order notifications

## Planned structure
- `client/` React + Vite storefront
- `server/` Express + MongoDB API
- `bot/` Discord.js v14 bot

## Security requirements
- Never commit `.env` files or tokens.
- Use signed payment webhooks before fulfillment.
- Store only goods you own or are authorized to resell.
- Do not store passwords or stolen credentials.
