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
 * Generates a crisp personalized Christmas E-Invitation PNG data URL on an HTML5 Canvas.
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

  // Deep evergreen festive background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#0b1c15');
  bgGrad.addColorStop(1, '#142f24');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative warm starlight glow
  const glow = ctx.createRadialGradient(540, 210, 20, 540, 210, 420);
  glow.addColorStop(0, 'rgba(245, 185, 66, 0.34)');
  glow.addColorStop(1, 'rgba(245, 185, 66, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, 640);

  // Outer gold frame
  ctx.strokeStyle = '#f5b942';
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  // Bethlehem 8-point star emblem at top
  ctx.save();
  ctx.translate(540, 165);
  ctx.fillStyle = '#ffd369';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const outerR = i % 2 === 0 ? 58 : 34;
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    const midAngle = angle + Math.PI / 8;
    ctx.lineTo(Math.cos(midAngle) * 14, Math.sin(midAngle) * 14);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Church / Host header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5b942';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(settings.churchName.toUpperCase(), 540, 275);

  // Main Event Title
  ctx.fillStyle = '#fbf6ec';
  ctx.font = '800 62px system-ui, -apple-system, sans-serif';
  const titleLines = wrapLines(ctx, settings.eventTitle, 860);
  let y = 355;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 540, y);
    y += 72;
  }

  // Event Subtitle
  ctx.fillStyle = '#bed0c5';
  ctx.font = '500 30px system-ui, -apple-system, sans-serif';
  const subLines = wrapLines(ctx, settings.eventSubtitle, 820);
  for (const line of subLines.slice(0, 2)) {
    ctx.fillText(line, 540, y + 10);
    y += 42;
  }

  // Cream Ticket Stub Card inside
  const cardTop = 560;
  const cardHeight = 640;
  ctx.fillStyle = '#fbf6ec';
  ctx.beginPath();
  ctx.roundRect(96, cardTop, canvas.width - 192, cardHeight, 28);
  ctx.fill();

  // Guest VIP header
  ctx.fillStyle = '#d93829';
  ctx.font = '800 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('PERSONAL CHRISTMAS E-INVITATION', 540, cardTop + 72);

  ctx.fillStyle = '#13251d';
  ctx.font = '800 50px system-ui, -apple-system, sans-serif';
  ctx.fillText(`For ${guestName}`, 540, cardTop + 142);

  // Divider line
  ctx.strokeStyle = '#d4c5ab';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, cardTop + 190);
  ctx.lineTo(canvas.width - 150, cardTop + 190);
  ctx.stroke();
  ctx.setLineDash([]);

  // Date & Venue details
  ctx.fillStyle = '#455a50';
  ctx.font = '700 25px system-ui, -apple-system, sans-serif';
  ctx.fillText('DATE & TIME', 540, cardTop + 252);

  ctx.fillStyle = '#13251d';
  ctx.font = '800 36px system-ui, -apple-system, sans-serif';
  ctx.fillText(formatReadableDateClient(settings.eventDateIso), 540, cardTop + 300);

  ctx.fillStyle = '#455a50';
  ctx.font = '700 25px system-ui, -apple-system, sans-serif';
  ctx.fillText('LOCATION', 540, cardTop + 378);

  ctx.fillStyle = '#13251d';
  ctx.font = '800 34px system-ui, -apple-system, sans-serif';
  const venueLines = wrapLines(ctx, settings.venueName, 760);
  let vy = cardTop + 424;
  for (const vLine of venueLines.slice(0, 2)) {
    ctx.fillText(vLine, 540, vy);
    vy += 42;
  }

  if (settings.venueAddress) {
    ctx.fillStyle = '#455a50';
    ctx.font = '500 26px system-ui, -apple-system, sans-serif';
    const addrLines = wrapLines(ctx, settings.venueAddress, 760);
    for (const aLine of addrLines.slice(0, 2)) {
      ctx.fillText(aLine, 540, vy + 4);
      vy += 34;
    }
  }

  // Pass code badge at bottom of card
  ctx.fillStyle = '#13251d';
  ctx.font = '700 26px ui-monospace, monospace';
  ctx.fillText(`PASS CODE: ${redemptionCode}  ·  FREE ADMISSION`, 540, cardTop + cardHeight - 44);

  // Footer note
  ctx.fillStyle = '#f5b942';
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('Bring a friend — everyone is welcome this Christmas!', 540, 1265);

  return canvas.toDataURL('image/png');
}
