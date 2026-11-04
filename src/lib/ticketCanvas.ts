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
  settings: EventSettings;
}): HTMLCanvasElement | null {
  const { guestName, settings } = params;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const bgColor = '#f4f1ec';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Warm ambient Christmas aura behind the card
  const topAura = ctx.createRadialGradient(540, 200, 10, 540, 200, 660);
  topAura.addColorStop(0, 'rgba(200, 0, 20, 0.18)');
  topAura.addColorStop(0.55, 'rgba(245, 158, 11, 0.11)');
  topAura.addColorStop(1, 'rgba(200, 0, 20, 0)');
  ctx.fillStyle = topAura;
  ctx.fillRect(0, 0, canvas.width, 920);

  const cardX = 72;
  const cardY = 72;
  const cardW = canvas.width - 144;
  const cardH = canvas.height - 144;

  // Main Elevated Royal VIP Invitation Card
  ctx.save();
  ctx.shadowColor = 'rgba(40, 12, 16, 0.18)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 52);
  ctx.fill();
  ctx.restore();

  // Royal Velvet Crimson & 24k Gold Invitation Hero
  const headerH = 490;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, headerH, [52, 52, 0, 0]);
  const topGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
  topGrad.addColorStop(0, '#59000a');
  topGrad.addColorStop(0.5, '#ad0013');
  topGrad.addColorStop(1, '#68000c');
  ctx.fillStyle = topGrad;
  ctx.fill();

  const goldSpot = ctx.createRadialGradient(540, cardY + 130, 10, 540, cardY + 130, 380);
  goldSpot.addColorStop(0, 'rgba(254, 240, 138, 0.38)');
  goldSpot.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = goldSpot;
  ctx.fill();
  ctx.restore();

  // Inner Gold Filigree Frame inside Header
  ctx.save();
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.42)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cardX + 28, cardY + 28, cardW - 56, headerH - 56, 34);
  ctx.stroke();
  ctx.restore();

  // Faceted Gold Bethlehem Star Crest
  ctx.save();
  ctx.translate(540, 174);
  const starGrad = ctx.createLinearGradient(-46, -46, 46, 46);
  starGrad.addColorStop(0, '#fffbeb');
  starGrad.addColorStop(0.5, '#fde047');
  starGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = starGrad;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const outerR = i % 2 === 0 ? 48 : 26;
    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    const midAngle = angle + Math.PI / 8;
    ctx.lineTo(Math.cos(midAngle) * 11, Math.sin(midAngle) * 11);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // VIP Invitation Eyebrow
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef08a';
  ctx.font = '800 23px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(`${settings.churchName.toUpperCase()}  ·  VIP CELEBRATION INVITATION`, 540, 266);

  // Event Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 54px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const titleLines = wrapLines(ctx, settings.eventTitle, 800);
  let titleY = 338;
  for (const tLine of titleLines.slice(0, 2)) {
    ctx.fillText(tLine, 540, titleY);
    titleY += 58;
  }

  // Greatest Gift Promise Ribbon inside Hero
  const promiseY = 472;
  ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.52)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(148, promiseY - 38, 784, 58, 29);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = '700 23px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('Join our Celebration Service & receive the Greatest Gift there', 540, promiseY - 1);

  // Honored Guest Name
  const guestY = 635;
  ctx.fillStyle = '#6e6e73';
  ctx.font = '800 21px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('PERSONAL VIP INVITATION FOR', 540, guestY);

  ctx.fillStyle = '#18181b';
  ctx.font = '900 56px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(guestName, 540, guestY + 64);

  // Perforated Tear Line
  const divY = 758;
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
  ctx.fillStyle = '#9a4406';
  ctx.font = '800 21px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('CELEBRATION DATE & TIME', 540, divY + 66);

  ctx.fillStyle = '#18181b';
  ctx.font = '800 38px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(formatReadableDateClient(settings.eventDateIso), 540, divY + 116);

  ctx.fillStyle = '#9a4406';
  ctx.font = '800 21px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('VENUE', 540, divY + 186);

  ctx.fillStyle = '#18181b';
  ctx.font = '800 35px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const venueLines = wrapLines(ctx, settings.venueName, 760);
  let vy = divY + 234;
  for (const vLine of venueLines.slice(0, 2)) {
    ctx.fillText(vLine, 540, vy);
    vy += 42;
  }

  if (settings.venueAddress) {
    ctx.fillStyle = '#4c4c56';
    ctx.font = '600 25px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    const addrLines = wrapLines(ctx, settings.venueAddress, 760);
    for (const aLine of addrLines.slice(0, 2)) {
      ctx.fillText(aLine, 540, vy + 4);
      vy += 34;
    }
  }

  // Christmas Blessing Gift Entitlement Footer (No Redemption Code!)
  const giftClean = (settings.giftDescription || 'Christmas Blessing Gift').replace(/\s+Pack$/i, '');
  ctx.fillStyle = '#fffbeb';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(140, 1098, 800, 118, 30);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#78350f';
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText(`🎁  ${giftClean.toUpperCase()}`, 540, 1148);

  ctx.fillStyle = '#9a4406';
  ctx.font = '700 23px -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  ctx.fillText('Show our team to collect with us', 540, 1188);

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
