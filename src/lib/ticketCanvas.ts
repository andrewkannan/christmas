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

/**
 * Generates an Apple Wallet-style Snow & Crimson Christmas E-Pass PNG data URL.
 */
export function renderPersonalizedETicketPng(params: {
  guestName: string;
  redemptionCode: string;
  settings: EventSettings;
}): string {
  const { guestName, redemptionCode, settings } = params;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean Apple Snow backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#f5f5f7');
  bgGrad.addColorStop(1, '#ececf1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle ambient Christmas glow
  const redGlow = ctx.createRadialGradient(540, 180, 10, 540, 180, 520);
  redGlow.addColorStop(0, 'rgba(215, 0, 21, 0.14)');
  redGlow.addColorStop(1, 'rgba(215, 0, 21, 0)');
  ctx.fillStyle = redGlow;
  ctx.fillRect(0, 0, canvas.width, 720);

  // Main Elevated White Wallet Card
  const cardX = 84;
  const cardY = 84;
  const cardW = canvas.width - 168;
  const cardH = canvas.height - 168;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 48);
  ctx.fill();
  ctx.restore();

  // Crimson Top Header Band inside Wallet Card
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 340, [48, 48, 0, 0]);
  const topGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 340);
  topGrad.addColorStop(0, '#e11d2e');
  topGrad.addColorStop(1, '#b80012');
  ctx.fillStyle = topGrad;
  ctx.fill();
  ctx.restore();

  // Gold Star Emblem
  ctx.save();
  ctx.translate(540, 185);
  ctx.fillStyle = '#ffd369';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const outerR = i % 2 === 0 ? 44 : 26;
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    const midAngle = angle + Math.PI / 8;
    ctx.lineTo(Math.cos(midAngle) * 11, Math.sin(midAngle) * 11);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Church Name in Header
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(`${settings.churchName.toUpperCase()}  ·  CHRISTMAS PASS`, 540, 272);

  // Event Title in Header
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const titleLines = wrapLines(ctx, settings.eventTitle, 780);
  ctx.fillText(titleLines[0] || settings.eventTitle, 540, 352);

  // Guest Name Block
  let y = 505;
  ctx.fillStyle = '#6e6e73';
  ctx.font = '700 24px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('GUEST', 540, y);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '800 56px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(guestName, 540, y + 66);

  // Event Subtitle
  if (settings.eventSubtitle) {
    ctx.fillStyle = '#515158';
    ctx.font = '500 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    const subLines = wrapLines(ctx, settings.eventSubtitle, 760);
    let sy = y + 124;
    for (const line of subLines.slice(0, 2)) {
      ctx.fillText(line, 540, sy);
      sy += 38;
    }
  }

  // Perforated Divider
  const divY = 740;
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
  ctx.font = '700 23px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('WHEN', 540, divY + 68);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '800 38px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(formatReadableDateClient(settings.eventDateIso), 540, divY + 118);

  ctx.fillStyle = '#6e6e73';
  ctx.font = '700 23px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('WHERE', 540, divY + 195);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '800 36px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const venueLines = wrapLines(ctx, settings.venueName, 760);
  let vy = divY + 244;
  for (const vLine of venueLines.slice(0, 2)) {
    ctx.fillText(vLine, 540, vy);
    vy += 42;
  }

  if (settings.venueAddress) {
    ctx.fillStyle = '#515158';
    ctx.font = '500 26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    const addrLines = wrapLines(ctx, settings.venueAddress, 760);
    for (const aLine of addrLines.slice(0, 2)) {
      ctx.fillText(aLine, 540, vy + 4);
      vy += 34;
    }
  }

  // Redemption Pill Box at Bottom
  ctx.fillStyle = '#f5f5f7';
  ctx.beginPath();
  ctx.roundRect(190, 1110, 700, 96, 24);
  ctx.fill();

  ctx.fillStyle = '#d70015';
  ctx.font = '800 32px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`PASS ${redemptionCode}  ·  FREE ENTRY`, 540, 1168);

  return canvas.toDataURL('image/png');
}
