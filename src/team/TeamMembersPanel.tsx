import { useEffect, useId, useRef, useState } from 'react';
import type { TeamMemberRecord, TeamSessionUser, TeamUserRole } from '../types.ts';
import {
  createTeamMember,
  deleteTeamMember,
  patchTeamMember,
} from '../lib/api.ts';
import {
  CheckCircleIcon,
  CopyIcon,
  KeyPasscodeIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersCrmIcon,
  WhatsAppIcon,
} from '../components/Icons.tsx';
import { formatShortTimestamp } from './teamHelpers.ts';

interface TeamMembersPanelProps {
  currentUser: TeamSessionUser | null;
  members: TeamMemberRecord[];
  churchName: string;
  onMembersChanged: () => void;
  onOpenQrForMember?: (memberName: string) => void;
}

interface IssuedPasscodeNotice {
  memberName: string;
  passcode: string;
  role: TeamUserRole;
  mode: 'created' | 'reset';
}

function suggestPasscodeForName(rawName: string): string {
  const words = rawName
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);

  let prefix = '';
  if (words.length >= 2) {
    prefix = words
      .slice(0, 3)
      .map((w) => w[0]!)
      .join('')
      .toUpperCase();
  } else if (words.length === 1) {
    prefix = words[0]!.slice(0, 2).toUpperCase();
  }
  if (prefix.length < 2) {
    prefix = (prefix + 'TM').slice(0, 2);
  }

  const randBuf = new Uint32Array(1);
  crypto.getRandomValues(randBuf);
  const fourDigits = String(1000 + (randBuf[0]! % 9000));
  return `${prefix}${fourDigits}`;
}

function syncUserInvalidAria(el: HTMLInputElement): void {
  const isUserInvalid =
    typeof CSS !== 'undefined' &&
    CSS.supports?.('selector(:user-invalid)') &&
    el.matches(':user-invalid');
  if (isUserInvalid) {
    el.setAttribute('aria-invalid', 'true');
  } else {
    el.removeAttribute('aria-invalid');
  }
}

export function TeamMembersPanel({
  currentUser,
  members,
  churchName,
  onMembersChanged,
  onOpenQrForMember,
}: TeamMembersPanelProps) {
  const uid = useId();
  const isAdmin = !currentUser || currentUser.role === 'admin';

  // Add Member Form State
  const [formResetKey, setFormResetKey] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState<TeamUserRole>('member');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ephemeral issued passcode banner (held strictly in memory right after create/reset)
  const [issuedNotice, setIssuedNotice] = useState<IssuedPasscodeNotice | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Row mutation states
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Native <dialog> Reset Passcode Modal State
  const resetDialogRef = useRef<HTMLDialogElement | null>(null);
  const [resetTarget, setResetTarget] = useState<TeamMemberRecord | null>(null);
  const [resetPasscode, setResetPasscode] = useState('');
  const [showResetPasscode, setShowResetPasscode] = useState(true);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog) return;
    if (resetTarget) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [resetTarget]);

  // Fallback light-dismiss for browsers without native <dialog closedby="any">
  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog) return;
    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    if (supportsClosedBy) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = e.target === dialog && isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && e.target === dialog && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const activeCount = members.filter((m) => m.active).length;
  const adminCount = members.filter((m) => m.role === 'admin').length;

  const handleSuggestNewCode = () => {
    const suggested = suggestPasscodeForName(name);
    setPasscode(suggested);
    setShowPasscode(true);
    setFormError(null);
  };

  const handleCreateMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    const normalizedCode = passcode.trim().toUpperCase();

    if (!trimmedName) {
      setFormError('Please enter the team member’s name.');
      return;
    }
    if (!/^[A-Z0-9]{4,24}$/.test(normalizedCode)) {
      setFormError('Passcode must be 4–24 letters or numbers with no spaces (e.g. AK2708).');
      return;
    }

    setCreating(true);
    try {
      const res = await createTeamMember({
        name: trimmedName,
        passcode: normalizedCode,
        role,
      });
      setIssuedNotice({
        memberName: res.user.name,
        passcode: normalizedCode,
        role: res.user.role,
        mode: 'created',
      });
      setCopiedInvite(false);
      setName('');
      setPasscode('');
      setRole('member');
      setFormResetKey((k) => k + 1);
      onMembersChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add team member.');
    } finally {
      setCreating(false);
    }
  };

  const buildInviteText = (notice: IssuedPasscodeNotice): string => {
    const teamUrl = `${window.location.origin}/team`;
    const roleLabel =
      notice.role === 'admin' ? 'Team Leader / Admin' : 'Evangelist / Team Member';
    return (
      `Hi ${notice.memberName}! 🎄 You have been added to the ${churchName} Command Center (${roleLabel}).\n\n` +
      `🔗 Sign in here: ${teamUrl}\n` +
      `🔑 Personal Passcode: ${notice.passcode}\n\n` +
      `Enter your passcode only (no username needed) to view contacts, add pastoral remarks, and download your personal QR board!`
    );
  };

  const handleCopyInvite = async () => {
    if (!issuedNotice) return;
    try {
      await navigator.clipboard.writeText(buildInviteText(issuedNotice));
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2400);
    } catch {
      // Clipboard ignored if restricted
    }
  };

  const handleToggleActive = async (member: TeamMemberRecord) => {
    setBusyMemberId(member.id);
    setRowError(null);
    try {
      await patchTeamMember(member.id, { active: !member.active });
      onMembersChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not update member status.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleToggleRole = async (member: TeamMemberRecord) => {
    const nextRole: TeamUserRole = member.role === 'admin' ? 'member' : 'admin';
    setBusyMemberId(member.id);
    setRowError(null);
    try {
      await patchTeamMember(member.id, { role: nextRole });
      onMembersChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not update member role.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleDeleteMember = async (member: TeamMemberRecord) => {
    setBusyMemberId(member.id);
    setRowError(null);
    try {
      await deleteTeamMember(member.id);
      setConfirmDeleteId(null);
      onMembersChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not remove team member.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const openResetModal = (member: TeamMemberRecord) => {
    setResetError(null);
    setResetPasscode('');
    setShowResetPasscode(true);
    setResetTarget(member);
  };

  const handleResetPasscodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    const normalizedCode = resetPasscode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,24}$/.test(normalizedCode)) {
      setResetError('Passcode must be 4–24 letters or numbers with no spaces (e.g. AK2708).');
      return;
    }

    setResetSaving(true);
    try {
      const targetSnapshot = resetTarget;
      const res = await patchTeamMember(targetSnapshot.id, { passcode: normalizedCode });
      setResetTarget(null);
      setResetPasscode('');
      setIssuedNotice({
        memberName: res.user.name,
        passcode: normalizedCode,
        role: res.user.role,
        mode: 'reset',
      });
      setCopiedInvite(false);
      onMembersChanged();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to update passcode.');
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <div className="team-members-stack">
      {/* Summary KPI Bar */}
      <div className="card-panel team-members-hero">
        <div className="team-members-hero__intro">
          <h2 className="section-title settings-legend">
            <UsersCrmIcon size={19} />
            <span>Outreach Team Members &amp; Passcode Access</span>
          </h2>
          <p className="subtle-text" style={{ marginBlockStart: '0.28rem' }}>
            Give each evangelist or leader their own personal passcode (like <code>AK2708</code> —
            initials + DOB or random numbers) so they can sign in at <code>/team</code> with{' '}
            <strong>passcode only</strong>.
          </p>
        </div>

        <div className="team-members-kpis">
          <div className="team-members-kpi">
            <span className="team-members-kpi__val">{members.length}</span>
            <span className="team-members-kpi__lbl">Total Members</span>
          </div>
          <div className="team-members-kpi">
            <span className="team-members-kpi__val">{activeCount}</span>
            <span className="team-members-kpi__lbl">Active Passcodes</span>
          </div>
          <div className="team-members-kpi">
            <span className="team-members-kpi__val">{adminCount}</span>
            <span className="team-members-kpi__lbl">Team Leaders</span>
          </div>
        </div>
      </div>

      {/* Ephemeral Issued Passcode Notice (shown immediately after Add or Reset) */}
      {issuedNotice && (
        <div role="status" aria-live="polite" className="passcode-issued-banner">
          <div className="passcode-issued-banner__body">
            <div className="passcode-issued-banner__title">
              <CheckCircleIcon size={17} />
              <strong>
                {issuedNotice.mode === 'created'
                  ? `${issuedNotice.memberName} added to the team!`
                  : `Passcode updated for ${issuedNotice.memberName}!`}
              </strong>
            </div>
            <p className="passcode-issued-banner__desc">
              Personal Passcode:{' '}
              <code className="passcode-issued-banner__code">{issuedNotice.passcode}</code> · Signs
              in at <code>/team</code> with passcode only (case-insensitive). Copy and share now —
              passcodes are stored encrypted and hidden once dismissed.
            </p>
          </div>

          <div className="passcode-issued-banner__actions">
            <button
              type="button"
              className="btn btn--whatsapp btn--sm"
              onClick={() => void handleCopyInvite()}
            >
              {copiedInvite ? <CheckCircleIcon size={15} /> : <CopyIcon size={15} />}
              <span>{copiedInvite ? 'WhatsApp Invite Copied!' : 'Copy WhatsApp Login Invite'}</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(buildInviteText(issuedNotice))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost btn--sm"
            >
              <WhatsAppIcon size={14} />
              <span>Share via WhatsApp</span>
            </a>
            <button
              type="button"
              className="btn btn--subtle btn--sm"
              onClick={() => setIssuedNotice(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Admin Create Member Form OR Member Read-Only Notice */}
      {isAdmin ? (
        <form
          key={formResetKey}
          method="post"
          action="/api/team/users"
          onSubmit={handleCreateMember}
          className="card-panel team-add-form"
        >
          <div className="team-add-form__header">
            <h3 className="section-title settings-legend" style={{ fontSize: '1.05rem' }}>
              <UserPlusIcon size={18} />
              <span>Add Team Member</span>
            </h3>
            <span className="privacy-chip">
              <ShieldCheckIcon size={13} />
              <span>Salted Scrypt Encrypted</span>
            </span>
          </div>

          <div className="team-add-form__grid">
            <div className="form-group" style={{ marginBlockEnd: 0 }}>
              <label htmlFor={`${uid}-member-name`} className="form-label">
                Full Name
              </label>
              <span id={`${uid}-name-hint`} className="field-hint">
                Shown on signed-in badge, QR Boards, and Live Contacts Evangelist list.
              </span>
              <input
                id={`${uid}-member-name`}
                name="name"
                type="text"
                autoComplete="off"
                maxLength={60}
                required
                placeholder="e.g. Andrew Kannan"
                className="form-input"
                value={name}
                aria-describedby={`${uid}-name-hint`}
                onBlur={(e) => syncUserInvalidAria(e.currentTarget)}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                  if (e.currentTarget.hasAttribute('aria-invalid')) {
                    syncUserInvalidAria(e.currentTarget);
                  }
                }}
              />
            </div>

            <div className="form-group team-passcode-field" style={{ marginBlockEnd: 0 }}>
              <label htmlFor={`${uid}-member-passcode`} className="form-label">
                Personal Login Passcode
              </label>
              <span id={`${uid}-passcode-rules`} className="field-hint">
                4–24 letters or numbers, no spaces (e.g. initials + DOB or random numbers like{' '}
                <code>AK2708</code>).
              </span>
              <div className="passcode-input-row">
                <input
                  id={`${uid}-member-passcode`}
                  name="passcode"
                  type={showPasscode ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  required
                  minLength={4}
                  maxLength={24}
                  pattern="[A-Za-z0-9]{4,24}"
                  placeholder="e.g. AK2708"
                  className="form-input passcode-input-row__control"
                  value={passcode}
                  aria-describedby={`${uid}-passcode-rules`}
                  aria-errormessage={`${uid}-passcode-err`}
                  onBlur={(e) => syncUserInvalidAria(e.currentTarget)}
                  onChange={(e) => {
                    setPasscode(e.target.value.replace(/\s+/g, ''));
                    if (formError) setFormError(null);
                    if (e.currentTarget.hasAttribute('aria-invalid')) {
                      syncUserInvalidAria(e.currentTarget);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  aria-pressed={showPasscode}
                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  onClick={() => setShowPasscode((s) => !s)}
                >
                  {showPasscode ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  className="btn btn--subtle btn--sm"
                  onClick={handleSuggestNewCode}
                >
                  <KeyPasscodeIcon size={14} />
                  <span>Suggest Code</span>
                </button>
                <div id={`${uid}-passcode-err`} className="field-inline-error">
                  <span aria-hidden="true">⚠ </span>Use 4–24 letters or numbers with no spaces
                  (e.g. AK2708).
                </div>
              </div>
            </div>
          </div>

          <fieldset className="team-role-fieldset">
            <legend className="form-label">Access Level</legend>
            <div className="team-role-cards">
              <label
                htmlFor={`${uid}-role-member`}
                className={`team-role-card${role === 'member' ? ' team-role-card--selected' : ''}`}
              >
                <input
                  id={`${uid}-role-member`}
                  type="radio"
                  name="role"
                  value="member"
                  checked={role === 'member'}
                  onChange={() => setRole('member')}
                />
                <span className="team-role-card__body">
                  <strong>Evangelist / Team Member</strong>
                  <span>
                    Signs in with passcode only · Views Mission Control &amp; Click Logs, manages
                    Live Contacts &amp; Remarks, creates QR Boards
                  </span>
                </span>
              </label>

              <label
                htmlFor={`${uid}-role-admin`}
                className={`team-role-card${role === 'admin' ? ' team-role-card--selected' : ''}`}
              >
                <input
                  id={`${uid}-role-admin`}
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={() => setRole('admin')}
                />
                <span className="team-role-card__body">
                  <strong>Team Leader / Admin</strong>
                  <span>
                    Full Evangelist access + can add/pause Team Members, reset passcodes, and edit
                    Campaign Targets &amp; Settings
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {formError && (
            <div role="alert" className="form-alert" style={{ marginBlockEnd: 0 }}>
              {formError}
            </div>
          )}

          <div className="team-add-form__footer">
            <button type="submit" className="btn btn--primary" disabled={creating}>
              <UserPlusIcon size={16} />
              <span>{creating ? 'Adding Team Member…' : 'Add Team Member'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="card-panel team-readonly-note">
          <ShieldCheckIcon size={18} />
          <div>
            <strong>Signed in as {currentUser.name} (Evangelist / Team Member)</strong>
            <p className="subtle-text" style={{ margin: '0.18rem 0 0' }}>
              Team Leaders / Admins can add new team members, reset passcodes, or change roles. Ask
              a Team Leader if you need your passcode updated.
            </p>
          </div>
        </div>
      )}

      {rowError && (
        <div role="alert" className="form-alert">
          {rowError}
        </div>
      )}

      {/* Team Members Roster */}
      <div className="card-panel" style={{ padding: members.length === 0 ? undefined : '0.85rem' }}>
        {members.length === 0 ? (
          <div className="crm-empty-state">
            <strong>No individual team members added yet</strong>
            <p className="subtle-text" style={{ margin: '0.25rem 0 0' }}>
              Add your first leader or evangelist above (for example, <strong>Andrew Kannan</strong>{' '}
              with passcode <code>AK2708</code>) so everyone can sign in with their own passcode.
            </p>
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={`${uid}-roster-caption`}
            className="crm-table-region team-roster-region"
          >
            <table className="crm-table team-roster-table">
              <caption id={`${uid}-roster-caption`} className="visually-hidden">
                Outreach team members and passcode access status ({members.length} total)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Team Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Login Status</th>
                  <th scope="col">Last Sign-In</th>
                  {isAdmin && <th scope="col">Manage</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = currentUser?.id === member.id;
                  const isBusy = busyMemberId === member.id;
                  const isConfirmingDelete = confirmDeleteId === member.id;

                  return (
                    <tr
                      key={member.id}
                      className={!member.active ? 'team-roster-row--paused' : undefined}
                    >
                      <th scope="row" className="crm-guest-cell">
                        <div className="crm-guest-cell__top">
                          <span className="crm-guest-cell__name">{member.name}</span>
                          {isSelf && <span className="member-self-pill">You</span>}
                        </div>
                        <div className="crm-guest-cell__meta">
                          <span>Added {formatShortTimestamp(member.createdAt)}</span>
                          {onOpenQrForMember && member.active && (
                            <button
                              type="button"
                              className="inline-link-btn"
                              onClick={() => onOpenQrForMember(member.name)}
                            >
                              QR Board →
                            </button>
                          )}
                        </div>
                      </th>

                      <td>
                        <span
                          className={`member-role-badge ${
                            member.role === 'admin'
                              ? 'member-role-badge--admin'
                              : 'member-role-badge--member'
                          }`}
                        >
                          {member.role === 'admin' ? 'Team Leader / Admin' : 'Evangelist'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`member-status-badge ${
                            member.active
                              ? 'member-status-badge--active'
                              : 'member-status-badge--paused'
                          }`}
                        >
                          {member.active ? 'Passcode Active' : 'Paused'}
                        </span>
                      </td>

                      <td>
                        <span className="subtle-text" style={{ fontSize: '0.8rem' }}>
                          {member.lastLoginAt
                            ? formatShortTimestamp(member.lastLoginAt)
                            : 'Not signed in yet'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td>
                          <div className="team-member-actions">
                            <button
                              type="button"
                              className="btn btn--subtle btn--xs"
                              disabled={isBusy}
                              aria-label={`Reset passcode for ${member.name}`}
                              onClick={() => openResetModal(member)}
                            >
                              <KeyPasscodeIcon size={13} />
                              <span>Reset Passcode</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn--ghost btn--xs"
                              disabled={isBusy || isSelf}
                              aria-label={
                                member.role === 'admin'
                                  ? `Change ${member.name} to Evangelist role`
                                  : `Make ${member.name} Team Leader Admin`
                              }
                              onClick={() => void handleToggleRole(member)}
                            >
                              {member.role === 'admin' ? 'Make Member' : 'Make Admin'}
                            </button>

                            <button
                              type="button"
                              className="btn btn--ghost btn--xs"
                              disabled={isBusy || isSelf}
                              aria-label={
                                member.active
                                  ? `Pause passcode login for ${member.name}`
                                  : `Enable passcode login for ${member.name}`
                              }
                              onClick={() => void handleToggleActive(member)}
                            >
                              {member.active ? 'Pause' : 'Enable'}
                            </button>

                            {isConfirmingDelete ? (
                              <span className="confirm-inline-group">
                                <button
                                  type="button"
                                  className="btn btn--primary btn--xs"
                                  disabled={isBusy}
                                  aria-label={`Confirm remove ${member.name}`}
                                  onClick={() => void handleDeleteMember(member)}
                                >
                                  Confirm Remove
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--xs"
                                  disabled={isBusy}
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn--ghost btn--xs team-remove-btn"
                                disabled={isBusy || isSelf}
                                aria-label={`Remove ${member.name}`}
                                onClick={() => setConfirmDeleteId(member.id)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Native <dialog> Modal for Resetting a Team Member's Passcode */}
      <dialog
        ref={resetDialogRef}
        {...({ closedby: 'any' } as Record<string, unknown>)}
        className="crm-dialog"
        aria-labelledby={`${uid}-reset-title`}
        onClose={() => {
          if (resetDialogRef.current) {
            resetDialogRef.current.returnValue = '';
          }
          setResetTarget(null);
          setResetError(null);
        }}
      >
        {resetTarget && (
          <form method="post" onSubmit={handleResetPasscodeSubmit} className="crm-dialog__sheet">
            <div className="crm-dialog__header">
              <div className="crm-dialog__heading-wrap">
                <div className="crm-dialog__eyebrow-row">
                  <span className="challenger-tag">Encrypted Passcode Update</span>
                </div>
                <h2 id={`${uid}-reset-title`} className="crm-dialog__title">
                  Set New Passcode for {resetTarget.name}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--xs crm-dialog__close"
                onClick={() => resetDialogRef.current?.close()}
              >
                Close
              </button>
            </div>

            <div className="crm-dialog__body">
              <div className="form-group" style={{ marginBlockEnd: 0 }}>
                <label htmlFor={`${uid}-reset-passcode`} className="form-label">
                  New Personal Passcode
                </label>
                <span id={`${uid}-reset-hint`} className="field-hint">
                  4–24 letters or numbers, no spaces (case-insensitive, e.g. <code>AK2708</code>).
                  Replaces their previous passcode immediately.
                </span>
                <div className="passcode-input-row">
                  <input
                    id={`${uid}-reset-passcode`}
                    name="passcode"
                    type={showResetPasscode ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    autoFocus
                    required
                    minLength={4}
                    maxLength={24}
                    pattern="[A-Za-z0-9]{4,24}"
                    placeholder="e.g. AK2708"
                    className="form-input passcode-input-row__control"
                    value={resetPasscode}
                    aria-describedby={`${uid}-reset-hint`}
                    onBlur={(e) => syncUserInvalidAria(e.currentTarget)}
                    onChange={(e) => {
                      setResetPasscode(e.target.value.replace(/\s+/g, ''));
                      if (resetError) setResetError(null);
                      if (e.currentTarget.hasAttribute('aria-invalid')) {
                        syncUserInvalidAria(e.currentTarget);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    aria-pressed={showResetPasscode}
                    aria-label={showResetPasscode ? 'Hide passcode' : 'Show passcode'}
                    onClick={() => setShowResetPasscode((s) => !s)}
                  >
                    {showResetPasscode ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--subtle btn--sm"
                    onClick={() => {
                      setResetPasscode(suggestPasscodeForName(resetTarget.name));
                      setShowResetPasscode(true);
                      setResetError(null);
                    }}
                  >
                    <KeyPasscodeIcon size={14} />
                    <span>Suggest</span>
                  </button>
                </div>
              </div>

              {resetError && (
                <div role="alert" className="form-alert" style={{ marginBlockEnd: 0 }}>
                  {resetError}
                </div>
              )}
            </div>

            <div className="crm-dialog__footer">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => resetDialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={resetSaving}>
                <KeyPasscodeIcon size={15} />
                <span>{resetSaving ? 'Updating…' : 'Save New Passcode'}</span>
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
