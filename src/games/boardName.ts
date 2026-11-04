/**
 * Privacy-preserving leaderboard display name.
 *   "Mei Ling Tan"              -> "Mei T."
 *   "Siti Nurhaliza binti Ahmad" -> "Siti A."
 *   "andrew"                     -> "Andrew"
 *   "李美玲" (no spaces, CJK)     -> "李**"   (surname first, given name masked)
 * Never returns the full multi-part name, never returns phone numbers.
 */
const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const MAX_FIRST_NAME_CHARS = 12;

function capitaliseFirst(chars: string[]): string {
  if (chars.length === 0) return '';
  return chars[0].toLocaleUpperCase() + chars.slice(1).join('');
}

export function formatBoardName(rawName: string): string {
  const cleaned = String(rawName ?? '')
    .normalize('NFC')
    // Strip control characters and digits (digits could leak phone fragments typed into the name field).
    .replace(/[\p{Cc}\p{Cf}\d]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) return 'Player';

  const parts = cleaned.split(' ').filter(Boolean);
  const firstChars = Array.from(parts[0]);

  if (parts.length === 1) {
    if (CJK_PATTERN.test(parts[0]) && firstChars.length >= 2) {
      return firstChars[0] + '*'.repeat(Math.min(firstChars.length - 1, 2));
    }
    return capitaliseFirst(firstChars.slice(0, MAX_FIRST_NAME_CHARS));
  }

  const firstName = capitaliseFirst(firstChars.slice(0, MAX_FIRST_NAME_CHARS));
  const lastInitial = Array.from(parts[parts.length - 1])[0]?.toLocaleUpperCase() ?? '';
  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}
