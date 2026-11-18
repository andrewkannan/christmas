import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { CrownFeedItem, CrownStatusResponse, EventSettings } from '../types.ts';
import { fetchCrownStatus } from '../lib/api.ts';
import { playArcadeTone } from '../lib/sound.ts';
import { ChristmasCrownArt } from '../crown/ChristmasCrownArt.tsx';
import {
  CrownIcon,
  QrBoardIcon,
  RefreshIcon,
  SparkleIcon,
} from '../components/Icons.tsx';

interface PresentCrownPageProps {
  settings: EventSettings;
  onOpenRegister: () => void;
  onOpenAdmin: () => void;
}

export function PresentCrownPage({
  settings,
  onOpenRegister,
  onOpenAdmin,
}: PresentCrownPageProps) {
  const [status, setStatus] = useState<CrownStatusResponse | null>(null);
  const [celebrationItem, setCelebrationItem] = useState<CrownFeedItem | null>(null);
  const [demoFillOverride, setDemoFillOverride] = useState<number | null>(null);
  const [showQrCorner, setShowQrCorner] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const prevLatestIdRef = useRef<string | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const registerUrl = `${window.location.origin}/register`;
    QRCode.toDataURL(registerUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#022c22', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, []);

  const triggerCelebration = useCallback((item: CrownFeedItem) => {
    setCelebrationItem(item);
    playArcadeTone('fanfare');
    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebrationItem(null);
    }, 6500);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const next = await fetchCrownStatus();
      setStatus(next);
      const newest = next.recentRegistrations[0];
      if (newest) {
        if (
          prevLatestIdRef.current !== null &&
          prevLatestIdRef.current !== newest.id
        ) {
          triggerCelebration(newest);
        }
        prevLatestIdRef.current = newest.id;
      }
    } catch {
      // Keep last known status on transient network hiccup
    }
  }, [triggerCelebration]);

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => {
      void loadStatus();
    }, 4000);
    return () => {
      window.clearInterval(timer);
      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, [loadStatus]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleRunDemoPreview = () => {
    setDemoFillOverride(15);
    window.setTimeout(() => setDemoFillOverride(48), 500);
    window.setTimeout(() => setDemoFillOverride(78), 1100);
    window.setTimeout(() => setDemoFillOverride(100), 1700);
    triggerCelebration({
      id: `demo-${Date.now()}`,
      source: 'register',
      confirmationCode: 'CROWN-KING',
      memberName: 'Andrew Kannan',
      churchZone: 'Zone 1 · JB Central & City',
      soulName: 'Bala & Family',
      memberCount: 4,
      createdAt: new Date().toISOString(),
    });
    window.setTimeout(() => {
      setDemoFillOverride(null);
    }, 5500);
  };

  const targetSouls = status?.targetSouls ?? settings.crownTargetSouls ?? 500;
  const totalSouls = status?.totalProgressSouls ?? 0;
  const realFillPct = status?.fillPercentage ?? 0;
  const activeFillPct = demoFillOverride !== null ? demoFillOverride : realFillPct;
  const remainingSouls = Math.max(0, targetSouls - totalSouls);

  const activeZones = (status?.zoneLeaderboard ?? []).filter((z) => z.soulsCount > 0);
  const displayZones =
    activeZones.length > 0
      ? activeZones.slice(0, 7)
      : (status?.zoneLeaderboard ?? []).slice(0, 6);
  const topZoneMax = Math.max(
    1,
    ...displayZones.map((z) => z.soulsCount)
  );

  return (
    <div className="present-crown-stage">
      {/* Live Celebration Toast Overlay when a New Soul is registered */}
      {celebrationItem && (
        <div className="present-celebration-toast" role="status" aria-live="polite">
          <div className="present-celebration-toast__crown">👑</div>
          <div className="present-celebration-toast__body">
            <span className="present-celebration-toast__eyebrow">
              NEW JEWEL ADDED TO THE KING OF GLORY CROWN!
            </span>
            <strong className="present-celebration-toast__headline">
              {celebrationItem.memberName} ({celebrationItem.churchZone}) registered{' '}
              <em>{celebrationItem.soulName}</em>!
            </strong>
          </div>
          <div className="present-celebration-toast__badge">
            +{celebrationItem.memberCount}{' '}
            {celebrationItem.memberCount === 1 ? 'SOUL' : 'SOULS'}
          </div>
        </div>
      )}

      {/* Top Royal Stage Header */}
      <header className="present-header">
        <div className="present-header__identity">
          <span className="present-royal-pill">
            <CrownIcon size={15} />
            <span>{settings.churchName} · KING OF GLORY CHRISTMAS</span>
          </span>
          <h1 className="present-title">
            Crown the King of Glory with Souls
          </h1>
          <p className="present-scripture">
            “Lift up your heads, O you gates! And the King of Glory shall come in.” — Psalm 24:7 ·{' '}
            <strong>{settings.eventTitle}</strong>
          </p>
        </div>

        <div className="present-header__controls no-print">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onOpenRegister}
          >
            <SparkleIcon size={15} />
            <span>+ Register a Soul (/register)</span>
          </button>
          <button
            type="button"
            className="btn btn--subtle btn--sm"
            onClick={handleRunDemoPreview}
          >
            <CrownIcon size={15} />
            <span>Demo Crown Fill</span>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowQrCorner((v) => !v)}
          >
            <QrBoardIcon size={15} />
            <span>{showQrCorner ? 'Hide QR' : 'Show QR'}</span>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleToggleFullscreen}
          >
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Screen'}</span>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onOpenAdmin}
          >
            <span>/admin</span>
          </button>
        </div>
      </header>

      {/* 3-Column Sanctuary Big-Screen Layout */}
      <div className="present-main-grid">
        {/* Left Column: Home Church Zone Leaderboard */}
        <section className="present-panel" aria-labelledby="present-zones-heading">
          <div className="present-panel__head">
            <h2 id="present-zones-heading" className="present-panel__title">
              🎄 Home Church Zone Jewels
            </h2>
            <span className="present-panel__meta">
              {status?.registeredGroupsCount ?? 0} Registrations
            </span>
          </div>

          <ul className="present-zone-list" role="list">
            {displayZones.map((z, idx) => {
              const barPct =
                z.soulsCount > 0 ? Math.max(8, Math.round((z.soulsCount / topZoneMax) * 100)) : 0;
              return (
                <li key={z.zone} className="present-zone-item">
                  <div className="present-zone-item__top">
                    <span className="present-zone-item__name">
                      <span className="present-zone-item__rank">#{idx + 1}</span> {z.zone}
                    </span>
                    <strong className="present-zone-item__count">
                      {z.soulsCount} {z.soulsCount === 1 ? 'Soul' : 'Souls'}
                    </strong>
                  </div>
                  <div className="present-zone-bar" aria-hidden="true">
                    <div
                      className="present-zone-bar__fill"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {showQrCorner && qrDataUrl && (
            <div className="present-qr-card">
              <img
                src={qrDataUrl}
                alt="QR code to open /register and add a soul to the King of Glory Crown"
                className="present-qr-card__img"
              />
              <div className="present-qr-card__copy">
                <span className="present-qr-card__tag">SCAN FROM YOUR SEAT</span>
                <strong>Add Your Friend to the Crown!</strong>
                <span>Scan or visit <code>/register</code> to watch the Crown fill live</span>
              </div>
            </div>
          )}
        </section>

        {/* Center Column: Giant Christmas Tree-Themed Crown Progress Visualizer */}
        <section className="present-center-stage" aria-labelledby="present-crown-counter-heading">
          <div className="present-crown-showcase">
            <ChristmasCrownArt
              fillPercentage={activeFillPct}
              currentSouls={totalSouls}
              targetSouls={targetSouls}
            />
          </div>

          <div className="present-counter-deck">
            <div className="present-counter-deck__numbers">
              <div className="present-counter-primary">
                <span id="present-crown-counter-heading" className="present-counter-primary__value">
                  {totalSouls.toLocaleString()}
                </span>
                <span className="present-counter-primary__slash">/</span>
                <span className="present-counter-primary__target">
                  {targetSouls.toLocaleString()} SOULS
                </span>
              </div>
              <span className="present-counter-pct-badge">
                {activeFillPct}% FULL CROWN
              </span>
            </div>

            <progress
              className="present-native-progress visually-hidden"
              max={targetSouls}
              value={Math.min(targetSouls, totalSouls)}
            >
              {activeFillPct}%
            </progress>

            <div className="present-meter-track" aria-hidden="true">
              <div
                className="present-meter-track__fill"
                style={{ width: `${Math.min(100, activeFillPct)}%` }}
              />
            </div>

            <div className="present-counter-subrow">
              <span>
                👑 Member Registered Souls:{' '}
                <strong>{(status?.registeredSoulsHeadcount ?? 0).toLocaleString()}</strong>
              </span>
              {status?.countArcadeLeads && (
                <span>
                  🕹️ Arcade Guests:{' '}
                  <strong>{(status?.arcadeLeadsCount ?? 0).toLocaleString()}</strong>
                </span>
              )}
              <span>
                {remainingSouls === 0 ? (
                  <strong>🎉 FULL CROWN OF GLORY REACHED!</strong>
                ) : (
                  <>
                    ✨ <strong>{remainingSouls.toLocaleString()}</strong> more souls to complete
                    the Full Crown
                  </>
                )}
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Live Recent Registrations Feed */}
        <section className="present-panel" aria-labelledby="present-feed-heading">
          <div className="present-panel__head">
            <h2 id="present-feed-heading" className="present-panel__title">
              ✨ Live Crown Feed
            </h2>
            <button
              type="button"
              className="btn btn--ghost btn--sm present-refresh-btn"
              onClick={() => void loadStatus()}
              aria-label="Refresh Crown Status"
            >
              <RefreshIcon size={14} />
              <span>Live</span>
            </button>
          </div>

          {!status || status.recentRegistrations.length === 0 ? (
            <div className="present-empty-feed" role="status">
              <p>
                Waiting for the first soul registration! Scan the QR code or open{' '}
                <strong>/register</strong> to light the first jewel in the King of Glory Crown.
              </p>
            </div>
          ) : (
            <ul className="present-feed-list" role="list">
              {status.recentRegistrations.slice(0, 8).map((item) => (
                <li key={item.id} className="present-feed-card">
                  <div className="present-feed-card__top">
                    <span className="present-feed-card__zone">{item.churchZone}</span>
                    <span className="present-feed-card__count">
                      +{item.memberCount} {item.memberCount === 1 ? 'Soul' : 'Souls'}
                    </span>
                  </div>
                  <div className="present-feed-card__main">
                    <strong>{item.soulName}</strong>
                  </div>
                  <div className="present-feed-card__sub">
                    Invited by <strong>{item.memberName}</strong> · <code>{item.confirmationCode}</code>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
