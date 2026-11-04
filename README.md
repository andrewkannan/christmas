# 🎄 Christmas Pocket Arcade — Street Evangelism Web App

A fast, mobile-first Christmas outreach web app designed for malls, campuses, and busy walkways. Passersby scan a volunteer's physical QR board, play a 15–20s arcade mini-game (with a 100% win / *Bonus Christmas Chest* mercy guarantee), unlock a screenshot-proof **Winner Gift Pass** + **personalized downloadable Christmas E-Ticket**, save the event to Google/Phone Calendar, and appear instantly in your **PIN-protected Team Outreach Console** for a 1-tap personal WhatsApp follow-up (`$0` SMS/API cost).

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
- **Team Outreach Console:** `http://localhost:5173/team` (default dev PIN: `1225`)

---

## Street Outreach Flow (35–45 Seconds)

1. **Print or Display Volunteer QR Boards:** Open `/team` → **QR Board Maker**, enter each volunteer's name (e.g., `Andrew`, target `18`), and click **Poster View → Print A4 Board** (or save the QR PNG).
2. **Passerby Scans QR (`/?vs=Andrew&target=18`):** Sees *"🎄 Andrew challenges you! Beat 18 pts"* and picks any 1 of 3 zero-tutorial games:
   - **⚡ Gift & Star Rush (20s Solo):** Slide sleigh left/right to catch gifts and the **Bethlehem Star** (2x Golden Fever).
   - **🥊 Sleigh Tap Duel (15s 2-Player, 1 Phone):** Hold one phone between volunteer and guest—tap opposite ends to pull the Christmas sleigh!
   - **🎯 Starlight Drop & Spark (15s Chill + 1 Trivia):** Drop 3 stars down the Plinko pegboard + answer 1 warm Christmas curiosity question that naturally starts a conversation.
3. **Name + Phone Unlock:** Guest enters their name and mobile number (automatically normalized with your default country code, e.g. `+60` or `+65`).
4. **Gift & Sticky E-Invitation (Saved on Their Phone):**
   - Volunteer verifies the **LIVE PASS** pulsing clock & unique `XMAS-XXXX` code, hands over the physical gift, and taps **Mark Gift Given ✓**.
   - Guest taps **Save My E-Invitation Image**, **Share Invite on WhatsApp**, **Open Venue Directions in Maps**, or **Google / Phone Calendar (`.ics`)**.
   - Their Winner Pass & E-Invitation stay saved automatically on their phone (`localStorage` + `?pass=` link) so they can tap **🎮 Play More Arcade Games** anytime after leaving—chasing high scores across all 3 games without ever re-entering their Name or Phone!
5. **1-Tap Volunteer WhatsApp Handshake & Master Analytics Dashboard (`/team`):**
   - On `/team` → **Live Contacts**, the volunteer taps **💬 Send WhatsApp Invite**—opening WhatsApp (`wa.me`) pre-filled with a personal note and a direct `?pass=` link back to the guest's saved E-Ticket & arcade profile.
   - On `/team` → **📊 Master Dashboard**, track every metric live (auto-synced every 5s): Total Page Views, Unique Phones, QR Scans, Return Session Views, Total Games Played, **Games Played During vs. AFTER Outreach**, Contacts & Visitor Conversion %, Gifts Claimed, **Shared Invitations**, E-Ticket Saves, Calendar Adds, Map Clicks, Team WhatsApps Sent, Outreach Funnel, Mini-Game Breakdown, Volunteer QR Leaderboard, and Live Activity Stream.

---

## Deploying Live for Street 4G (Render / Railway / Fly.io)

Because passersby scan on their own mobile data, deploy this single self-contained app (includes `Dockerfile`):

1. Push this folder to a private GitHub repository.
2. Create a Web Service on **Railway** or **Render** (Docker or Node 24 runtime):
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Persistent Volume (recommended):** Mount a volume at `/data` and set `DB_PATH=/data/christmas.db` so contacts persist across restarts.
3. Set Environment Variables:
   - `TEAM_PIN` — Your private 4–8 digit team PIN
   - `SESSION_SECRET` — A random 32+ character secret string
   - `NODE_ENV=production`

---

## Verification Commands

```powershell
npm run typecheck   # Strict TypeScript check
npm test            # Automated API, phone normalization, CSV & PIN security tests
npm run build       # Production TypeScript + Vite bundle
```
