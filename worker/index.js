export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const path = url.pathname.replace(/^\//, '');

    // FIX: Enforce timeouts on all proxy requests to prevent socket exhaustion and server hanging
    const fetchWithTimeout = async (target, options = {}, ms = 8000) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ms);
      try {
        return await fetch(target, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      // 1. Authentication & Login
      if (path === "api/login" && request.method === "POST") {
        const { username, password } = await request.json();
        
        if (username === 'admin' && password === 'admin123') {
            return new Response(JSON.stringify({ success: true, isAdmin: true, username: 'admin' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const userStr = await env.NEW_USER_STORE.get(`user:${username.toLowerCase()}`);
        if (!userStr) return new Response(JSON.stringify({ error: "User not found." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
        const user = JSON.parse(userStr);
        if (user.password !== password) return new Response(JSON.stringify({ error: "Invalid password." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
        return new Response(JSON.stringify({ success: true, isAdmin: !!user.isAdmin, surprise: !!user.surprise, profile: user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Admin: Create User
      if (path === "api/create-user" && request.method === "POST") {
        const { username, password, isAdmin, surprise } = await request.json();
        const existing = await env.NEW_USER_STORE.get(`user:${username.toLowerCase()}`);
        if (existing) throw new Error("Username already exists.");

        const newUser = { username, password, isAdmin: !!isAdmin, surprise: !!surprise, likedSongs: [], customPlaylists: [], favouriteArtists: [], favouriteAlbums: [] };
        await env.NEW_USER_STORE.put(`user:${username.toLowerCase()}`, JSON.stringify(newUser));
        
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Admin: List all users (usernames + admin flag only — never returns passwords)
      if (path === "api/list-users" && request.method === "GET") {
        const listed = await env.NEW_USER_STORE.list({ prefix: "user:" });
        const users = await Promise.all(listed.keys.map(async (k) => {
          const raw = await env.NEW_USER_STORE.get(k.name);
          if (!raw) return null;
          try {
            const u = JSON.parse(raw);
            return {
              username: u.username,
              isAdmin: !!u.isAdmin,
              surprise: !!u.surprise,
              likedCount: (u.likedSongs || []).length,
              playlistCount: (u.customPlaylists || []).length
            };
          } catch (e) { return null; }
        }));
        return new Response(JSON.stringify({ users: users.filter(Boolean) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Admin: Toggle a user's admin flag
      if (path === "api/set-admin" && request.method === "POST") {
        const { username, isAdmin } = await request.json();
        if (!username) throw new Error("Missing username parameter");
        const key = `user:${username.toLowerCase()}`;
        const raw = await env.NEW_USER_STORE.get(key);
        if (!raw) throw new Error("User not found.");
        const user = JSON.parse(raw);
        user.isAdmin = !!isAdmin;
        await env.NEW_USER_STORE.put(key, JSON.stringify(user));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Admin: Toggle a user's one-time "surprise" welcome flag
      if (path === "api/set-surprise" && request.method === "POST") {
        const { username, surprise } = await request.json();
        if (!username) throw new Error("Missing username parameter");
        const key = `user:${username.toLowerCase()}`;
        const raw = await env.NEW_USER_STORE.get(key);
        if (!raw) throw new Error("User not found.");
        const user = JSON.parse(raw);
        user.surprise = !!surprise;
        await env.NEW_USER_STORE.put(key, JSON.stringify(user));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Clear a user's surprise flag after the animation has been shown once.
      // Called by the app itself (not the admin) right after playback, so the
      // surprise is a genuine one-time event until an admin re-enables it.
      if (path === "api/clear-surprise" && request.method === "POST") {
        const { username } = await request.json();
        if (!username) throw new Error("Missing username parameter");
        const key = `user:${username.toLowerCase()}`;
        const raw = await env.NEW_USER_STORE.get(key);
        if (raw) {
          const user = JSON.parse(raw);
          user.surprise = false;
          await env.NEW_USER_STORE.put(key, JSON.stringify(user));
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Admin: Delete a user account entirely.
      if (path === "api/delete-user" && request.method === "POST") {
        const { username } = await request.json();
        if (!username) throw new Error("Missing username parameter");
        await env.NEW_USER_STORE.delete(`user:${username.toLowerCase()}`);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 3. Save Profile
      // IMPORTANT: this only ever writes the library fields the client owns
      // (liked songs, playlists, etc). Admin-controlled flags (isAdmin,
      // surprise) are re-read from storage at the moment of writing and
      // carried over untouched — so a surprise/admin toggle happening
      // concurrently with a client autosave can never be wiped out.
      if (path === "api/save-profile" && request.method === "POST") {
        const body = await request.json();
        if (!body.username) throw new Error("Missing username parameter");

        const key = `user:${body.username.toLowerCase()}`;
        const existingStr = await env.NEW_USER_STORE.get(key);
        const existingUser = existingStr ? JSON.parse(existingStr) : {};

        const profileData = { 
            username: body.username, 
            password: existingUser.password || "",
            isAdmin: !!existingUser.isAdmin,
            surprise: !!existingUser.surprise,
            likedSongs: body.likedSongs || [], 
            customPlaylists: body.customPlaylists || [],
            favouriteArtists: body.favouriteArtists || [],
            favouriteAlbums: body.favouriteAlbums || []
        };
        await env.NEW_USER_STORE.put(key, JSON.stringify(profileData));

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Proxy Endpoints
      if (path === "api/search-proxy" && request.method === "GET") {
        const query = url.searchParams.get("q");
        const filter = url.searchParams.get("f") || "song";
        const response = await fetchWithTimeout(`https://api.ytify.workers.dev/search?q=${encodeURIComponent(query)}&f=${filter}`);
        return new Response(await response.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "api/suggestions-proxy" && request.method === "GET") {
        const query = url.searchParams.get("q");
        const response = await fetchWithTimeout(`https://ytify.pp.ua/search-suggestions?q=${encodeURIComponent(query)}&music=false`);
        return new Response(await response.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "api/channel-proxy" && request.method === "GET") {
        const channelId = url.searchParams.get("id");
        const response = await fetchWithTimeout(`https://api.ytify.workers.dev/channel?id=${encodeURIComponent(channelId)}`);
        return new Response(await response.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "api/similar-proxy" && request.method === "GET") {
        const title = url.searchParams.get("title");
        const artist = url.searchParams.get("artist");
        const response = await fetchWithTimeout(`https://api.ytify.workers.dev/similar?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&limit=10`);
        return new Response(await response.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "api/playlist-import-proxy" && request.method === "GET") {
        const listId = url.searchParams.get("id");
        if (!listId) throw new Error("Missing playlist id parameter");

        // Radio / mix ids ("RD...") aren't real playlists and can't be fetched.
        if (/^RD/i.test(listId) && !/^RDCLAK/i.test(listId)) {
          return new Response(JSON.stringify({ error: "That's a radio/mix link, not a playlist. Open the actual playlist page and copy that link instead." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const jsonResp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const cleanArtist = (a) => (a || "Unknown Artist").replace(/\s*-\s*Topic$/i, "").trim();

        /* --- Strategy 1: official YouTube Data API v3 (most reliable) ---
           Enable it by adding a key:  npx wrangler secret put YT_API_KEY  */
        async function importViaDataApi() {
          if (!env.YT_API_KEY) return null;
          let title = null;
          try {
            const metaRes = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${encodeURIComponent(listId)}&key=${env.YT_API_KEY}`, {}, 7000);
            if (metaRes.ok) {
              const meta = await metaRes.json();
              title = meta?.items?.[0]?.snippet?.title || null;
            }
          } catch (e) {}

          const items = [];
          let pageToken = "";
          for (let page = 0; page < 6; page++) { // up to 300 tracks
            const qs = `part=snippet&maxResults=50&playlistId=${encodeURIComponent(listId)}${pageToken ? `&pageToken=${pageToken}` : ""}&key=${env.YT_API_KEY}`;
            const r = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/playlistItems?${qs}`, {}, 8000);
            if (!r.ok) {
              // 404 = not found/private for the API; let the InnerTube fallback try.
              if (page === 0) return null;
              break;
            }
            const data = await r.json();
            (data.items || []).forEach(it => {
              const s = it.snippet;
              const vid = s?.resourceId?.videoId;
              if (!vid || s.title === "Private video" || s.title === "Deleted video") return;
              const th = s.thumbnails || {};
              const best = th.maxres || th.standard || th.high || th.medium || th.default;
              items.push({
                id: vid,
                title: s.title || "Unknown Title",
                artist: cleanArtist(s.videoOwnerChannelTitle || s.channelTitle),
                thumb: best ? best.url : null
              });
            });
            pageToken = data.nextPageToken;
            if (!pageToken) break;
          }
          if (!items.length) return null;
          return { title: title || "Imported playlist", items };
        }

        /* --- Strategy 2: InnerTube browse API (what YouTube's own web app calls).
           Far more stable than scraping the HTML page, supports continuations. --- */
        async function importViaInnerTube() {
          const ctx = { context: { client: { clientName: "WEB", clientVersion: "2.20260101.00.00", hl: "en", gl: "US" } } };
          const browse = (body) => fetchWithTimeout("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" },
            body: JSON.stringify({ ...ctx, ...body })
          }, 9000).then(r => r.ok ? r.json() : null);

          const data = await browse({ browseId: "VL" + listId });
          if (!data) return null;

          let title = data?.microformat?.microformatDataRenderer?.title
            || data?.header?.playlistHeaderRenderer?.title?.simpleText
            || data?.header?.pageHeaderRenderer?.pageTitle
            || "Imported playlist";

          // Find the playlistVideoListRenderer contents wherever they live.
          function findVideoList(node) {
            if (!node || typeof node !== "object") return null;
            if (node.playlistVideoListRenderer?.contents) return node.playlistVideoListRenderer.contents;
            for (const k of Object.keys(node)) {
              const found = findVideoList(node[k]);
              if (found) return found;
            }
            return null;
          }

          const items = [];
          const pushFrom = (contents) => {
            let continuation = null;
            (contents || []).forEach(c => {
              if (c.playlistVideoRenderer) {
                const v = c.playlistVideoRenderer;
                const thumbs = v.thumbnail?.thumbnails || [];
                items.push({
                  id: v.videoId,
                  title: v.title?.runs?.[0]?.text || v.title?.simpleText || "Unknown Title",
                  artist: cleanArtist(v.shortBylineText?.runs?.[0]?.text),
                  thumb: thumbs.length ? thumbs[thumbs.length - 1].url : null
                });
              } else if (c.continuationItemRenderer) {
                continuation = c.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
              }
            });
            return continuation;
          };

          let token = pushFrom(findVideoList(data));
          // Follow continuations for long playlists (cap ~400 tracks / 3 extra pages)
          for (let page = 0; token && page < 3 && items.length < 400; page++) {
            const next = await browse({ continuation: token });
            if (!next) break;
            const actions = next.onResponseReceivedActions || [];
            let contents = null;
            for (const a of actions) {
              if (a.appendContinuationItemsAction?.continuationItems) { contents = a.appendContinuationItemsAction.continuationItems; break; }
            }
            token = pushFrom(contents);
          }

          if (!items.length) return null;
          return { title, items: items.filter(t => t.id) };
        }

        /* --- Strategy 3: legacy HTML scrape (last resort) --- */
        async function importViaScrape() {
          const ytRes = await fetchWithTimeout(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}&hl=en`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
              "Cookie": "CONSENT=YES+1; PREF=hl=en&gl=US"
            }
          }, 12000);
          const html = await ytRes.text();
          const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});/s) || html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s);
          if (!match) return null;
          let data;
          try { data = JSON.parse(match[1]); } catch (e) { return null; }

          let title = "Imported playlist";
          try { title = data?.microformat?.microformatDataRenderer?.title || title; } catch (e) {}
          try {
            const headerTitle = data?.header?.playlistHeaderRenderer?.title?.simpleText;
            if (headerTitle) title = headerTitle;
          } catch (e) {}

          let items = [];
          try {
            const tabs = data.contents.twoColumnBrowseResultsRenderer.tabs;
            const contents = tabs[0].tabRenderer.content.sectionListRenderer.contents[0]
              .itemSectionRenderer.contents[0].playlistVideoListRenderer.contents;
            items = contents
              .filter(c => c.playlistVideoRenderer)
              .map(c => {
                const v = c.playlistVideoRenderer;
                const thumbs = v.thumbnail?.thumbnails || [];
                return {
                  id: v.videoId,
                  title: v.title?.runs?.[0]?.text || v.title?.simpleText || "Unknown Title",
                  artist: cleanArtist(v.shortBylineText?.runs?.[0]?.text),
                  thumb: thumbs.length ? thumbs[thumbs.length - 1].url : null
                };
              })
              .filter(t => t.id);
          } catch (e) {}
          if (!items.length) return null;
          return { title, items };
        }

        let result = null;
        try { result = await importViaDataApi(); } catch (e) {}
        if (!result) { try { result = await importViaInnerTube(); } catch (e) {} }
        if (!result) { try { result = await importViaScrape(); } catch (e) {} }

        if (!result) {
          return jsonResp({ error: "Couldn't read this playlist — make sure it's public (not unlisted-private) and that the link contains list=…" }, 502);
        }
        return jsonResp(result);
      }

      if (path === "api/resolve-video-proxy" && request.method === "GET") {
        const raw = url.searchParams.get("url") || url.searchParams.get("id") || "";
        const idMatch = raw.match(/(?:v=|\/watch\?v=|youtu\.be\/|\/shorts\/)([\w-]{11})/) || raw.match(/^([\w-]{11})$/);
        const videoId = idMatch ? idMatch[1] : null;
        if (!videoId) {
          return new Response(JSON.stringify({ error: "That doesn't look like a YouTube or YouTube Music song link." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const oembedRes = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + videoId)}&format=json`);
        if (!oembedRes.ok) {
          return new Response(JSON.stringify({ error: "That video couldn't be found — it may be private or removed." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const meta = await oembedRes.json();
        return new Response(JSON.stringify({
          id: videoId,
          title: meta.title || "Unknown Title",
          artist: (meta.author_name || "Unknown Artist").replace(/\s*-\s*Topic$/i, "").trim(),
          thumb: meta.thumbnail_url || `https://wsrv.nl?url=https://i.ytimg.com/vi_webp/${videoId}/mqdefault.webp`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === "api/lyrics-proxy" && request.method === "GET") {
        const title = url.searchParams.get("title") || "";
        const artist = (url.searchParams.get("artist") || "").replace(/\s*-\s*Topic$/i, "").trim();
        const artist2 = (url.searchParams.get("artist2") || "").replace(/\s*-\s*Topic$/i, "").trim(); // plain channel artist fallback
        const altTitle = url.searchParams.get("alt") || ""; // raw/uncleaned title fallback
        const album = url.searchParams.get("album") || "";
        const isrc = url.searchParams.get("isrc") || "";     // usually absent (YT has no ISRC)
        const duration = url.searchParams.get("duration");

        const jsonResp = (obj) => new Response(JSON.stringify(obj), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1" };

        const pad = (n, w) => String(n).padStart(w, "0");
        const secToTag = (sec) => {
          const total = Math.max(0, Number(sec) || 0);
          const m = Math.floor(total / 60), s = Math.floor(total % 60), cs = Math.floor((total % 1) * 100);
          return `[${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}]`;
        };
        const decodeEntities = (s) => (s || "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));

        const artistCandidates = [...new Set([artist, artist2].filter(Boolean))];
        if (!artistCandidates.length) artistCandidates.push("");

        // ---------- DURABLE CACHE (Cloudflare KV) ----------
        // Once ANY attempt finds lyrics for a song, store them so every later
        // play is instant and immune to upstream flakiness/rate-limits. Keyed on
        // title+artist only (NOT duration) so a differing YouTube runtime can't
        // cause a miss. Only successful results are cached; misses always retry
        // live. This is the core of "second time it works" now being "always".
        const norm = (s) => (s || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        const cacheKeys = artistCandidates.map(a => `lyrics:v2:${norm(title)}|${norm(a)}`.slice(0, 500));
        const kv = env.NEW_USER_STORE;
        if (kv) {
          for (const ck of cacheKeys) {
            try {
              const cached = await kv.get(ck);
              if (cached) {
                const obj = JSON.parse(cached);
                if (obj && (obj.synced || obj.plain)) return jsonResp({ found: true, ...obj });
              }
            } catch (e) { /* cache miss/parse error → fall through to live fetch */ }
          }
        }
        const cacheResult = (payload) => {
          if (!kv) return;
          const body = JSON.stringify(payload);
          try { ctx && ctx.waitUntil(kv.put(cacheKeys[0], body, { expirationTtl: 60 * 60 * 24 * 30 })); }
          catch (e) { /* never let caching break the response */ }
        };

        /* ---------- Provider: LRCLIB (lrclib.net) — same as monochrome ---------- */
        async function lrclibGet(t, a, withDuration) {
          const params = { track_name: t, artist_name: a };
          if (withDuration && duration) params.duration = duration;
          const qs = new URLSearchParams(params).toString();
          const r = await fetchWithTimeout(`https://lrclib.net/api/get?${qs}`, { headers: UA }, 4500);
          return r.ok ? r.json() : null;
        }
        async function lrclibSearchRaw(q) {
          const r = await fetchWithTimeout(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, { headers: UA }, 4500);
          if (!r.ok) return [];
          const arr = await r.json();
          return Array.isArray(arr) ? arr : [];
        }
        function pickBestSearchHit(pools, wantTitle) {
          const wantDur = duration ? Number(duration) : null;
          const wantArtists = artistCandidates.map(norm).filter(Boolean);
          const seen = new Set();
          let best = null, bestScore = -1;
          for (const pool of pools) {
            for (const cand of pool.slice(0, 12)) {
              const dedupeKey = cand.id || `${cand.trackName}|${cand.artistName}|${cand.duration}`;
              if (seen.has(dedupeKey)) continue;
              seen.add(dedupeKey);
              let score = 0;
              if (cand.syncedLyrics) score += 4; else if (cand.plainLyrics) score += 1;
              const candArtist = norm(cand.artistName);
              if (wantArtists.some(w => candArtist && (candArtist.includes(w) || w.includes(candArtist)))) score += 4;
              if (wantDur && cand.duration) {
                const diff = Math.abs(cand.duration - wantDur);
                if (diff <= 3) score += 3; else if (diff <= 10) score += 1; else score -= 2;
              }
              if (norm(cand.trackName) === norm(wantTitle)) score += 2;
              if (score > bestScore) { bestScore = score; best = cand; }
            }
          }
          return best;
        }

        /* ---------- Provider: KPoe / lyrics+ (line-synced). geeked.wtf is the
           only healthy mirror (prjktla=429, vercel=402). CRITICAL: a wrong
           YouTube runtime (e.g. a video padded to 260s for a 171s song) makes
           KPoe miss a song it actually has, so we try WITH and WITHOUT duration.
           That single fact is why the same song worked one time and not another. */
        const KPOE_SERVERS = [
          "https://lyrics.geeked.wtf",
          "https://lyricsplus.prjktla.workers.dev",
          "https://lyricsplus.prjktla.my.id"
        ];
        function kpoeToResult(data) {
          if (!data || !Array.isArray(data.lyrics) || !data.lyrics.length) return null;
          if (String(data.type).toLowerCase() === "plain") {
            return { plain: data.lyrics.map(l => l.text || "").join("\n"), synced: null };
          }
          const lrc = data.lyrics.map(l => `${secToTag((Number(l.time) || 0) / 1000)}${l.text || ""}`).join("\n");
          return { synced: lrc, plain: null };
        }
        async function kpoeOnce(base, t, a, withDur) {
          const params = new URLSearchParams({ title: t, artist: a });
          if (withDur && duration) params.append("duration", duration);
          if (album) params.append("album", album);
          if (isrc) params.append("isrc", isrc);
          const r = await fetchWithTimeout(`${base}/v2/lyrics/get?${params}`, { headers: UA, redirect: "follow" }, 4500);
          if (!r.ok) return null;
          return kpoeToResult(await r.json());
        }
        async function kpoeFetch(t, a) {
          // Primary (geeked.wtf): both duration variants IN PARALLEL so a wrong
          // duration can't hide the song and we never pay two round-trips.
          const variants = duration ? [true, false] : [false];
          const primary = (await Promise.all(variants.map(w => kpoeOnce(KPOE_SERVERS[0], t, a, w).catch(() => null)))).filter(Boolean);
          const pHit = primary.find(x => x.synced) || primary.find(x => x.plain);
          if (pHit) return pHit;
          // Backups (best-effort, no duration), in parallel.
          const backups = (await Promise.all(KPOE_SERVERS.slice(1).map(b => kpoeOnce(b, t, a, false).catch(() => null)))).filter(Boolean);
          return backups.find(x => x.synced) || backups.find(x => x.plain) || null;
        }

        /* ---------- Provider: binimum (Apple-Music word-synced TTML). ---------- */
        function ttmlTime(v) {
          if (v == null) return NaN;
          v = String(v).trim();
          if (/^\d+(\.\d+)?s?$/.test(v)) return parseFloat(v);
          const parts = v.split(":").map(parseFloat);
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          return NaN;
        }
        function ttmlToSynced(xml) {
          const out = [];
          const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
          let m;
          while ((m = pRe.exec(xml))) {
            const beginMatch = m[1].match(/\bbegin="([^"]+)"/);
            if (!beginMatch) continue;
            const t = ttmlTime(beginMatch[1]);
            if (!isFinite(t)) continue;
            const text = decodeEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
            out.push(`${secToTag(t)}${text}`);
          }
          return out.length ? out.join("\n") : null;
        }
        async function binimumFetch(t, a) {
          const tryUrl = async (u) => {
            const r = await fetchWithTimeout(u, { headers: UA }, 4500);
            if (!r.ok) return null;
            const data = await r.json().catch(() => null);
            const hit = data?.results?.[0];
            if (!hit?.lyricsUrl) return null;
            const tr = await fetchWithTimeout(hit.lyricsUrl, { headers: UA }, 4500);
            if (!tr.ok) return null;
            const synced = ttmlToSynced(await tr.text());
            return synced ? { synced, plain: null } : null;
          };
          try {
            if (isrc) {
              const byIsrc = await tryUrl(`https://lyrics-api.binimum.org/?isrc=${encodeURIComponent(isrc)}`);
              if (byIsrc) return byIsrc;
            }
            const p = new URLSearchParams({ track: t, artist: a });
            if (album) p.append("album", album);
            return await tryUrl(`https://lyrics-api.binimum.org/?${p}`);
          } catch (e) { return null; }
        }

        const respond = (result, source) => {
          const payload = {
            synced: result.syncedLyrics || result.synced || null,
            plain: result.plainLyrics || result.plain || null,
            instrumental: !!result.instrumental,
            source,
            sourceHref: source === "LRCLIB" ? "https://lrclib.net" : null
          };
          if (payload.synced || payload.plain) cacheResult(payload); // persist positive results
          return jsonResp({ found: true, ...payload });
        };
        const bestOf = (cands) => {
          const synced = cands.find(c => c && (c.syncedLyrics || c.synced));
          if (synced) return synced;
          const plain = cands.find(c => c && (c.plainLyrics || c.plain));
          if (plain) return plain;
          return cands.find(c => c && c.instrumental) || null;
        };

        // ROUND 1 (all in parallel): LRCLIB exact GET (every artist ±duration)
        // AND KPoe (every artist, both duration variants). These are the two
        // fast, high-hit providers; running them together — not in sequence —
        // is what takes the response from ~15s down to a couple of seconds.
        const getJobs = [];
        for (const a of artistCandidates) { getJobs.push(lrclibGet(title, a, true)); getJobs.push(lrclibGet(title, a, false)); }
        const [lrGetResults, kpoeResults] = await Promise.all([
          Promise.all(getJobs.map(p => p.catch(() => null))),
          Promise.all(artistCandidates.map(a => kpoeFetch(title, a).catch(() => null)))
        ]);
        const lr = bestOf(lrGetResults.filter(Boolean));
        const kpoeBest = bestOf(kpoeResults.filter(Boolean));

        if (lr && lr.syncedLyrics) return respond(lr, "LRCLIB");
        if (kpoeBest && kpoeBest.synced) return respond(kpoeBest, "Lyrics+");

        // ROUND 2 (only if no synced yet): the slower fallbacks, in parallel.
        const searchQueries = [...new Set(artistCandidates.map(a => `${title} ${a}`.trim()))];
        const round2 = await Promise.all([
          binimumFetch(title, artistCandidates[0]).catch(() => null),
          Promise.all(searchQueries.map(q => lrclibSearchRaw(q).catch(() => [])))
        ]);
        const binimum = round2[0];
        const searched = pickBestSearchHit(round2[1] || [], title);

        if (binimum && binimum.synced) return respond(binimum, "Apple");
        if (searched && searched.syncedLyrics) return respond(searched, "LRCLIB");

        // any plain text
        if (lr && lr.plainLyrics) return respond(lr, "LRCLIB");
        if (kpoeBest && kpoeBest.plain) return respond(kpoeBest, "Lyrics+");
        if (searched && (searched.plainLyrics || searched.instrumental)) return respond(searched, "LRCLIB");
        if (lr && lr.instrumental) return respond(lr, "LRCLIB");

        // ROUND 3 (last resort): raw/uncleaned title, every artist, in parallel.
        if (altTitle && altTitle !== title) {
          const altGetJobs = artistCandidates.map(a => lrclibGet(altTitle, a, false).catch(() => null));
          const altKpoeJobs = artistCandidates.map(a => kpoeFetch(altTitle, a).catch(() => null));
          const altSearchQueries = [...new Set(artistCandidates.map(a => `${altTitle} ${a}`.trim()))];
          const [altGetResults, altKpoeResults, altSearchPools] = await Promise.all([
            Promise.all(altGetJobs),
            Promise.all(altKpoeJobs),
            Promise.all(altSearchQueries.map(q => lrclibSearchRaw(q).catch(() => [])))
          ]);
          const altGet = bestOf(altGetResults.filter(Boolean));
          if (altGet && altGet.syncedLyrics) return respond(altGet, "LRCLIB");
          const altKpoe = bestOf(altKpoeResults.filter(Boolean));
          if (altKpoe && altKpoe.synced) return respond(altKpoe, "Lyrics+");
          const altSearched = pickBestSearchHit(altSearchPools, altTitle);
          if (altSearched && (altSearched.syncedLyrics || altSearched.plainLyrics || altSearched.instrumental)) return respond(altSearched, "LRCLIB");
          if (altGet && (altGet.plainLyrics || altGet.instrumental)) return respond(altGet, "LRCLIB");
          if (altKpoe && altKpoe.plain) return respond(altKpoe, "Lyrics+");
        }

        return jsonResp({ found: false });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
    }
  }
};
