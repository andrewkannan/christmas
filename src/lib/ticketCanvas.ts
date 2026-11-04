import type { EventSettings } from '../types.ts';

function formatReadableDateClient(eventDateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(eventDateIso);
  if (!match) return eventDateIso;
  const [, year, month, day, hourStr, minStr] = match;
  const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const hour24 = Number(hourStr);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${weekday}, ${Number(day)} ${monthName} ${year} · ${hour12}:${minStr} ${period}`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const probe = current ? `${current} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = probe;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function paintTicketCanvas(params: {
  guestName: string;
  redemptionCode: string;
  settings: EventSettings;
}): HTMLCanvasElement | null {
  const { guestName, redemptionCode, settings } = params;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bgColor = '#f4f2ee';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Warm ambient Christmas aura behind the card
  const topAura = ctx.createRadialGradient(540, 180, 10, 540, 180, 620);
  topAura.addColorStop(0, 'rgba(215, 0, 21, 0.16)');
  topAura.addColorStop(0.6, 'rgba(245, 158, 11, 0.08)');
  topAura.addColorStop(1, 'rgba(215, 0, 21, 0)');
  ctx.fillStyle = topAura;
  ctx.fillRect(0, 0, canvas.width, 860);

  const cardX = 76;
  const cardY = 76;
  const cardW = canvas.width - 152;
  const cardH = canvas.height - 152;

  // Main Elevated Wallet Card
  ctx.save();
  ctx.shadowColor = 'rgba(24, 16, 18, 0.16)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 52);
  ctx.fill();
  ctx.restore();

  // Velvet Crimson & Gold Spotlight Header Band
  const headerH = 360;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, headerH, [52, 52, 0, 0]);
  const topGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
  topGrad.addColorStop(0, '#7f000d');
  topGrad.addColorStop(0.5, '#c40014');
  topGrad.addColorStop(1, '#8c000f');
  ctx.fillStyle = topGrad;
  ctx.fill();

  const goldSpot = ctx.createRadialGradient(540, cardY + 110, 10, 540, cardY + 110, 320);
  goldSpot.addColorStop(0, 'rgba(254, 240, 138, 0.34)');
  goldSpot.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = goldSpot;
  ctx.fill();
  ctx.restore();

  // Faceted Gold Star Crest
  ctx.save();
  ctx.translate(540, 180);
  const starGrad = ctx.createLinearGradient(-44, -44, 44, 44);
  starGrad.addColorStop(0, '#fffbeb');
  starGrad.addColorStop(0.5, '#fde047');
  starGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = starGrad;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const outerR = i % 2 === 0 ? 46 : 26;
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    const midAngle = angle + Math.PI / 8;
    ctx.lineTo(Math.cos(midAngle) * 11, Math.sin(midAngle) * 11);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Church Eyebrow
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef08a';
  ctx.font = '800 24px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(`${settings.churchName.toUpperCase()}  ·  VIP WINNER PASS`, 540, 272);

  // Event Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 54px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const titleLines = wrapLines(ctx, settings.eventTitle, 800);
  ctx.fillText(titleLines[0] || settings.eventTitle, 540, 348);

  // Guest Name & Gift Entitlement
  const guestY = 505;
  ctx.fillStyle = '#6e6e73';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('VIP GUEST', 540, guestY);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '900 58px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(guestName, 540, guestY + 66);

  // Gift Pill
  const giftLabel = `GIFT UNLOCKED · ${settings.giftDescription.toUpperCase()}`;
  ctx.font = '800 23px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const pillW = Math.min(780, Math.max(420, ctx.measureText(giftLabel).width + 68));
  ctx.fillStyle = '#fef9ec';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(540 - pillW / 2, guestY + 98, pillW, 56, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#9a4406';
  ctx.fillText(giftLabel, 540, guestY + 134);

  // True Semicircular Ticket Cutouts + Perforated Tear Line
  const divY = 726;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cardX, divY, 26, 0, Math.PI * 2);
  ctx.arc(cardX + cardW, divY, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d2d2d7';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cardX + 44, divY);
  ctx.lineTo(cardX + cardW - 44, divY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Date & Location
  ctx.fillStyle = '#6e6e73';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('DATE & TIME', 540, divY + 68);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '800 38px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(formatReadableDateClient(settings.eventDateIso), 540, divY + 118);

  ctx.fillStyle = '#6e6e73';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('LOCATION', 540, divY + 190);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '800 36px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const venueLines = wrapLines(ctx, settings.venueName, 760);
  let vy = divY + 238;
  for (const vLine of venueLines.slice(0, 2)) {
    ctx.fillText(vLine, 540, vy);
    vy += 42;
  }

  if (settings.venueAddress) {
    ctx.fillStyle = '#515158';
    ctx.font = '600 26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    const addrLines = wrapLines(ctx, settings.venueAddress, 760);
    for (const aLine of addrLines.slice(0, 2)) {
      ctx.fillText(aLine, 540, vy + 4);
      vy += 34;
    }
  }

  // Redemption Code Stage at Bottom
  ctx.fillStyle = '#fff1f2';
  ctx.strokeStyle = 'rgba(215, 0, 21, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(160, 1094, 760, 114, 30);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#9f0010';
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('PASS CODE  ·  FREE ENTRY & GIFT', 540, 1134);

  ctx.fillStyle = '#d70015';
  ctx.font = '900 40px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(redemptionCode, 540, 1184);

  return canvas;
}

/**
 * Generates an Apple Wallet-style Christmas VIP Pass as a PNG Blob (ideal for Web Share API & Object URLs).
 */
export function renderPersonalizedETicketBlob(params: {
  guestName: string;
  redemptionCode: string;
  settings: EventSettings;
}): Promise<Blob | null> {
  const canvas = paintTicketCanvas(params);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Generates an Apple Wallet-style Christmas VIP Pass PNG data URL.
 */
export function renderPersonalizedETicketPng(params: {
  guestName: string;
  redemptionCode: string;
  settings: EventSettings;
}): string {
  const canvas = paintTicketCanvas(params);
  return canvas ? canvas.toDataURL('image/png') : '';
}
