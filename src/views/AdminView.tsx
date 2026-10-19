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
  UploadCloud,
  FileUp,
  Download,
  FileText,
  Instagram,
  MessageSquare,
  Unlock,
  Archive,
  ChevronDown,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  NEW_HUB_BACKEND,
  fetchWithTimeout,
  fetchJsonRetry,
  fetchAdminUsersList,
  fetchAdminSettings,
  updateAdminSettings,
  toggleUserEnabledStatus,
  FeedbackItem,
  fetchFeedbackList,
  deleteFeedbackItem,
  clearAllFeedback,
  fetchVerifiedFollowers,
  updateVerifiedFollowers,
  fetchUnlockedUsers,
  toggleUserSettingsLock,
  VerifiedFollowersResponse,
} from '../services/api';
import { sessionManager } from '../services/sessionManager';

interface AdminUserRecord {
  username: string;
  isAdmin: boolean;
  enabled?: boolean;
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

  // Global Auto-Enable Setting state
  const [autoEnable, setAutoEnable] = useState(false);
  const [autoEnableLoading, setAutoEnableLoading] = useState(false);

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
  // Inbox / Feedback state
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [clearingAllFeedback, setClearingAllFeedback] = useState(false);

  // Verified Followers & Unlocked Users State
  const [verifiedFollowers, setVerifiedFollowers] = useState<VerifiedFollowersResponse | null>(null);
  const [unlockedUsersList, setUnlockedUsersList] = useState<Array<{ username: string; unlockedSocialHandle?: string; unlockedPlatform?: string; unlockedAt?: number }>>([]);
  const [selectedFollowerPlatform, setSelectedFollowerPlatform] = useState<'instagram' | 'tiktok'>('instagram');
  const [newFollowerInput, setNewFollowerInput] = useState('');
  const [addingFollowers, setAddingFollowers] = useState(false);
  const [syncingFollowers, setSyncingFollowers] = useState(false);
  const [togglingLockUser, setTogglingLockUser] = useState<string | null>(null);

  // Cloudflare guide modal state
  const [showCloudflareGuide, setShowCloudflareGuide] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [showBackupFormatDropdown, setShowBackupFormatDropdown] = useState(false);

  const handleDownloadAllBackup = async (fileExt: 'zip' | 'json' | 'txt' = 'zip') => {
    setDownloadingBackup(true);
    setDownloadProgress('Starting backup...');
    setShowBackupFormatDropdown(false);

    try {
      const sessionToken = sessionManager.getSessionToken();
      const today = new Date().toISOString().split('T')[0];
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!NEW_HUB_BACKEND && sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }

      // 1. Get base user list
      let userList = users;
      if (!userList || userList.length === 0) {
        setDownloadProgress('Fetching user list...');
        userList = await fetchAdminUsersList();
      }

      // 2. Try fast server endpoint first if running full-stack
      const serverUsersMap = new Map<string, any>();
      try {
        const res = await fetchWithTimeout(`/api/admin/backup`, 10000, { headers }).catch(() => null);
        if (res && res.ok) {
          const sJson = await res.json().catch(() => null);
          if (sJson && Array.isArray(sJson.users)) {
            for (const su of sJson.users) {
              if (su && su.username) {
                serverUsersMap.set(su.username.toLowerCase(), su);
              }
            }
          }
        }
      } catch {}

      // 3. Deep scrape every user to guarantee 100% complete data (never shallow)
      const fullProfiles: any[] = [];
      const batchSize = 4;

      for (let i = 0; i < userList.length; i += batchSize) {
        const batch = userList.slice(i, i + batchSize);
        setDownloadProgress(`Scraping user profiles: ${Math.min(i + batch.length, userList.length)}/${userList.length}...`);

        const batchResults = await Promise.all(
          batch.map(async (u) => {
            const clean = u.username.toLowerCase();
            const fromServer = serverUsersMap.get(clean);
            // If server returned complete document with playlists, liked songs, and albums
            if (
              fromServer &&
              Array.isArray(fromServer.customPlaylists) &&
              Array.isArray(fromServer.likedSongs) &&
              fromServer.customPlaylists.length >= (u.playlistCount || 0) &&
              fromServer.likedSongs.length >= (u.likedCount || 0)
            ) {
              return fromServer;
            }

            // Scrape user profile directly from /api/user-profile
            try {
              const pRes = await fetchWithTimeout(
                `${NEW_HUB_BACKEND}/api/user-profile?username=${encodeURIComponent(u.username)}`,
                10000,
                { headers }
              ).catch(() => null);

              if (pRes && pRes.ok) {
                const pData = await pRes.json().catch(() => null);
                if (pData?.profile) {
                  const prof = pData.profile;
                  const truePass =
                    u.password && u.password !== 'mouzika'
                      ? u.password
                      : prof.password && prof.password !== 'mouzika'
                      ? prof.password
                      : '';

                  return {
                    username: u.username,
                    displayName: prof.displayName || u.username,
                    avatarUrl: prof.avatarUrl || null,
                    email: u.email || prof.email || null,
                    password: truePass,
                    isAdmin: Boolean(u.isAdmin || prof.isAdmin),
                    enabled: u.enabled !== false && prof.enabled !== false,
                    customPlaylists: Array.isArray(prof.customPlaylists) ? prof.customPlaylists : [],
                    likedSongs: Array.isArray(prof.likedSongs) ? prof.likedSongs : [],
                    favouriteAlbums: Array.isArray(prof.favouriteAlbums) ? prof.favouriteAlbums : [],
                    favouriteArtists: Array.isArray(prof.favouriteArtists) ? prof.favouriteArtists : [],
                    recentlyPlayed: Array.isArray(prof.recentlyPlayed) ? prof.recentlyPlayed : [],
                    stats: prof.stats || {},
                    theme: prof.theme || 'dark',
                    accentColor: prof.accentColor || 'purple',
                    liquidGlass: prof.liquidGlass !== undefined ? prof.liquidGlass : true,
                    createdAt: (u as any).createdAt || prof.createdAt || Date.now(),
                    updatedAt: prof.updatedAt || Date.now(),
                  };
                }
              }
            } catch {}

            // Fallback complete schema if network failed for individual profile
            return {
              username: u.username,
              displayName: u.username,
              avatarUrl: null,
              email: u.email || null,
              password: u.password && u.password !== 'mouzika' ? u.password : '',
              isAdmin: Boolean(u.isAdmin),
              enabled: u.enabled !== false,
              customPlaylists: [],
              likedSongs: [],
              favouriteAlbums: [],
              favouriteArtists: [],
              recentlyPlayed: [],
              stats: {},
              theme: 'dark',
              accentColor: 'purple',
              liquidGlass: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          })
        );
        fullProfiles.push(...batchResults);
      }

      setDownloadProgress('Building archive...');

      if (fileExt === 'zip') {
        const zip = new JSZip();

        // 1. /users/ folder with individual user JSON files exactly as in Cloudflare KV
        const usersFolder = zip.folder('users');
        const cloudflareKvDump: Record<string, any> = {};

        for (const prof of fullProfiles) {
          const userJson = JSON.stringify(prof, null, 2);
          usersFolder?.file(`${prof.username}.json`, userJson);
          cloudflareKvDump[`user_${prof.username.toLowerCase()}`] = prof;
        }

        // 2. all_users_combined.json for one-click app restore
        const combinedBackup = {
          backup: true,
          type: 'mouzika_all_users_backup',
          date: today,
          generatedAt: Date.now(),
          totalUsers: fullProfiles.length,
          users: fullProfiles,
        };
        zip.file('all_users_combined.json', JSON.stringify(combinedBackup, null, 2));

        // 3. cloudflare_kv_dump.json for Cloudflare KV bulk upload
        zip.file('cloudflare_kv_dump.json', JSON.stringify(cloudflareKvDump, null, 2));

        // 4. README.txt
        const readme = `MOUZIKETNA COMPLETE DATABASE BACKUP
=====================================
Date: ${today}
Total User Accounts: ${fullProfiles.length}
Generated At: ${new Date().toISOString()}

CONTENTS:
1. /users/
   Contains individual complete JSON files for each user (${fullProfiles.map((u) => u.username).join(', ')}).
   When you open any file, you will find all playlists, liked songs, albums, and credentials exactly as if you queried that user in Cloudflare KV.

2. /all_users_combined.json
   All user profiles combined into a single JSON file. You can upload this directly into MOUZIKETNA via the "Restore Backup" button.

3. /cloudflare_kv_dump.json
   Cloudflare Workers KV format (keyed by user_<username>) for direct bulk import into Cloudflare KV.
`;
        zip.file('README.txt', readme);

        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });

        const filename = `mouzika-users-backup-${today}.zip`;
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`✓ Downloaded ${filename} (${fullProfiles.length} complete user accounts in zip)`);
      } else {
        const combinedBackup = {
          backup: true,
          type: 'mouzika_all_users_backup',
          date: today,
          generatedAt: Date.now(),
          totalUsers: fullProfiles.length,
          users: fullProfiles,
        };
        const content = JSON.stringify(combinedBackup, null, 2);
        const filename = `backup-${today}.${fileExt}`;
        const blob = new Blob([content], { type: fileExt === 'json' ? 'application/json' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`✓ Downloaded ${filename} (${fullProfiles.length} full user profiles backed up)`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to download backup', true);
    } finally {
      setDownloadingBackup(false);
      setDownloadProgress(null);
    }
  };

  const handleDownloadUserBackup = async (targetUser: AdminUserRecord, fileExt: 'json' | 'txt' = 'json') => {
    try {
      const sessionToken = sessionManager.getSessionToken();
      const today = new Date().toISOString().split('T')[0];
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!NEW_HUB_BACKEND && sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      const res = await fetchWithTimeout(
        `${NEW_HUB_BACKEND}/api/user-profile?username=${encodeURIComponent(targetUser.username)}`,
        8000,
        { headers }
      ).catch(() => null);

      let profData: any = null;
      if (res && res.ok) {
        const d = await res.json().catch(() => null);
        profData = d?.profile || null;
      }
      if (!profData) {
        profData = {
          username: targetUser.username,
          displayName: targetUser.username,
          password: targetUser.password && targetUser.password !== 'mouzika' ? targetUser.password : '',
          isAdmin: Boolean(targetUser.isAdmin),
          enabled: targetUser.enabled !== false,
          customPlaylists: [],
          likedSongs: [],
          favouriteAlbums: [],
          stats: {},
        };
      }
      if (targetUser.password && targetUser.password !== 'mouzika' && !profData.password) {
        profData.password = targetUser.password;
      }

      const content = JSON.stringify(profData, null, 2);
      const filename = `backup_${targetUser.username}_${today}.${fileExt}`;
      const blob = new Blob([content], { type: fileExt === 'json' ? 'application/json' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`✓ Downloaded full backup for @${targetUser.username}`);
    } catch {
      showToast(`Failed to download backup for @${targetUser.username}`, true);
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoringBackup(true);
    try {
      const text = await file.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Selected backup file is not valid JSON text');
      }

      const sessionToken = sessionManager.getSessionToken();

      // Check if this is an all-users backup file ({ users: [...] } or array)
      if (Array.isArray(data) || Array.isArray(data.users)) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (!NEW_HUB_BACKEND && sessionToken) {
          headers.Authorization = `Bearer ${sessionToken}`;
        }
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/admin/restore-backup`, 25000, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        }).catch(() => null);

        const resData = await res?.json().catch(() => null);
        if (res && res.ok) {
          const count = resData?.restoredCount || (data.users?.length || data.length);
          showToast(`✓ Full backup restored successfully! (${count} user accounts updated)`);
          loadAdminData();
          return;
        }
      }

      // Single user backup file
      const rawName = data.username || data.user || file.name.replace(/^backup_|^user_/, '').replace(/\.(txt|json)$/i, '');
      const targetUser = String(rawName).trim().toLowerCase();
      if (!targetUser) {
        throw new Error('Could not determine user account from backup file');
      }

      const payload = {
        ...data,
        username: targetUser,
      };

      const syncHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!NEW_HUB_BACKEND && sessionToken) {
        syncHeaders.Authorization = `Bearer ${sessionToken}`;
      }
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/sync-profile`, 15000, {
        method: 'POST',
        headers: syncHeaders,
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (!res || !res.ok) {
        await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/user-profile`, 15000, {
          method: 'POST',
          headers: syncHeaders,
          body: JSON.stringify(payload),
        }).catch(() => null);
      }

      showToast(`✓ Backup for user "@${targetUser}" successfully uploaded & restored!`);
      loadAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to parse or restore backup file', true);
    } finally {
      setRestoringBackup(false);
      e.target.value = '';
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersList, settingsData, feedbackData, followersData, unlockedData] = await Promise.all([
        fetchAdminUsersList().catch(() => []),
        fetchAdminSettings().catch(() => ({ autoEnable: false })),
        fetchFeedbackList().catch(() => []),
        fetchVerifiedFollowers().catch(() => null),
        fetchUnlockedUsers().catch(() => []),
      ]);

      if (Array.isArray(usersList)) {
        const enriched = usersList.map((u: any) => {
          try {
            const override = localStorage.getItem(`mouzika_user_status_${u.username.toLowerCase()}`);
            if (override) {
              return { ...u, enabled: override === 'enabled' };
            }
          } catch {}
          return u;
        });
        setUsers(enriched);
      } else {
        setUsers([]);
      }

      setAutoEnable(Boolean(settingsData?.autoEnable));
      setFeedbackList(Array.isArray(feedbackData) ? feedbackData : []);
      if (followersData) setVerifiedFollowers(followersData);
      if (Array.isArray(unlockedData)) setUnlockedUsersList(unlockedData);
    } catch {
      showToast('Could not load admin data from server', true);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowers = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newFollowerInput.trim();
    if (!raw) return;
    const parts = raw.split(/[\n,]+/).map((s) => s.trim().replace(/^@/, '')).filter(Boolean);
    if (parts.length === 0) return;

    setAddingFollowers(true);
    const res = await updateVerifiedFollowers('add', selectedFollowerPlatform, undefined, parts);
    setAddingFollowers(false);

    if (res.success) {
      showToast(`✓ Added ${parts.length} follower(s) to ${selectedFollowerPlatform}`);
      setNewFollowerInput('');
      const fresh = await fetchVerifiedFollowers();
      if (fresh) setVerifiedFollowers(fresh);
    } else {
      showToast(res.error || 'Failed to add followers', true);
    }
  };

  const handleRemoveFollower = async (platform: 'instagram' | 'tiktok', handle: string) => {
    const res = await updateVerifiedFollowers('remove', platform, handle);
    if (res.success) {
      showToast(`Removed @${handle} from ${platform} verified list`);
      const fresh = await fetchVerifiedFollowers();
      if (fresh) setVerifiedFollowers(fresh);
    } else {
      showToast(res.error || 'Failed to remove follower', true);
    }
  };

  const handleSyncFollowers = async (platform: 'instagram' | 'tiktok') => {
    setSyncingFollowers(true);
    const res = await updateVerifiedFollowers('sync', platform);
    setSyncingFollowers(false);
    if (res.success) {
      showToast(`✓ Synchronized ${platform} followers list!`);
      const fresh = await fetchVerifiedFollowers();
      if (fresh) setVerifiedFollowers(fresh);
    } else {
      showToast(res.error || 'Failed to sync followers', true);
    }
  };

  const handleToggleUserLock = async (targetUsername: string, isCurrentlyUnlocked: boolean) => {
    setTogglingLockUser(targetUsername);
    const nextState = !isCurrentlyUnlocked;
    const res = await toggleUserSettingsLock(targetUsername, nextState);
    setTogglingLockUser(null);
    if (res.success) {
      showToast(nextState ? `✓ Settings UNLOCKED for @${targetUsername}` : `Settings LOCKED for @${targetUsername}`);
      const fresh = await fetchUnlockedUsers();
      if (fresh) setUnlockedUsersList(fresh);
    } else {
      showToast(res.error || 'Failed to update user lock', true);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    setDeletingFeedbackId(id);
    const ok = await deleteFeedbackItem(id);
    setDeletingFeedbackId(null);
    if (ok) {
      setFeedbackList((prev) => prev.filter((f) => f.id !== id));
      showToast('Message deleted');
    } else {
      showToast('Failed to delete message', true);
    }
  };

  const handleClearAllFeedback = () => {
    setModalConfirm({
      title: 'Clear All Feedback Inbox Messages?',
      text: 'Are you sure you want to permanently delete all incoming report and suggestion messages? This action cannot be undone.',
      onConfirm: async () => {
        setClearingAllFeedback(true);
        const ok = await clearAllFeedback();
        setClearingAllFeedback(false);
        if (ok) {
          setFeedbackList([]);
          showToast('Feedback inbox cleared');
        } else {
          showToast('Failed to clear feedback inbox', true);
        }
      },
    });
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleAutoEnable = async () => {
    const next = !autoEnable;
    setAutoEnableLoading(true);
    const res = await updateAdminSettings(next);
    setAutoEnableLoading(false);
    if (res.success) {
      setAutoEnable(next);
      showToast(next ? '✓ Auto-enable turned ON (New registrations will be active instantly)' : '✓ Auto-enable turned OFF (New registrations require manual admin approval)');
    } else {
      showToast(res.error || 'Failed to update setting', true);
    }
  };

  const handleToggleUserEnabled = async (targetUsername: string, currentEnabled: boolean) => {
    setUpdatingUser(targetUsername);
    const next = !currentEnabled;
    const res = await toggleUserEnabledStatus(targetUsername, next);
    setUpdatingUser(null);

    if (res.success) {
      showToast(next ? `User "${targetUsername}" ENABLED for playback` : `User "${targetUsername}" DISABLED`);
      setUsers((prev) =>
        prev.map((u) => (u.username.toLowerCase() === targetUsername.toLowerCase() ? { ...u, enabled: next } : u))
      );
    } else {
      showToast(res.error || 'Failed to update user status', true);
      loadAdminData();
    }
  };

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
      const sessionToken = sessionManager.getSessionToken();
      
      // 1. Always create on Cloudflare Worker so the account and password exist in the cloud!
      let workerErr: string | null = null;
      try {
        const workerRes = await fetchWithTimeout('https://new-music-space-api.urshabib.workers.dev/api/create-user', 9000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: u,
            password: p,
            isAdmin: newIsAdmin,
          }),
        });
        const wData = await workerRes.json().catch(() => null);
        if (!workerRes.ok || (wData && wData.error)) {
          if (wData?.error?.toLowerCase().includes('already exist')) {
            workerErr = wData.error;
          }
        }
      } catch {}

      if (workerErr) {
        throw new Error(workerErr);
      }

      // 2. Also create on local Express server if available
      try {
        await fetchWithTimeout('/api/create-user', 5000, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({
            username: u,
            password: p,
            isAdmin: newIsAdmin,
            sessionToken: sessionToken || '',
          }),
        });
      } catch {}

      showToast(`User "${u}" successfully created!`);
      setNewUsername('');
      setNewPassword('');
      setNewIsAdmin(false);
      loadAdminData();
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
      const sessionToken = sessionManager.getSessionToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!NEW_HUB_BACKEND && sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/set-admin`, 8000, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: targetUsername,
          isAdmin: newStatus,
          sessionToken: sessionToken || '',
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
      loadAdminData();
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
      const sessionToken = sessionManager.getSessionToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!NEW_HUB_BACKEND && sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/delete-user`, 8000, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: uName,
          sessionToken: sessionToken || '',
        }),
      });
      const resData = await res.json().catch(() => null);
      if (!res.ok || (resData && resData.error)) {
        throw new Error(resData?.error || 'Failed to delete user');
      }
      showToast(`User "${uName}" deleted`, true);
      setUsers((prev) => prev.filter((u) => u.username.toLowerCase() !== uName.toLowerCase()));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', true);
      loadAdminData();
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
        setUsers((prev) =>
          prev.map((u) => (u.username.toLowerCase() === target.toLowerCase() ? { ...u, password: newPass } : u))
        );
        loadAdminData();
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

        {/* Stats Badges & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleDownloadAllBackup('json')}
            disabled={downloadingBackup}
            className="px-4 py-2 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 flex items-center gap-2 text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-95 disabled:opacity-50"
            title="Download full backup with all users with today's date (backup-YYYY-MM-DD.json)"
          >
            {downloadingBackup ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Download className="w-4 h-4 text-emerald-400" />
            )}
            <span>Download Backup</span>
          </button>

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

      {/* 0. Global Registration Moderation Control Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-white">Auto-Enable New Registrations</h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                autoEnable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {autoEnable ? 'Active (Instant)' : 'Inactive (Approval Required)'}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1 leading-relaxed max-w-xl">
              When active, new self-registered accounts are automatically approved for track playback. When inactive, new sign-ups default to pending approval until manually enabled by an administrator.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleAutoEnable}
          disabled={autoEnableLoading}
          className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer flex-shrink-0 ${
            autoEnable
              ? 'bg-emerald-500 text-black hover:brightness-110 active:scale-95'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
          }`}
        >
          {autoEnableLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span>{autoEnable ? 'Auto-Enable ON' : 'Turn Auto-Enable ON'}</span>
          )}
        </button>
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
              onClick={loadAdminData}
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
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                          u.enabled !== false
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {u.enabled !== false ? 'Enabled' : 'Pending Approval'}
                        </span>
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

                        <span>•</span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <KeyRound className="w-3 h-3 text-white/30" />
                          {u.password && u.password !== 'mouzika' ? (
                            <span className="flex items-center gap-1 font-mono text-[var(--accent)] font-semibold">
                              <span>Password:</span>
                              <span>{revealedPasswords[u.username] ? u.password : '••••••••'}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevealedPasswords((prev) => ({
                                    ...prev,
                                    [u.username]: !prev[u.username],
                                  }));
                                }}
                                className="p-0.5 hover:text-white transition-colors cursor-pointer ml-0.5"
                                title={revealedPasswords[u.username] ? 'Hide password' : 'Show password'}
                              >
                                {revealedPasswords[u.username] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                            </span>
                          ) : (
                            <span className="text-white/40 italic">
                              Password: Cloud Protected
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    {/* Enable / Disable Status Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleUserEnabled(u.username, u.enabled !== false)}
                      disabled={isBeingUpdated}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        u.enabled !== false
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                      } disabled:opacity-40`}
                      title={u.enabled !== false ? 'Click to disable account' : 'Click to enable account for playback'}
                    >
                      {isBeingUpdated ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : u.enabled !== false ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Enabled</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Approve & Enable</span>
                        </>
                      )}
                    </button>

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

                    {/* Toggle Settings Lock Button */}
                    {(() => {
                      const isUserUnlocked = Boolean(unlockedUsersList.some((un) => un.username.toLowerCase() === u.username.toLowerCase()));
                      return (
                        <button
                          type="button"
                          onClick={() => handleToggleUserLock(u.username, isUserUnlocked)}
                          disabled={togglingLockUser === u.username}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isUserUnlocked
                              ? 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30'
                              : 'bg-white/5 hover:bg-purple-500/20 text-white/60 hover:text-purple-300 border border-white/10'
                          } disabled:opacity-40`}
                          title={isUserUnlocked ? 'Click to Lock Customization Settings' : 'Click to Unlock Customization Settings'}
                        >
                          {togglingLockUser === u.username ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isUserUnlocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Settings Unlocked</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Settings Locked</span>
                            </>
                          )}
                        </button>
                      );
                    })()}

                    {/* Export Individual User Backup */}
                    <button
                      type="button"
                      onClick={() => handleDownloadUserBackup(u, 'json')}
                      className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 transition-colors cursor-pointer"
                      title={`Download backup file for ${u.username}`}
                    >
                      <Download className="w-4 h-4" />
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

      {/* 3. Social Follow & Verified Followers Manager */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 flex flex-col gap-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-lg text-white flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>Social Follow & Verified Followers Manager</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Manage followers list for Instagram (@mouziketna) and TikTok (@mouziketna.app), and inspect unlocked accounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSyncFollowers(selectedFollowerPlatform)}
              disabled={syncingFollowers}
              className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingFollowers ? 'animate-spin' : ''}`} />
              <span>Sync {selectedFollowerPlatform === 'tiktok' ? 'TikTok' : 'Instagram'}</span>
            </button>
          </div>
        </div>

        {/* Platform Selection Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedFollowerPlatform('instagram')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
              selectedFollowerPlatform === 'instagram'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-950/40'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <Instagram className="w-4 h-4 text-pink-300" />
            <span>Instagram (@mouziketna)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
              {verifiedFollowers?.instagram?.followers?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFollowerPlatform('tiktok')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
              selectedFollowerPlatform === 'tiktok'
                ? 'bg-black text-white border border-white/30 shadow-lg'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span>TikTok (@mouziketna.app)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
              {verifiedFollowers?.tiktok?.followers?.length || 0}
            </span>
          </button>
        </div>

        {/* Add Follower Form */}
        <form onSubmit={handleAddFollowers} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder={`Add handle(s) to ${selectedFollowerPlatform === 'tiktok' ? 'TikTok' : 'Instagram'} (e.g. username1, username2)...`}
            value={newFollowerInput}
            onChange={(e) => setNewFollowerInput(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400 transition-colors"
          />
          <button
            type="submit"
            disabled={addingFollowers || !newFollowerInput.trim()}
            className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md shrink-0"
          >
            {addingFollowers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span>Add to Verified</span>
          </button>
        </form>

        {/* Followers List Display */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-white/60">
            <span>Verified Follower Handles ({verifiedFollowers?.[selectedFollowerPlatform]?.followers?.length || 0}):</span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-black/40 border border-white/5 scrollbar-thin">
            {(verifiedFollowers?.[selectedFollowerPlatform]?.followers || []).map((f) => (
              <span
                key={f}
                className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/90 flex items-center gap-1.5 group"
              >
                <span>@{f}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFollower(selectedFollowerPlatform, f)}
                  className="text-white/30 hover:text-red-400 transition-colors cursor-pointer ml-0.5"
                  title="Remove from verified list"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(!verifiedFollowers?.[selectedFollowerPlatform]?.followers || verifiedFollowers[selectedFollowerPlatform].followers.length === 0) && (
              <span className="text-xs text-white/40 italic">No verified followers added yet. Add handles above or sync.</span>
            )}
          </div>
        </div>

        {/* Unlocked Accounts Summary */}
        <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
            <Unlock className="w-3.5 h-3.5 text-purple-400" />
            <span>Currently Unlocked User Accounts ({unlockedUsersList.length})</span>
          </h4>

          {unlockedUsersList.length === 0 ? (
            <p className="text-xs text-white/40 italic">No users have unlocked their customization settings yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {unlockedUsersList.map((un) => (
                <div
                  key={un.username}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-purple-500/20 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">@{un.username}</div>
                    <div className="text-[10px] text-purple-300/70 truncate flex items-center gap-1">
                      <span>Via {un.unlockedPlatform || 'social'}:</span>
                      <strong className="text-white">@{un.unlockedSocialHandle || 'verified'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleUserLock(un.username, true)}
                    className="px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Lock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Admin Feedback Inbox (Reports & Suggestions) */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.03] glass-panel border border-white/10 flex flex-col gap-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-lg text-white flex items-center gap-2.5">
              <Mail className="w-5 h-5 text-[var(--accent)]" />
              <span>Feedback Inbox ({feedbackList.length})</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Incoming bug reports and feature suggestions submitted by users from Settings.
            </p>
          </div>

          {feedbackList.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllFeedback}
              disabled={clearingAllFeedback}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              {clearingAllFeedback ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Clear All Messages</span>
            </button>
          )}
        </div>

        {feedbackList.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5">
            <Mail className="w-8 h-8 mx-auto text-white/20 mb-2" />
            <p className="text-sm font-bold text-white/70">Inbox is empty</p>
            <p className="text-xs text-white/40 mt-1">
              No reports or suggestions have been submitted yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {feedbackList.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2 relative group hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                        item.category === 'Report Problem'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {item.category === 'Report Problem' ? '🚨 Report Problem' : '💡 Suggestion'}
                    </span>
                    <span className="text-xs font-extrabold text-white">@{item.username}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white/40">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteFeedback(item.id)}
                      disabled={deletingFeedbackId === item.id}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                      title="Delete message"
                    >
                      {deletingFeedbackId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-white/80 leading-relaxed font-medium whitespace-pre-wrap">
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DOWNLOAD ALL USERS BACKUP CARD */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/[0.08] to-teal-500/[0.04] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-lg shadow-emerald-950/30">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>Download Full Website Backup</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {new Date().toISOString().split('T')[0]}
              </span>
            </h4>
            <p className="text-xs text-white/60 mt-0.5 max-w-xl">
              Export and download a complete backup of all users on your website, including true passwords, custom playlists, liked tracks, listening time, and statistics with today's date.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleDownloadAllBackup('json')}
            disabled={downloadingBackup}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-95 disabled:opacity-50"
            title={`Download backup-${new Date().toISOString().split('T')[0]}.json`}
          >
            {downloadingBackup ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <Download className="w-4 h-4 text-black" />
            )}
            <span>Download Backup (.JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadAllBackup('txt')}
            disabled={downloadingBackup}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/80 hover:text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title={`Download backup-${new Date().toISOString().split('T')[0]}.txt`}
          >
            <FileText className="w-3.5 h-3.5 text-white/60" />
            <span>.TXT</span>
          </button>
        </div>
      </div>

      {/* RESTORE CLOUDFLARE BACKUP FILE CARD */}
      <div className="p-6 rounded-3xl bg-emerald-500/[0.03] border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>Restore User Backup to Cloudflare</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                TXT / JSON Backup
              </span>
            </h4>
            <p className="text-xs text-white/50 mt-0.5">
              Select or drop a downloaded backup TXT/JSON file (like <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded font-mono">user_doudou.txt</code>) to push their playlists, liked songs, and account data back to Cloudflare.
            </p>
          </div>
        </div>

        <label className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shadow-lg shadow-emerald-950/20 active:scale-95">
          {restoringBackup ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Pushing to Cloudflare...</span>
            </>
          ) : (
            <>
              <FileUp className="w-4 h-4 text-emerald-400" />
              <span>Upload Backup TXT / JSON</span>
            </>
          )}
          <input
            type="file"
            accept=".txt,.json"
            onChange={handleRestoreBackupFile}
            disabled={restoringBackup}
            className="hidden"
          />
        </label>
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
