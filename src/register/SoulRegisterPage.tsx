import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  DEFAULT_CHURCH_ZONES,
  type CrownStatusResponse,
  type EventSettings,
  type SoulRegistrationRecord,
} from '../types.ts';
import { fetchCrownStatus, submitSoulRegistration } from '../lib/api.ts';
import { playArcadeTone } from '../lib/sound.ts';
import { ChristmasCrownArt } from '../crown/ChristmasCrownArt.tsx';
import {
  CheckCircleIcon,
  CrownIcon,
  GiftBoxIcon,
  SparkleIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';

interface SoulRegisterPageProps {
  settings: EventSettings;
  onOpenPresentScreen: () => void;
  onOpenArcade: () => void;
}

interface FieldErrors {
  memberName?: string;
  memberPhone?: string;
  churchZone?: string;
  soulName?: string;
  memberCount?: string;
  soulPhone?: string;
}

const MEMBER_STORAGE_KEY = 'ccc_christmas_register_member_v1';

interface SavedMemberProfile {
  memberName: string;
  memberPhone: string;
  churchZone: string;
}

function loadSavedMemberProfile(): SavedMemberProfile {
  try {
    const raw = localStorage.getItem(MEMBER_STORAGE_KEY);
    if (!raw) return { memberName: '', memberPhone: '', churchZone: '' };
    const parsed = JSON.parse(raw) as Partial<SavedMemberProfile>;
    return {
      memberName: typeof parsed.memberName === 'string' ? parsed.memberName : '',
      memberPhone: typeof parsed.memberPhone === 'string' ? parsed.memberPhone : '',
      churchZone: typeof parsed.churchZone === 'string' ? parsed.churchZone : '',
    };
  } catch {
    return { memberName: '', memberPhone: '', churchZone: '' };
  }
}

function saveMemberProfile(profile: SavedMemberProfile): void {
  try {
    localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function SoulRegisterPage({
  settings,
  onOpenPresentScreen,
  onOpenArcade,
}: SoulRegisterPageProps) {
  const initialMember = loadSavedMemberProfile();

  const [crownStatus, setCrownStatus] = useState<CrownStatusResponse | null>(null);
  const [memberName, setMemberName] = useState(initialMember.memberName);
  const [memberPhone, setMemberPhone] = useState(initialMember.memberPhone);
  const [churchZone, setChurchZone] = useState(initialMember.churchZone);

  const [soulName, setSoulName] = useState('');
  const [memberCount, setMemberCount] = useState<number>(1);
  const [soulPhone, setSoulPhone] = useState('');
  const [address, setAddress] = useState('');

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedReg, setCompletedReg] = useState<SoulRegistrationRecord | null>(null);

  const memberNameRef = useRef<HTMLInputElement>(null);
  const memberPhoneRef = useRef<HTMLInputElement>(null);
  const churchZoneRef = useRef<HTMLSelectElement>(null);
  const soulNameRef = useRef<HTMLInputElement>(null);
  const memberCountRef = useRef<HTMLInputElement>(null);
  const soulPhoneRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const refreshCrown = useCallback(() => {
    fetchCrownStatus()
      .then((res) => setCrownStatus(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCrown();
    const timer = window.setInterval(refreshCrown, 8000);
    return () => window.clearInterval(timer);
  }, [refreshCrown]);

  const zones: readonly string[] =
    crownStatus?.churchZones && crownStatus.churchZones.length > 0
      ? crownStatus.churchZones
      : settings.churchZones && settings.churchZones.length > 0
        ? settings.churchZones
        : DEFAULT_CHURCH_ZONES;

  const validateField = (
    field: keyof FieldErrors,
    vals = { memberName, memberPhone, churchZone, soulName, memberCount, soulPhone }
  ): string | undefined => {
    switch (field) {
      case 'memberName':
        return vals.memberName.trim().length < 2
          ? 'Please enter your name (at least 2 characters).'
          : undefined;
      case 'memberPhone':
        return vals.memberPhone.replace(/\D/g, '').length < 7
          ? 'Please enter your valid mobile / WhatsApp number.'
          : undefined;
      case 'churchZone':
        return !vals.churchZone.trim() ? 'Please choose your Home Church Zone.' : undefined;
      case 'soulName':
        return vals.soulName.trim().length < 2
          ? "Please enter your New Soul's name (at least 2 characters)."
          : undefined;
      case 'memberCount':
        return !Number.isFinite(vals.memberCount) || vals.memberCount < 1 || vals.memberCount > 50
          ? 'Enter a number of members between 1 and 50.'
          : undefined;
      case 'soulPhone':
        return vals.soulPhone.replace(/\D/g, '').length < 7
          ? "Please enter the New Soul's mobile / WhatsApp number."
          : undefined;
    }
  };

  const handleBlur = (field: keyof FieldErrors) => {
    if (!touched[field]) return;
    const msg = validateField(field);
    setErrors((prev) => ({ ...prev, [field]: msg }));
  };

  const clearErrorOnInput = (field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (submitError) {
      setSubmitError('');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError('');

    const nextErrors: FieldErrors = {
      memberName: validateField('memberName'),
      memberPhone: validateField('memberPhone'),
      churchZone: validateField('churchZone'),
      soulName: validateField('soulName'),
      memberCount: validateField('memberCount'),
      soulPhone: validateField('soulPhone'),
    };
    setErrors(nextErrors);

    if (nextErrors.memberName) {
      memberNameRef.current?.focus();
      return;
    }
    if (nextErrors.memberPhone) {
      memberPhoneRef.current?.focus();
      return;
    }
    if (nextErrors.churchZone) {
      churchZoneRef.current?.focus();
      return;
    }
    if (nextErrors.soulName) {
      soulNameRef.current?.focus();
      return;
    }
    if (nextErrors.memberCount) {
      memberCountRef.current?.focus();
      return;
    }
    if (nextErrors.soulPhone) {
      soulPhoneRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitSoulRegistration({
        memberName: memberName.trim(),
        memberPhone: memberPhone.trim(),
        churchZone: churchZone.trim(),
        soulName: soulName.trim(),
        memberCount: Math.max(1, Math.min(50, Math.round(memberCount))),
        soulPhone: soulPhone.trim(),
        address: address.trim(),
        countryCode: settings.defaultCountryCode || '60',
      });

      saveMemberProfile({
        memberName: memberName.trim(),
        memberPhone: memberPhone.trim(),
        churchZone: churchZone.trim(),
      });

      setCrownStatus(res.crownStatus);
      setCompletedReg(res.registration);
      playArcadeTone('fanfare');
      window.setTimeout(() => {
        successHeadingRef.current?.focus();
      }, 60);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to save registration. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAnotherSoul = () => {
    setCompletedReg(null);
    setSoulName('');
    setMemberCount(1);
    setSoulPhone('');
    setAddress('');
    setErrors({});
    setSubmitError('');
    window.setTimeout(() => {
      soulNameRef.current?.focus();
    }, 60);
  };

  const targetSouls = crownStatus?.targetSouls ?? settings.crownTargetSouls ?? 500;
  const currentSouls = crownStatus?.totalProgressSouls ?? 0;
  const fillPct = crownStatus?.fillPercentage ?? 0;

  return (
    <div className="soul-register-stage">
      {/* Top Hero + Mini Live King of Glory Crown Preview */}
      <section className="card-panel soul-register-hero" aria-labelledby="register-page-heading">
        <div className="soul-register-hero__grid">
          <div className="soul-register-hero__copy">
            <span className="eyebrow-pill">
              <CrownIcon size={14} />
              <span>{settings.churchName} · King of Glory Christmas</span>
            </span>
            <h1 id="register-page-heading" className="hero-title">
              Register Your New Soul for Christmas
            </h1>
            <p className="hero-subtitle">
              Every friend, family member, neighbor, or colleague you bring adds a glowing jewel to
              the <strong>King of Glory Christmas Crown</strong> for{' '}
              <strong>{settings.eventTitle}</strong>!
            </p>

            <div className="soul-register-progress-pill" role="status" aria-live="polite">
              <div className="soul-register-progress-pill__top">
                <span>
                  👑 Live Crown Progress: <strong>{currentSouls.toLocaleString()}</strong> /{' '}
                  {targetSouls.toLocaleString()} Souls
                </span>
                <strong>{fillPct}% Full</strong>
              </div>
              <div className="soul-register-progress-bar" aria-hidden="true">
                <div
                  className="soul-register-progress-bar__fill"
                  style={{ width: `${Math.min(100, fillPct)}%` }}
                />
              </div>
            </div>

            <div className="soul-register-hero__actions">
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                onClick={onOpenPresentScreen}
              >
                <CrownIcon size={15} />
                <span>View Live Big-Screen Crown (/present)</span>
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={onOpenArcade}
              >
                <SparkleIcon size={15} />
                <span>Christmas Arcade</span>
              </button>
            </div>
          </div>

          <div className="soul-register-hero__crown-box">
            <ChristmasCrownArt
              fillPercentage={fillPct}
              currentSouls={currentSouls}
              targetSouls={targetSouls}
              compact
            />
          </div>
        </div>
      </section>

      {completedReg ? (
        <section
          className="card-panel soul-register-success"
          aria-labelledby="soul-registered-heading"
        >
          <div className="soul-register-success__banner">
            <span className="eyebrow-pill">
              <CheckCircleIcon size={14} />
              <span>Confirmation Code · {completedReg.confirmationCode}</span>
            </span>
            <h2
              id="soul-registered-heading"
              ref={successHeadingRef}
              tabIndex={-1}
              className="soul-register-success__title"
            >
              👑 +{completedReg.memberCount}{' '}
              {completedReg.memberCount === 1 ? 'Soul Added' : 'Souls Added'} to the King of Glory
              Crown!
            </h2>
            <p className="soul-register-success__sub">
              Thank you, <strong>{completedReg.memberName}</strong> ({completedReg.churchZone})! We
              have reserved{' '}
              <strong>
                {completedReg.memberCount}{' '}
                {completedReg.memberCount === 1 ? 'VIP seat' : 'VIP seats'}
              </strong>{' '}
              for <strong>{completedReg.soulName}</strong> at {settings.eventTitle}.
            </p>
          </div>

          <div className="soul-register-summary-grid">
            <div className="soul-register-summary-card">
              <span className="soul-register-summary-card__label">Church Member</span>
              <strong>{completedReg.memberName}</strong>
              <span>{completedReg.memberPhone}</span>
              <span className="badge badge--gold">{completedReg.churchZone}</span>
            </div>
            <div className="soul-register-summary-card">
              <span className="soul-register-summary-card__label">New Soul Registered</span>
              <strong>
                {completedReg.soulName} ({completedReg.memberCount}{' '}
                {completedReg.memberCount === 1 ? 'Member' : 'Members'})
              </strong>
              <span>{completedReg.soulPhone}</span>
              {completedReg.address && (
                <span className="soul-register-summary-card__addr">📍 {completedReg.address}</span>
              )}
            </div>
          </div>

          <div className="soul-register-success__actions">
            <a
              href={completedReg.soulWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--whatsapp btn--lg btn--full"
            >
              <WhatsAppIcon size={19} />
              <span>Send Personal WhatsApp Invite to {completedReg.soulName}</span>
            </a>

            <div className="soul-register-success__secondary">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleRegisterAnotherSoul}
              >
                <GiftBoxIcon size={17} />
                <span>+ Register Another New Soul</span>
              </button>
              <button
                type="button"
                className="btn btn--subtle"
                onClick={onOpenPresentScreen}
              >
                <CrownIcon size={17} />
                <span>Watch Crown Rise on /present</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="card-panel soul-register-form-card" aria-labelledby="soul-form-title">
          <div className="soul-register-form-header">
            <h2 id="soul-form-title" className="section-title">
              Soul Registration Form
            </h2>
            <p className="muted-text">
              Fill in your details and your invited guest&apos;s details below so our hospitality
              team can prepare their Christmas welcome gift and track attendance.
            </p>
          </div>

          <form
            action="/api/public/register-soul"
            method="POST"
            noValidate
            onSubmit={handleSubmit}
            className="soul-register-form"
          >
            {/* Section 1: Church Member Details */}
            <fieldset className="soul-fieldset">
              <legend className="soul-fieldset__legend">
                1. Church Member (Inviter Details)
              </legend>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="reg-member-name" className="form-label">
                    Church Member Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={memberNameRef}
                    id="reg-member-name"
                    name="memberName"
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    enterKeyHint="next"
                    placeholder="e.g. Andrew Kannan"
                    className="form-input"
                    value={memberName}
                    aria-invalid={errors.memberName ? 'true' : undefined}
                    aria-describedby={errors.memberName ? 'reg-member-name-err' : undefined}
                    onChange={(e) => {
                      setMemberName(e.target.value);
                      clearErrorOnInput('memberName');
                    }}
                    onBlur={() => handleBlur('memberName')}
                  />
                  {errors.memberName && (
                    <span id="reg-member-name-err" className="field-error" role="alert">
                      {errors.memberName}
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="reg-member-phone" className="form-label">
                    Church Member Phone Number <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={memberPhoneRef}
                    id="reg-member-phone"
                    name="memberPhone"
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={30}
                    autoComplete="tel"
                    enterKeyHint="next"
                    placeholder="e.g. 012-345 6789"
                    className="form-input"
                    value={memberPhone}
                    aria-invalid={errors.memberPhone ? 'true' : undefined}
                    aria-describedby={errors.memberPhone ? 'reg-member-phone-err' : undefined}
                    onChange={(e) => {
                      setMemberPhone(e.target.value);
                      clearErrorOnInput('memberPhone');
                    }}
                    onBlur={() => handleBlur('memberPhone')}
                  />
                  {errors.memberPhone && (
                    <span id="reg-member-phone-err" className="field-error" role="alert">
                      {errors.memberPhone}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="reg-church-zone" className="form-label">
                  Home Church Zone <span aria-hidden="true">*</span>
                </label>
                <select
                  ref={churchZoneRef}
                  id="reg-church-zone"
                  name="churchZone"
                  required
                  className="form-input form-select"
                  value={churchZone}
                  aria-invalid={errors.churchZone ? 'true' : undefined}
                  aria-describedby={errors.churchZone ? 'reg-church-zone-err' : 'reg-church-zone-hint'}
                  onChange={(e) => {
                    setChurchZone(e.target.value);
                    clearErrorOnInput('churchZone');
                  }}
                  onBlur={() => handleBlur('churchZone')}
                >
                  <option value="">— Select your Home Church Zone —</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
                <span id="reg-church-zone-hint" className="field-hint">
                  Choose the cell group or home church zone you belong to.
                </span>
                {errors.churchZone && (
                  <span id="reg-church-zone-err" className="field-error" role="alert">
                    {errors.churchZone}
                  </span>
                )}
              </div>
            </fieldset>

            {/* Section 2: New Soul Details */}
            <fieldset className="soul-fieldset soul-fieldset--gold">
              <legend className="soul-fieldset__legend">
                2. New Soul (Invited Friend / Family Details)
              </legend>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="reg-soul-name" className="form-label">
                    New Soul Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={soulNameRef}
                    id="reg-soul-name"
                    name="soulName"
                    type="text"
                    required
                    maxLength={80}
                    enterKeyHint="next"
                    placeholder="e.g. Mr. & Mrs. Bala / Jason Lim"
                    className="form-input"
                    value={soulName}
                    aria-invalid={errors.soulName ? 'true' : undefined}
                    aria-describedby={errors.soulName ? 'reg-soul-name-err' : undefined}
                    onChange={(e) => {
                      setSoulName(e.target.value);
                      clearErrorOnInput('soulName');
                    }}
                    onBlur={() => handleBlur('soulName')}
                  />
                  {errors.soulName && (
                    <span id="reg-soul-name-err" className="field-error" role="alert">
                      {errors.soulName}
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="reg-soul-phone" className="form-label">
                    New Soul Phone Number <span aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={soulPhoneRef}
                    id="reg-soul-phone"
                    name="soulPhone"
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={30}
                    enterKeyHint="next"
                    placeholder="e.g. 016-778 9900"
                    className="form-input"
                    value={soulPhone}
                    aria-invalid={errors.soulPhone ? 'true' : undefined}
                    aria-describedby={
                      errors.soulPhone ? 'reg-soul-phone-err' : 'reg-soul-phone-hint'
                    }
                    onChange={(e) => {
                      setSoulPhone(e.target.value);
                      clearErrorOnInput('soulPhone');
                    }}
                    onBlur={() => handleBlur('soulPhone')}
                  />
                  <span id="reg-soul-phone-hint" className="field-hint">
                    Used to send their Christmas E-Invitation & welcome reminder on WhatsApp.
                  </span>
                  {errors.soulPhone && (
                    <span id="reg-soul-phone-err" className="field-error" role="alert">
                      {errors.soulPhone}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="reg-member-count" className="form-label">
                  No. of Members Coming (Including This New Soul) <span aria-hidden="true">*</span>
                </label>
                <div className="soul-count-control">
                  <div className="soul-count-stepper">
                    <button
                      type="button"
                      className="btn btn--subtle soul-count-stepper__btn"
                      aria-label="Decrease number of members"
                      onClick={() => {
                        setMemberCount((c) => Math.max(1, c - 1));
                        clearErrorOnInput('memberCount');
                      }}
                    >
                      −
                    </button>
                    <input
                      ref={memberCountRef}
                      id="reg-member-count"
                      name="memberCount"
                      type="number"
                      inputMode="numeric"
                      required
                      min={1}
                      max={50}
                      className="form-input soul-count-stepper__input"
                      value={memberCount}
                      aria-invalid={errors.memberCount ? 'true' : undefined}
                      aria-describedby={
                        errors.memberCount ? 'reg-member-count-err' : 'reg-member-count-hint'
                      }
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setMemberCount(Number.isFinite(n) ? n : 1);
                        clearErrorOnInput('memberCount');
                      }}
                      onBlur={() => handleBlur('memberCount')}
                    />
                    <button
                      type="button"
                      className="btn btn--subtle soul-count-stepper__btn"
                      aria-label="Increase number of members"
                      onClick={() => {
                        setMemberCount((c) => Math.min(50, c + 1));
                        clearErrorOnInput('memberCount');
                      }}
                    >
                      +
                    </button>
                  </div>

                  <div className="soul-count-presets" role="group" aria-label="Quick member count presets">
                    {[1, 2, 3, 4, 5].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`btn btn--sm ${
                          memberCount === preset ? 'btn--primary' : 'btn--ghost'
                        }`}
                        onClick={() => {
                          setMemberCount(preset);
                          clearErrorOnInput('memberCount');
                        }}
                      >
                        {preset} {preset === 1 ? 'Soul' : 'Souls'}
                      </button>
                    ))}
                  </div>
                </div>
                <span id="reg-member-count-hint" className="field-hint">
                  Each person coming adds +1 soul toward filling the King of Glory Crown!
                </span>
                {errors.memberCount && (
                  <span id="reg-member-count-err" className="field-error" role="alert">
                    {errors.memberCount}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="reg-soul-address" className="form-label">
                  Address <span className="field-optional-tag">(Optional)</span>
                </label>
                <textarea
                  id="reg-soul-address"
                  name="address"
                  rows={2}
                  maxLength={400}
                  autoComplete="street-address"
                  placeholder="Optional: Taman / street address or transport pickup landmark"
                  className="form-input form-textarea"
                  value={address}
                  aria-describedby="reg-soul-address-hint"
                  onChange={(e) => setAddress(e.target.value)}
                />
                <span id="reg-soul-address-hint" className="field-hint">
                  Helpful if your guest needs carpool transport or a Christmas blessing visit.
                </span>
              </div>
            </fieldset>

            {submitError && (
              <div className="alert-error" role="alert">
                {submitError}
              </div>
            )}

            <div className="soul-register-submit-row">
              <button
                type="submit"
                className="btn btn--primary btn--lg btn--full"
                disabled={submitting}
              >
                <CrownIcon size={19} />
                <span>
                  {submitting
                    ? 'Adding to the King of Glory Crown…'
                    : `Register Soul (+${Math.max(1, memberCount || 1)} to King of Glory Crown)`}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
