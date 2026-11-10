import type { StoryboardArtScene } from './storyboardData.ts';

interface StoryboardArtProps {
  scene: StoryboardArtScene;
  churchName?: string;
}

/**
 * Custom illustrated cinematic storyboard panels (640x360 widescreen with center-weighted
 * hero composition so 9:16 vertical Reel crop guides frame the action cleanly).
 */
export function StoryboardArt({ scene, churchName = 'CCC JB Bilingual' }: StoryboardArtProps) {
  return (
    <svg
      viewBox="0 0 640 360"
      width="640"
      height="360"
      className="sb-art-svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sb-warm-dusk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a0a10" />
          <stop offset="55%" stopColor="#6c121c" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="sb-night-jb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13192b" />
          <stop offset="60%" stopColor="#261726" />
          <stop offset="100%" stopColor="#49161f" />
        </linearGradient>
        <linearGradient id="sb-snow-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffdf9" />
          <stop offset="100%" stopColor="#fde8e8" />
        </linearGradient>
        <linearGradient id="sb-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="48%" stopColor="#cbd5e1" />
          <stop offset="52%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
        <linearGradient id="sb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {scene === 'car-door' && (
        <g>
          <rect width="640" height="360" fill="url(#sb-warm-dusk)" />
          {/* Warm bokeh street lights */}
          <circle cx="120" cy="78" r="34" fill="#fde047" opacity="0.22" />
          <circle cx="510" cy="64" r="46" fill="#fb923c" opacity="0.2" />
          <circle cx="445" cy="110" r="22" fill="#fef08a" opacity="0.28" />
          {/* Classic vintage crimson car body + open door */}
          <path d="M40 210 Q140 135 280 132 L540 132 L600 210 L600 340 L40 340 Z" fill="#991b1b" />
          <path d="M210 140 L470 140 L520 208 L190 208 Z" fill="#1e1b24" />
          {/* Tan vintage leather seat visible inside open door */}
          <rect x="238" y="168" width="92" height="118" rx="16" fill="#b45309" stroke="#fde68a" strokeWidth="2" />
          <line x1="258" y1="176" x2="258" y2="278" stroke="#78350f" strokeWidth="3" />
          <line x1="284" y1="176" x2="284" y2="278" stroke="#78350f" strokeWidth="3" />
          <line x1="310" y1="176" x2="310" y2="278" stroke="#78350f" strokeWidth="3" />
          {/* Vintage steering wheel silhouette */}
          <circle cx="352" cy="196" r="28" fill="none" stroke="#fef3c7" strokeWidth="5" />
          <circle cx="352" cy="196" r="6" fill="#fef3c7" />
          {/* Open classic door swung toward foreground + chrome trim */}
          <path
            d="M155 118 L345 96 L355 326 L145 340 Z"
            fill="#b91c1c"
            stroke="#fecaca"
            strokeWidth="2.5"
          />
          <path d="M172 134 L326 116 L330 206 L168 214 Z" fill="#29151c" opacity="0.88" />
          <rect x="152" y="224" width="198" height="8" rx="4" fill="url(#sb-chrome)" />
          {/* Chrome vintage handle + driver's hand + star keychain */}
          <rect x="268" y="238" width="64" height="14" rx="7" fill="url(#sb-chrome)" />
          <circle cx="276" cy="245" r="9" fill="#94a3b8" />
          <ellipse cx="298" cy="252" rx="22" ry="15" fill="#f1c27d" />
          <line x1="312" y1="264" x2="318" y2="288" stroke="#fef08a" strokeWidth="2.5" />
          <polygon points="318,284 322,294 332,294 324,300 327,310 318,304 309,310 312,300 304,294 314,294" fill="#fde047" />
        </g>
      )}

      {scene === 'mirror-smile' && (
        <g>
          <rect width="640" height="360" fill="#1b0d12" />
          {/* Out-of-focus windshield Christmas bokeh */}
          <circle cx="110" cy="95" r="42" fill="#ef4444" opacity="0.25" />
          <circle cx="525" cy="88" r="48" fill="#f59e0b" opacity="0.24" />
          <circle cx="165" cy="260" r="55" fill="#10b981" opacity="0.18" />
          <circle cx="495" cy="270" r="38" fill="#fde047" opacity="0.2" />
          {/* Mirror stem from roof */}
          <rect x="308" y="0" width="24" height="96" fill="#475569" />
          <circle cx="320" cy="96" r="14" fill="url(#sb-chrome)" />
          {/* Large Chrome-rimmed Vintage Rear-View Mirror */}
          <rect
            x="140"
            y="98"
            width="360"
            height="148"
            rx="28"
            fill="#2b1920"
            stroke="url(#sb-chrome)"
            strokeWidth="10"
          />
          <rect x="148" y="106" width="344" height="132" rx="21" fill="#3b1d26" />
          {/* Driver's warm eyes & confident joyful smile reflected inside mirror */}
          <ellipse cx="320" cy="176" rx="95" ry="62" fill="#e0a96d" />
          <path d="M226 146 Q320 96 414 146 L406 122 Q320 88 234 122 Z" fill="#18181b" />
          {/* Expressive locked-in eyes with catchlights */}
          <path d="M262 162 Q284 150 304 162 Q284 170 262 162 Z" fill="#ffffff" />
          <circle cx="284" cy="160" r="8" fill="#1c1917" />
          <circle cx="287" cy="157" r="2.8" fill="#ffffff" />
          <path d="M336 162 Q356 150 378 162 Q356 170 336 162 Z" fill="#ffffff" />
          <circle cx="356" cy="160" r="8" fill="#1c1917" />
          <circle cx="359" cy="157" r="2.8" fill="#ffffff" />
          {/* Warm eyebrows */}
          <path d="M258 146 Q284 137 306 146" fill="none" stroke="#18181b" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M334 144 Q358 134 382 145" fill="none" stroke="#18181b" strokeWidth="4.5" strokeLinecap="round" />
          {/* Hint of warm knowing smile at bottom of mirror */}
          <path d="M292 206 Q320 226 348 206" fill="none" stroke="#7c2d12" strokeWidth="5" strokeLinecap="round" />
          {/* Two fingers adjusting the bottom-right corner of the mirror */}
          <ellipse cx="478" cy="242" rx="28" ry="16" transform="rotate(-18 478 242)" fill="#e0a96d" />
          <ellipse cx="496" cy="262" rx="24" ry="14" transform="rotate(-18 496 262)" fill="#d0965a" />
          {/* Sparkle glint on mirror corner */}
          <path d="M180 128 L185 140 L197 145 L185 150 L180 162 L175 150 L163 145 L175 140 Z" fill="#fef08a" />
        </g>
      )}

      {scene === 'jesus-call' && (
        <g>
          <rect width="640" height="360" fill="url(#sb-night-jb)" />
          {/* Vintage wooden dash strip */}
          <rect x="0" y="255" width="640" height="105" fill="#451a03" />
          <rect x="0" y="250" width="640" height="8" fill="url(#sb-chrome)" />
          {/* Glowing Phone on Dashboard Mount */}
          <circle cx="250" cy="175" r="118" fill="#fde047" opacity="0.13" />
          <rect
            x="178"
            y="34"
            width="144"
            height="276"
            rx="24"
            fill="#0f172a"
            stroke="url(#sb-chrome)"
            strokeWidth="5"
          />
          <rect x="186" y="44" width="128" height="256" rx="18" fill="#111827" />
          {/* Pulsing golden halo + Caller ID: JESUS */}
          <circle cx="250" cy="112" r="34" fill="#f59e0b" opacity="0.22" />
          <circle cx="250" cy="112" r="24" fill="url(#sb-gold)" />
          <path d="M250 96 L254 108 L266 112 L254 116 L250 128 L246 116 L234 112 L246 108 Z" fill="#78350f" />
          <text x="250" y="164" textAnchor="middle" fill="#fef08a" fontSize="10" fontWeight="700" letterSpacing="1.5">
            INCOMING CALL
          </text>
          <text x="250" y="190" textAnchor="middle" fill="#ffffff" fontSize="24" fontWeight="900" letterSpacing="1">
            JESUS
          </text>
          {/* Decline & Pulsing Green Answer Button */}
          <circle cx="214" cy="252" r="18" fill="#dc2626" />
          <circle cx="286" cy="252" r="24" fill="#22c55e" opacity="0.3" />
          <circle cx="286" cy="252" r="18" fill="#16a34a" />
          <path d="M280 247 Q286 259 293 249" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          {/* Speech bubble: "Yes Appa!" */}
          <rect x="356" y="88" width="234" height="84" rx="20" fill="#fffbeb" stroke="#f59e0b" strokeWidth="3" />
          <polygon points="356,136 334,152 362,156" fill="#fffbeb" />
          <text x="473" y="125" textAnchor="middle" fill="#991b1b" fontSize="23" fontWeight="900">
            “Yes Appa!”
          </text>
          <text x="473" y="150" textAnchor="middle" fill="#78350f" fontSize="12" fontWeight="700">
            Ready to bring Christmas joy!
          </text>
        </g>
      )}

      {scene === 'trunk-vault' && (
        <g>
          <rect width="640" height="360" fill="#1c0b12" />
          {/* Radial golden light bursting out of open vintage trunk */}
          <polygon points="320,310 70,20 570,20" fill="#f59e0b" opacity="0.22" />
          <polygon points="320,310 160,20 480,20" fill="#fef08a" opacity="0.2" />
          {/* Open classic trunk lid at top */}
          <path d="M85 18 Q320 0 555 18 L525 68 Q320 52 115 68 Z" fill="#991b1b" stroke="url(#sb-chrome)" strokeWidth="4" />
          {/* Trunk bay interior */}
          <path d="M90 220 L550 220 L595 360 L45 360 Z" fill="#3b0d15" stroke="url(#sb-chrome)" strokeWidth="5" />
          {/* Glowing QR Code Boards + Wrapped Christmas Blessing Gifts */}
          <g transform="translate(155, 165) rotate(-7)">
            <rect width="128" height="156" rx="12" fill="#ffffff" stroke="#d97706" strokeWidth="4" />
            <rect x="14" y="12" width="100" height="22" rx="6" fill="#b91c1c" />
            <text x="64" y="27" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">
              BEAT MY SCORE!
            </text>
            {/*Stylized QR grid */}
            <rect x="26" y="44" width="76" height="76" rx="6" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
            <rect x="34" y="52" width="18" height="18" fill="#0f172a" />
            <rect x="76" y="52" width="18" height="18" fill="#0f172a" />
            <rect x="34" y="94" width="18" height="18" fill="#0f172a" />
            <rect x="58" y="74" width="14" height="14" fill="#b91c1c" />
            <rect x="76" y="94" width="18" height="18" fill="#0f172a" />
            <text x="64" y="138" textAnchor="middle" fill="#0f6840" fontSize="9.5" fontWeight="800">
              WIN FREE GIFT
            </text>
          </g>
          {/* Wrapped Crimson & Emerald Christmas Gifts */}
          <g transform="translate(328, 192)">
            <rect width="88" height="84" rx="8" fill="#dc2626" stroke="#fef08a" strokeWidth="2.5" />
            <rect x="38" y="0" width="12" height="84" fill="#fde047" />
            <rect x="0" y="36" width="88" height="12" fill="#fde047" />
            <circle cx="36" cy="-4" r="10" fill="none" stroke="#fde047" strokeWidth="4" />
            <circle cx="52" cy="-4" r="10" fill="none" stroke="#fde047" strokeWidth="4" />
          </g>
          <g transform="translate(428, 212) rotate(6)">
            <rect width="74" height="70" rx="8" fill="#0f6840" stroke="#a7f3d0" strokeWidth="2.5" />
            <rect x="31" y="0" width="12" height="70" fill="#fde047" />
            <rect x="0" y="29" width="74" height="12" fill="#fde047" />
          </g>
          {/* Team silhouettes looking down into trunk smiling */}
          <circle cx="235" cy="108" r="28" fill="#27151d" />
          <circle cx="320" cy="96" r="31" fill="#27151d" />
          <circle cx="405" cy="110" r="27" fill="#27151d" />
        </g>
      )}

      {scene === 'carpool-pickup' && (
        <g>
          <rect width="640" height="360" fill="#fef3c7" />
          <rect x="0" y="265" width="640" height="95" fill="#334155" />
          {/* Side profile of classic car packed with smiling squad + gift tower */}
          <path d="M75 215 L145 140 L455 140 L535 210 L575 220 L575 275 L65 275 Z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="3" />
          <rect x="165" y="152" width="120" height="58" rx="8" fill="#fffbeb" />
          <rect x="300" y="152" width="135" height="58" rx="8" fill="#fffbeb" />
          {/* Gift boxes stacked high in backseat */}
          <rect x="185" y="160" width="44" height="44" rx="4" fill="#0f6840" />
          <rect x="195" y="122" width="40" height="38" rx="4" fill="#f59e0b" />
          {/* QR board held out passenger window */}
          <rect x="372" y="146" width="54" height="66" rx="6" fill="#ffffff" stroke="#b91c1c" strokeWidth="3" />
          <rect x="384" y="160" width="30" height="30" fill="#0f172a" />
          {/* Classic whitewall tires */}
          <circle cx="170" cy="275" r="36" fill="#0f172a" />
          <circle cx="170" cy="275" r="24" fill="#ffffff" />
          <circle cx="170" cy="275" r="14" fill="url(#sb-chrome)" />
          <circle cx="465" cy="275" r="36" fill="#0f172a" />
          <circle cx="465" cy="275" r="24" fill="#ffffff" />
          <circle cx="465" cy="275" r="14" fill="url(#sb-chrome)" />
        </g>
      )}

      {scene === 'grey-street' && (
        <g>
          <rect width="640" height="360" fill="#cbd5e1" />
          {/* Grey monochrome city buildings & tired commuters on right */}
          <rect x="320" y="40" width="90" height="230" fill="#94a3b8" />
          <rect x="425" y="70" width="110" height="200" fill="#64748b" />
          <rect x="0" y="268" width="640" height="92" fill="#475569" />
          <circle cx="435" cy="215" r="16" fill="#334155" />
          <rect x="423" y="233" width="24" height="48" rx="8" fill="#334155" />
          <circle cx="505" cy="218" r="16" fill="#334155" />
          <rect x="493" y="236" width="24" height="45" rx="8" fill="#334155" />
          {/* Warm golden color wave radiating from Vintage Crimson Car on left */}
          <circle cx="165" cy="235" r="175" fill="#fde047" opacity="0.32" />
          <path d="M20 218 L95 162 L245 162 L305 218 L325 272 L20 272 Z" fill="#dc2626" />
          <circle cx="95" cy="272" r="28" fill="#0f172a" />
          <circle cx="95" cy="272" r="17" fill="#ffffff" />
          <circle cx="255" cy="272" r="28" fill="#0f172a" />
          <circle cx="255" cy="272" r="17" fill="#ffffff" />
        </g>
      )}

      {scene === 'jb-street-walk' && (
        <g>
          <rect width="640" height="360" fill="url(#sb-night-jb)" />
          {/* JB Heritage shophouse arches & festive string lights */}
          <path d="M30 85 Q320 135 610 75" fill="none" stroke="#fde047" strokeWidth="2" strokeDasharray="6 8" />
          <circle cx="130" cy="100" r="6" fill="#fde047" />
          <circle cx="250" cy="110" r="6" fill="#f87171" />
          <circle cx="380" cy="108" r="6" fill="#34d399" />
          <circle cx="500" cy="92" r="6" fill="#fde047" />
          {/* Squad holding QR Lanyard Boards */}
          <g transform="translate(245, 118)">
            <rect width="150" height="192" rx="14" fill="#ffffff" stroke="#f59e0b" strokeWidth="4" />
            <rect x="14" y="14" width="122" height="26" rx="7" fill="#b91c1c" />
            <text x="75" y="31" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">
              {churchName.toUpperCase()}
            </text>
            <rect x="33" y="52" width="84" height="84" rx="8" fill="#0f172a" />
            <rect x="43" y="62" width="22" height="22" fill="#ffffff" />
            <rect x="85" y="62" width="22" height="22" fill="#ffffff" />
            <rect x="43" y="104" width="22" height="22" fill="#ffffff" />
            <rect x="69" y="88" width="14" height="14" fill="#ef4444" />
            <text x="75" y="158" textAnchor="middle" fill="#18181b" fontSize="12" fontWeight="900">
              SCAN TO VERSUS!
            </text>
            <text x="75" y="175" textAnchor="middle" fill="#0f6840" fontSize="10" fontWeight="800">
              WIN A CHRISTMAS GIFT
            </text>
          </g>
        </g>
      )}

      {(scene === 'qr-scan-hook' || scene === 'color-burst-scan') && (
        <g>
          <rect width="640" height="360" fill="url(#sb-snow-glass)" />
          {scene === 'color-burst-scan' && (
            <>
              <circle cx="320" cy="180" r="220" fill="#fde047" opacity="0.24" />
              <circle cx="320" cy="180" r="155" fill="#fca5a5" opacity="0.25" />
            </>
          )}
          {/* Left: Evangelist QR Board */}
          <rect x="82" y="68" width="166" height="218" rx="16" fill="#ffffff" stroke="#d97706" strokeWidth="3.5" />
          <rect x="114" y="106" width="102" height="102" rx="8" fill="#18181b" />
          <rect x="126" y="118" width="24" height="24" fill="#ffffff" />
          <rect x="180" y="118" width="24" height="24" fill="#ffffff" />
          <rect x="126" y="172" width="24" height="24" fill="#ffffff" />
          <text x="165" y="244" textAnchor="middle" fill="#b91c1c" fontSize="12" fontWeight="900">
            BEAT MY SCORE!
          </text>
          {/* Laser scan beam connecting QR board to Guest's Phone */}
          <polygon points="216,156 376,72 376,286" fill="#10b981" opacity="0.18" />
          <line x1="216" y1="156" x2="376" y2="156" stroke="#059669" strokeWidth="3" strokeDasharray="7 5" />
          {/* Right: Guest Phone launching Christmas Arcade instantly */}
          <rect x="372" y="38" width="172" height="284" rx="26" fill="#0f172a" stroke="#334155" strokeWidth="4" />
          <rect x="382" y="50" width="152" height="260" rx="19" fill="#fffaf5" />
          <rect x="394" y="66" width="128" height="44" rx="10" fill="#b91c1c" />
          <text x="458" y="86" textAnchor="middle" fill="#fef08a" fontSize="8.5" fontWeight="800">
            {churchName.toUpperCase()}
          </text>
          <text x="458" y="101" textAnchor="middle" fill="#ffffff" fontSize="11.5" fontWeight="900">
            Christmas Arcade
          </text>
          {/* Mini game tiles on phone */}
          <rect x="394" y="120" width="128" height="48" rx="9" fill="#ecfdf5" stroke="#059669" strokeWidth="2" />
          <text x="458" y="148" textAnchor="middle" fill="#065f46" fontSize="11" fontWeight="900">
            Starlight Hockey 2P
          </text>
          <rect x="394" y="176" width="60" height="54" rx="9" fill="#fff1f2" stroke="#f43f5e" strokeWidth="1.5" />
          <rect x="462" y="176" width="60" height="54" rx="9" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
          <rect x="394" y="242" width="128" height="34" rx="17" fill="#dc2626" />
          <text x="458" y="263" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="900">
            TAP TO PLAY FREE!
          </text>
        </g>
      )}

      {scene === 'hockey-versus' && (
        <g>
          <rect width="640" height="360" fill="#0f172a" />
          {/* Neon Starlight Portal connecting two phones side-by-side */}
          <circle cx="320" cy="185" r="142" fill="#38bdf8" opacity="0.14" />
          {/* Phone 1 (Guest): Code 2412 */}
          <g transform="translate(116, 42) rotate(-4)">
            <rect width="164" height="278" rx="24" fill="#1e293b" stroke="#94a3b8" strokeWidth="4" />
            <rect x="10" y="12" width="144" height="254" rx="17" fill="#f0f9ff" />
            <line x1="10" y1="139" x2="154" y2="139" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="82" cy="139" r="24" fill="none" stroke="#0284c7" strokeWidth="2.5" />
            <circle cx="82" cy="215" r="20" fill="#dc2626" stroke="#ffffff" strokeWidth="3" />
            <rect x="32" y="22" width="100" height="24" rx="12" fill="#0f172a" />
            <text x="82" y="38" textAnchor="middle" fill="#fde047" fontSize="11" fontWeight="900">
              CODE: 2412
            </text>
          </g>
          {/* Phone 2 (Evangelist): Live Mirrored Rink */}
          <g transform="translate(360, 52) rotate(4)">
            <rect width="164" height="278" rx="24" fill="#1e293b" stroke="#94a3b8" strokeWidth="4" />
            <rect x="10" y="12" width="144" height="254" rx="17" fill="#f0f9ff" />
            <line x1="10" y1="139" x2="154" y2="139" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6 4" />
            <circle cx="82" cy="139" r="24" fill="none" stroke="#0284c7" strokeWidth="2.5" />
            <circle cx="82" cy="212" r="20" fill="#0f6840" stroke="#ffffff" strokeWidth="3" />
            <rect x="32" y="22" width="100" height="24" rx="12" fill="#065f46" />
            <text x="82" y="38" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">
              7 - 5 WIN!
            </text>
          </g>
          {/* Blazing Gold Turbo Puck shooting across both phones! */}
          <path d="M210 185 Q320 135 425 168" fill="none" stroke="#fde047" strokeWidth="7" strokeLinecap="round" />
          <circle cx="425" cy="168" r="16" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
        </g>
      )}

      {scene === 'arcade-montage' && (
        <g>
          <rect width="640" height="360" fill="#fffaf5" />
          {/* 3-Panel Split Screen Montage */}
          <rect x="24" y="28" width="184" height="304" rx="18" fill="#fff1f2" stroke="#fda4af" strokeWidth="3" />
          <circle cx="116" cy="130" r="38" fill="#dc2626" />
          <text x="116" y="136" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="900">
            DASH!
          </text>
          <text x="116" y="232" textAnchor="middle" fill="#881337" fontSize="15" fontWeight="900">
            Santa Dash
          </text>
          <text x="116" y="254" textAnchor="middle" fill="#9f1239" fontSize="11" fontWeight="700">
            3-Lane Runner
          </text>

          <rect x="228" y="28" width="184" height="304" rx="18" fill="#ecfdf5" stroke="#6ee7b7" strokeWidth="3" />
          <circle cx="320" cy="130" r="38" fill="#0f6840" />
          <line x1="286" y1="158" x2="354" y2="102" stroke="#fde047" strokeWidth="6" strokeLinecap="round" />
          <text x="320" y="232" textAnchor="middle" fill="#064e3b" fontSize="15" fontWeight="900">
            Berry Slash
          </text>
          <text x="320" y="254" textAnchor="middle" fill="#047857" fontSize="11" fontWeight="700">
            Combo Slicer
          </text>

          <rect x="432" y="28" width="184" height="304" rx="18" fill="#fffbeb" stroke="#fcd34d" strokeWidth="3" />
          <rect x="492" y="96" width="32" height="32" rx="6" fill="#d97706" />
          <rect x="524" y="96" width="32" height="32" rx="6" fill="#dc2626" />
          <rect x="508" y="128" width="32" height="32" rx="6" fill="#0f6840" />
          <text x="524" y="232" textAnchor="middle" fill="#78350f" fontSize="15" fontWeight="900">
            Block &amp; Candy
          </text>
          <text x="524" y="254" textAnchor="middle" fill="#92400e" fontSize="11" fontWeight="700">
            Puzzle Favorites
          </text>
        </g>
      )}

      {scene === 'gift-vip-pass' && (
        <g>
          <rect width="640" height="360" fill="url(#sb-warm-dusk)" />
          {/* Confetti sparkles */}
          <circle cx="105" cy="70" r="6" fill="#fde047" />
          <circle cx="530" cy="82" r="7" fill="#34d399" />
          <circle cx="490" cy="290" r="6" fill="#fde047" />
          <circle cx="135" cy="285" r="5" fill="#fca5a5" />
          {/* Left: Wrapped Physical Christmas Blessing Gift */}
          <g transform="translate(120, 128) rotate(-5)">
            <rect width="154" height="146" rx="14" fill="#dc2626" stroke="#fef08a" strokeWidth="4" />
            <rect x="66" y="0" width="22" height="146" fill="url(#sb-gold)" />
            <rect x="0" y="62" width="154" height="22" fill="url(#sb-gold)" />
            <ellipse cx="62" cy="-8" rx="22" ry="12" fill="none" stroke="#fde047" strokeWidth="6" />
            <ellipse cx="92" cy="-8" rx="22" ry="12" fill="none" stroke="#fde047" strokeWidth="6" />
          </g>
          {/* Right: Golden VIP Celebration Pass on Phone */}
          <g transform="translate(338, 48) rotate(3)">
            <rect width="176" height="268" rx="24" fill="#18181b" stroke="url(#sb-gold)" strokeWidth="4" />
            <rect x="12" y="14" width="152" height="240" rx="16" fill="#fffbeb" />
            <rect x="22" y="26" width="132" height="58" rx="10" fill="#881337" />
            <text x="88" y="48" textAnchor="middle" fill="#fde047" fontSize="9.5" fontWeight="800">
              VIP INVITATION PASS
            </text>
            <text x="88" y="68" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">
              XMAS-2412
            </text>
            <rect x="26" y="98" width="124" height="28" rx="14" fill="#0f6840" />
            <text x="88" y="116" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="800">
              Add to Calendar
            </text>
            <rect x="26" y="134" width="60" height="26" rx="13" fill="#e0f2fe" />
            <text x="56" y="151" textAnchor="middle" fill="#0369a1" fontSize="9.5" fontWeight="800">
              Maps
            </text>
            <rect x="90" y="134" width="60" height="26" rx="13" fill="#ecfeff" />
            <text x="120" y="151" textAnchor="middle" fill="#0e7490" fontSize="9.5" fontWeight="800">
              Waze
            </text>
            <text x="88" y="196" textAnchor="middle" fill="#78350f" fontSize="10.5" fontWeight="900">
              {churchName}
            </text>
          </g>
        </g>
      )}

      {scene === 'mirror-callback' && (
        <g>
          <rect width="640" height="360" fill="#120910" />
          {/* Warm Christmas Star & Bokeh */}
          <circle cx="320" cy="64" r="44" fill="#fde047" opacity="0.18" />
          <path d="M320 26 L326 48 L348 54 L326 60 L320 82 L314 60 L292 54 L314 48 Z" fill="#fef08a" />
          {/* Vintage Mirror Callback */}
          <rect
            x="148"
            y="96"
            width="344"
            height="112"
            rx="24"
            fill="#2b1620"
            stroke="url(#sb-chrome)"
            strokeWidth="7"
          />
          <text x="320" y="142" textAnchor="middle" fill="#fef08a" fontSize="13" fontWeight="800">
            APPA: “Well done. Save them a seat!”
          </text>
          <text x="320" y="174" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="900">
            {churchName} · Christmas Celebration
          </text>
          {/* End Card Banner */}
          <rect x="132" y="232" width="376" height="92" rx="18" fill="#991b1b" stroke="#fde047" strokeWidth="2.5" />
          <text x="320" y="266" textAnchor="middle" fill="#fef08a" fontSize="12" fontWeight="800" letterSpacing="1.2">
            SPOT OUR QR BOARDS IN JB · OR SCAN NOW!
          </text>
          <text x="320" y="298" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="900">
            Play · Win a Gift · Join the Celebration
          </text>
        </g>
      )}
    </svg>
  );
}
