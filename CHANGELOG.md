# Changelog

All notable changes to **Christmas Pocket Arcade** are documented in this file.

## [1.6.3] - 2026-11-05

### Added
- **Team Members Management & Personal Passcode-Only Sign-In (`src/team/TeamMembersPanel.tsx`, `src/team/TeamLogin.tsx`, `server/auth.ts`, `server/routes.ts`):**
  - Team members can now sign in at `/team` using **only their personal alphanumeric passcode** (4–24 letters or numbers, case-insensitive, e.g. `AK2708` or `ak2708` — initials + DOB or random numbers) with zero username/email prompt, while preserving Master `TEAM_PIN` admin access.
  - Added a dedicated **`Team Members`** tab in the `CCC JB Bilingual Command Center` where Team Leaders / Admins can add members (`Full Name`, `Personal Login Passcode` with `Show`/`Hide` + 1-tap `Suggest Code`, and `Evangelist / Team Member` vs `Team Leader / Admin` role cards), copy/send a 1-tap **WhatsApp Login Invite**, rotate passcodes in a native `<dialog closedby="any">` modal, toggle roles, pause/enable logins, or remove members with self-lockout protection.
  - Added a live signed-in identity badge in the Command Center header (`Andrew Kannan · Leader` / `Evangelist` / `Team Admin · Master PIN`), automatic pre-fill + 1-tap Team Roster chips in **QR Board Maker**, and team roster suggestions in CRM Evangelist reassignment.
- **Salted Scrypt Passcode Encryption, Role Authorization & PostgreSQL Persistence (`server/auth.ts`, `server/db.ts`, `server/postgres.ts`):**
  - Passcodes are normalized (`UPPERCASE`, trimmed), indexed by a domain-separated `SHA-256` digest (`UNIQUE`) with collision checks against existing members and `TEAM_PIN`, and verified via salted `crypto.scryptSync` + `crypto.timingSafeEqual` (hashes and digests never leave the server).
  - Enforced backend role-based authorization (`requireTeamAdmin` vs `requireActiveTeamAuth`) and live session verification on every `/api/team/*` request so pausing or removing a member immediately revokes their active session cookie (`401`).
  - Persisted `team_users` in Railway PostgreSQL (`PostgresPersistenceAdapter` startup hydration + write-through `upsertTeamUser` / `deleteTeamUser`) so team accounts and passcodes survive `git push` container redeploys.
- **Tests (`tests/api.test.ts`, `tests/postgresPersistence.test.ts`, `e2e/arcade.spec.ts`):** Added unit/integration, simulated container-wipe, and Playwright E2E coverage for adding team members, case-insensitive passcode-only sign-in, role permissions, self-lockout prevention, and live session revocation.

## [1.6.2] - 2026-11-05

### Added
- **Interactive Click & Activity Audit Logs Across `CCC JB Bilingual Command Center` (`src/team/ActivityLogDialog.tsx`, `src/team/MasterAnalytics.tsx`, `src/team/TeamDashboard.tsx`):**
  - Every metric in **Mission Control** is now clickable to inspect the exact chronological log of **who** performed the click (Guest Name, `+Phone` with 1-click Copy, `XMAS-XXXX`, RSVP stage, or `Unregistered Street Visitor · Device #tag`), **what** exact action they took, **which evangelist QR board** they scanned (`On Street` vs `After Street`), and **exact timestamp**:
    - All **6 Official Campaign Target Scorecards** (`Total QR Scans & Page Views`, `Games Started`, `Registered Contacts`, `Physical Gifts Handed Out`, `Games Played AFTER Street Interaction`, `Shared Invites + Saved Tickets + Calendar Adds`).
    - All **6 Supporting Pulse Chips**, including **`Maps & Waze Clicks`** (`X Maps · Y Waze`), `Unique Phones`, `Saved-Session Returns`, `VIP Invite Opens`, and `Team WhatsApps Sent`.
    - All **6 Conversion Funnel Stages**, **Arcade Cabinet** game rows, **Evangelist** `Log` buttons, **Live Activity Stream** rows, and the hero **`Full Click Log`** button.
  - Native `<dialog closedby="any">` audit log inspector with 16 category filter pills (`All`, `Maps & Waze`, `Google Maps`, `Waze`, `Shares + Tickets + Calendar`, `WhatsApp Shares`, `E-Tickets Saved`, `Calendar Adds`, etc.), removable scope chips (`leadId`, `gameId`, `volunteer`), live search across guest name/phone/code/evangelist, `@container` mobile stacked cards, and 1-click **`Open CRM`**.
- **Separate Google Maps vs. Waze Click Tracking & Lifecycle Audit Events (`WinnerPass.tsx`, `server/db.ts`, `server/routes.ts`):**
  - Separated Waze clicks (`waze_click`) from Google Maps clicks (`maps_click`) on the VIP Celebration Invitation while keeping `mapsDirectionsClicks` aggregated (`googleMapsClicks + wazeClicks`) and adding `Google Maps Clicks` and `Waze Clicks` columns to `/api/team/leads/export.csv`.
  - Recorded server-verified `'lead_registered'` and `'gift_claimed'` events in `analytics_events` (persisted to PostgreSQL via `syncEventById`) with automatic `UNION ALL` historical fallbacks and retroactive `visitor_id -> lead_id` guest resolution on `GET /api/team/activity-log` (protected by `requireTeamAuth`).
- **Per-Contact Click & Activity Timelines (`src/team/ContactCrmDialog.tsx`, `src/team/TeamDashboard.tsx`):**
  - Added `Maps/Waze` click counts and a **`Log`** button on every `Live Contacts` row, plus `X Maps · Y Waze` snapshot stats and a live **Complete Click & Activity Log** timeline inside every guest's CRM modal.
- **Tests (`tests/api.test.ts`, `e2e/arcade.spec.ts`):** Added `/api/team/activity-log` auth, server-only event spoofing rejection, `maps_click` vs `waze_click` filtering, search/evangelist/lead scoping tests, and Playwright E2E coverage across desktop & mobile `/team`.

## [1.6.1] - 2026-11-05

### Fixed
- **Railway PostgreSQL Persistence Across `git push` Redeploys (`server/postgres.ts`, `server/db.ts`, `server/routes.ts`, `server/index.ts`):**
  - Added `pg`-backed relational PostgreSQL persistence (`settings`, `leads`, `analytics_events`, `game_runs`) automatically activated whenever `DATABASE_URL` (or `DATABASE_PRIVATE_URL`, `POSTGRES_URL`, `DATABASE_PUBLIC_URL`, or `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`) is configured on the web service.
  - Hydrates local SQLite inside an atomic startup transaction before `app.listen(...)` opens HTTP traffic, resets `sqlite_sequence` auto-increment counters cleanly, and awaits PostgreSQL write-through on every mutating endpoint (`POST /api/leads`, `PATCH /api/team/leads/:id`, `PUT /api/team/settings`, `POST /api/public/claim/:token`, `POST /api/events`, `POST /api/runs`, `POST /api/runs/:id/finish`) plus `SIGTERM`/`SIGINT` shutdown flush.
  - Automatically negotiates plain TCP for Railway internal private networking (`*.railway.internal`) and TLS for Railway public proxy / cloud PostgreSQL URLs, with startup warm-up retries and credential-redacted logging.
- **Live `/team` Storage Persistence Indicator & Unlinked `DATABASE_URL` Alert (`TeamDashboard.tsx`, `styles.css`):**
  - Added a live header badge (`PostgreSQL Persistent` vs `Local SQLite` vs `Ephemeral SQLite (Unlinked)`) and an accessible `role="alert"` warning banner when running in Railway/production without a linked `DATABASE_URL` variable reference (`${{Postgres.DATABASE_URL}}`), plus `GET /api/health` storage diagnostics.
- **Tests (`tests/postgresPersistence.test.ts`):** Added unit and simulated container-wipe integration tests proving contacts, pastoral remarks, Confirmed RSVPs, leaderboards, custom campaign targets, and auto-increment ID sequences survive full container replacement.

## [1.6.0] - 2026-11-05

### Added
- **Evangelism Command Center & 6 Official Campaign Target Scorecards (`MasterAnalytics.tsx`, `EventSettingsForm.tsx`, `server/db.ts`):**
  - Added live progress scorecards with semantic `<progress>` bars, completion `%`, and exact remaining counts for all **6 official evangelism targets** (configurable in `/team` with 1-click reset to defaults):
    1. **Total QR Scans & Page Views:** `1,500`
    2. **Games Started:** `500`
    3. **Registered Contacts (Name + Phone):** `500`
    4. **Physical Gifts Handed Out:** `500`
    5. **Games Played AFTER Street Interaction:** `100`
    6. **Shared Invites + Saved Tickets + Calendar Adds:** `100`
  - Added an **Executive Campaign Scoreboard** showing overall pace `%` and **4 clickable Action Queue cards** (`Needs 1st WhatsApp`, `Unclaimed Street Gift`, `Hot Intent Guests`, `Confirmed Coming`) that jump straight into filtered `Live Contacts`.
  - Upgraded the **Evangelist Shepherd Leaderboard** with per-volunteer RSVP counts, remarks counts, and 1-tap filtering into each evangelist's guest list.
- **Live Contacts Pastoral CRM & Remarks Modal (`ContactCrmDialog.tsx`, `TeamDashboard.tsx`, `teamHelpers.ts`, `server/routes.ts`):**
  - Added inline `+ Add Remark / Prayer Note` and editable remark cards on every live contact, opening a native `<dialog>` modal (`showModal()`, `closedby="any"` + backdrop-click fallback, isolated draft state immune to 5s live auto-sync).
  - Added **7 1-tap Quick-Tag chips** (`Interested in service`, `Coming with family`, `Needs transport / ride`, `Mandarin / Bilingual`, `Youth / Student`, `Prayer request`, `Follow up Dec 23`) plus a 1,000-char pastoral remarks field with `notes_updated_at` timestamping.
  - Added a **5-stage Celebration RSVP Pipeline** (`New`, `WhatsApp Sent`, `Replied`, `Confirmed Coming`, `Can't Make It`), **Engagement Heat Scoring** (`Hot Intent`, `Warm Guest`, `Street Contact`), evangelist reassignment `<datalist>`, `Copy Phone` / `Copy VIP Link`, **Pause/Resume Auto-Sync**, full-text search across **Remarks**, and `@container (width < 760px)` stacked mobile contact cards.
  - Added **2-Stage WhatsApp Outreach** (`1st WhatsApp Invite` + `Service Reminder WhatsApp` template) and enriched CSV export (`Follow-Up Status`, `Engagement Tier`, `Remarks`, `Remarks Updated At`) protected by `sanitizeCsvCell`.
- **Tests (`tests/teamHelpers.test.ts`, `tests/api.test.ts`, `e2e/arcade.spec.ts`):** Added unit, integration, CSV formula-injection security, and Playwright `/team` E2E tests covering all 6 campaign targets, remarks persistence, RSVP pipeline transitions, and remarks search.

## [1.5.0] - 2026-11-05

### Added
- **2-Phone Live 4-Digit Versus — Starlight Air Hockey (`StarlightAirHockey.tsx`, `HockeyMatchmaker.tsx`, `hockeyLogic.ts`, `server/hockeyRooms.ts`):**
  - Replaced Claw Grab (`claw-machine`) with **Starlight Hockey (`ice-hockey`)**, a 60fps cross-phone neon Christmas ice rink (`First to 7 Goals or 45s`) with a top **Opponent Phone Radar**, blazing **Starlight Portal** seam, roaming **Star Gate** (`+5` Turbo Puck), and final-12s **Double Puck Fever**.
  - **4-Digit Room Code Matchmaking:** Guests open `Show 4-Digit Code` (`1000`–`9999`) while evangelists or friends tap `Enter 4-Digit Code` on their own phone to pair live over Express SSE (`text/event-stream`) + HTTP input sync with automatic polling and Frosty Elf Bot disconnect fallback (zero new npm dependencies).
  - **Solo vs Elf Bot Mode:** Guests playing on 1 phone or replaying from their saved VIP Pass at home can launch **Play Solo vs Elf Bot** immediately.
  - **Guest-Only Leaderboard Protection & Challenger Summary (`GameShell.tsx`):** Evangelists/challengers joining via a 4-digit code (`role === 'joiner'`) never write to `game_runs` or Rank `#1–#3`, and receive a dedicated **Challenger Match Summary** with a 1-tap `Join Next 4-Digit Code` button; when an evangelist joins with their display name, their name automatically credits `volunteerName` attribution on the guest's run and claimed pass.
- **Property & E2E Tests (`tests/hockeyLogic.property.test.ts`, `e2e/arcade.spec.ts`):** Added `fast-check` physics/perspective invariants, `HockeyRoomManager` lifecycle/token security tests, and dual-browser-context 2-phone live versus Playwright E2E coverage.

### Changed
- **CCC JB Bilingual Branding (`server/db.ts`, `WinnerPass.tsx`, `api.ts`):** Updated default organization branding from `Hope Community` to **`CCC JB Bilingual`** across the header, VIP Celebration Service Invitation badge, fallbacks, and an automatic startup SQLite migration for existing databases while preserving historical `'claw-machine'` analytics and CSV records.

## [1.4.0] - 2026-11-05

### Added
- **Royal VIP Celebration Service Invitation (`WinnerPass.tsx`, `ticketCanvas.ts`):** Promoted the Velvet-Crimson & 24k Gold VIP Celebration Invitation to the hero center of the Winner Pass (and downloadable 1080×1350 PNG), highlighting *"Join our Celebration Service & receive the Greatest Gift there"*.
- **Live Celebration Countdown Tab & Dual Navigation (`WinnerPass.tsx`, `EventSettingsForm.tsx`):** Added a live `d / h / m / s` countdown tab directly beneath the VIP Invitation plus side-by-side **Google Maps** and **Waze** navigation buttons (with optional custom `wazeUrl` in `/team`).
- **One-Click Smart Calendar (`WinnerPass.tsx`, `server/routes.ts`):** Unified Apple Calendar (`inline` `.ics` on iOS/iPadOS/macOS Safari) and Android/Google Calendar into a single 1-click **Add to Calendar** button.
- **Viral WhatsApp Friend Challenge (`WinnerPass.tsx`, `App.tsx`, `ArcadeLobby.tsx`):** Replaced plain share text with **Challenge Friends to Play** (`/?friend=<FirstName>&target=<Score>`), displaying a live friend-challenge banner on the Lobby while keeping `/team` volunteer attribution strictly scoped to `?vs=`.
- **Unlimited All-Time Player Rankings Modal (`FullLeaderboardModal.tsx`, `server/db.ts`, `server/routes.ts`):** Added `GET /api/leaderboard/:gameId` and a native `<dialog>` Hall of Champions showing the unlimited full ranking history of all players using strictly each player's single all-time best verified score (`"Mei L."` initials, zero phone PII).
- **Glowing Rank 1–3 Cards, Filter Tabs & Crown Quest (`TopThree.tsx`, `WinnerPass.tsx`, `ArcadeLobby.tsx`):** Added metallic Gold/Silver/Bronze glow and specular sheen sweeps for Rank `#1–#3`, `All Games / Top 1–3 / Chase #1` tabs, and a `Crown Quest` replay motivator with exact point-gap nudges.
- **Polyphonic Christmas, Game & Victory Music (`src/lib/sound.ts`):** Added Web Audio lookahead music scenes for Lobby/Pass Christmas background music (`We Wish You a Merry Christmas` + `Deck the Halls`), 5 distinct game soundtracks, and `Joy to the World` victory chorus controlled by the top-bar Mute toggle.

### Changed
- **Gift Redemption Flow (`WinnerPass.tsx`, `ClaimForm.tsx`, `server/db.ts`):** Removed the `SHOW CODE TO COLLECT GIFT / XMAS-XXXX` display block and standardized gift naming to **Christmas Blessing Gift** (*"Show our team to collect with us"*), with an automatic SQLite migration updating legacy default settings.

## [1.3.0] - 2026-11-04

### Added
- **Shining 3D Trophy & Custom Vector Emblem Suite (`Icons.tsx`):** Animated gold, silver, and bronze 3D trophies with metallic specular sheen sweeps and twinkling starlight sparkles, custom sculpted SVG cabinet emblems for all 5 games, and 20+ accessible vector UI icons replacing OS emojis across player screens.
- **Victory Celebrations (`ConfettiBurst.tsx`, `sound.ts`, `GameShell.tsx`):** GPU-composited confetti and golden starlight burst, multi-oscillator celebratory fanfare, smooth score roll-up animation, and a Velvet-Crimson & 24k Gold **Victory Stage** spotlighting projected/locked ranks.
- **3-Slot Championship Podium (`TopThree.tsx`):** Always-visible Gold `#1`, Silver `#2`, and Bronze `#3` medal podium slots showing live leaders, unregistered player rank previews (`Ready to lock`), and open podium invitations (`Open`).
- **Interactive 5-Game Trophy Board (`WinnerPass.tsx`):** Returning VIPs can launch, defend `#1`, or chase higher ranks on any of the 5 cabinets with one tap straight from their Winner Pass.

### Fixed
- **iOS Safari "Save Pass" (`WinnerPass.tsx`, `ticketCanvas.ts`):** Replaced `<a href="data:image/png;base64,...">` (which hijacked Safari's address bar with `data:`) with `canvas.toBlob` + Web Share API (`navigator.share({ files })` on touch devices) and `URL.createObjectURL(blob)` fallback.
- **Mobile Viewport & Gift Entitlement Layout:** Added semicircular perforated ticket notches, single-line non-wrapping gift entitlement pill, HTML `v`-mode regex escaping on phone inputs, and iOS bottom safe-area clearance (`calc(5.5rem + env(safe-area-inset-bottom, 0px))`).

## [1.2.0] - 2026-11-04

### Added
- **Complete game rounds:** every game now runs in one shared frame — 3-2-1 countdown, live HUD (score, lives or moves, timer), a pause after each lost life, auto-pause when the phone locks, an end banner, and a **results screen** with final score, personal best, the volunteer's challenge, rank, and **Play again**.
- **Lives and fail states:** 3 lives in Claw Grab (empty grab), Santa Dash (barrier), Block Stack (top-out) and Berry Slash (dropped treat or frost bomb); **20-move limit** in Candy Match. Every round also has a time cap so it always ends on the street.
- **All-time leaderboards:** Top 3 per game on the results screen, the #1 score on each lobby tile, and **My ranks** across all 5 games on the pass. Names are shown as "Mei L."; phone numbers are never exposed.
- **Server-verified scores:** rounds are timed by the server and checked against per-game caps; implausible scores are kept for audit but never ranked.
- **Tests:** leaderboard/API tests, property-based tests (fast-check) for Tetris and Candy Match rules, name privacy and score plausibility, plus Playwright end-to-end tests on emulated Android phones (`npm run test:e2e`).

### Changed
- Removed the hidden "mercy bonus" that silently inflated final scores — scores are now exactly what the player earned. Everyone still gets the gift: lives affect rank, never the gift.
- Removed the **Team** button from player pages; the console is reached only via the `/team` link + PIN.
- Block Stack board is now 8×14 with a 7-bag randomizer, wall kicks and lock delay.

## [1.1.0] - 2026-11-04

### Added
- **5 Christmas Arcade Stop Games** tailored to Malaysia & Asia arcade favorites:
  - **Claw Grab (`claw-machine`)** — 22s UFO crane catcher with laser aim guide, articulated gold prongs, prize chute, and Final 5s Golden Magnet Claw.
  - **Santa Dash (`santa-dash`)** — 20s 3-lane snowy sprint with swipe/tap/keyboard lane hops, barriers, gifts, coins, and Star Magnet Rush.
  - **Block Stack (`gift-tetris`)** — 25s 8×12 Christmas Gift Tetris blitz with ghost preview, pre-gapped starter rows for instant line clears, and tactile 4-button pad.
  - **Berry Slash (`gift-slash`)** — 20s ornament & candy slicer with glowing blade trail, split halves, multi-slice combos, frost bombs, and `Space` accessibility slash.
  - **Candy Match (`candy-match`)** — 25s 6×6 swap-3 blitz with 5 color-and-shape distinct candies, Row Sparklers, idle move hints, and deadlock prevention.
- `@supports not (accent-color)` progressive enhancement fallback and `@media (forced-colors: active)` high-contrast borders.

### Changed
- **Apple Snow Glass Redesign**: Reworked lobby, HUD, claim form, downloadable E-Ticket PNG, and Apple Wallet-style Winner Pass into a crisp, minimal-copy light theme (`#F5F5F7` / `#FFFFFF`, frosted glass header, `#D70015` crimson, `#0F6840` pine green, `#B45309` gold) meeting `>= 4.5:1` text and `>= 3:1` control boundary contrast.
- **Backwards-Compatible Game Analytics**: `MasterAnalytics` and API schemas accept all 5 active games while preserving historical SQLite records from legacy `v1.0.0` game IDs (`gift-rush`, `tap-duel`, `starlight-drop`).

## [1.0.0] - 2026-11-04

### Added
- Initial Christmas Pocket Arcade outreach platform with volunteer `?vs=` QR boards, Name + WhatsApp unlock, live screenshot-proof Winner Pass, downloadable PNG E-Ticket, Google & `.ics` Calendar invites, persistent phone sessions, and PIN-protected `/team` Master Analytics Console.
