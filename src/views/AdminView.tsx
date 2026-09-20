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
} from 'lucide-react';
import { NEW_HUB_BACKEND, fetchWithTimeout, fetchJsonRetry } from '../services/api';

interface AdminUserRecord {
  username: string;
  isAdmin: boolean;
  likedCount?: number;
  playlistCount?: number;
}

export const AdminView: React.FC = () => {
  const { goBack, globalUser, showToast, setModalConfirm } = useMusic();

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

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

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.trim().toLowerCase())
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

        {/* Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-xs font-bold text-white/80">{users.length} Users</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-[#ff6b1a]/10 border border-[#ff6b1a]/20 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#ff6b1a]" />
            <span className="text-xs font-bold text-[#ff6b1a]">{totalAdmins} Admins</span>
          </div>
        </div>
      </div>

      {/* 1. Create User Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 flex flex-col gap-5 shadow-xl">
        <h3 className="font-black text-lg text-white flex items-center gap-2.5">
          <UserPlus className="w-5 h-5 text-[#ff6b1a]" />
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
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ff6b1a] transition-colors"
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
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ff6b1a] transition-colors"
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
                className="w-4 h-4 rounded accent-[#ff6b1a] cursor-pointer"
              />
              <span>Grant Administrator Rights</span>
            </label>

            <button
              type="submit"
              disabled={creating || !newUsername.trim() || !newPassword.trim()}
              className="px-6 py-3 bg-[#ff6b1a] hover:bg-[#ff8b47] text-black font-extrabold text-xs rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center gap-2 shadow-lg shadow-[#ff6b1a]/20"
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
            <Users className="w-5 h-5 text-[#ff6b1a]" />
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
                className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#ff6b1a] transition-colors w-40 sm:w-52"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadUsers}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh users list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#ff6b1a]' : ''}`} />
            </button>
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff6b1a]" />
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
                          ? 'bg-gradient-to-br from-[#ff6b1a] to-[#7a2c00] text-white shadow-[#ff6b1a]/20'
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
                          <span className="px-2 py-0.5 rounded-md bg-[#ff6b1a]/15 border border-[#ff6b1a]/30 text-[#ff6b1a] text-[10px] font-black uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                      </div>

                      {/* Counts / stats */}
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-white/50">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-white/30" />
                          <span>{u.likedCount ?? 0} liked</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <ListMusic className="w-3 h-3 text-white/30" />
                          <span>{u.playlistCount ?? 0} playlists</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Toggle Admin Button */}
                    <button
                      onClick={() => handleToggleAdmin(u.username, u.isAdmin)}
                      disabled={isBeingUpdated || isCurrentUser}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        u.isAdmin
                          ? 'bg-white/5 hover:bg-red-500/10 text-white/70 hover:text-red-400'
                          : 'bg-white/5 hover:bg-[#ff6b1a]/15 text-white/70 hover:text-[#ff6b1a]'
                      } disabled:opacity-40 disabled:pointer-events-none`}
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
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors disabled:opacity-40"
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
    </div>
  );
};
