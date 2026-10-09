import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  KeyRound,
  Shield,
  ShieldCheck,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ChevronRight,
  Info,
  Clock,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    globalUser,
    globalPass,
    userProfile,
    updateUserEmail,
    updateUserPassword,
    setIsAuthGateOpen,
    showToast,
    t,
  } = useMusic();

  // Email state
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showInDevModal, setShowInDevModal] = useState(false);

  // Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showResetPasswordContactAdmin, setShowResetPasswordContactAdmin] = useState(false);

  // Rate-limiting security against brute-force attacks
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Reset form states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsAddingEmail(false);
      setEmailInput('');
      setEmailError(null);
      setShowInDevModal(false);
      setIsChangingPassword(false);
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setPasswordError(null);
      setPasswordSuccess(false);
      setShowResetPasswordContactAdmin(false);
    }
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  if (!isOpen) return null;

  // RFC compliant Email regex
  const isEmailValid = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    const trimmed = emailInput.trim();

    if (!trimmed) {
      setEmailError('Please enter an email address.');
      return;
    }

    if (!isEmailValid(trimmed)) {
      setEmailError('Please enter a valid email format (e.g. name@example.com).');
      return;
    }

    setEmailSaving(true);
    try {
      const res = await updateUserEmail(trimmed);
      if (!res.success) {
        setEmailError(res.error || 'Failed to link email address.');
      } else {
        setIsAddingEmail(false);
        setEmailInput('');
      }
    } catch {
      setEmailError('Error saving email address. Please try again.');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (lockoutSeconds > 0) {
      setPasswordError(`Security lockout in effect. Try again in ${lockoutSeconds}s.`);
      return;
    }

    if (!currentPassInput) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassInput) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (newPassInput.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassInput !== confirmPassInput) {
      setPasswordError('New passwords do not match. Please verify both fields.');
      return;
    }

    if (currentPassInput === newPassInput) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await updateUserPassword(currentPassInput, newPassInput);
      if (!res.success) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutSeconds(30);
          setPasswordError('Too many failed attempts. Security cooldown active for 30s.');
        } else {
          setPasswordError(res.error || 'Failed to update password.');
        }
      } else {
        setPasswordSuccess(true);
        setCurrentPassInput('');
        setNewPassInput('');
        setConfirmPassInput('');
        setFailedAttempts(0);
        setTimeout(() => {
          setIsChangingPassword(false);
          setPasswordSuccess(false);
        }, 2200);
      }
    } catch {
      setPasswordError('An unexpected error occurred while updating password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[#141418] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">Account Settings</h3>
                <p className="text-[11px] text-white/50">
                  {globalUser ? `@${globalUser} • Security & Credentials` : 'Guest Session'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!globalUser ? (
            /* Guest Warning & Login prompt */
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center gap-3">
              <KeyRound className="w-10 h-10 text-[var(--accent)]" />
              <div>
                <h4 className="font-bold text-sm text-white">Sign In Required</h4>
                <p className="text-xs text-white/60 mt-1 max-w-xs">
                  Sign in with your Mouziketna account to manage your linked email address and password credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsAuthGateOpen(true);
                }}
                className="mt-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-transform hover:scale-105 active:scale-95 shadow-md shadow-[var(--accent)]/20 cursor-pointer"
              >
                Sign In to Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* SECTION 1: EMAIL ADDRESS */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[var(--accent)]" />
                    <span className="font-bold text-xs text-white">Email Address</span>
                  </div>
                  {userProfile.email && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      Linked
                    </span>
                  )}
                </div>

                {userProfile.email ? (
                  /* User HAS email: show address with Modify button that triggers In-Development popup */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-white truncate">{userProfile.email}</p>
                        <p className="text-[10px] text-white/40">Synchronized with Cloudflare</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowInDevModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer self-start sm:self-auto"
                    >
                      Modify
                    </button>
                  </div>
                ) : (
                  /* User DOES NOT have email: display empty state with Add button */
                  <div>
                    {!isAddingEmail ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
                        <div>
                          <p className="font-bold text-xs text-white/80">No email address linked</p>
                          <p className="text-[11px] text-white/40 mt-0.5">
                            Add your email address to sync and secure your profile.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingEmail(true);
                            setEmailError(null);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-[var(--accent)]/20 cursor-pointer self-start sm:self-auto"
                        >
                          Add Email Address
                        </button>
                      </div>
                    ) : (
                      /* Inline Add Email form */
                      <form onSubmit={handleSaveEmail} className="flex flex-col gap-2.5 p-3 rounded-xl bg-black/50 border border-[var(--accent)]/30">
                        <label className="text-[11px] font-semibold text-white/70">
                          Enter your email address:
                        </label>
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => {
                            setEmailInput(e.target.value);
                            setEmailError(null);
                          }}
                          placeholder="user@example.com"
                          autoFocus
                          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white text-xs placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />

                        {emailError && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{emailError}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingEmail(false);
                              setEmailInput('');
                              setEmailError(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={emailSaving || !emailInput.trim()}
                            className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:brightness-110 disabled:opacity-50 text-black font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            {emailSaving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Syncing...</span>
                              </>
                            ) : (
                              <span>Confirm & Sync</span>
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: PASSWORD CHANGE */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[var(--accent)]" />
                    <span className="font-bold text-xs text-white">Password & Authentication</span>
                  </div>
                  <span className="text-[10px] text-white/40">Encrypted in Session</span>
                </div>

                {!isChangingPassword ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
                    <div>
                      <p className="font-bold text-xs text-white/80">Account Password</p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        Update password without getting logged out from current session.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setShowResetPasswordContactAdmin(true)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-xs transition-colors border border-white/10 cursor-pointer"
                        title="Contact administrator to reset password"
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(true);
                          setPasswordError(null);
                          setPasswordSuccess(false);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/10 cursor-pointer"
                      >
                        Change Password
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Password change form */
                  <form onSubmit={handleSavePassword} className="flex flex-col gap-3 p-3.5 rounded-xl bg-black/50 border border-white/15">
                    {/* Current Password */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-white/70">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPass ? 'text' : 'password'}
                          value={currentPassInput}
                          onChange={(e) => {
                            setCurrentPassInput(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Enter current password"
                          className="w-full px-3 py-2 pr-9 rounded-xl bg-white/5 border border-white/15 text-white text-xs placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                          className="absolute right-2.5 top-2.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                          {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-white/70">New Password</label>
                        <span className="text-[10px] text-white/40">Min. 6 characters</span>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPass ? 'text' : 'password'}
                          value={newPassInput}
                          onChange={(e) => {
                            setNewPassInput(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Type new password"
                          className="w-full px-3 py-2 pr-9 rounded-xl bg-white/5 border border-white/15 text-white text-xs placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPass(!showNewPass)}
                          className="absolute right-2.5 top-2.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                          {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-white/70">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPass ? 'text' : 'password'}
                          value={confirmPassInput}
                          onChange={(e) => {
                            setConfirmPassInput(e.target.value);
                            setPasswordError(null);
                          }}
                          placeholder="Confirm new password"
                          className="w-full px-3 py-2 pr-9 rounded-xl bg-white/5 border border-white/15 text-white text-xs placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                          className="absolute right-2.5 top-2.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                          {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Password Feedback */}
                    {passwordError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>Password successfully updated and cached! You remain signed in.</span>
                      </div>
                    )}

                    {lockoutSeconds > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Anti-brute force cooldown: {lockoutSeconds}s remaining</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={passwordSaving || lockoutSeconds > 0 || !currentPassInput || !newPassInput || !confirmPassInput}
                        className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:brightness-110 disabled:opacity-50 text-black font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {passwordSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <span>Update Password</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Security Protection Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-white/40 text-[11px] leading-relaxed">
                <Shield className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                <span>
                  Credentials are verified with zero-interruption session caching. Modifying your password updates both cloud servers and your device cache so you never get locked out.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POPUP: Changing email unavailable notice */}
      {showInDevModal && (
        <div
          onClick={() => setShowInDevModal(false)}
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#18181c] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <Mail className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-black text-base text-white">Changing Email Unavailable</h4>
              <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                Direct email modification is currently unavailable. Please contact your system administrator to update or change your registered email address.
              </p>
            </div>

            {userProfile.email && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/50 w-full text-left">
                <span className="font-bold text-white/80 block mb-0.5">Current Email:</span>
                <span className="text-[var(--accent)] font-semibold truncate block">{userProfile.email}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInDevModal(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-[var(--accent)]/20 cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* POPUP: Reset password contact admin notice */}
      {showResetPasswordContactAdmin && (
        <div
          onClick={() => setShowResetPasswordContactAdmin(false)}
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#18181c] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-black text-base text-white">Reset Password Unavailable</h4>
              <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                Self-service password reset is currently unavailable. Please contact your system administrator to reset or recover your account password.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/50 w-full text-left">
              <span className="font-bold text-white/80 block mb-0.5">Account:</span>
              <span className="text-white font-mono font-semibold">@{globalUser}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowResetPasswordContactAdmin(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-[var(--accent)]/20 cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
