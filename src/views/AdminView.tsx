import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  ShieldAlert,
  UserPlus,
  Users,
  Trash2,
  Loader2,
  ArrowLeft,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Heart,
  ListMusic,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  Cloud,
  Database,
  Copy,
  Check,
  Sparkles,
  X,
  Mail,
} from 'lucide-react';
import { NEW_HUB_BACKEND, fetchWithTimeout, fetchJsonRetry } from '../services/api';

interface AdminUserRecord {
  username: string;
  isAdmin: boolean;
  likedCount?: number;
  playlistCount?: number;
  password?: string;
  email?: string;
}

export const AdminView: React.FC = () => {
  const { goBack, globalUser, showToast, setModalConfirm, adminResetUserPassword } = useMusic();

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Modify password state
  const [editingPasswordUser, setEditingPasswordUser] = useState<AdminUserRecord | null>(null);
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [showTargetPassword, setShowTargetPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Cloudflare guide modal state
  const [showCloudflareGuide, setShowCloudflareGuide] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchJsonRetry<any>(`${NEW_HUB_BACKEND}/api/list-users`, 3);
      if (data && Array.isArray(data.users)) {
        setUsers(data.users);
      } else if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch {
      showToast('Could not load users list from server', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = newUsername.trim();
    const p = newPassword.trim();
    if (!u || !p) {
      showToast('Please enter both a username and password', true);
      return;
    }
    setCreating(true);

    try {
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/create-user`, 9000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          password: p,
          isAdmin: newIsAdmin,
        }),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || (resData && resData.error)) {
        throw new Error(resData?.error || 'Failed to create user');
      }

      showToast(`User "${u}" successfully created!`);
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Error creating user', true);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAdmin = async (targetUsername: string, currentAdminStatus: boolean) => {
    setUpdatingUser(targetUsername);
    const newStatus = !currentAdminStatus;
    try {
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/set-admin`, 8000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername,
          isAdmin: newStatus,
        }),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok || (resData && resData.error)) {
        throw new Error(resData?.error || 'Failed to update admin role');
      }

      showToast(newStatus ? `"${targetUsername}" is now an admin` : `Admin role removed for "${targetUsername}"`);
      // Update locally immediately
      setUsers((prev) =>
        prev.map((u) => (u.username.toLowerCase() === targetUsername.toLowerCase() ? { ...u, isAdmin: newStatus } : u))
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to change admin status', true);
      loadUsers();
    } finally {
      setUpdatingUser(null);
    }
  };

  const confirmDeleteUser = (uName: string) => {
    if (setModalConfirm) {
      setModalConfirm({
        title: `Delete "${uName}"?`,
        text: "This will permanently remove the account and all associated playlists and library data from the server. This cannot be undone.",
        onConfirm: () => performDeleteUser(uName),
      });
    } else {
      performDeleteUser(uName);
    }
  };

  const performDeleteUser = async (uName: string) => {
    setUpdatingUser(uName);
    try {
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/delete-user`, 8000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uName }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok || (resData && resData.error)) {
        throw new Error(resData?.error || 'Failed to delete user');
      }
      showToast(`User "${uName}" deleted`, true);
      setUsers((prev) => prev.filter((u) => u.username.toLowerCase() !== uName.toLowerCase()));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', true);
      loadUsers();
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleAdminUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPasswordUser) return;
    const target = editingPasswordUser.username;
    const newPass = targetNewPassword.trim();
    if (!newPass) {
      showToast('Please enter a new password', true);
      return;
    }
    if (newPass.length < 4) {
      showToast('Password must be at least 4 characters long', true);
      return;
    }
    setSavingPassword(true);
    try {
      const res = await adminResetUserPassword(target, newPass);
      if (res.success) {
        showToast(`Password updated for user "${target}"`);
        setEditingPasswordUser(null);
        setTargetNewPassword('');
        loadUsers();
      } else {
        showToast(res.error || 'Failed to update password', true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Error updating password', true);
    } finally {
      setSavingPassword(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTargetNewPassword(pass);
    setShowTargetPassword(true);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.trim().toLowerCase()))
  );

  const totalAdmins = users.filter((u) => u.isAdmin).length;

  return (
    <div className="flex flex-col gap-8 max-w-4xl pb-24 select-none">
      {/* Top navigation */}
      <button
        onClick={goBack}
        className="self-start flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-[#ff6b1a]" />
            <span>Admin Console</span>
          </h2>
          <p className="text-xs text-white/50 font-semibold mt-1">
            Manage registered accounts, grant administrator privileges, and configure users.
          </p>
        </div>

        {/* Stats Badges & Cloudflare DB button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCloudflareGuide(true)}
            className="px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white flex items-center gap-2 text-xs font-bold transition-all cursor-pointer"
            title="How to view and inspect database on Cloudflare"
          >
            <Cloud className="w-4 h-4 text-sky-400" />
            <span>Cloudflare DB Guide</span>
          </button>
          <div className="px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-xs font-bold text-white/80">{users.length} Users</span>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold text-[var(--accent)]">{totalAdmins} Admins</span>
          </div>
        </div>
      </div>

      {/* 1. Create User Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 flex flex-col gap-5 shadow-xl">
        <h3 className="font-black text-lg text-white flex items-center gap-2.5">
          <UserPlus className="w-5 h-5 text-[var(--accent)]" />
          <span>Create New User</span>
        </h3>

        <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white/60">Username</label>
              <input
                type="text"
                placeholder="e.g. sarah"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white/60">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-white/80 select-none">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
              <span>Grant Administrator Rights</span>
            </label>

            <button
              type="submit"
              disabled={creating || !newUsername.trim() || !newPassword.trim()}
              className="px-6 py-3 bg-[var(--accent)] hover:opacity-90 text-black font-extrabold text-xs rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2 shadow-lg shadow-[var(--accent-soft)]"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Registered Users List */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 flex flex-col gap-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-black text-lg text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[var(--accent)]" />
            <span>Registered Users ({users.length})</span>
          </h3>

          <div className="flex items-center gap-2.5">
            {/* User Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors w-40 sm:w-52"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadUsers}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh users list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[var(--accent)]' : ''}`} />
            </button>
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
            <p className="text-xs font-semibold text-white/50">Fetching registered accounts...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5">
            <Users className="w-8 h-8 mx-auto text-white/20 mb-2" />
            <p className="text-sm font-bold text-white/70">
              {searchQuery ? `No users matching "${searchQuery}"` : 'No registered users found'}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {searchQuery ? 'Try a different search query' : 'Create an account using the form above'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {filteredUsers.map((u) => {
              const isCurrentUser = Boolean(globalUser && u.username.toLowerCase() === globalUser.toLowerCase());
              const isBeingUpdated = updatingUser === u.username;

              return (
                <div
                  key={u.username}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-white/[0.02] -mx-3 px-3 rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    {/* User Avatar Initial */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-md ${
                        u.isAdmin
                          ? 'bg-gradient-to-br from-[var(--accent)] to-[#401500] text-white shadow-[var(--accent-soft)]'
                          : 'bg-white/10 text-white/90'
                      }`}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>

                    {/* User Meta */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white">{u.username}</span>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-[10px] font-bold">
                            You
                          </span>
                        )}
                        {u.isAdmin && (
                          <span className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-black uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                      </div>

                      {/* Counts / stats / email / password */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] font-medium text-white/50">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-white/30" />
                          <span>{u.likedCount ?? 0} liked</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <ListMusic className="w-3 h-3 text-white/30" />
                          <span>{u.playlistCount ?? 0} playlists</span>
                        </span>

                        {u.email && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[var(--accent)] font-semibold">
                              <Mail className="w-3 h-3 opacity-70" />
                              <span className="truncate max-w-[160px]">{u.email}</span>
                            </span>
                          </>
                        )}

                        {u.password && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/70">
                              <Lock className="w-2.5 h-2.5 text-white/40" />
                              <span className="font-mono text-[10px]">
                                {revealedPasswords[u.username] ? u.password : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedPasswords((prev) => ({
                                    ...prev,
                                    [u.username]: !prev[u.username],
                                  }))
                                }
                                className="text-white/40 hover:text-white"
                                title={revealedPasswords[u.username] ? 'Hide password' : 'Show password'}
                              >
                                {revealedPasswords[u.username] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    {/* Modify User Password Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPasswordUser(u);
                        setTargetNewPassword(u.password || '');
                        setShowTargetPassword(false);
                      }}
                      disabled={isBeingUpdated}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-[var(--accent-soft)] hover:bg-[var(--accent)]/30 text-[var(--accent)] border border-[var(--accent)]/30 cursor-pointer disabled:opacity-40"
                      title={`Modify password for ${u.username}`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Set Password</span>
                    </button>

                    {/* Toggle Admin Button */}
                    <button
                      onClick={() => handleToggleAdmin(u.username, u.isAdmin)}
                      disabled={isBeingUpdated || isCurrentUser}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        u.isAdmin
                          ? 'bg-white/5 hover:bg-red-500/10 text-white/70 hover:text-red-400'
                          : 'bg-white/5 hover:bg-[var(--accent-soft)] text-white/70 hover:text-[var(--accent)]'
                      } disabled:opacity-40 disabled:pointer-events-none cursor-pointer`}
                      title={u.isAdmin ? 'Revoke admin rights' : 'Promote to admin'}
                    >
                      {isBeingUpdated ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : u.isAdmin ? (
                        <>
                          <ShieldOff className="w-3.5 h-3.5" />
                          <span>Revoke Admin</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Make Admin</span>
                        </>
                      )}
                    </button>

                    {/* Delete User Button */}
                    {!isCurrentUser && (
                      <button
                        onClick={() => confirmDeleteUser(u.username)}
                        disabled={isBeingUpdated}
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors disabled:opacity-40 cursor-pointer"
                        title="Delete user account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CLOUDFLARE DATABASE INFO CARD */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>Cloudflare Backend Database</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                Workers KV / D1
              </span>
            </h4>
            <p className="text-xs text-white/50 mt-0.5">
              Forgot an administrator or user password? You can inspect and modify all records directly in Cloudflare.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCloudflareGuide(true)}
          className="px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <HelpCircle className="w-4 h-4" />
          <span>View Cloudflare Instructions</span>
        </button>
      </div>

      {/* MODAL: ADMIN SET / MODIFY USER PASSWORD */}
      {editingPasswordUser && (
        <div
          onClick={() => setEditingPasswordUser(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#16161a] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Modify User Password</h3>
                  <p className="text-xs text-white/50">
                    Account: <span className="font-bold text-white">@{editingPasswordUser.username}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPasswordUser(null)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAdminUpdatePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-white/80">New Password</label>
                <div className="relative">
                  <input
                    type={showTargetPassword ? 'text' : 'password'}
                    value={targetNewPassword}
                    onChange={(e) => setTargetNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoFocus
                    className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTargetPassword(!showTargetPassword)}
                    className="absolute right-3 top-3.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    {showTargetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Helper Actions */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Strong Password</span>
                </button>

                {targetNewPassword && (
                  <button
                    type="button"
                    onClick={() => handleCopy(targetNewPassword, 'modal-pass')}
                    className="text-xs text-white/60 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {copiedKey === 'modal-pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'modal-pass' ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-white/50 leading-relaxed">
                This will immediately overwrite the password for <strong className="text-white">@{editingPasswordUser.username}</strong> on the Cloudflare server. If they are currently active, their login will remain valid without interruption.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPasswordUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || !targetNewPassword.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-[var(--accent-soft)]"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Cloudflare...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STEP-BY-STEP CLOUDFLARE DATABASE ACCESS GUIDE */}
      {showCloudflareGuide && (
        <div
          onClick={() => setShowCloudflareGuide(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#141418] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Cloudflare Users Database</h3>
                  <p className="text-xs text-white/50">How to inspect & recover passwords in Cloudflare</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudflareGuide(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Steps */}
            <div className="flex flex-col gap-4 text-xs text-white/80 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[11px] font-black">1</span>
                  <span>Log in to Cloudflare Dashboard</span>
                </div>
                <p className="text-white/60 pl-7">
                  Open <strong className="text-sky-300">https://dash.cloudflare.com</strong> and sign in to your Cloudflare account.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[11px] font-black">2</span>
                  <span>Open Workers & Pages</span>
                </div>
                <p className="text-white/60 pl-7">
                  In the left sidebar, click <strong>Workers & Pages</strong>, then select your worker: <code className="bg-black/60 px-2 py-0.5 rounded text-[var(--accent)]">new-music-space-api</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[11px] font-black">3</span>
                  <span>Inspect Storage / KV Namespaces</span>
                </div>
                <p className="text-white/60 pl-7">
                  Click the <strong>Storage</strong> (or <strong>Settings → Bindings → KV Namespaces</strong>) tab. Select the Users KV namespace (e.g., <code className="bg-black/60 px-1.5 py-0.5 rounded text-white/90">USERS</code> or <code className="bg-black/60 px-1.5 py-0.5 rounded text-white/90">MUSIC_KV</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-[11px] font-black">4</span>
                  <span>View or Edit User Password</span>
                </div>
                <p className="text-white/60 pl-7">
                  Click <strong>KV Pairs</strong>. Find the key <code className="bg-black/60 px-1.5 py-0.5 rounded text-white/90">user:[username]</code> or <code className="bg-black/60 px-1.5 py-0.5 rounded text-white/90">users</code>. Click <strong>View</strong> to read the JSON value containing their password, or edit it directly and click <strong>Save</strong>!
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2.5">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Tip:</strong> You don't even need to visit Cloudflare! You can modify any user's password directly from this Admin Console using the <strong>Set Password</strong> button above.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCloudflareGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
