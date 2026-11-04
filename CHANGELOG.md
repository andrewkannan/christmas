# Changelog

All notable changes to **Christmas Pocket Arcade** are documented in this file.

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
