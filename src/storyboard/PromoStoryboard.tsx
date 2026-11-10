import { useEffect, useId, useState } from 'react';
import type { EventSettings } from '../types.ts';
import { playArcadeTone } from '../lib/sound.ts';
import { CheckCircleIcon, QrBoardIcon, StarMarkIcon, TicketPassIcon } from '../components/Icons.tsx';
import {
  PRODUCTION_PROPS_CHECKLIST,
  STORYBOARD_CUTS,
  type StoryboardCutId,
  type StoryboardShot,
} from './storyboardData.ts';
import { StoryboardArt } from './StoryboardArt.tsx';
import { PhoneCallPropDialog, type PropSceneMode } from './PhoneCallPropDialog.tsx';

interface PromoStoryboardProps {
  settings: EventSettings;
  onOpenArcade: () => void;
  onOpenTeamQr: () => void;
}

const FILMED_STORAGE_KEY = 'xmas_storyboard_filmed_v1';
const PROPS_STORAGE_KEY = 'xmas_storyboard_props_v1';

function loadCheckedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveCheckedSet(key: string, values: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    // Ignore storage quota errors
  }
}

export function PromoStoryboard({
  settings,
  onOpenArcade,
  onOpenTeamQr,
}: PromoStoryboardProps) {
  const uid = useId();
  const [selectedCutId, setSelectedCutId] = useState<StoryboardCutId>('vault-duel');
  const [activeShotIndex, setActiveShotIndex] = useState(0);
  const [isPlayingAnimatic, setIsPlayingAnimatic] = useState(false);
  const [aspectGuide, setAspectGuide] = useState<'9:16' | '16:9'>('9:16');

  const [filmedIds, setFilmedIds] = useState<Set<string>>(() => loadCheckedSet(FILMED_STORAGE_KEY));
  const [checkedProps, setCheckedProps] = useState<Set<string>>(() =>
    loadCheckedSet(PROPS_STORAGE_KEY)
  );

  const [propDialogOpen, setPropDialogOpen] = useState(false);
  const [propDialogMode, setPropDialogMode] = useState<PropSceneMode>('incoming-call');

  const activeCut =
    STORYBOARD_CUTS.find((cut) => cut.id === selectedCutId) ?? STORYBOARD_CUTS[0]!;
  const shots = activeCut.shots;
  const currentShot: StoryboardShot = shots[activeShotIndex] ?? shots[0]!;

  const filmedInActiveCut = shots.filter((s) => filmedIds.has(s.id)).length;

  useEffect(() => {
    setActiveShotIndex(0);
    setIsPlayingAnimatic(false);
  }, [selectedCutId]);

  useEffect(() => {
    if (!isPlayingAnimatic) return;
    const stepMs = Math.max(2200, Math.round(currentShot.durationSec * 550));
    const timer = window.setTimeout(() => {
      if (activeShotIndex + 1 < shots.length) {
        const nextIndex = activeShotIndex + 1;
        setActiveShotIndex(nextIndex);
        const nextArt = shots[nextIndex]?.art;
        if (nextArt === 'jesus-call' || nextArt === 'hockey-versus' || nextArt === 'gift-vip-pass') {
          playArcadeTone('star');
        } else {
          playArcadeTone('tap');
        }
      } else {
        playArcadeTone('fanfare');
        setIsPlayingAnimatic(false);
      }
    }, stepMs);
    return () => window.clearTimeout(timer);
  }, [isPlayingAnimatic, activeShotIndex, currentShot.durationSec, shots]);

  const toggleShotFilmed = (shotId: string) => {
    setFilmedIds((prev) => {
      const next = new Set(prev);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      saveCheckedSet(FILMED_STORAGE_KEY, next);
      return next;
    });
  };

  const togglePropChecked = (propId: string) => {
    setCheckedProps((prev) => {
      const next = new Set(prev);
      if (next.has(propId)) {
        next.delete(propId);
      } else {
        next.add(propId);
      }
      saveCheckedSet(PROPS_STORAGE_KEY, next);
      return next;
    });
  };

  const openCallProp = (mode: PropSceneMode) => {
    setPropDialogMode(mode);
    setPropDialogOpen(true);
  };

  return (
    <section aria-labelledby={`${uid}-sb-title`} className="sb-page">
      {/* Executive Storyboard Hero */}
      <div className="console-hero sb-hero">
        <div className="console-hero__top">
          <div className="console-hero__summary">
            <span className="console-hero__eyebrow">
              <StarMarkIcon size={13} />
              <span>{settings.churchName} · Christmas Promo Director’s Board</span>
            </span>
            <h1 id={`${uid}-sb-title`} className="console-hero__title">
              “Yes Appa!” — Street Christmas Arcade Storyboard
            </h1>
            <p className="console-hero__sub">
              Starts with your <strong>vintage classic car</strong> entrance,{' '}
              <strong>centre mirror smile</strong>, and the call from <strong>JESUS</strong> (
              <em>“Yes Appa!”</em>)—then explodes onto Johor Bahru streets with{' '}
              <strong>QR Code Boards</strong>, <strong>2-Phone Starlight Hockey</strong>, and{' '}
              <strong>real Christmas gifts</strong>.
            </p>
          </div>

          <div className="console-hero__controls no-print">
            <button
              type="button"
              className="btn btn--gold btn--sm"
              onClick={() => openCallProp('incoming-call')}
            >
              <StarMarkIcon size={15} />
              <span>Launch “JESUS Calling” Screen Prop</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm sb-hero-print-btn"
              onClick={() => window.print()}
            >
              <span>Print / Save A4 Shot List</span>
            </button>
          </div>
        </div>

        <div className="sb-hero-stats">
          <div className="sb-stat-pill">
            <strong>{activeCut.totalDurationLabel}</strong>
            <span>Runtime &amp; Beats</span>
          </div>
          <div className="sb-stat-pill">
            <strong>
              {filmedInActiveCut} / {shots.length} Shots
            </strong>
            <span>Shoot Progress (Saved on Device)</span>
          </div>
          <div className="sb-stat-pill">
            <strong>{activeCut.musicStyle}</strong>
            <span>Soundtrack Vibe</span>
          </div>
        </div>
      </div>

      {/* 3 Creative Storyline Continuation Tabs */}
      <div className="card-panel sb-cut-selector">
        <div className="sb-cut-selector__head">
          <div>
            <h2 className="section-title" style={{ fontSize: '1.08rem' }}>
              Choose Your Story Continuation After “Yes Appa!” (3 Catchy Ideas)
            </h2>
            <p className="subtle-text" style={{ marginBlockStart: '0.2rem' }}>
              All 3 concepts keep your exact Shots 01–03 in the vintage car, then give you 3 fun
              ways to transition to the street QR Arcade.
            </p>
          </div>
        </div>

        <div className="sb-cut-tabs no-print" role="group" aria-label="Storyline concepts">
          {STORYBOARD_CUTS.map((cut) => {
            const selected = cut.id === activeCut.id;
            return (
              <button
                key={cut.id}
                type="button"
                className={`sb-cut-tab${selected ? ' sb-cut-tab--active' : ''}`}
                aria-pressed={selected}
                onClick={() => setSelectedCutId(cut.id)}
              >
                <span className="sb-cut-tab__badge">{cut.badge}</span>
                <strong className="sb-cut-tab__title">{cut.title}</strong>
              </button>
            );
          })}
        </div>

        <div className="sb-cut-pitch">
          <p className="sb-cut-pitch__logline">
            <strong>Pitch:</strong> {activeCut.logline}
          </p>
          <p className="sb-cut-pitch__why">
            <strong>Why it hooks viewers:</strong> {activeCut.whyItWorks}
          </p>
        </div>
      </div>

      {/* Interactive Animatic Preview Stage */}
      <div className="card-panel sb-animatic no-print">
        <div className="sb-animatic__top">
          <div>
            <span className="challenger-tag">{currentShot.phase}</span>
            <h2 className="section-title" style={{ marginBlockStart: '0.28rem' }}>
              Shot {String(currentShot.shotNumber).padStart(2, '0')} ({currentShot.timecode}) —{' '}
              {currentShot.title}
            </h2>
          </div>

          <div className="sb-aspect-toggle" role="group" aria-label="Camera framing guide">
            <button
              type="button"
              className={`btn btn--xs ${aspectGuide === '9:16' ? 'btn--gold' : 'btn--ghost'}`}
              aria-pressed={aspectGuide === '9:16'}
              onClick={() => setAspectGuide('9:16')}
            >
              9:16 Reels / TikTok Guide
            </button>
            <button
              type="button"
              className={`btn btn--xs ${aspectGuide === '16:9' ? 'btn--gold' : 'btn--ghost'}`}
              aria-pressed={aspectGuide === '16:9'}
              onClick={() => setAspectGuide('16:9')}
            >
              16:9 Sanctuary Screen
            </button>
          </div>
        </div>

        <div className="sb-stage-frame">
          <div className="sb-stage-canvas">
            <StoryboardArt scene={currentShot.art} churchName={settings.churchName} />
            {aspectGuide === '9:16' && (
              <div className="sb-reel-safezone" aria-hidden="true">
                <span>9:16 REEL SAFE ZONE</span>
              </div>
            )}
          </div>
          <div className="sb-stage-caption">
            <strong>{currentShot.dialogueOrText}</strong>
            <span>{currentShot.cameraAngle}</span>
          </div>
        </div>

        <div className="sb-transport">
          <div className="sb-transport__btns">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={activeShotIndex === 0}
              onClick={() => {
                setIsPlayingAnimatic(false);
                setActiveShotIndex((i) => Math.max(0, i - 1));
              }}
            >
              ◀ Prev Shot
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                if (!isPlayingAnimatic && activeShotIndex === shots.length - 1) {
                  setActiveShotIndex(0);
                }
                setIsPlayingAnimatic((playing) => !playing);
              }}
            >
              {isPlayingAnimatic ? '⏸ Pause Animatic' : '▶ Play Animatic Pitch'}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={activeShotIndex >= shots.length - 1}
              onClick={() => {
                setIsPlayingAnimatic(false);
                setActiveShotIndex((i) => Math.min(shots.length - 1, i + 1));
              }}
            >
              Next Shot ▶
            </button>
          </div>

          <div className="sb-filmstrip" role="group" aria-label="Jump to shot">
            {shots.map((shot, idx) => (
              <button
                key={shot.id}
                type="button"
                className={`sb-filmstrip__pill${idx === activeShotIndex ? ' sb-filmstrip__pill--active' : ''}${
                  filmedIds.has(shot.id) ? ' sb-filmstrip__pill--filmed' : ''
                }`}
                aria-label={`Jump to Shot ${shot.shotNumber}: ${shot.title}`}
                aria-pressed={idx === activeShotIndex}
                onClick={() => {
                  setIsPlayingAnimatic(false);
                  setActiveShotIndex(idx);
                }}
              >
                {String(shot.shotNumber).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ordered Shot-by-Shot Storyboard Cards */}
      <div>
        <div className="section-header-row">
          <h2 className="section-title">
            Frame-by-Frame Shooting Script ({shots.length} Shots)
          </h2>
          <span className="subtle-text">
            Tap “Mark Filmed” on shoot day to track camera coverage
          </span>
        </div>

        <ol className="sb-shot-grid">
          {shots.map((shot, idx) => {
            const isFilmed = filmedIds.has(shot.id);
            return (
              <li
                key={shot.id}
                className={`card-panel sb-shot-card${isFilmed ? ' sb-shot-card--filmed' : ''}`}
              >
                <div className="sb-shot-card__top">
                  <div className="sb-shot-card__badges">
                    <span className="sb-shot-num">
                      SHOT {String(shot.shotNumber).padStart(2, '0')}
                    </span>
                    <span className="sb-shot-time">{shot.timecode}</span>
                    <span className="sb-shot-phase">{shot.phase}</span>
                  </div>

                  <button
                    type="button"
                    className={`btn btn--xs no-print ${isFilmed ? 'btn--whatsapp' : 'btn--ghost'}`}
                    aria-pressed={isFilmed}
                    aria-label={`Mark Shot ${shot.shotNumber} (${shot.title}) as filmed`}
                    onClick={() => toggleShotFilmed(shot.id)}
                  >
                    {isFilmed && <CheckCircleIcon size={13} />}
                    <span>{isFilmed ? 'Filmed' : 'Mark Filmed'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="sb-shot-card__art-btn"
                  aria-label={`Preview Shot ${shot.shotNumber} in animatic stage`}
                  onClick={() => {
                    setIsPlayingAnimatic(false);
                    setActiveShotIndex(idx);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <StoryboardArt scene={shot.art} churchName={settings.churchName} />
                </button>

                <h3 className="sb-shot-card__title">{shot.title}</h3>

                <dl className="sb-shot-specs">
                  <div>
                    <dt>Visual Action</dt>
                    <dd>{shot.visualAction}</dd>
                  </div>
                  <div>
                    <dt>Camera &amp; Lens</dt>
                    <dd>{shot.cameraAngle}</dd>
                  </div>
                  <div>
                    <dt>Dialogue / Text</dt>
                    <dd className="sb-shot-specs__quote">{shot.dialogueOrText}</dd>
                  </div>
                  <div>
                    <dt>Audio &amp; Beat</dt>
                    <dd>{shot.audioCue}</dd>
                  </div>
                </dl>

                {shot.arcadeTieIn && (
                  <div className="sb-shot-card__cta no-print">
                    {shot.arcadeTieIn === 'call-prop' && (
                      <button
                        type="button"
                        className="btn btn--subtle btn--xs"
                        onClick={() =>
                          openCallProp(
                            shot.shotNumber <= 3 ? 'incoming-call' : 'final-message'
                          )
                        }
                      >
                        <StarMarkIcon size={13} />
                        <span>
                          {shot.shotNumber <= 3
                            ? 'Open “JESUS Calling” Phone Prop'
                            : 'Open “APPA Message” Phone Prop'}
                        </span>
                      </button>
                    )}
                    {shot.arcadeTieIn === 'qr-board' && (
                      <button
                        type="button"
                        className="btn btn--subtle btn--xs"
                        onClick={onOpenTeamQr}
                      >
                        <QrBoardIcon size={13} />
                        <span>Generate Printable QR Board (/team)</span>
                      </button>
                    )}
                    {(shot.arcadeTieIn === 'arcade-lobby' ||
                      shot.arcadeTieIn === 'hockey-versus' ||
                      shot.arcadeTieIn === 'vip-pass') && (
                      <button
                        type="button"
                        className="btn btn--subtle btn--xs"
                        onClick={onOpenArcade}
                      >
                        <TicketPassIcon size={13} />
                        <span>
                          {shot.arcadeTieIn === 'hockey-versus'
                            ? 'Open Live 2-Phone Hockey (/)'
                            : 'Open Live Christmas Arcade (/)'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Collapsible Secondary Production Kit & End-Card Copy (<details> per modern-web-guidance) */}
      <div className="sb-production-drawers">
        <details className="card-panel sb-details" open>
          <summary className="sb-details__summary">
            Shoot-Day Props, Phones &amp; Wardrobe Checklist ({checkedProps.size} /{' '}
            {PRODUCTION_PROPS_CHECKLIST.length} Ready)
          </summary>
          <div className="sb-details__body">
            <div className="sb-props-grid">
              {PRODUCTION_PROPS_CHECKLIST.map((prop) => {
                const done = checkedProps.has(prop.id);
                return (
                  <label
                    key={prop.id}
                    htmlFor={`${uid}-${prop.id}`}
                    className={`sb-prop-check-card${done ? ' sb-prop-check-card--done' : ''}`}
                  >
                    <input
                      id={`${uid}-${prop.id}`}
                      type="checkbox"
                      checked={done}
                      onChange={() => togglePropChecked(prop.id)}
                    />
                    <div>
                      <span className="sb-prop-check-card__cat">{prop.category}</span>
                      <strong className="sb-prop-check-card__title">{prop.item}</strong>
                      <p className="sb-prop-check-card__desc">{prop.detail}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </details>

        <details className="card-panel sb-details">
          <summary className="sb-details__summary">
            Director’s Camera Notes &amp; Final End-Card Copy ({settings.churchName})
          </summary>
          <div className="sb-details__body sb-director-notes">
            <div>
              <h3 className="sb-subheading">Filming the Vintage Rear-View Mirror (Shots 02 &amp; 10)</h3>
              <ul className="sb-tips-list">
                <li>
                  Place the camera near the passenger headrest with a <strong>50mm or 85mm</strong>{' '}
                  portrait lens (or iPhone 2× / 3× telephoto) aimed at the centre mirror—this fills
                  the frame with the driver’s eyes while keeping the camera itself invisible in the
                  reflection!
                </li>
                <li>
                  Have the driver look directly into the <strong>camera lens reflected inside the mirror</strong>:
                  optics work both ways, so looking at the lens in the mirror locks eyes directly
                  with the audience.
                </li>
                <li>
                  Park with warm street / fairy lights behind the rear window for cinematic Christmas
                  bokeh.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="sb-subheading">Ready-to-Paste Video Caption &amp; End Card</h3>
              <div className="sb-endcard-box">
                <p style={{ margin: '0 0 0.4rem' }}>
                  <strong>End Card Headline:</strong> {settings.churchName} — {settings.eventTitle}
                </p>
                <p style={{ margin: '0 0 0.4rem' }}>
                  <strong>Venue:</strong> {settings.venueName} ({settings.venueAddress})
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Social Caption Idea:</strong> When Appa calls… we take Christmas joy to the
                  streets! 🎄🚗 Spot our team’s QR boards around JB, challenge us to a 45-second
                  live 2-phone game right on your phone, claim a Christmas Blessing Gift, and unlock
                  your VIP Celebration Pass!
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>

      <PhoneCallPropDialog
        open={propDialogOpen}
        initialMode={propDialogMode}
        eventTitle={settings.eventTitle}
        churchName={settings.churchName}
        onClose={() => setPropDialogOpen(false)}
      />
    </section>
  );
}
