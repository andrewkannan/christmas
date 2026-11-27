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
 * Clean, wordless Full-Screen 3D Royal Palace Double Doors covering 100% of the viewport.
 * - Zero text or overlays — only the grand carved doors, outer gold hinges, 3D door thickness,
 *   and continuously shining 24k Gold Door Knobs that invite the guest to tap.
 * - On tap/click:
 *   1. The 24k gold door knobs turn (0ms -> 320ms).
 *   2. The heavy palace doors pivot slowly and majestically on their outer hinges in true 3D
 *      perspective (2.4s swing with visible 3D door thickness and foreshortening, never sliding)
 *      revealing pure clean white (#ffffff) shining behind the doors.
 *   3. As the doors open wide, the pure clean white light shines and immediately fades smoothly
 *      (550ms) into the page so there is no long blank white screen.
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

  // Choreography:
  // - 'opening' (0ms -> 2050ms): Knobs turn (0-320ms), heavy palace doors swing open slowly in 3D perspective
  //   (300ms -> 2550ms) with pure clean white (#ffffff) shining behind them.
  // - 'white-fade' (2050ms -> 2600ms): As the doors reach wide open, the clean white light fades out
  //   over just 550ms so the page appears smoothly with no lingering blank white screen.
  // - 'opened' (2600ms): Overlay unmounts cleanly.
  useEffect(() => {
    if (phase === 'opening') {
      const t = window.setTimeout(() => {
        setPhase('white-fade');
      }, 2050);
      return () => window.clearTimeout(t);
    }
    if (phase === 'white-fade') {
      const t = window.setTimeout(() => {
        setPhase('opened');
      }, 550);
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
      {/* Pure Clean White (#ffffff) Light Behind the Doors (z-index: 1, NEVER in front of the doors) */}
      <div className="royal-door-overlay__white-shine" aria-hidden="true" />

      {/* Outer Palace Doorway Frame & 3D Perspective Stage */}
      <div className="royal-door-frame" aria-hidden="true">
        <div className="royal-door-stage">
          {/* ==================== LEFT FULL-HEIGHT PALACE DOOR ==================== */}
          <div className="royal-door royal-door--left">
            {/* 3D Inner Wood/Gold Door Thickness Slab (visible as the door pivots in 3D) */}
            <div className="royal-door__thickness royal-door__thickness--left" />

            {/* Dynamic 3D Depth Shading Overlay as door swings */}
            <div className="royal-door__depth-shade" />

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
            {/* 3D Inner Wood/Gold Door Thickness Slab (visible as the door pivots in 3D) */}
            <div className="royal-door__thickness royal-door__thickness--right" />

            {/* Dynamic 3D Depth Shading Overlay as door swings */}
            <div className="royal-door__depth-shade" />

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
    </div>
  );
}
