import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  BOOTH_ARCADE_GAMES,
  BOOTH_GAME_LABELS_MAP,
  type BoothGameId,
  type BoothPublicSummaryResponse,
  type BoothRelationship,
  type BoothWinnerRecord,
  type EventSettings,
} from '../types.ts';
import {
  fetchBoothPublicSummary,
  fetchBoothWinnerByVoucher,
  patchBoothWinnerPublic,
  submitBoothWinner,
} from '../lib/api.ts';
import { playArcadeTone, triggerHaptic } from '../lib/sound.ts';
import {
  CheckCircleIcon,
  CopyIcon,
  CrownIcon,
  GiftBoxIcon,
  PlayTriangleIcon,
  QrBoardIcon,
  SparkleIcon,
  TicketPassIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import { BoothGameRunner } from './BoothGames.tsx';

interface ChurchBoothPageProps {
  settings: EventSettings;
  onOpenGuestArcade: () => void;
}

type BoothStep =
  | { kind: 'hub' }
  | { kind: 'playing'; game: BoothGameId }
  | { kind: 'claim'; game: BoothGameId; score: number }
  | { kind: 'voucher'; winner: BoothWinnerRecord; justUnlocked?: boolean };

const SAVED_BOOTH_VOUCHER_KEY = 'christmas_booth_last_voucher_v1';
const BOOTH_KIOSK_MODE_KEY = 'christmas_booth_kiosk_mode_v1';

const RELATIONSHIPS: readonly { value: BoothRelationship; label: string; emoji: string }[] = [
  { value: 'Friend', label: 'Friend', emoji: '🤝' },
  { value: 'Family', label: 'Family / Relative', emoji: '👨‍👩‍👧' },
  { value: 'Colleague', label: 'Colleague / Classmate', emoji: '💼' },
  { value: 'Neighbor', label: 'Neighbor', emoji: '🏡' },
] as const;

const SEAT_OPTIONS: readonly { count: number; label: string; sub: string }[] = [
  { count: 1, label: '1 VIP Seat', sub: 'For my friend' },
  { count: 2, label: '2 VIP Seats', sub: 'Friend + partner / me' },
  { count: 3, label: '3+ Family Seats', sub: 'Bring their family' },
] as const;

function makeClientRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `booth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ChurchBoothPage({ settings, onOpenGuestArcade }: ChurchBoothPageProps) {
  const uid = useId();
  const qrModalRef = useRef<HTMLDialogElement | null>(null);
  const memberNameRef = useRef<HTMLInputElement | null>(null);
  const memberPhoneRef = useRef<HTMLInputElement | null>(null);
  const friendNameRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<BoothStep>({ kind: 'hub' });
  const [summary, setSummary] = useState<BoothPublicSummaryResponse | null>(null);
  const [kioskMode, setKioskMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BOOTH_KIOSK_MODE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [lastSavedVoucher, setLastSavedVoucher] = useState<BoothWinnerRecord | null>(null);

  // Claim form states
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [countryCode, setCountryCode] = useState(settings.defaultCountryCode || '60');
  const [friendName, setFriendName] = useState('');
  const [relationship, setRelationship] = useState<BoothRelationship>('Friend');
  const [seatsReserved, setSeatsReserved] = useState<number>(2);
  const [friendPhone, setFriendPhone] = useState('');
  const [clientRequestId, setClientRequestId] = useState(() => makeClientRequestId());

  // Field-level blur/submit validation errors (per modern-web-guidance forms skill)
  const [touched, setTouched] = useState<{
    memberName?: boolean;
    memberPhone?: boolean;
    friendName?: boolean;
  }>({});
  const [fieldErrors, setFieldErrors] = useState<{
    memberName?: string;
    memberPhone?: string;
    friendName?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Voucher states
  const [voucherQrDataUrl, setVoucherQrDataUrl] = useState('');
  const [boothHubQrDataUrl, setBoothHubQrDataUrl] = useState('');
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [patchingVoucher, setPatchingVoucher] = useState(false);

  const boothPageUrl = useMemo(() => {
    return `${window.location.origin}/winners`;
  }, []);

  const refreshSummary = useCallback(() => {
    fetchBoothPublicSummary()
      .then((res) => setSummary(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSummary();
    const interval = setInterval(refreshSummary, 8000);
    return () => clearInterval(interval);
  }, [refreshSummary]);

  // Generate QR code for the Booth Poster modal
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(boothPageUrl, {
      width: 520,
      margin: 2,
      color: { dark: '#0b1914', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setBoothHubQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [boothPageUrl]);

  // Check URL ?voucher=VIP-XXXX (used when scanning Kiosk QR on personal phone) or saved local voucher
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVoucher = (params.get('voucher') || '').trim();
    if (urlVoucher) {
      fetchBoothWinnerByVoucher(urlVoucher)
        .then(({ winner }) => {
          setLastSavedVoucher(winner);
          setStep({ kind: 'voucher', winner, justUnlocked: false });
        })
        .catch(() => {});
      return;
    }

    try {
      const savedCode = localStorage.getItem(SAVED_BOOTH_VOUCHER_KEY);
      if (savedCode) {
        fetchBoothWinnerByVoucher(savedCode)
          .then(({ winner }) => setLastSavedVoucher(winner))
          .catch(() => {});
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Generate QR code for the active voucher so Kiosk players can scan to open on their phone
  useEffect(() => {
    if (step.kind !== 'voucher') {
      setVoucherQrDataUrl('');
      return;
    }
    let active = true;
    const handoffUrl = `${window.location.origin}/winners?voucher=${encodeURIComponent(
      step.winner.voucherCode
    )}`;
    QRCode.toDataURL(handoffUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0b1914', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setVoucherQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [step]);

  // Light-dismiss fallback for Booth QR dialog
  useEffect(() => {
    const dialog = qrModalRef.current;
    if (!dialog) return;
    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    const onBackdropClick = (e: MouseEvent) => {
      if (supportsClosedBy) return;
      if (e.target !== dialog) return;
      if (e.clientX === 0 && e.clientY === 0) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inside) dialog.close();
    };
    dialog.addEventListener('click', onBackdropClick);
    return () => dialog.removeEventListener('click', onBackdropClick);
  }, []);

  const toggleKioskMode = () => {
    setKioskMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BOOTH_KIOSK_MODE_KEY, next ? '1' : '0');
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const validateMemberName = (val: string): string | undefined => {
    if (!val.trim()) return 'Please enter your name.';
    return undefined;
  };

  const validateMemberPhone = (val: string): string | undefined => {
    const digits = val.replace(/\D/g, '');
    if (digits.length < 7) return 'Please enter a valid mobile number (at least 7 digits).';
    return undefined;
  };

  const validateFriendName = (val: string): string | undefined => {
    if (!val.trim()) {
      return "Please enter the friend or family member's name you are winning this seat for.";
    }
    return undefined;
  };

  const handleStartGame = (game: BoothGameId) => {
    playArcadeTone('tap');
    triggerHaptic(15);
    setStep({ kind: 'playing', game });
  };

  const handleGameFinished = useCallback((game: BoothGameId, score: number) => {
    setClientRequestId(makeClientRequestId());
    setSubmitError(null);
    setFieldErrors({});
    setTouched({});
    setStep({ kind: 'claim', game, score });
  }, []);

  const handleResetForNextMember = () => {
    setFriendName('');
    setFriendPhone('');
    setRelationship('Friend');
    setSeatsReserved(2);
    if (kioskMode) {
      setMemberName('');
      setMemberPhone('');
    }
    setFieldErrors({});
    setTouched({});
    setSubmitError(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has('voucher')) {
      params.delete('voucher');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `/winners?${qs}` : '/winners');
    }
    setStep({ kind: 'hub' });
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'claim' || submitting) return;

    const nameErr = validateMemberName(memberName);
    const phoneErr = validateMemberPhone(memberPhone);
    const friendErr = validateFriendName(friendName);

    setTouched({ memberName: true, memberPhone: true, friendName: true });
    setFieldErrors({
      memberName: nameErr,
      memberPhone: phoneErr,
      friendName: friendErr,
    });

    if (nameErr) {
      memberNameRef.current?.focus();
      return;
    }
    if (phoneErr) {
      memberPhoneRef.current?.focus();
      return;
    }
    if (friendErr) {
      friendNameRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { winner } = await submitBoothWinner({
        memberName: memberName.trim(),
        memberPhone: memberPhone.trim(),
        countryCode,
        friendName: friendName.trim(),
        relationship,
        seatsReserved,
        friendPhone: friendPhone.trim(),
        gamePlayed: step.game,
        score: step.score,
        clientRequestId,
      });

      if (!kioskMode) {
        try {
          localStorage.setItem(SAVED_BOOTH_VOUCHER_KEY, winner.voucherCode);
        } catch {
          // Ignore
        }
      }
      setLastSavedVoucher(winner);
      playArcadeTone('fanfare');
      triggerHaptic(35);
      refreshSummary();
      setStep({ kind: 'voucher', winner, justUnlocked: true });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save your booth voucher. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTokenHandedOut = async (winner: BoothWinnerRecord) => {
    if (patchingVoucher) return;
    setPatchingVoucher(true);
    try {
      const { winner: updated } = await patchBoothWinnerPublic(winner.voucherCode, {
        tokenHandedOut: !winner.tokenHandedOut,
      });
      setLastSavedVoucher(updated);
      setStep((curr) => (curr.kind === 'voucher' ? { ...curr, winner: updated } : curr));
      refreshSummary();
      playArcadeTone('pickup');
    } catch {
      // Ignore transient error
    } finally {
      setPatchingVoucher(false);
    }
  };

  const handleSendFriendWhatsapp = (winner: BoothWinnerRecord) => {
    void patchBoothWinnerPublic(winner.voucherCode, { whatsappSent: true })
      .then(({ winner: updated }) => {
        setLastSavedVoucher(updated);
        setStep((curr) => (curr.kind === 'voucher' ? { ...curr, winner: updated } : curr));
      })
      .catch(() => {});
  };

  const handleCopyFriendInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteLink(true);
      setTimeout(() => setCopiedInviteLink(false), 2200);
    } catch {
      // Ignore
    }
  };

  return (
    <section aria-labelledby={`${uid}-booth-heading`} className="booth-stage stage-enter">
      {/* Top Church Booth Banner */}
      <div className="hero-marquee booth-hero">
        <div className="hero-marquee__glow" aria-hidden="true" />
        <div className="hero-marquee__top">
          <span className="marquee-pill marquee-pill--gold">
            <CrownIcon size={14} />
            <span>{settings.churchName} · Church Member Booth</span>
          </span>

          <div className="booth-mode-actions">
            <button
              type="button"
              className={`quick-tag-chip${kioskMode ? ' quick-tag-chip--active' : ''}`}
              aria-pressed={kioskMode}
              onClick={toggleKioskMode}
            >
              {kioskMode ? '🖥️ Shared Booth Kiosk' : '📱 Personal Phone Mode'}
            </button>
            <button
              type="button"
              className="quick-tag-chip"
              onClick={() => qrModalRef.current?.showModal()}
            >
              <QrBoardIcon size={14} />
              <span>Booth QR Poster</span>
            </button>
          </div>
        </div>

        <h1 id={`${uid}-booth-heading`} className="hero-marquee__title">
          Win a VIP Seat for Your Friend &amp; Family
        </h1>

        <p className="hero-marquee__subtitle">
          Play any 20-second game below to unlock a{' '}
          <strong>Reserved VIP Seat + Physical {settings.giftDescription} Token</strong> to invite a
          new soul to <strong>{settings.eventTitle}</strong>!
        </p>

        {/* Live Church Mobilization Counter */}
        <div className="booth-impact-bar" aria-label="Church booth impact statistics">
          <div className="booth-impact-stat">
            <strong>{summary?.totalMembersPlayed ?? 0}</strong>
            <span>Members Played</span>
          </div>
          <div className="booth-impact-stat booth-impact-stat--gold">
            <strong>{summary?.totalNewSoulSeats ?? 0}</strong>
            <span>New Soul Seats Won</span>
          </div>
          <div className="booth-impact-stat">
            <strong>{summary?.tokensHandedOut ?? 0}</strong>
            <span>Gift Tokens Claimed</span>
          </div>
        </div>

        {lastSavedVoucher && step.kind === 'hub' && !kioskMode && (
          <div className="hero-marquee__pass-row" style={{ marginBlockStart: '0.75rem' }}>
            <span className="subtle-text" style={{ color: '#fef08a', fontSize: '0.85rem' }}>
              Seat won for <strong>{lastSavedVoucher.friendName}</strong> ({lastSavedVoucher.voucherCode})
            </span>
            <button
              type="button"
              className="btn btn--gold-light btn--sm"
              onClick={() =>
                setStep({ kind: 'voucher', winner: lastSavedVoucher, justUnlocked: false })
              }
            >
              <TicketPassIcon size={15} />
              <span>Open My VIP Voucher</span>
            </button>
          </div>
        )}
      </div>

      {/* STEP 1: WALK-UP 4-GAME HUB */}
      {step.kind === 'hub' && (
        <>
          <div className="booth-section-header">
            <h2 className="section-title">
              <SparkleIcon size={18} />
              <span>Step 1: Pick Any Game to Play &amp; Win Instantly</span>
            </h2>
            <p className="subtle-text">
              Designed for every generation — kids, youth, parents, aunties &amp; uncles! Every play
              unlocks a VIP Seat &amp; Gift Token.
            </p>
          </div>

          <ul role="list" className="arcade-shelf booth-games-shelf">
            {BOOTH_ARCADE_GAMES.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  className="arcade-tile booth-game-tile"
                  onClick={() => handleStartGame(game.id)}
                >
                  <div
                    className="arcade-tile__icon"
                    style={{ background: game.accentBg, color: game.accentFg }}
                    aria-hidden="true"
                  >
                    <span style={{ fontSize: '1.75rem' }}>{game.emoji}</span>
                  </div>

                  <div className="arcade-tile__meta">
                    <div className="arcade-tile__title-row">
                      <h3 className="arcade-tile__title">{game.title}</h3>
                      <span className="podium-tier-tag podium-tier-tag--1">
                        <span>{game.generationTag}</span>
                      </span>
                    </div>

                    <p className="booth-game-tile__desc">{game.subtitle}</p>

                    <div className="arcade-tile__sub">
                      <span className="arcade-tile__hint">
                        {game.durationLabel} · {game.controlHint}
                      </span>
                    </div>
                  </div>

                  <span className="arcade-tile__play">
                    <span>Play</span>
                    <PlayTriangleIcon size={11} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Recent Church Booth Winners Wall */}
          {summary && summary.recentWinners.length > 0 && (
            <div className="card-panel booth-winners-wall">
              <div className="booth-winners-wall__header">
                <h2 className="section-title">
                  <GiftBoxIcon size={18} />
                  <span>Live Church Booth Winners Wall</span>
                </h2>
                <span className="marquee-pill marquee-pill--gold">
                  <span>{summary.totalNewSoulSeats} VIP Seats Reserved</span>
                </span>
              </div>

              <ul role="list" className="booth-ticker-list">
                {summary.recentWinners.map((item) => (
                  <li key={item.voucherCode} className="booth-ticker-item">
                    <span className="booth-ticker-item__code">{item.voucherCode}</span>
                    <div className="booth-ticker-item__body">
                      <strong>{item.memberName}</strong> won{' '}
                      <strong>
                        {item.seatsReserved} VIP {item.seatsReserved === 1 ? 'Seat' : 'Seats'}
                      </strong>{' '}
                      for their {item.relationship.toLowerCase()}{' '}
                      <span className="booth-ticker-item__vip">{item.friendName}</span>
                    </div>
                    <span className="booth-ticker-item__game">
                      {BOOTH_GAME_LABELS_MAP[item.gamePlayed]} · {item.score} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* STEP 2: ACTIVE BOOTH GAME */}
      {step.kind === 'playing' && (
        <div className="card-panel">
          <BoothGameRunner
            gameId={step.game}
            onFinish={(score) => handleGameFinished(step.game, score)}
            onBack={() => setStep({ kind: 'hub' })}
          />
        </div>
      )}

      {/* STEP 3: VICTORY + DEDICATE VIP SEAT TO FRIEND/FAMILY */}
      {step.kind === 'claim' && (
        <div className="card-panel booth-claim-card stage-enter">
          <div className="booth-victory-banner">
            <span className="marquee-pill marquee-pill--gold">
              <SparkleIcon size={14} />
              <span>
                VICTORY · {step.score} PTS ON {BOOTH_GAME_LABELS_MAP[step.game]}
              </span>
            </span>
            <h2 className="booth-victory-banner__title">
              🎉 You Won a VIP Seat &amp; Gift Token!
            </h2>
            <p className="booth-victory-banner__sub">
              Who are you claiming this Christmas Seat &amp; Gift Token for? Enter your name and
              your friend or family member&rsquo;s name below!
            </p>
          </div>

          <form
            aria-labelledby={`${uid}-claim-form-title`}
            noValidate
            onSubmit={handleClaimSubmit}
            className="claim-form"
          >
            <h3 id={`${uid}-claim-form-title`} className="visually-hidden">
              Reserve VIP Seat and Gift Token for Your Friend or Family Member
            </h3>

            {submitError && (
              <div role="alert" className="error-banner">
                {submitError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor={`${uid}-member-name`} className="form-label">
                1. Your Name (Church Member) <span aria-hidden="true">*</span>
              </label>
              <span id={`${uid}-member-name-hint`} className="field-hint">
                So your friend knows this VIP invitation &amp; gift came personally from you.
              </span>
              <input
                ref={memberNameRef}
                id={`${uid}-member-name`}
                name="memberName"
                type="text"
                required
                maxLength={80}
                autoComplete="name"
                enterKeyHint="next"
                className="form-input"
                placeholder="e.g. Andrew Kannan"
                value={memberName}
                aria-invalid={Boolean(touched.memberName && fieldErrors.memberName)}
                aria-describedby={
                  touched.memberName && fieldErrors.memberName
                    ? `${uid}-member-name-hint ${uid}-member-name-err`
                    : `${uid}-member-name-hint`
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setMemberName(val);
                  if (fieldErrors.memberName) {
                    setFieldErrors((prev) => ({ ...prev, memberName: validateMemberName(val) }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, memberName: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    memberName: validateMemberName(memberName),
                  }));
                }}
              />
              {touched.memberName && fieldErrors.memberName && (
                <p id={`${uid}-member-name-err`} className="field-error" role="status">
                  {fieldErrors.memberName}
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`${uid}-member-phone`} className="form-label">
                2. Your Mobile Number (WhatsApp) <span aria-hidden="true">*</span>
              </label>
              <span id={`${uid}-member-phone-hint`} className="field-hint">
                Used to link your Booth Gift Token and send you a copy of your friend&rsquo;s pass.
              </span>
              <div className="phone-input-row">
                <select
                  aria-label="Country code"
                  name="countryCode"
                  className="form-select phone-country-select"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  <option value="60">🇲🇾 +60</option>
                  <option value="65">🇸🇬 +65</option>
                  <option value="62">🇮🇩 +62</option>
                  <option value="91">🇮🇳 +91</option>
                  <option value="44">🇬🇧 +44</option>
                  <option value="1">🇺🇸 +1</option>
                </select>
                <input
                  ref={memberPhoneRef}
                  id={`${uid}-member-phone`}
                  name="memberPhone"
                  type="tel"
                  inputMode="tel"
                  required
                  maxLength={24}
                  autoComplete="tel-national"
                  enterKeyHint="next"
                  className="form-input"
                  placeholder="012-345 6789"
                  value={memberPhone}
                  aria-invalid={Boolean(touched.memberPhone && fieldErrors.memberPhone)}
                  aria-describedby={
                    touched.memberPhone && fieldErrors.memberPhone
                      ? `${uid}-member-phone-hint ${uid}-member-phone-err`
                      : `${uid}-member-phone-hint`
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setMemberPhone(val);
                    if (fieldErrors.memberPhone) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        memberPhone: validateMemberPhone(val),
                      }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, memberPhone: true }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      memberPhone: validateMemberPhone(memberPhone),
                    }));
                  }}
                />
              </div>
              {touched.memberPhone && fieldErrors.memberPhone && (
                <p id={`${uid}-member-phone-err`} className="field-error" role="status">
                  {fieldErrors.memberPhone}
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`${uid}-friend-name`} className="form-label">
                3. Who Are You Winning This VIP Seat For? (&ldquo;New Soul&rdquo; Name){' '}
                <span aria-hidden="true">*</span>
              </label>
              <span id={`${uid}-friend-name-hint`} className="field-hint">
                Enter your friend, family member, colleague, or neighbor&rsquo;s name (e.g. Uncle
                Lim, Sarah, Cousin David).
              </span>
              <input
                ref={friendNameRef}
                id={`${uid}-friend-name`}
                name="friendName"
                type="text"
                required
                maxLength={80}
                autoComplete="off"
                enterKeyHint="next"
                className="form-input"
                placeholder="e.g. Uncle Lim / Colleague Sarah"
                value={friendName}
                aria-invalid={Boolean(touched.friendName && fieldErrors.friendName)}
                aria-describedby={
                  touched.friendName && fieldErrors.friendName
                    ? `${uid}-friend-name-hint ${uid}-friend-name-err`
                    : `${uid}-friend-name-hint`
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setFriendName(val);
                  if (fieldErrors.friendName) {
                    setFieldErrors((prev) => ({ ...prev, friendName: validateFriendName(val) }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, friendName: true }));
                  setFieldErrors((prev) => ({
                    ...prev,
                    friendName: validateFriendName(friendName),
                  }));
                }}
              />
              {touched.friendName && fieldErrors.friendName && (
                <p id={`${uid}-friend-name-err`} className="field-error" role="status">
                  {fieldErrors.friendName}
                </p>
              )}
            </div>

            <fieldset className="booth-fieldset">
              <legend className="form-label">4. Your Relationship with Them</legend>
              <div className="booth-radio-grid">
                {RELATIONSHIPS.map((rel) => {
                  const checked = relationship === rel.value;
                  const radioId = `${uid}-rel-${rel.value}`;
                  return (
                    <label
                      key={rel.value}
                      htmlFor={radioId}
                      className={`booth-radio-pill${checked ? ' booth-radio-pill--checked' : ''}`}
                    >
                      <input
                        id={radioId}
                        type="radio"
                        name="relationship"
                        value={rel.value}
                        checked={checked}
                        onChange={() => setRelationship(rel.value)}
                      />
                      <span>
                        {rel.emoji} {rel.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="booth-fieldset">
              <legend className="form-label">5. How Many VIP Seats to Reserve?</legend>
              <div className="booth-radio-grid booth-radio-grid--3">
                {SEAT_OPTIONS.map((opt) => {
                  const checked = seatsReserved === opt.count;
                  const radioId = `${uid}-seats-${opt.count}`;
                  return (
                    <label
                      key={opt.count}
                      htmlFor={radioId}
                      className={`booth-radio-pill${checked ? ' booth-radio-pill--checked' : ''}`}
                    >
                      <input
                        id={radioId}
                        type="radio"
                        name="seatsReserved"
                        value={opt.count}
                        checked={checked}
                        onChange={() => setSeatsReserved(opt.count)}
                      />
                      <div>
                        <strong>{opt.label}</strong>
                        <small>{opt.sub}</small>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="form-group">
              <label htmlFor={`${uid}-friend-phone`} className="form-label">
                6. Friend&rsquo;s Mobile Number (Optional — for direct 1-tap WhatsApp)
              </label>
              <span id={`${uid}-friend-phone-hint`} className="field-hint">
                Optional: Enter to open WhatsApp directly to their chat, or leave blank to choose
                them from your WhatsApp contacts list.
              </span>
              <input
                id={`${uid}-friend-phone`}
                name="friendPhone"
                type="tel"
                inputMode="tel"
                maxLength={24}
                autoComplete="off"
                enterKeyHint="done"
                className="form-input"
                placeholder="Optional: e.g. 012-987 6543"
                value={friendPhone}
                aria-describedby={`${uid}-friend-phone-hint`}
                onChange={(e) => setFriendPhone(e.target.value)}
              />
            </div>

            <div className="booth-claim-actions">
              <button
                type="submit"
                className="btn btn--primary btn--lg btn--full"
                disabled={submitting}
              >
                <GiftBoxIcon size={18} />
                <span>
                  {submitting
                    ? 'Unlocking Booth Gift Token…'
                    : `Unlock Gift Token & Seat for ${friendName.trim() || 'My Friend'}`}
                </span>
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setStep({ kind: 'hub' })}
              >
                Play Another Game First
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 4: UNLOCKED GOLDEN BOOTH VOUCHER & WHATSAPP PASS */}
      {step.kind === 'voucher' && (
        <div className="card-panel booth-voucher-card stage-enter">
          <div className="booth-voucher-header">
            <span className="booth-voucher-code">{step.winner.voucherCode}</span>
            <span
              className={`status-pill ${
                step.winner.tokenHandedOut ? 'status-pill--green' : 'status-pill--amber'
              }`}
            >
              {step.winner.tokenHandedOut
                ? '✅ Physical Gift Token Collected'
                : '🎁 Show to Booth Team for Gift Token'}
            </span>
          </div>

          <h2 className="booth-voucher-title">
            🎄 Reserved VIP Seat for <span>{step.winner.friendName}</span>!
          </h2>
          <p className="booth-voucher-subtitle">
            Won by <strong>{step.winner.memberName}</strong> ({step.winner.relationship} ·{' '}
            {step.winner.seatsReserved}{' '}
            {step.winner.seatsReserved === 1 ? 'VIP Seat' : 'VIP Seats'}) on{' '}
            <strong>{BOOTH_GAME_LABELS_MAP[step.winner.gamePlayed]}</strong> ({step.winner.score}{' '}
            pts)
          </p>

          <div className="booth-voucher-steps">
            <div className="booth-voucher-box">
              <div className="booth-voucher-box__eyebrow">
                STEP A · COLLECT AT CHURCH BOOTH TABLE
              </div>
              <p className="booth-voucher-box__text">
                Show code <strong>{step.winner.voucherCode}</strong> at the booth table to collect
                the physical <strong>{settings.giftDescription} Token &amp; Invitation Card</strong>{' '}
                to hand to <strong>{step.winner.friendName}</strong>!
              </p>
              <button
                type="button"
                className={`btn btn--sm ${
                  step.winner.tokenHandedOut ? 'btn--subtle' : 'btn--gold-light'
                }`}
                disabled={patchingVoucher}
                onClick={() => handleToggleTokenHandedOut(step.winner)}
              >
                <CheckCircleIcon size={16} />
                <span>
                  {step.winner.tokenHandedOut
                    ? 'Physical Gift Token Handed Out (Tap to Undo)'
                    : 'Booth Helper: Mark Physical Gift Token Handed Out'}
                </span>
              </button>
            </div>

            <div className="booth-voucher-box booth-voucher-box--whatsapp">
              <div className="booth-voucher-box__eyebrow">
                STEP B · SEND PERSONAL VIP PASS TO {step.winner.friendName.toUpperCase()}
              </div>
              <p className="booth-voucher-box__text">
                Send {step.winner.friendName} their personalised VIP link! When they tap it, the
                Christmas Arcade greets them by name:
              </p>
              <div className="booth-voucher-cta-stack">
                <a
                  href={step.winner.friendWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--whatsapp btn--lg btn--full"
                  onClick={() => handleSendFriendWhatsapp(step.winner)}
                >
                  <WhatsAppIcon size={19} />
                  <span>Send VIP Seat Invite to {step.winner.friendName} on WhatsApp</span>
                </a>

                <button
                  type="button"
                  className="btn btn--subtle btn--sm"
                  onClick={() => handleCopyFriendInvite(step.winner.friendInviteUrl)}
                >
                  <CopyIcon size={15} />
                  <span>
                    {copiedInviteLink
                      ? 'Copied Personal Invite Link!'
                      : `Copy ${step.winner.friendName}'s Personal VIP Link`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Kiosk-to-Phone QR Handoff */}
          {voucherQrDataUrl && (
            <div className="booth-handoff-qr">
              <img
                src={voucherQrDataUrl}
                alt={`QR code to open voucher ${step.winner.voucherCode} on your phone`}
                className="booth-handoff-qr__img"
              />
              <div className="booth-handoff-qr__copy">
                <strong>Playing on the Shared Booth Tablet/Laptop?</strong>
                <p>
                  Scan this QR code with your phone camera to open this voucher on your own phone
                  and WhatsApp <strong>{step.winner.friendName}</strong> in 1 tap!
                </p>
              </div>
            </div>
          )}

          <div className="booth-voucher-footer">
            <button
              type="button"
              className="btn btn--primary btn--lg btn--full"
              onClick={handleResetForNextMember}
            >
              🔄 {kioskMode ? 'Next Church Member (Reset Booth Kiosk)' : 'Win Another Seat for Another Friend'}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onOpenGuestArcade}
            >
              Preview Guest Christmas Arcade (/)
            </button>
          </div>
        </div>
      )}

      {/* Printable / Scannable Booth QR Poster Modal */}
      <dialog
        ref={qrModalRef}
        aria-labelledby={`${uid}-qr-modal-title`}
        className="qr-print-dialog"
        {...({ closedby: 'any' } as Record<string, string>)}
      >
        <div className="qr-print-sheet">
          <div className="qr-print-sheet__eyebrow">
            {settings.churchName.toUpperCase()} · CHURCH MEMBER BOOTH
          </div>
          <h2 id={`${uid}-qr-modal-title`} className="qr-print-sheet__title">
            Win a VIP Seat &amp; Gift for Your Friend!
          </h2>
          <p className="qr-print-sheet__sub">
            Scan to play our 20-second All-Generations Booth Games on your phone &amp; claim a
            Reserved Seat + Gift Token for a friend or family member!
          </p>
          {boothHubQrDataUrl && (
            <img
              src={boothHubQrDataUrl}
              alt={`QR code for ${boothPageUrl}`}
              className="qr-print-sheet__qr"
            />
          )}
          <div className="qr-print-sheet__url">{boothPageUrl}</div>
          <div className="qr-print-sheet__actions no-print">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => window.print()}
            >
              🖨️ Print Booth Poster
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => qrModalRef.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
