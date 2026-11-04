import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vRot: number;
  kind: 'ribbon' | 'star';
  alpha: number;
}

const FESTIVE_PALETTE = [
  '#fde047', // bright gold
  '#f59e0b', // warm amber gold
  '#ff3b30', // festive crimson
  '#d70015', // ruby
  '#10b981', // emerald
  '#ffffff', // snow sparkle
] as const;

/**
 * Lightweight, self-terminating celebratory confetti & golden starlight shower.
 * Automatically honors prefers-reduced-motion and stops its rAF loop once complete.
 */
export function ConfettiBurst({ intensity = 'high' }: { intensity?: 'high' | 'medium' }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = intensity === 'high' ? 64 : 38;
    const particles: Particle[] = [];
    const originY = Math.min(220, h * 0.26);

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const spreadAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.45;
      const speed = 260 + Math.random() * 420;
      particles.push({
        x: w * 0.5 + side * (Math.random() * Math.min(110, w * 0.25)),
        y: originY + (Math.random() - 0.5) * 30,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed - 90,
        size: 5 + Math.random() * 6,
        color: FESTIVE_PALETTE[i % FESTIVE_PALETTE.length],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 9,
        kind: i % 4 === 0 ? 'star' : 'ribbon',
        alpha: 1,
      });
    }

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const DURATION_SEC = 2.25;

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      elapsed += dt;

      ctx.clearRect(0, 0, w, h);

      let alive = 0;
      for (const p of particles) {
        p.vy += 690 * dt;
        p.vx *= 0.988;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;

        if (elapsed > DURATION_SEC * 0.62) {
          p.alpha = Math.max(0, 1 - (elapsed - DURATION_SEC * 0.62) / (DURATION_SEC * 0.38));
        }

        if (p.alpha <= 0.02 || p.y > h + 40) continue;
        alive += 1;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;

        if (p.kind === 'star') {
          const r = p.size * 1.15;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.28, -r * 0.28);
          ctx.lineTo(r, 0);
          ctx.lineTo(r * 0.28, r * 0.28);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.28, r * 0.28);
          ctx.lineTo(-r, 0);
          ctx.lineTo(-r * 0.28, -r * 0.28);
          ctx.closePath();
          ctx.fill();
        } else {
          const tilt = Math.cos(p.rot * 2);
          ctx.fillRect(-p.size * 0.6, -p.size * 0.32 * Math.max(0.25, Math.abs(tilt)), p.size * 1.2, p.size * 0.64);
        }
        ctx.restore();
      }

      if (alive > 0 && elapsed < DURATION_SEC) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [intensity]);

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
