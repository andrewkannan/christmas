import { useId } from 'react';
import type { ActiveGameId } from '../types.ts';

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Hero 3D-sculpted metallic trophy with animated diagonal specular sheen & floating sparkles.
 */
export function ShiningTrophy({
  tier = 'gold',
  size = 88,
  rankBadge,
}: {
  tier?: 'gold' | 'silver' | 'bronze';
  size?: number;
  rankBadge?: number | null;
}) {
  const uid = useId();
  const palette =
    tier === 'silver'
      ? {
          rimLight: '#ffffff',
          top: '#f8fafc',
          mid: '#cbd5e1',
          deep: '#64748b',
          shadow: '#334155',
          gem: '#dc2626',
          halo: 'rgba(226, 232, 240, 0.42)',
        }
      : tier === 'bronze'
        ? {
            rimLight: '#fff7ed',
            top: '#fed7aa',
            mid: '#ea580c',
            deep: '#9a3412',
            shadow: '#431407',
            gem: '#fde047',
            halo: 'rgba(251, 146, 60, 0.36)',
          }
        : {
            rimLight: '#fffbeb',
            top: '#fef08a',
            mid: '#f59e0b',
            deep: '#b45309',
            shadow: '#78350f',
            gem: '#d70015',
            halo: 'rgba(253, 224, 71, 0.45)',
          };

  return (
    <div className="trophy-showcase" style={{ width: size, height: size }} aria-hidden="true">
      <span className="trophy-showcase__halo" style={{ background: `radial-gradient(circle, ${palette.halo} 0%, transparent 70%)` }} />
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className="trophy-showcase__svg"
        fill="none"
      >
        <defs>
          <linearGradient id={`${uid}-cup`} x1="28" y1="18" x2="92" y2="86" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.rimLight} />
            <stop offset="28%" stopColor={palette.top} />
            <stop offset="68%" stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.deep} />
          </linearGradient>
          <linearGradient id={`${uid}-stem`} x1="46" y1="68" x2="74" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={palette.top} />
            <stop offset="55%" stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.shadow} />
          </linearGradient>
          <linearGradient id={`${uid}-base`} x1="34" y1="92" x2="86" y2="108" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3a0d12" />
            <stop offset="50%" stopColor="#1f070a" />
            <stop offset="100%" stopColor="#0f0406" />
          </linearGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.88)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <path d="M35 22H85V45C85 60.5 73.8 72 60 72C46.2 72 35 60.5 35 45V22Z" />
          </clipPath>
        </defs>

        {/* Left & Right Sculpted Handles */}
        <path
          d="M36 28H25C20.5 28 18 31.5 18 36.5C18 46.5 25.5 55 36.5 56.5"
          stroke={`url(#${uid}-cup)`}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M84 28H95C99.5 28 102 31.5 102 36.5C102 46.5 94.5 55 83.5 56.5"
          stroke={`url(#${uid}-cup)`}
          strokeWidth="6.5"
          strokeLinecap="round"
        />

        {/* Pedestal Stem & Collar */}
        <path d="M54 69H66L69 88H51L54 69Z" fill={`url(#${uid}-stem)`} />
        <rect x="44" y="86" width="32" height="7" rx="3.5" fill={`url(#${uid}-cup)`} />

        {/* Velvet & Gold Championship Plinth */}
        <rect x="33" y="92" width="54" height="15" rx="5" fill={`url(#${uid}-base)`} stroke={palette.mid} strokeWidth="1.8" />
        <rect x="42" y="97" width="36" height="5" rx="2.5" fill={`url(#${uid}-cup)`} opacity="0.9" />

        {/* Main Cup Bowl */}
        <path
          d="M35 22H85V45C85 60.5 73.8 72 60 72C46.2 72 35 60.5 35 45V22Z"
          fill={`url(#${uid}-cup)`}
        />
        {/* Vertical Left Highlight */}
        <path
          d="M42 26V44C42 53 46.5 60.5 53 64"
          stroke={palette.rimLight}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.72"
        />

        {/* Animated Diagonal Specular Sweep */}
        <g clipPath={`url(#${uid}-clip)`}>
          <rect
            x="-45"
            y="10"
            width="36"
            height="80"
            transform="rotate(22 60 45)"
            fill={`url(#${uid}-sheen)`}
            className="trophy-showcase__sheen"
          />
        </g>

        {/* Crowned Rim */}
        <rect x="32" y="17" width="56" height="7.5" rx="3.75" fill={`url(#${uid}-cup)`} stroke={palette.rimLight} strokeWidth="1" />

        {/* Center Star / Rank Crest */}
        {rankBadge && rankBadge <= 3 ? (
          <g>
            <circle cx="60" cy="44" r="12.5" fill={palette.gem} stroke={palette.rimLight} strokeWidth="2" />
            <text
              x="60"
              y="48.5"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="13.5"
              fontWeight="900"
              fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
            >
              #{rankBadge}
            </text>
          </g>
        ) : (
          <path
            d="M60 30L63.5 39.2L73.3 39.8L65.7 46L68.2 55.6L60 50.2L51.8 55.6L54.3 46L46.7 39.8L56.5 39.2L60 30Z"
            fill={palette.rimLight}
            stroke={palette.deep}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        )}

        {/* Twinkling 4-Point Sparkles */}
        <path
          d="M20 18L22 23L27 25L22 27L20 32L18 27L13 25L18 23L20 18Z"
          fill="#fffbeb"
          className="trophy-sparkle trophy-sparkle--1"
        />
        <path
          d="M101 15L102.6 19.2L106.8 20.8L102.6 22.4L101 26.6L99.4 22.4L95.2 20.8L99.4 19.2L101 15Z"
          fill="#fef08a"
          className="trophy-sparkle trophy-sparkle--2"
        />
        <path
          d="M98 66L99.3 69.4L102.7 70.7L99.3 72L98 75.4L96.7 72L93.3 70.7L96.7 69.4L98 66Z"
          fill="#ffffff"
          className="trophy-sparkle trophy-sparkle--3"
        />
      </svg>
    </div>
  );
}

/**
 * Sculpted Podium Medal (#1 Gold, #2 Silver, #3 Bronze, or Open Slot).
 */
export function MedalEmblem({
  rank,
  open = false,
  size = 28,
}: {
  rank: 1 | 2 | 3;
  open?: boolean;
  size?: number;
}) {
  const uid = useId();
  const colors =
    rank === 1
      ? { top: '#fef08a', mid: '#f59e0b', deep: '#b45309', ribbon: '#d70015', text: '#451a03' }
      : rank === 2
        ? { top: '#f8fafc', mid: '#cbd5e1', deep: '#64748b', ribbon: '#0284c7', text: '#0f172a' }
        : { top: '#ffedd5', mid: '#ea580c', deep: '#9a3412', ribbon: '#0f6840', text: '#431407' };

  if (open) {
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" fill="none">
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke={colors.mid}
          strokeWidth="2"
          strokeDasharray="3.5 2.5"
          fill="rgba(255,255,255,0.65)"
        />
        <text
          x="16"
          y="20"
          textAnchor="middle"
          fill={colors.deep}
          fontSize="11"
          fontWeight="900"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
        >
          #{rank}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={`${uid}-m`} x1="6" y1="6" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={colors.top} />
          <stop offset="55%" stopColor={colors.mid} />
          <stop offset="100%" stopColor={colors.deep} />
        </linearGradient>
      </defs>
      <path d="M10 3H15L13 11H8L10 3Z" fill={colors.ribbon} />
      <path d="M22 3H17L19 11H24L22 3Z" fill={colors.ribbon} opacity="0.85" />
      <circle cx="16" cy="18.5" r="10.5" fill={`url(#${uid}-m)`} stroke="#ffffff" strokeWidth="1.4" />
      <circle cx="16" cy="18.5" r="7.8" stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />
      <text
        x="16"
        y="22.3"
        textAnchor="middle"
        fill={colors.text}
        fontSize="11"
        fontWeight="900"
        fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
      >
        {rank}
      </text>
    </svg>
  );
}

/**
 * 5 bespoke Apple-Arcade-style vector emblems for the 5 Christmas games.
 */
export function GameEmblem({ gameId, size = 34 }: { gameId: ActiveGameId; size?: number }) {
  switch (gameId) {
    case 'ice-hockey':
      return (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" fill="none">
          {/* Rink Portal Seam & Speed Trail */}
          <line x1="6" y1="9" x2="34" y2="9" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" strokeDasharray="3 2.5" strokeLinecap="round" />
          <path d="M16 25L20 13M24 26L21.5 15" stroke="#fde047" strokeWidth="2.1" strokeLinecap="round" opacity="0.85" />
          {/* Glowing Starlight Puck Flying Upward */}
          <circle cx="20" cy="12" r="5.5" fill="#fef08a" />
          <circle cx="20" cy="12" r="2.6" fill="#d70015" />
          {/* Sculpted Striker Mallet */}
          <ellipse cx="20" cy="29.5" rx="10.5" ry="5.5" fill="#ffffff" />
          <ellipse cx="20" cy="28" rx="7.5" ry="3.7" fill="#fef08a" />
          <ellipse cx="20" cy="26.5" rx="4" ry="2.2" fill="#d70015" />
          {/* Sparkle */}
          <path d="M31.5 14L32.5 16.4L35 17.4L32.5 18.4L31.5 20.8L30.5 18.4L28 17.4L30.5 16.4L31.5 14Z" fill="#fde047" />
        </svg>
      );
    case 'santa-dash':
      return (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" fill="none">
          {/* Speed Lines */}
          <line x1="4" y1="15" x2="11" y2="15" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="3" y1="21" x2="9" y2="21" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" strokeLinecap="round" />
          {/* Sleek Sleigh Body */}
          <path
            d="M11 24H29C31.5 24 33.5 21.5 34.5 18.5L31 18.5C28.5 18.5 27 14.5 23 14.5H14L11 24Z"
            fill="#ffffff"
          />
          <path d="M15 14.5L17.5 9.5H23.5L25 14.5" fill="#fde047" />
          {/* Golden Runners */}
          <path
            d="M8.5 29.5H31.5C34 29.5 35.8 27.8 36 25.5"
            stroke="#fde047"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <line x1="15" y1="24" x2="15" y2="29.5" stroke="#fde047" strokeWidth="2.2" />
          <line x1="26" y1="24" x2="26" y2="29.5" stroke="#fde047" strokeWidth="2.2" />
        </svg>
      );
    case 'gift-tetris':
      return (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" fill="none">
          {/* T-Tetromino Gift Blocks */}
          <rect x="8" y="21" width="10.5" height="10.5" rx="2.5" fill="#ffffff" />
          <rect x="19.5" y="21" width="10.5" height="10.5" rx="2.5" fill="#fef08a" />
          <rect x="19.5" y="9.5" width="10.5" height="10.5" rx="2.5" fill="#ffffff" />
          <rect x="8" y="9.5" width="10.5" height="10.5" rx="2.5" fill="rgba(255,255,255,0.38)" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2.5 2" />
          {/* Sparkle */}
          <path d="M33 10L34.2 12.8L37 14L34.2 15.2L33 18L31.8 15.2L29 14L31.8 12.8L33 10Z" fill="#fef08a" />
        </svg>
      );
    case 'gift-slash':
      return (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" fill="none">
          {/* Split Ornament Halves */}
          <path d="M12.5 24.5A8.5 8.5 0 0 1 24.5 12.5L12.5 24.5Z" fill="#fef08a" />
          <path d="M27.5 15.5A8.5 8.5 0 0 1 15.5 27.5L27.5 15.5Z" fill="#ffffff" />
          {/* Sweeping Katana Blade Arc */}
          <path
            d="M6 34C14 25 24 15 35 6"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path d="M31 6L32.2 9L35.2 10.2L32.2 11.4L31 14.4L29.8 11.4L26.8 10.2L29.8 9L31 6Z" fill="#fde047" />
        </svg>
      );
    case 'candy-match':
      return (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" fill="none">
          {/* Faceted Peppermint Gem */}
          <polygon points="20,6 32,15 27.5,31 12.5,31 8,15" fill="#ffffff" />
          <polygon points="20,10.5 27.5,16.5 24.5,27.5 15.5,27.5 12.5,16.5" fill="#fef08a" />
          <circle cx="20" cy="19.5" r="4.2" fill="#0284c7" />
          <path d="M32 7L33.2 9.8L36 11L33.2 12.2L32 15L30.8 12.2L28 11L30.8 9.8L32 7Z" fill="#fde047" />
        </svg>
      );
  }
}

export function StarMarkIcon({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="2.2" fill="#fde047" />
    </svg>
  );
}

export function CrownIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M3 18.5H21V20.5H3V18.5ZM2.5 7.5L7.5 12L12 5L16.5 12L21.5 7.5L19.5 16.5H4.5L2.5 7.5Z" />
    </svg>
  );
}

export function SparkleIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2L14.3 9.7L22 12L14.3 14.3L12 22L9.7 14.3L2 12L9.7 9.7L12 2Z" />
    </svg>
  );
}

export function GiftBoxIcon({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="3" y="8" width="18" height="4" rx="1.2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 12V19.5C5 20.3 5.7 21 6.5 21H17.5C18.3 21 19 20.3 19 19.5V12" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="21" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8C12 8 8 8 7.2 5.6C6.5 3.6 9.2 2.5 10.8 4.4C11.6 5.4 12 8 12 8ZM12 8C12 8 16 8 16.8 5.6C17.5 3.6 14.8 2.5 13.2 4.4C12.4 5.4 12 8 12 8Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TicketPassIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M3 7.5C3 6.4 3.9 5.5 5 5.5H19C20.1 5.5 21 6.4 21 7.5V10C19.6 10 18.5 11.1 18.5 12.5C18.5 13.9 19.6 15 21 15V17.5C21 18.6 20.1 19.5 19 19.5H5C3.9 19.5 3 18.6 3 17.5V15C4.4 15 5.5 13.9 5.5 12.5C5.5 11.1 4.4 10 3 10V7.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="9.5" y1="8.5" x2="9.5" y2="16.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 2" />
    </svg>
  );
}

export function VolumeOnIcon({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d="M11 5L6.5 9H3V15H6.5L11 19V5Z" fill="currentColor" />
      <path d="M15.5 8.5C16.8 9.8 17.5 11.3 17.5 12C17.5 12.7 16.8 14.2 15.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 5.8C20.7 8 21.5 10.3 21.5 12C21.5 13.7 20.7 16 18.5 18.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function VolumeOffIcon({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d="M11 5L6.5 9H3V15H6.5L11 19V5Z" fill="currentColor" />
      <path d="M16 9.5L21 14.5M21 9.5L16 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon({ filled = true, size = 16, className }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M12 20.6L10.6 19.3C5.6 14.8 2.5 12 2.5 8.4C2.5 5.5 4.8 3.2 7.7 3.2C9.4 3.2 11 4 12 5.2C13 4 14.6 3.2 16.3 3.2C19.2 3.2 21.5 5.5 21.5 8.4C21.5 12 18.4 14.8 13.4 19.3L12 20.6Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function BoltMovesIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M13 2L4.5 13.5H11.5L10.5 22L19.5 10.5H12.5L13 2Z" />
    </svg>
  );
}

export function TimerClockIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <circle cx="12" cy="13" r="8.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 8.5V13L15 14.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="9.5" y1="2.5" x2="14.5" y2="2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function PlayTriangleIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M6.5 4.5L19.5 12L6.5 19.5V4.5Z" />
    </svg>
  );
}

export function ReplayIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M4.5 12A7.5 7.5 0 1 1 6.7 17.3M4.5 7V12H9.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GridGamesIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function DownloadPassIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d="M12 3.5V14.5M12 14.5L7.5 10M12 14.5L16.5 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 16.5V18.5C4.5 19.6 5.4 20.5 6.5 20.5H17.5C18.6 20.5 19.5 19.6 19.5 18.5V16.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M12 3.2C7.1 3.2 3.2 7.1 3.2 11.9C3.2 13.6 3.7 15.2 4.6 16.5L3.4 20.8L7.8 19.6C9.1 20.3 10.5 20.7 12 20.7C16.9 20.7 20.8 16.8 20.8 12C20.8 7.1 16.9 3.2 12 3.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.3 8.8C9.6 8.8 9.9 8.8 10.1 9.2L10.9 11C11 11.3 10.9 11.6 10.7 11.8L10.1 12.4C10.6 13.3 11.4 14.1 12.3 14.6L12.9 14C13.1 13.8 13.4 13.7 13.7 13.8L15.5 14.6C15.9 14.8 15.9 15.1 15.9 15.4C15.8 16.3 14.8 17 13.8 17C11.2 17 7.8 13.8 7.8 11C7.8 10 8.4 9 9.3 8.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CalendarIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="3" x2="8" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="3" x2="16" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MapPinIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M12 21C12 21 18.5 15.2 18.5 10C18.5 6.4 15.6 3.5 12 3.5C8.4 3.5 5.5 6.4 5.5 10C5.5 15.2 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8.2 12.2L10.8 14.8L16 9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M12 3L19.5 6V11.5C19.5 16.2 16.3 19.9 12 21.2C7.7 19.9 4.5 16.2 4.5 11.5V6L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8.8 12.2L11 14.4L15.4 9.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d="M19 12H5M5 12L11 6M5 12L11 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WazeIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M19.8 11.6C19.8 7.5 16.4 4.2 12.1 4.2C7.8 4.2 4.4 7.5 4.4 11.6C4.4 13.4 5 14.9 6.1 16.1C5.6 17.1 4.6 17.7 3.5 17.9C4.7 18.8 6.5 19.1 8.2 18.6C9.4 19 10.7 19.2 12.1 19.2C16.4 19.2 19.8 15.8 19.8 11.6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="9.6" cy="10.6" r="1.2" fill="currentColor" />
      <circle cx="14.6" cy="10.6" r="1.2" fill="currentColor" />
      <path
        d="M9.4 13.8C10.1 14.8 11.1 15.3 12.1 15.3C13.1 15.3 14.1 14.8 14.8 13.8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="8.2" cy="19.6" r="1.7" fill="currentColor" />
      <circle cx="15.8" cy="19.6" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function TrophyBoardIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M7 4.5H17V9.5C17 12.3 14.8 14.5 12 14.5C9.2 14.5 7 12.3 7 9.5V4.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7 6.5H4.5C3.9 6.5 3.5 7 3.5 7.6C3.5 9.8 5 11.4 7 11.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M17 6.5H19.5C20.1 6.5 20.5 7 20.5 7.6C20.5 9.8 19 11.4 17 11.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 14.5V18.5M8.5 19.5H15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MusicNoteIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M9 17.5V6.2L19 4.2V15.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="17.5" r="2.7" fill="currentColor" />
      <circle cx="16.5" cy="15.5" r="2.7" fill="currentColor" />
    </svg>
  );
}

export function FlameIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M12.6 2.3C12.9 5.2 11.3 7.3 9.7 8.9C8 10.6 7.2 12.2 7.2 14.3C7.2 17.5 9.6 20 12.7 20C15.9 20 18.4 17.4 18.4 13.9C18.4 10.1 16.2 6.8 12.6 2.3ZM12.5 17.6C11 17.6 9.9 16.5 9.9 15C9.9 13.6 10.8 12.6 12.3 11.3C13.6 12.5 14.6 13.8 14.6 15.1C14.6 16.5 13.7 17.6 12.5 17.6Z" />
    </svg>
  );
}

export function VersusPhonesIcon({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="2.5" y="4" width="7.5" height="16" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="14" y="4" width="7.5" height="16" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.5 9.5L13.5 7.5M13.5 14.5L10.5 16.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function TargetGoalIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function UsersCrmIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <circle cx="9" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.2 19.2C3.8 15.9 6.1 14.2 9 14.2C11.9 14.2 14.2 15.9 14.8 19.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.8" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.2 14.5C18.4 14.7 20.1 16.1 20.6 18.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NoteEditIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M12 20H20.5M16.2 4.3C17 3.5 18.3 3.5 19.1 4.3L19.7 4.9C20.5 5.7 20.5 7 19.7 7.8L8.6 18.9L4 20L5.1 15.4L16.2 4.3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QrBoardIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="6" width="2" height="2" fill="currentColor" />
      <rect x="16" y="6" width="2" height="2" fill="currentColor" />
      <rect x="6" y="16" width="2" height="2" fill="currentColor" />
      <path d="M14 14H17V17H14V14ZM17 17H20.5V20.5H17V17ZM14 19.5H15.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function SlidersIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <line x1="4" y1="6.5" x2="20" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="17.5" x2="20" y2="17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="6.5" r="2.3" fill="var(--bg-surface, #ffffff)" stroke="currentColor" strokeWidth="2" />
      <circle cx="15.5" cy="12" r="2.3" fill="var(--bg-surface, #ffffff)" stroke="currentColor" strokeWidth="2" />
      <circle cx="10.5" cy="17.5" r="2.3" fill="var(--bg-surface, #ffffff)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function LockIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10.5V7.5C8 5.3 9.8 3.5 12 3.5C14.2 3.5 16 5.3 16 7.5V10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function CopyIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 8.5V6.5C15.5 5.4 14.6 4.5 13.5 4.5H6.5C5.4 4.5 4.5 5.4 4.5 6.5V13.5C4.5 14.6 5.4 15.5 6.5 15.5H8.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function BellReminderIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M6.5 10C6.5 6.9 9 4.4 12 4.4C15 4.4 17.5 6.9 17.5 10V14.2L19.3 16.4H4.7L6.5 14.2V10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 19C10.5 20 11.2 20.5 12 20.5C12.8 20.5 13.5 20 14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EyeScanIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <path
        d="M2.5 12C4.4 7.8 7.9 5.5 12 5.5C16.1 5.5 19.6 7.8 21.5 12C19.6 16.2 16.1 18.5 12 18.5C7.9 18.5 4.4 16.2 2.5 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ShareViralIcon({ size = 17, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="none">
      <circle cx="18" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="2.8" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18.5" r="2.8" stroke="currentColor" strokeWidth="2" />
      <line x1="8.6" y1="10.7" x2="15.4" y2="6.8" stroke="currentColor" strokeWidth="2" />
      <line x1="8.6" y1="13.3" x2="15.4" y2="17.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}



