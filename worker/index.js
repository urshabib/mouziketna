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
        
        return new Response(JSON.stringify({ success: true, isAdmin: !!user.isAdmin, profile: user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Admin: Create User
      if (path === "api/create-user" && request.method === "POST") {
        const { username, password, isAdmin } = await request.json();
        const existing = await env.NEW_USER_STORE.get(`user:${username.toLowerCase()}`);
        if (existing) throw new Error("Username already exists.");

        const newUser = { username, password, isAdmin: !!isAdmin, likedSongs: [], customPlaylists: [], favouriteArtists: [], favouriteAlbums: [] };
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

      // 3. Save Profile
      if (path === "api/save-profile" && request.method === "POST") {
        const body = await request.json();
        if (!body.username) throw new Error("Missing username parameter");

        const existingStr = await env.NEW_USER_STORE.get(`user:${body.username.toLowerCase()}`);
        const existingUser = existingStr ? JSON.parse(existingStr) : {};

        const profileData = { 
            username: body.username, 
            password: existingUser.password || "",
            isAdmin: !!existingUser.isAdmin,
            likedSongs: body.likedSongs || [], 
            customPlaylists: body.customPlaylists || [],
            favouriteArtists: body.favouriteArtists || [],
            favouriteAlbums: body.favouriteAlbums || []
        };
        await env.NEW_USER_STORE.put(`user:${body.username.toLowerCase()}`, JSON.stringify(profileData));

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

        const ytRes = await fetchWithTimeout(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}&hl=en`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "CONSENT=YES+1; PREF=hl=en&gl=US"
          }
        }, 12000); // 12 seconds for full YT page resolution
        const html = await ytRes.text();
        const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});/s) || html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s);
        if (!match) {
          return new Response(JSON.stringify({ error: "Couldn't read this playlist — it may be private, region-locked, or YouTube changed its page format." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let data;
        try { data = JSON.parse(match[1]); }
        catch (e) {
          return new Response(JSON.stringify({ error: "This playlist's page came back in a format we couldn't parse." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

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
                artist: v.shortBylineText?.runs?.[0]?.text || "Unknown Artist",
                thumb: thumbs.length ? thumbs[thumbs.length - 1].url : null
              };
            })
            .filter(t => t.id);
        } catch (e) {}

        return new Response(JSON.stringify({ title, items }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        const duration = url.searchParams.get("duration");

        async function lrclibGet(params) {
          const qs = new URLSearchParams(params).toString();
          const r = await fetchWithTimeout(`https://lrclib.net/api/get?${qs}`, { headers: { "User-Agent": "MusicSpaceApp v1.0" } });
          return r.ok ? r.json() : null;
        }
        async function lrclibSearch(q) {
          const r = await fetchWithTimeout(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "MusicSpaceApp v1.0" } });
          if (!r.ok) return null;
          const arr = await r.json();
          return Array.isArray(arr) && arr.length ? arr[0] : null;
        }

        let result = null;
        if (duration) result = await lrclibGet({ track_name: title, artist_name: artist, duration }).catch(() => null);
        if (!result) result = await lrclibGet({ track_name: title, artist_name: artist }).catch(() => null);
        if (!result) result = await lrclibSearch(`${title} ${artist}`).catch(() => null);

        if (!result) {
          return new Response(JSON.stringify({ found: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          found: true,
          synced: result.syncedLyrics || null,
          plain: result.plainLyrics || null,
          instrumental: !!result.instrumental,
          source: "LRCLIB",
          sourceHref: "https://lrclib.net"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
    }
  }
};