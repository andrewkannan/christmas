import { useCallback, useEffect, useRef, useState } from 'react';
import { playArcadeTone } from '../lib/sound.ts';

interface ChristmasCastleMagicProps {
  /** 'arcade' for the main page (/), 'register' for the invitation sign-up page (/register). */
  variant?: 'arcade' | 'register';
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
 * Clean, wordless Full-Screen Royal Palace Double Doors covering 100% of the viewport.
 * - Zero text or overlays — only the grand doors and continuously shining 24k Gold Door Knobs
 *   that invite the guest to tap.
 * - On tap/click: the door knobs turn, the heavy palace doors swing open smoothly and
 *   unhurriedly in 3D perspective (~1.9s) revealing pure clean white (#ffffff), and then
 *   the clean white gently fades out (~0.95s) so the page fades in smoothly.
 */
export function ChristmasCastleMagic(_props: ChristmasCastleMagicProps) {
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

  // Choreography (smooth, weighty, unhurried palace door swing):
  // 1. 'opening' (0ms -> 2150ms): Knobs turn (0-320ms), palace doors swing open smoothly over 1.88s
  //    as pure clean white (#ffffff) shines behind them.
  // 2. 'white-fade' (2150ms -> 3100ms): Pure clean white screen gently fades out over 950ms so the page fades in.
  // 3. 'opened' (3100ms): Overlay unmounts cleanly.
  useEffect(() => {
    if (phase === 'opening') {
      const t = window.setTimeout(() => {
        setPhase('white-fade');
      }, 2150);
      return () => window.clearTimeout(t);
    }
    if (phase === 'white-fade') {
      const t = window.setTimeout(() => {
        setPhase('opened');
      }, 950);
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

  return (
    <div
      className={`royal-door-overlay royal-door-overlay--${phase} no-print`}
      role="button"
      tabIndex={0}
      aria-label="Open palace doors"
      onClick={handleOpenDoor}
    >
      {/* Pure Clean White Light behind the doors that shines full-screen and then gently fades out */}
      <div className="royal-door-overlay__white-shine" aria-hidden="true" />

      {/* Center Seam Pure White Light Ray that widens as the palace doors unlatch and swing open */}
      <div className="royal-door-overlay__seam-beam" aria-hidden="true" />

      {/* 3D Full-Viewport Palace Double Doors Stage */}
      <div className="royal-door-stage" aria-hidden="true">
        {/* ==================== LEFT FULL-HEIGHT PALACE DOOR ==================== */}
        <div className="royal-door royal-door--left">
          <span className="royal-door__hinge royal-door__hinge--top" />
          <span className="royal-door__hinge royal-door__hinge--mid" />
          <span className="royal-door__hinge royal-door__hinge--bot" />

          <div className="royal-door__inner-frame">
            <div className="royal-door__panel royal-door__panel--upper">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
              <div className="royal-door__medallion-ring" />
            </div>

            <div className="royal-door__rail" />

            <div className="royal-door__panel royal-door__panel--lower">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
            </div>
          </div>

          {/* Left Shining 24k Gold Door Knob & Backplate */}
          <div className="royal-door__knob-assembly royal-door__knob-assembly--left">
            <div className="royal-door__knob-halo" />
            <div className="royal-door__backplate">
              <span className="royal-door__screw royal-door__screw--top" />
              <div className="royal-door__knob">
                <div className="royal-door__knob-cap">
                  <span className="royal-door__knob-glint" />
                </div>
                <svg className="royal-door__knob-spark" viewBox="0 0 32 32">
                  <path
                    d="M16 1 L18.2 12.2 L29.5 14.5 L18.2 16.8 L16 28 L13.8 16.8 L2.5 14.5 L13.8 12.2 Z"
                    fill="#ffffff"
                  />
                </svg>
              </div>
              <span className="royal-door__keyhole" />
              <span className="royal-door__screw royal-door__screw--bot" />
            </div>
          </div>
        </div>

        {/* ==================== RIGHT FULL-HEIGHT PALACE DOOR ==================== */}
        <div className="royal-door royal-door--right">
          <span className="royal-door__hinge royal-door__hinge--top" />
          <span className="royal-door__hinge royal-door__hinge--mid" />
          <span className="royal-door__hinge royal-door__hinge--bot" />

          <div className="royal-door__inner-frame">
            <div className="royal-door__panel royal-door__panel--upper">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
              <div className="royal-door__medallion-ring" />
            </div>

            <div className="royal-door__rail" />

            <div className="royal-door__panel royal-door__panel--lower">
              <DoorCornerFiligree className="royal-door__filigree--tl" />
              <DoorCornerFiligree className="royal-door__filigree--tr" />
              <DoorCornerFiligree className="royal-door__filigree--bl" />
              <DoorCornerFiligree className="royal-door__filigree--br" />
            </div>
          </div>

          {/* Right Shining 24k Gold Door Knob & Backplate */}
          <div className="royal-door__knob-assembly royal-door__knob-assembly--right">
            <div className="royal-door__knob-halo" />
            <div className="royal-door__backplate">
              <span className="royal-door__screw royal-door__screw--top" />
              <div className="royal-door__knob">
                <div className="royal-door__knob-cap">
                  <span className="royal-door__knob-glint" />
                </div>
                <svg className="royal-door__knob-spark royal-door__knob-spark--delayed" viewBox="0 0 32 32">
                  <path
                    d="M16 1 L18.2 12.2 L29.5 14.5 L18.2 16.8 L16 28 L13.8 16.8 L2.5 14.5 L13.8 12.2 Z"
                    fill="#ffffff"
                  />
                </svg>
              </div>
              <span className="royal-door__keyhole" />
              <span className="royal-door__screw royal-door__screw--bot" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
