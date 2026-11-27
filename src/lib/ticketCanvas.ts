import type { EventSettings } from '../types.ts';
import {
  KING_OF_GLORY_INVITE,
  VENUE_ADDRESS_LABEL,
  VENUE_FULL_LABEL,
} from '../invite/kingOfGloryInvite.ts';

function formatReadableDateClient(eventDateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(eventDateIso);
  if (!match) return `${KING_OF_GLORY_INVITE.dateLabel} · ${KING_OF_GLORY_INVITE.timeLabel}`;
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

/** Draws the Manger & Crown emblem centered at (cx, cy). */
function drawMangerCrownCrest(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1): void {
  ctx.save();
  ctx.translate(cx - 60 * scale, cy - 46 * scale);
  ctx.scale(scale, scale);

  // Gold Crown
  ctx.fillStyle = '#f5d27b';
  ctx.beginPath();
  ctx.moveTo(38, 30);
  ctx.lineTo(34, 8);
  ctx.lineTo(48, 20);
  ctx.lineTo(60, 4);
  ctx.lineTo(72, 20);
  ctx.lineTo(86, 8);
  ctx.lineTo(82, 30);
  ctx.closePath();
  ctx.fill();

  for (const [px, py] of [
    [34, 7],
    [60, 3.5],
    [86, 7],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.roundRect(37, 29, 46, 5, 1.5);
  ctx.fill();

  // Golden Straw
  ctx.fillStyle = '#e9b65c';
  ctx.beginPath();
  const strawPoints: ReadonlyArray<[number, number]> = [
    [18, 46],
    [24, 36],
    [28, 44],
    [34, 33],
    [40, 43],
    [46, 34],
    [52, 43],
    [58, 33],
    [64, 43],
    [70, 34],
    [76, 43],
    [82, 33],
    [88, 44],
    [94, 36],
    [100, 46],
  ];
  strawPoints.forEach(([sx, sy], idx) => {
    if (idx === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fill();

  // Wooden Manger Crib
  ctx.fillStyle = '#b97b32';
  ctx.beginPath();
  ctx.moveTo(14, 45);
  ctx.lineTo(106, 45);
  ctx.lineTo(96, 66);
  ctx.lineTo(24, 66);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(30, 64);
  ctx.lineTo(44, 64);
  ctx.lineTo(30, 90);
  ctx.lineTo(20, 90);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(76, 64);
  ctx.lineTo(90, 64);
  ctx.lineTo(100, 90);
  ctx.lineTo(90, 90);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** Draws a decorative gold corner flourish at (x, y) rotated into each corner. */
function drawCornerFlourish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  flipX: 1 | -1,
  flipY: 1 | -1,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX, flipY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(0, 26, 12, 44, 38, 52);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(26, 0, 44, 12, 52, 38);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintTicketCanvas(params: {
  guestName: string;
  settings: EventSettings;
}): HTMLCanvasElement | null {
  const { guestName, settings } = params;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const serifFont = '"Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
  const sansFont = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  // Warm invitation parchment canvas backdrop
  const bgColor = '#f3ead6';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle gold/crimson glow behind the stamp card
  const topAura = ctx.createRadialGradient(540, 260, 10, 540, 260, 700);
  topAura.addColorStop(0, 'rgba(155, 20, 24, 0.16)');
  topAura.addColorStop(0.6, 'rgba(200, 146, 42, 0.12)');
  topAura.addColorStop(1, 'rgba(155, 20, 24, 0)');
  ctx.fillStyle = topAura;
  ctx.fillRect(0, 0, canvas.width, 980);

  const cardX = 64;
  const cardY = 58;
  const cardW = canvas.width - 128;
  const cardH = canvas.height - 116;

  // Outer Royal Crimson Postage-Stamp Card
  ctx.save();
  ctx.shadowColor = 'rgba(42, 16, 11, 0.24)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 18;
  const outerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  outerGrad.addColorStop(0, '#8d1115');
  outerGrad.addColorStop(0.5, '#7c0c0f');
  outerGrad.addColorStop(1, '#580709');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 36);
  ctx.fill();
  ctx.restore();

  // Scalloped Postage-Stamp Perforations around the outer edge
  ctx.fillStyle = bgColor;
  const stepX = 56;
  for (let x = cardX + 46; x <= cardX + cardW - 46; x += stepX) {
    ctx.beginPath();
    ctx.arc(x, cardY, 12, 0, Math.PI * 2);
    ctx.arc(x, cardY + cardH, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const stepY = 56;
  for (let y = cardY + 46; y <= cardY + cardH - 46; y += stepY) {
    ctx.beginPath();
    ctx.arc(cardX, y, 12, 0, Math.PI * 2);
    ctx.arc(cardX + cardW, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner Warm Cream Paper Invitation Sheet
  const paperX = cardX + 26;
  const paperY = cardY + 26;
  const paperW = cardW - 52;
  const paperH = cardH - 52;

  ctx.fillStyle = '#fbf6e8';
  ctx.beginPath();
  ctx.roundRect(paperX, paperY, paperW, paperH, 24);
  ctx.fill();

  // Royal Crimson & 24k Gold Filigree Hero Header inside the paper
  const headerH = 515;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(paperX + 14, paperY + 14, paperW - 28, headerH, 20);
  const topGrad = ctx.createLinearGradient(paperX, paperY, paperX + paperW, paperY + headerH);
  topGrad.addColorStop(0, '#5c0709');
  topGrad.addColorStop(0.5, '#9b1418');
  topGrad.addColorStop(1, '#5c0709');
  ctx.fillStyle = topGrad;
  ctx.fill();

  const goldSpot = ctx.createRadialGradient(540, paperY + 160, 10, 540, paperY + 160, 420);
  goldSpot.addColorStop(0, 'rgba(245, 210, 123, 0.34)');
  goldSpot.addColorStop(1, 'rgba(245, 210, 123, 0)');
  ctx.fillStyle = goldSpot;
  ctx.fill();
  ctx.restore();

  // Inner Gold Filigree Frame & Corner Flourishes inside Header
  const frameX = paperX + 32;
  const frameY = paperY + 32;
  const frameW = paperW - 64;
  const frameH = headerH - 36;
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 210, 123, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(frameX, frameY, frameW, frameH, 16);
  ctx.stroke();
  ctx.restore();

  drawCornerFlourish(ctx, frameX + 14, frameY + 14, 1, 1, '#f5d27b');
  drawCornerFlourish(ctx, frameX + frameW - 14, frameY + 14, -1, 1, '#f5d27b');
  drawCornerFlourish(ctx, frameX + 14, frameY + frameH - 14, 1, -1, '#f5d27b');
  drawCornerFlourish(ctx, frameX + frameW - 14, frameY + frameH - 14, -1, -1, '#f5d27b');

  // Gold Manger & Crown Crest
  drawMangerCrownCrest(ctx, 540, paperY + 106, 1.05);

  // Church Brand & Bilingual Tagline
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5d27b';
  ctx.font = `800 20px ${sansFont}`;
  ctx.fillText(
    `${KING_OF_GLORY_INVITE.churchShortName.toUpperCase()}  ·  ${KING_OF_GLORY_INVITE.churchFullName}`,
    540,
    paperY + 194
  );

  ctx.fillStyle = 'rgba(251, 246, 232, 0.92)';
  ctx.font = `700 21px ${sansFont}`;
  ctx.fillText(KING_OF_GLORY_INVITE.tagline.toUpperCase(), 540, paperY + 230);

  // Display Serif Invitation Headline
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 54px ${serifFont}`;
  ctx.fillText('Come celebrate Christmas with us', 540, paperY + 298);

  // Warm Invitation Lead
  ctx.fillStyle = '#fde68a';
  ctx.font = `600 24px ${sansFont}`;
  ctx.fillText('You’re warmly invited to a Christmas Eve evening with us.', 540, paperY + 350);

  // Greatest Gift Promise Ribbon inside Hero
  const promiseY = paperY + 435;
  ctx.fillStyle = 'rgba(245, 210, 123, 0.16)';
  ctx.strokeStyle = 'rgba(245, 210, 123, 0.58)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(160, promiseY - 36, 760, 56, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = `700 22px ${sansFont}`;
  ctx.fillText('✨ Join our Celebration Service & receive the Greatest Gift there', 540, promiseY - 1);

  // Honored Guest Name on Cream Paper
  const guestY = paperY + 590;
  ctx.fillStyle = '#8b5e14';
  ctx.font = `800 20px ${sansFont}`;
  ctx.fillText('PERSONAL VIP INVITATION FOR', 540, guestY);

  ctx.fillStyle = '#7c0c0f';
  ctx.font = `900 54px ${serifFont}`;
  ctx.fillText(guestName, 540, guestY + 62);

  // Perforated Gold Ticket Divider
  const divY = paperY + 695;
  ctx.strokeStyle = 'rgba(200, 146, 42, 0.55)';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(paperX + 46, divY);
  ctx.lineTo(paperX + paperW - 46, divY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Date & Time
  ctx.fillStyle = '#8b5e14';
  ctx.font = `800 20px ${sansFont}`;
  ctx.fillText('CHRISTMAS EVE · DATE & TIME', 540, divY + 54);

  ctx.fillStyle = '#2a1810';
  ctx.font = `800 35px ${sansFont}`;
  ctx.fillText(
    `${formatReadableDateClient(settings.eventDateIso)}  (Arrive by ${KING_OF_GLORY_INVITE.arriveByLabel})`,
    540,
    divY + 102
  );

  // Venue (Menara Zurich fallback if legacy default)
  const rawVenue = (settings.venueName || '').trim();
  const displayVenue = !rawVenue || /Starlight Atrium/i.test(rawVenue) ? VENUE_FULL_LABEL : rawVenue;
  const rawAddr = (settings.venueAddress || '').trim();
  const displayAddr = !rawAddr || /Central Walk/i.test(rawAddr) ? VENUE_ADDRESS_LABEL : rawAddr;

  ctx.fillStyle = '#8b5e14';
  ctx.font = `800 20px ${sansFont}`;
  ctx.fillText('VENUE & GUIDELINE ROUTE', 540, divY + 166);

  ctx.fillStyle = '#2a1810';
  ctx.font = `800 34px ${sansFont}`;
  const venueLines = wrapLines(ctx, displayVenue, 760);
  let vy = divY + 212;
  for (const vLine of venueLines.slice(0, 2)) {
    ctx.fillText(vLine, 540, vy);
    vy += 40;
  }

  if (displayAddr) {
    ctx.fillStyle = '#604535';
    ctx.font = `600 24px ${sansFont}`;
    const addrLines = wrapLines(ctx, displayAddr, 760);
    for (const aLine of addrLines.slice(0, 2)) {
      ctx.fillText(aLine, 540, vy + 2);
      vy += 32;
    }
  }

  // Christmas Blessing Gift Entitlement Footer
  const giftClean = (settings.giftDescription || 'Christmas Blessing Gift').replace(/\s+Pack$/i, '');
  const giftBoxY = paperY + paperH - 146;
  ctx.fillStyle = '#fff9eb';
  ctx.strokeStyle = '#c8922a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(148, giftBoxY, 784, 112, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7c0c0f';
  ctx.font = `900 27px ${sansFont}`;
  ctx.fillText(`🎁  ${giftClean.toUpperCase()}`, 540, giftBoxY + 48);

  ctx.fillStyle = '#8b5e14';
  ctx.font = `700 22px ${sansFont}`;
  ctx.fillText('Show our team to collect with us · Free Entry', 540, giftBoxY + 84);

  return canvas;
}

/**
 * Generates an Apple Wallet-style Christmas VIP Invitation Pass as a PNG Blob.
 */
export function renderPersonalizedETicketBlob(params: {
  guestName: string;
  redemptionCode?: string;
  settings: EventSettings;
}): Promise<Blob | null> {
  const canvas = paintTicketCanvas(params);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Generates an Apple Wallet-style Christmas VIP Invitation Pass PNG data URL.
 */
export function renderPersonalizedETicketPng(params: {
  guestName: string;
  redemptionCode?: string;
  settings: EventSettings;
}): string {
  const canvas = paintTicketCanvas(params);
  return canvas ? canvas.toDataURL('image/png') : '';
}

