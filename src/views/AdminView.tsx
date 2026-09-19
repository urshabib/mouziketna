import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  ShieldAlert,
  UserPlus,
  Users,
  Trash2,
  Gift,
  Loader2,
  Check,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { NEW_HUB_BACKEND, fetchWithTimeout, fetchJsonRetry } from '../services/api';

export const AdminView: React.FC = () => {
  const { goBack, globalUser, showToast, setSurpriseUser } = useMusic();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newSurprise, setNewSurprise] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchJsonRetry<any[]>(`${NEW_HUB_BACKEND}/api/list-users`, 2);
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      showToast('Failed to load users list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);

    try {
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/create-user`, 8000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          isAdmin: newIsAdmin,
          surpriseWelcome: newSurprise,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to create user');
      }

      showToast(`User "${newUsername}" created!`);
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      setNewSurprise(false);
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Error creating user', true);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (uName: string) => {
    try {
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/delete-user`, 8000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uName }),
      });
      if (res.ok) {
        showToast(`User "${uName}" deleted`);
        loadUsers();
      }
    } catch {
      showToast('Failed to delete user', true);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl pb-24 select-none">
      <button
        onClick={goBack}
        className="self-start flex items-center gap-2 p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-[#ff6b1a]" />
            <span>Admin Console</span>
          </h2>
          <p className="text-xs text-white/50 font-semibold mt-1">
            Manage user accounts, admin rights, and custom welcome surprises.
          </p>
        </div>

        <button
          onClick={() => setSurpriseUser('Admin Preview')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 text-xs font-bold transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Preview Surprise</span>
        </button>
      </div>

      {/* 1. Create User Card */}
      <div className="p-6 rounded-3xl bg-white/[0.03] glass-panel border border-white/5 flex flex-col gap-4">
        <h3 className="font-extrabold text-base text-white flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#ff6b1a]" />
          <span>Create New User</span>
        </h3>

        <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff6b1a]"
            />
            <input
              type="password"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff6b1a]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-white/80 font-medium">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded accent-[#ff6b1a]"
              />
              <span>Administrator Privileges</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newSurprise}
                onChange={(e) => setNewSurprise(e.target.checked)}
                className="w-4 h-4 rounded accent-pink-500"
              />
              <span>Tulip Surprise on Welcome</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={creating || !newUsername.trim() || !newPassword.trim()}
            className="self-start px-6 py-2.5 bg-[#ff6b1a] text-black font-extrabold text-xs rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Create Account</span>}
          </button>
        </form>
      </div>

      {/* 2. User List */}
      <div className="p-6 rounded-3xl bg-white/[0.03] glass-panel border border-white/5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ff6b1a]" />
            <span>Registered Users ({users.length})</span>
          </h3>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="text-xs font-bold text-white/50 hover:text-white"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin text-[#ff6b1a]" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-xs text-white/40">No users found or could not connect to backend.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {users.map((u) => (
              <div key={u.username} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white">{u.username}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {u.isAdmin && (
                        <span className="text-[10px] font-extrabold uppercase text-[#ff6b1a]">
                          Admin
                        </span>
                      )}
                      {u.surpriseWelcome && (
                        <span className="text-[10px] font-extrabold text-pink-300">
                          🌷 Surprise Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {u.username !== globalUser && (
                  <button
                    onClick={() => handleDeleteUser(u.username)}
                    className="p-2 text-white/40 hover:text-red-400 rounded-full transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
