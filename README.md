# 🎄 Christmas Pocket Arcade — Street Evangelism Web App

A fast, mobile-first Christmas outreach web app designed for malls, campuses, and busy walkways. Passersby scan a volunteer's physical QR board, play one of 5 Christmas arcade games (3 lives or a move limit, honest scoring, retry anytime), see their **score, rank and the game's all-time Top 3**, unlock a screenshot-proof **Winner Gift Pass** + **personalized downloadable Christmas E-Ticket** (every player gets the gift — lives affect rank, never the gift), save the event to Google/Phone Calendar, and appear instantly in your **PIN-protected Team Outreach Console** for a 1-tap personal WhatsApp follow-up (`$0` SMS/API cost).

---

## Quick Start (Local)

Requires **Node.js 22.5+** (tested on **Node.js 24** with built-in `node:sqlite`).

```powershell
# 1. Install dependencies
npm install

# 2. (Optional) Copy .env.example to .env and set your real Team PIN
Copy-Item .env.example .env

# 3. Start both the API (:3001) and Web UI (:5173)
npm run dev
```

- **Player Arcade Hub:** `http://localhost:5173/?vs=Andrew&target=18`
- **Team Outreach Console:** `http://localhost:5173/team` (default dev PIN: `1225`). There is deliberately no link to it from the player pages — share the URL with your team only.

---

## Street Outreach Flow (35–45 Seconds)

1. **Print or Display Volunteer QR Boards:** Open `/team` → **QR Board Maker**, enter each volunteer's name (e.g., `Andrew`, target `18`), and click **Poster View → Print A4 Board** (or save the QR PNG).
2. **Passerby Scans QR (`/?vs=Andrew&target=18`):** Opens the **5-Game Christmas Arcade Stop**. Every game runs in the same frame: 3-2-1 countdown → live HUD (score, lives or moves, timer) → end banner → results screen.
   - **🏒 Starlight Hockey (2P Live Versus · First to 7 or 45s):** Guest shows a 4-digit room code on their phone and a team member enters it on theirs to smash a glowing puck live across both screens (plus Solo vs Frosty Elf Bot mode). Only the guest is ranked on the public Champion Board.
   - **🛷 Santa Dash (3 lives, 60s cap):** 3-lane runner; coin 1 · gift 3 · star 5 (magnet); hitting a barrier costs a life.
   - **🧱 Block Stack (3 lives, 90s cap):** 8×14 gift Tetris (7-bag, ghost piece, wall kicks); topping out costs a life and clears the upper rows.
   - **⚔️ Berry Slash (3 lives, 60s cap):** slice ornaments; letting one fall or slicing a frost bomb costs a life; 3+ in one swipe is a combo.
   - **🍬 Candy Match (20 moves, 90s cap):** 6×6 swap-3 with cascades and Row Sparklers; invalid swaps are free.
3. **Results Screen:** final score, "New best!", the volunteer's challenge ("Beat Andrew's 18"), the player's all-time rank (or "You'd be #2 — claim your gift to join the board"), and the game's **all-time Top 3** (names shown as "Mei L."). Buttons: **Claim my gift**, **Play again**, **All games**.
4. **Name + Phone Unlock:** Guest enters their name and mobile number (automatically normalized with your default country code, e.g. `+60` or `+65`). Rounds they already played on this phone are attached to their name on the leaderboard.
5. **Gift & Sticky E-Invitation (Saved on Their Phone):**
   - Volunteer verifies the **LIVE PASS** pulsing clock & unique `XMAS-XXXX` code, hands over the physical gift, and taps **Mark Gift Given ✓**.
   - Guest taps **Save Pass**, **Share Invite**, **Open in Maps**, or **Google / Apple Calendar (`.ics`)**, and sees **My ranks** across all 5 games.
   - The pass stays saved on their phone (`localStorage` + `?pass=` link) so they can keep chasing high scores after leaving, without re-entering their details.
6. **Evangelism Command Center, 6 Campaign Targets & Pastoral CRM (`/team`):**
   - **Mission Control (`MasterAnalytics.tsx`):** Auto-syncs every 5s (with `Pause Sync` toggle) to track all **6 Official Campaign Targets** (`1,500` QR Scans & Page Views · `500` Games Started · `500` Registered Contacts · `500` Physical Gifts Handed Out · `100` Games Played AFTER Street Interaction · `100` Shared Invites + Saved Tickets + Calendar Adds), plus 4 clickable Action Queues, 6-stage Conversion Funnel, Evangelist Shepherd Leaderboard, and Live Activity Stream.
   - **Live Contacts Pastoral CRM (`TeamDashboard.tsx`, `ContactCrmDialog.tsx`):** Tap `+ Add Remark / Prayer Note` on any guest to record pastoral remarks & 1-tap quick tags, track the **5-stage Celebration RSVP pipeline** (`New` → `WhatsApp Sent` → `Replied` → `Confirmed Coming` / `Can't Make It`), filter by `Hot Intent` or `Has Remarks`, search across names/phones/evangelists/remarks, send **Stage 1 Invite** or **Stage 2 Service Reminder** WhatsApps, and export a formula-safe CSV.

---

## Deploying Live for Street 4G (Railway / Render / Fly.io)

Because passersby scan on their own mobile data, deploy this single self-contained app (includes `Dockerfile`):

1. Push this folder to your GitHub repository.
2. Create a Web Service + **PostgreSQL** database on **Railway** (or **Render**):
   - **Important on Railway (Link Postgres to Web Service):** Adding a Postgres database to the Railway canvas does **not** automatically inject `DATABASE_URL` into your Web App container. Open your **Web App service → Variables → `+ New Variable` → `Add Reference`** and select **`DATABASE_URL`** from your **Postgres** service (`DATABASE_URL=${{Postgres.DATABASE_URL}}`).
   - Once linked, `/team` displays a green **`PostgreSQL Persistent`** badge in the header, and every contact, pastoral remark, RSVP stage, game leaderboard score, and setting survives every `git push` redeploy automatically.
   - *(Alternative single-node fallback without Postgres)*: Mount a persistent volume at `/data` (`DB_PATH=/data/christmas.db`).
3. Set Environment Variables on the Web Service:
   - `DATABASE_URL` — `${{Postgres.DATABASE_URL}}` (Railway Variable Reference to your Postgres service)
   - `TEAM_PIN` — Your private 4–8 digit team PIN
   - `SESSION_SECRET` — A random 32+ character secret string
   - `NODE_ENV=production`

---

## Verification Commands

```powershell
npm run typecheck   # Strict TypeScript check
npm test            # API, security, leaderboard + property-based game-rule tests (Vitest + fast-check)
npm run build       # Production TypeScript + Vite bundle
npm run test:e2e    # Builds, then plays every game to its results screen on emulated Android phones (Playwright)
```

First-time Playwright setup: `npx playwright install chromium`.

### How scores stay honest

- Each round is started and finished on the server (`POST /api/runs`, `POST /api/runs/:id/finish`); the **server's clock** measures how long it lasted.
- A score is ranked only if it is within the game's cap and its points-per-second limit (`src/games/rules.ts`). Anything else is stored as *rejected* and never reaches the board.
- The leaderboard shows each registered player's best per game, earliest achiever wins ties, names formatted as "Mei L." (digits stripped, Chinese names masked as "李**"). Phone numbers are never exposed.
- Limitation: this raises the bar for cheating but cannot stop a determined person from posting a *plausible* fake score. If the board is abused, the team can see `game_runs` rows in the database.
