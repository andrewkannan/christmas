import { useId } from 'react';

interface ChristmasCrownArtProps {
  fillPercentage: number;
  currentSouls: number;
  targetSouls: number;
  compact?: boolean;
}

interface CrownJewel {
  cx: number;
  cy: number;
  r: number;
  color: string;
  ring: string;
  thresholdPct: number;
  kind: 'jewel' | 'ornament' | 'bulb';
}

const CROWN_JEWELS: readonly CrownJewel[] = [
  // Base Royal Band Gemstones (ignite early: 5% - 18%)
  { cx: 155, cy: 428, r: 12, color: '#ef4444', ring: '#fef08a', thresholdPct: 6, kind: 'jewel' },
  { cx: 228, cy: 428, r: 11, color: '#10b981', ring: '#fef08a', thresholdPct: 10, kind: 'jewel' },
  { cx: 300, cy: 428, r: 15, color: '#f59e0b', ring: '#ffffff', thresholdPct: 12, kind: 'jewel' },
  { cx: 372, cy: 428, r: 11, color: '#10b981', ring: '#fef08a', thresholdPct: 10, kind: 'jewel' },
  { cx: 445, cy: 428, r: 12, color: '#ef4444', ring: '#fef08a', thresholdPct: 6, kind: 'jewel' },

  // Lower Christmas Bough Ornaments (20% - 45%)
  { cx: 145, cy: 345, r: 9, color: '#fbbf24', ring: '#fef9c3', thresholdPct: 24, kind: 'ornament' },
  { cx: 222, cy: 332, r: 10, color: '#e11d48', ring: '#fecdd3', thresholdPct: 28, kind: 'ornament' },
  { cx: 300, cy: 348, r: 11, color: '#38bdf8', ring: '#e0f2fe', thresholdPct: 25, kind: 'ornament' },
  { cx: 378, cy: 332, r: 10, color: '#e11d48', ring: '#fecdd3', thresholdPct: 28, kind: 'ornament' },
  { cx: 455, cy: 345, r: 9, color: '#fbbf24', ring: '#fef9c3', thresholdPct: 24, kind: 'ornament' },

  // Mid Crown Christmas Tree Garland Lights (45% - 72%)
  { cx: 125, cy: 262, r: 8, color: '#fde047', ring: '#ffffff', thresholdPct: 48, kind: 'bulb' },
  { cx: 205, cy: 245, r: 10, color: '#22c55e', ring: '#dcfce7', thresholdPct: 54, kind: 'ornament' },
  { cx: 300, cy: 255, r: 13, color: '#ef4444', ring: '#fef08a', thresholdPct: 52, kind: 'jewel' },
  { cx: 395, cy: 245, r: 10, color: '#22c55e', ring: '#dcfce7', thresholdPct: 54, kind: 'ornament' },
  { cx: 475, cy: 262, r: 8, color: '#fde047', ring: '#ffffff', thresholdPct: 48, kind: 'bulb' },

  // Upper Spire Tips & Christmas Finials (70% - 92%)
  { cx: 96, cy: 175, r: 10, color: '#f59e0b', ring: '#fef08a', thresholdPct: 72, kind: 'bulb' },
  { cx: 196, cy: 132, r: 11, color: '#ef4444', ring: '#fef08a', thresholdPct: 82, kind: 'jewel' },
  { cx: 300, cy: 165, r: 11, color: '#fde047', ring: '#ffffff', thresholdPct: 76, kind: 'ornament' },
  { cx: 404, cy: 132, r: 11, color: '#ef4444', ring: '#fef08a', thresholdPct: 82, kind: 'jewel' },
  { cx: 504, cy: 175, r: 10, color: '#f59e0b', ring: '#fef08a', thresholdPct: 72, kind: 'bulb' },
];

// Majestic 5-Spired Royal Crown sculpted with layered Christmas Pine Bough serrations
const CROWN_OUTER_PATH = `
  M 118 462
  L 106 392
  L 84 295
  L 102 288
  L 78 228
  L 98 222
  L 96 175
  L 132 232
  L 122 240
  L 154 282
  L 174 218
  L 162 214
  L 185 168
  L 175 164
  L 196 132
  L 222 184
  L 212 188
  L 242 252
  L 266 188
  L 254 184
  L 280 128
  L 268 124
  L 300 66
  L 332 124
  L 320 128
  L 346 184
  L 334 188
  L 358 252
  L 388 188
  L 378 184
  L 404 132
  L 425 164
  L 415 168
  L 438 214
  L 426 218
  L 446 282
  L 478 240
  L 468 232
  L 504 175
  L 502 222
  L 522 228
  L 498 288
  L 516 295
  L 494 392
  L 482 462
  Z
`;

export function ChristmasCrownArt({
  fillPercentage,
  currentSouls,
  targetSouls,
  compact = false,
}: ChristmasCrownArtProps) {
  const uid = useId();
  const titleId = `crown-title-${uid}`;
  const clipId = `crown-fill-clip-${uid}`;
  const crownOutlineClipId = `crown-shape-clip-${uid}`;
  const goldGradId = `crown-gold-grad-${uid}`;
  const pineGradId = `crown-pine-grad-${uid}`;
  const liquidCrestGradId = `crown-crest-grad-${uid}`;
  const starGlowId = `crown-star-glow-${uid}`;

  const clampedPct = Math.min(100, Math.max(0, fillPercentage));
  // Fill spans vertically from y=468 (0%) up to y=20 (100%)
  const minY = 20;
  const maxY = 468;
  const fillTopY = maxY - ((maxY - minY) * clampedPct) / 100;
  const fillHeight = Math.max(0, maxY - fillTopY + 12);

  return (
    <div className={`crown-art-wrap ${compact ? 'crown-art-wrap--compact' : ''}`}>
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox="0 0 600 520"
        className="crown-art-svg"
      >
        <title id={titleId}>
          {`King of Glory Christmas Crown Progress: ${currentSouls} of ${targetSouls} souls registered (${clampedPct}% full)`}
        </title>

        <defs>
          <linearGradient id={pineGradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="45%" stopColor="#047857" />
            <stop offset="82%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          <linearGradient id={goldGradId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#fef9c3" />
          </linearGradient>

          <linearGradient id={liquidCrestGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </linearGradient>

          <radialGradient id={starGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#facc15" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          {/* Dynamic bottom-to-top progress clip */}
          <clipPath id={clipId}>
            <rect
              x="0"
              y={fillTopY}
              width="600"
              height={fillHeight}
              className="crown-art-clip-rect"
            />
          </clipPath>

          <clipPath id={crownOutlineClipId}>
            <path d={CROWN_OUTER_PATH} />
          </clipPath>
        </defs>

        {/* Background Milestone Guides (25%, 50%, 75%, 100%) */}
        {!compact &&
          [
            { pct: 25, y: 356, label: '25%' },
            { pct: 50, y: 244, label: '50%' },
            { pct: 75, y: 132, label: '75%' },
            { pct: 100, y: 54, label: '100% FULL CROWN' },
          ].map((m) => {
            const reached = clampedPct >= m.pct;
            return (
              <g key={m.pct} aria-hidden="true">
                <line
                  x1="36"
                  y1={m.y}
                  x2="564"
                  y2={m.y}
                  stroke={reached ? 'rgba(253, 224, 71, 0.45)' : 'rgba(255, 255, 255, 0.14)'}
                  strokeDasharray="5 6"
                  strokeWidth="1.5"
                />
                <text
                  x="560"
                  y={m.y - 6}
                  textAnchor="end"
                  fill={reached ? '#fde047' : 'rgba(255, 255, 255, 0.48)'}
                  fontSize="11"
                  fontWeight="800"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

        {/* 1. Unfilled Royal Crown-Tree Blueprint Silhouette */}
        <g aria-hidden="true">
          <path
            d={CROWN_OUTER_PATH}
            fill="rgba(255, 255, 255, 0.06)"
            stroke="rgba(253, 224, 71, 0.38)"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Unlit Base Band */}
          <path
            d="M 110 392 L 490 392 L 482 462 L 118 462 Z"
            fill="rgba(127, 29, 29, 0.28)"
            stroke="rgba(253, 224, 71, 0.35)"
            strokeWidth="2"
          />

          {/* Unlit Jewels & Ornaments */}
          {CROWN_JEWELS.map((j, idx) => (
            <circle
              key={idx}
              cx={j.cx}
              cy={j.cy}
              r={j.r}
              fill="rgba(255, 255, 255, 0.12)"
              stroke="rgba(253, 224, 71, 0.3)"
              strokeWidth="1.5"
            />
          ))}

          {/* Unlit Top Star of Bethlehem */}
          <polygon
            points="300,22 309,46 334,54 309,62 300,86 291,62 266,54 291,46"
            fill="rgba(255, 255, 255, 0.14)"
            stroke="rgba(253, 224, 71, 0.45)"
            strokeWidth="2"
          />
        </g>

        {/* 2. Progressive Bottom-to-Top Filled King of Glory Christmas Crown */}
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {/* Evergreen Christmas Tree & Golden Royal Crown Body */}
          <path
            d={CROWN_OUTER_PATH}
            fill={`url(#${pineGradId})`}
            stroke={`url(#${goldGradId})`}
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Decorative Christmas Fir Bough Ribbons & Golden Garland Swags inside Crown */}
          <g clipPath={`url(#${crownOutlineClipId})`}>
            <path
              d="M 95 360 Q 200 395 300 352 Q 400 395 505 360"
              fill="none"
              stroke="#fde047"
              strokeWidth="3.5"
              strokeDasharray="8 6"
              opacity="0.85"
            />
            <path
              d="M 110 295 Q 210 330 300 285 Q 390 330 490 295"
              fill="none"
              stroke="#fef08a"
              strokeWidth="3"
              strokeDasharray="6 6"
              opacity="0.8"
            />
            <path
              d="M 155 225 Q 230 255 300 212 Q 370 255 445 225"
              fill="none"
              stroke="#fde047"
              strokeWidth="2.5"
              strokeDasharray="5 5"
              opacity="0.75"
            />

            {/* Golden Spire Ribs */}
            <line x1="300" y1="74" x2="300" y2="390" stroke="rgba(254, 240, 138, 0.45)" strokeWidth="3" />
            <line x1="196" y1="138" x2="228" y2="390" stroke="rgba(254, 240, 138, 0.35)" strokeWidth="2.5" />
            <line x1="404" y1="138" x2="372" y2="390" stroke="rgba(254, 240, 138, 0.35)" strokeWidth="2.5" />

            {/* Royal Crimson & Gold Crown Base Band */}
            <path
              d="M 106 392 L 494 392 L 482 462 L 118 462 Z"
              fill="#991b1b"
              stroke={`url(#${goldGradId})`}
              strokeWidth="4"
            />
            <line x1="112" y1="404" x2="488" y2="404" stroke="#fde047" strokeWidth="2" opacity="0.85" />
            <line x1="116" y1="450" x2="484" y2="450" stroke="#fde047" strokeWidth="2" opacity="0.85" />

            {/* Glowing Liquid Gold Crest at the current fill water-line */}
            {clampedPct > 0 && clampedPct < 100 && (
              <g>
                <rect
                  x="60"
                  y={fillTopY}
                  width="480"
                  height="38"
                  fill={`url(#${liquidCrestGradId})`}
                />
                <line
                  x1="60"
                  y1={fillTopY + 2}
                  x2="540"
                  y2={fillTopY + 2}
                  stroke="#fef9c3"
                  strokeWidth="4"
                />
              </g>
            )}
          </g>

          {/* Lit Jewels, Christmas Ornaments & Bulbs */}
          {CROWN_JEWELS.map((j, idx) => (
            <g key={idx}>
              <circle cx={j.cx} cy={j.cy} r={j.r + 5} fill={j.ring} opacity="0.28" />
              <circle
                cx={j.cx}
                cy={j.cy}
                r={j.r}
                fill={j.color}
                stroke={j.ring}
                strokeWidth="2.5"
              />
              <circle
                cx={j.cx - j.r * 0.3}
                cy={j.cy - j.r * 0.3}
                r={Math.max(2, j.r * 0.28)}
                fill="#ffffff"
                opacity="0.85"
              />
            </g>
          ))}

          {/* Lit Star of Bethlehem at the Crown Apex */}
          <circle cx="300" cy="54" r="46" fill={`url(#${starGlowId})`} />
          <polygon
            points="300,16 311,44 340,54 311,64 300,92 289,64 260,54 289,44"
            fill="#fef08a"
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          <circle cx="300" cy="54" r="8" fill="#ffffff" />
        </g>

        {/* 3. Always-Crisp Golden Outer Frame & Base Inscription */}
        <path
          d={CROWN_OUTER_PATH}
          fill="none"
          stroke={`url(#${goldGradId})`}
          strokeWidth="3.5"
          strokeLinejoin="round"
          opacity="0.85"
          aria-hidden="true"
        />

        <text
          x="300"
          y="496"
          textAnchor="middle"
          fill="#fef08a"
          fontSize="15"
          fontWeight="900"
          letterSpacing="2.5"
          aria-hidden="true"
        >
          👑 KING OF GLORY · CHRISTMAS CROWN OF SOULS 🎄
        </text>
      </svg>
    </div>
  );
}
