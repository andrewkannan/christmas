# Spec: Christmas Pocket Arcade

## Objective
Turn street/mall/campus Christmas evangelism into a sleek, direct-to-user ~35-second **Apple Snow Glass Christmas Arcade Stop**—and keep guests engaged *after* the street interaction with a saved phone session, always-accessible Apple Wallet-style E-Pass, and full Master Analytics Dashboard:
1. Passersby scan a volunteer's physical QR board (`/?vs=VolunteerName&target=18`).
2. Players tap straight into 1 of **5 zero-tutorial Christmas arcade games** familiar across Malaysia & Asia (**Claw Grab**, **Santa Dash**, **Block Stack**, **Berry Slash**, **Candy Match**). Each round runs in a shared game frame: countdown → live HUD → **3 lives** (Candy Match: **20 moves**) with a time cap → **results screen** (score, personal best, rank, the game's **all-time Top 3**, Play again).
3. Scores are **honest** (no hidden bonuses) and **server-verified** (server-timed rounds, per-game caps in `src/games/rules.ts`). Every player remains 100% gift & invite eligible — lives affect rank, never the gift.
4. Players enter their **Name + WhatsApp Number** in a concise 2-field card once to unlock a **live screenshot-proof Winner Pass**, **personalized downloadable E-Ticket PNG**, **Google/Apple Calendar invite**, and **WhatsApp friend share**.
5. **Persistent Saved Phone Session:** The player's pass and best scores are saved on their phone (`localStorage` + restorable via `?pass=<claimToken>`) so they can keep playing all 5 games during or after the interaction without re-entering their details, while keeping 1-tap access to their Pass.
6. **Master Analytics & Team Console (`/team`):** PIN-protected console providing a real-time **Master Dashboard** of all numbers (total views, unique visitors, return visits, total games played, games played during vs. after interaction, contacts registered, gifts claimed, shared invitations, E-ticket saves, Google/.ics calendar adds, map clicks, per-game stats across all 5 active games + legacy game history, per-volunteer leaderboard, per-guest engagement, and live activity stream) alongside 1-tap `wa.me` follow-up, QR Board Maker, CSV export, and Event Settings.

## Tech Stack
- **Runtime & Backend:** Node.js 24 (`node:sqlite` WAL database), Express 4, Zod validation, TypeScript
- **Frontend:** React 19, Vite 8, Apple Snow Glass semantic CSS tokens (`color-scheme: light`, `accent-color`, `dvh`, `@container`, `:user-invalid`, `<progress>`, `forced-colors` fallbacks), HTML5 Canvas
- **Utilities:** `qrcode` (local SVG/PNG QR board generation), RFC 5545 `.ics` calendar builder
- **Testing:** Vitest 5 + Supertest

## Commands
- **Dev:** `npm run dev` (starts Express API on `:3001` and Vite UI on `:5173`)
- **Build:** `npm run build`
- **Start (Prod):** `npm start`
- **Typecheck:** `npm run typecheck`
- **Test:** `npm test`

## Boundaries
- **Always:** Validate all inputs client- and server-side; enforce `HttpOnly` signed session cookie on `/api/team/*`; never expose guest phone numbers on public endpoints (including `/api/public/pass/:claimToken` and `/api/leaderboard`); show leaderboard names only as "First L."; verify round scores on the server; rate-limit PIN login & public endpoints; sanitize CSV exports against formula injection; ensure 100% keyboard & mobile touch accessibility.
- **Ask First:** Adding external cloud SDKs or paid messaging providers.
- **Never:** Expose guest phone numbers publicly; hard-code production secrets in source control; fail a player out of receiving the Christmas invitation; inflate or fake player scores; link to the team console from player pages.
