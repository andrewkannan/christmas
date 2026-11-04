# Spec: Christmas Pocket Arcade

## Objective
Turn street/mall/campus Christmas evangelism into a warm, joyful ~35-second interactive experience—and keep guests engaged *after* the street interaction with a saved phone session, always-accessible E-Invitation, and full Master Analytics Dashboard:
1. Passersby scan a volunteer's physical QR board (`/?vs=VolunteerName&target=18`).
2. Players pick 1 of 3 zero-tutorial 15–20s arcade games (**Gift & Star Rush**, **2P Sleigh Tap Duel**, **Starlight Drop + Icebreaker**).
3. Every player unlocks a win or *Christmas Bonus Chest* (100% gift & invite eligibility).
4. Players enter their **Name + Phone Number** once to unlock a **screenshot-proof Winner Gift Pass**, **personalized downloadable E-Ticket PNG**, **Google/Apple Calendar invite**, and **WhatsApp friend share**.
5. **Persistent Saved Phone Session:** The player's pass and session are saved on their phone (`localStorage` + restorable via `?pass=<claimToken>`) so they can keep playing all 3 games during or after the interaction without re-entering their details, while keeping 1-tap access to their E-Invitation.
6. **Master Analytics & Team Console (`/team`):** PIN-protected console providing a real-time **Master Dashboard** of all numbers (total views, unique visitors, return visits, total games played, games played during vs. after interaction, contacts registered, gifts claimed, shared invitations, E-ticket saves, Google/.ics calendar adds, map clicks, per-game stats, per-volunteer leaderboard, per-guest engagement, and live activity stream) alongside 1-tap `wa.me` follow-up, QR Board Maker, CSV export, and Event Settings.

## Tech Stack
- **Runtime & Backend:** Node.js 24 (`node:sqlite` WAL database), Express 4, Zod validation, TypeScript
- **Frontend:** React 19, Vite 8, semantic modern CSS tokens (`dvh`, `@container`, `:user-invalid`, `<progress>`), HTML5 Canvas
- **Utilities:** `qrcode` (local SVG/PNG QR board generation), RFC 5545 `.ics` calendar builder
- **Testing:** Vitest 5 + Supertest

## Commands
- **Dev:** `npm run dev` (starts Express API on `:3001` and Vite UI on `:5173`)
- **Build:** `npm run build`
- **Start (Prod):** `npm start`
- **Typecheck:** `npm run typecheck`
- **Test:** `npm test`

## Boundaries
- **Always:** Validate all inputs client- and server-side; enforce `HttpOnly` signed session cookie on `/api/team/*`; never expose guest phone numbers on public endpoints (including `/api/public/pass/:claimToken`); rate-limit PIN login & public endpoints; sanitize CSV exports against formula injection; ensure 100% keyboard & mobile touch accessibility.
- **Ask First:** Adding external cloud SDKs or paid messaging providers.
- **Never:** Expose guest phone numbers publicly; hard-code production secrets in source control; fail a player out of receiving the Christmas invitation.
