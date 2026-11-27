import { useCallback, useEffect, useRef, useState } from 'react';
import { KING_OF_GLORY_INVITE } from '../invite/kingOfGloryInvite.ts';
import { playArcadeTone } from '../lib/sound.ts';

interface ChristmasCastleMagicProps {
  /** 'arcade' for the main page (/), 'register' for the invitation sign-up page (/register). */
  variant: 'arcade' | 'register';
}

type DoorPhase = 'closed' | 'opening' | 'white-fade' | 'opened';

function DoorCornerFiligree({ className }: { className: string }) {
  return (
    <svg
      className={`royal-door__filigree ${className}`}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 60 C4 30 12 14 34 6" />
        <path d="M4 60 C30 60 48 52 58 30" />
        <path d="M14 46 c-6 -6 -2 -16 7 -14 c6 1 6 9 1 10 c-3 1 -5 -2 -3 -4" />
        <path d="M24 38 c4 -10 16 -12 20 -4" />
      </g>
      <circle cx="4" cy="60" r="2.8" fill="currentColor" />
    </svg>
  );
}

/**
 * Full-screen Royal King's Double Door ("King of Glory") covering 100% of the viewport.
 * - Waits for the guest to click/tap the 24k Gold Door Knob (or anywhere on the doors).
 * - On click: the door knobs turn, the full-screen double doors swing open in 3D perspective,
 *   shining pure clean white (#ffffff) across the entire viewport, and then the clean white
 *   smoothly fades out so the page fades in.
 */
export function ChristmasCastleMagic({ variant }: ChristmasCastleMagicProps) {
  const [phase, setPhase] = useState<DoorPhase>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return 'opened';
    }
    return 'closed';
  });

  const phaseRef = useRef<DoorPhase>(phase);
  phaseRef.current = phase;

  const handleOpenDoor = useCallback(() => {
    if (phaseRef.current !== 'closed') return;
    setPhase('opening');
    playArcadeTone('fanfare');
  }, []);

  // Choreography:
  // 1. 'opening' (0ms -> 980ms): Knobs turn, doors swing open in 3D, pure clean white light shines out to fill screen.
  // 2. 'white-fade' (980ms -> 1650ms): The pure clean white screen smoothly fades out so the page fades in.
  // 3. 'opened' (1650ms): Overlay unmounts cleanly.
  useEffect(() => {
    if (phase === 'opening') {
      const t = window.setTimeout(() => {
        setPhase('white-fade');
      }, 980);
      return () => window.clearTimeout(t);
    }
    if (phase === 'white-fade') {
      const t = window.setTimeout(() => {
        setPhase('opened');
      }, 680);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  // Allow Enter / Space / Escape keyboard users to open the door
  useEffect(() => {
    if (phase !== 'closed') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleOpenDoor();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleOpenDoor]);

  if (phase === 'opened') {
    return null;
  }

  const subtitle =
    variant === 'register'
      ? 'Christmas Eve Invitation · Tap the Door Knob to Enter'
      : 'Christmas Celebration · Tap the Door Knob to Enter';

  return (
    <div
      className={`royal-door-overlay royal-door-overlay--${phase} no-print`}
      role="dialog"
      aria-modal="false"
      aria-label="Royal Christmas Doors — Tap the door knob to open"
      onClick={handleOpenDoor}
    >
      {/* Pure Clean White Light behind the doors that shines full-screen and then fades out */}
      <div className="royal-door-overlay__white-shine" aria-hidden="true" />

      {/* Center Seam Light Ray that blazes as the doors unlatch */}
      <div className="royal-door-overlay__seam-beam" aria-hidden="true" />

      {/* 3D Full-Viewport Double Doors Stage */}
      <div className="royal-door-stage" aria-hidden="true">
        {/* ==================== LEFT FULL-HEIGHT ROYAL DOOR ==================== */}
        <div className="royal-door royal-door--left">
          {/* Outer Gold Hinge Plates */}
          <span className="royal-door__hinge royal-door__hinge--top" />
          <span className="royal-door__hinge royal-door__hinge--mid" />
          <span className="royal-door__hinge royal-door__hinge--bot" />

          <div className="royal-door__inner-frame">
            {/* Upper Recessed Coffered Panel */}
            <div className="royal-door__panel royal-door__panel--upper">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
              <div className="royal-door__medallion-ring" />
            </div>

            {/* Middle Lock Rail */}
            <div className="royal-door__rail" />

            {/* Lower Recessed Coffered Panel */}
            <div className="royal-door__panel royal-door__panel--lower">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
            </div>
          </div>

          {/* Left 24k Gold Door Knob & Escutcheon Backplate */}
          <div className="royal-door__knob-assembly royal-door__knob-assembly--left">
            <div className="royal-door__backplate">
              <span className="royal-door__screw royal-door__screw--top" />
              <div className="royal-door__knob">
                <div className="royal-door__knob-cap" />
              </div>
              <span className="royal-door__keyhole" />
              <span className="royal-door__screw royal-door__screw--bot" />
            </div>
          </div>
        </div>

        {/* ==================== RIGHT FULL-HEIGHT ROYAL DOOR ==================== */}
        <div className="royal-door royal-door--right">
          {/* Outer Gold Hinge Plates */}
          <span className="royal-door__hinge royal-door__hinge--top" />
          <span className="royal-door__hinge royal-door__hinge--mid" />
          <span className="royal-door__hinge royal-door__hinge--bot" />

          <div className="royal-door__inner-frame">
            {/* Upper Recessed Coffered Panel */}
            <div className="royal-door__panel royal-door__panel--upper">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
              <div className="royal-door__medallion-ring" />
            </div>

            {/* Middle Lock Rail */}
            <div className="royal-door__rail" />

            {/* Lower Recessed Coffered Panel */}
            <div className="royal-door__panel royal-door__panel--lower">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
            </div>
          </div>

          {/* Right 24k Gold Door Knob & Escutcheon Backplate */}
          <div className="royal-door__knob-assembly royal-door__knob-assembly--right">
            <div className="royal-door__backplate">
              <span className="royal-door__screw royal-door__screw--top" />
              <div className="royal-door__knob">
                <div className="royal-door__knob-cap" />
              </div>
              <span className="royal-door__keyhole" />
              <span className="royal-door__screw royal-door__screw--bot" />
            </div>
          </div>
        </div>
      </div>

      {/* Royal Crest Plaque above the Door Knobs */}
      <div className="royal-door-overlay__crest" aria-hidden="true">
        <div className="royal-door-overlay__seal">
          <img src="/favicon.svg" alt="" width="58" height="58" />
        </div>
        <span className="royal-door-overlay__church">
          {KING_OF_GLORY_INVITE.churchShortName} · {KING_OF_GLORY_INVITE.churchFullName}
        </span>
        <strong className="royal-door-overlay__title">{KING_OF_GLORY_INVITE.title}</strong>
      </div>

      {/* Interactive Click-to-Open Prompt below the Door Knobs */}
      <div className="royal-door-overlay__prompt">
        <button
          type="button"
          className="royal-door-overlay__btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDoor();
          }}
        >
          <span>{subtitle}</span>
        </button>
      </div>
    </div>
  );
}
