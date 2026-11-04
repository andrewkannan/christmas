# Changelog

All notable changes to **Christmas Pocket Arcade** are documented in this file.

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
