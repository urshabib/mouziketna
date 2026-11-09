const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 1. BACKEND ROUTE: The CORS Proxy for Downloading
// Parameters expected: ?url=<decrypted_audio_url>&title=<song_title>&artist=<artist_name>
// Returns: An audio/mp4 file stream forcing a download attachment
app.get('/api/download', async (req, res) => {
    const { url, title, artist } = req.query;

    if (!url) {
        return res.status(400).send("Missing audio URL.");
    }

    try {
        // The server fetches the file, bypassing browser CORS restrictions entirely
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        if (!response.ok) throw new Error("Failed to fetch audio from CDN");

        // Format a clean filename, removing illegal characters
        const safeTitle = (title || "Unknown_Title").replace(/[^a-zA-Z0-9 \-\.]/g, '');
        const safeArtist = (artist || "Unknown_Artist").replace(/[^a-zA-Z0-9 \-\.]/g, '');
        const filename = `${safeTitle} - ${safeArtist}.m4a`;

        // Tell the browser this is a file to be downloaded, not displayed
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'audio/mp4');

        // Stream the data directly to the client
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error("Download proxy error:", error);
        res.status(500).send("Error downloading file.");
    }
});

// 2. FRONTEND ROUTE: Serve the HTML and Client-Side Logic
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Standalone Audio Fetcher</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
        <style>
            body { font-family: system-ui, sans-serif; background-color: #111; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background-color: #1a1a1a; padding: 2rem; border-radius: 12px; border: 1px solid #333; width: 100%; max-width: 400px; }
            h2 { margin-top: 0; color: #0ea5e9; }
            input { width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 8px; margin-bottom: 1rem; box-sizing: border-box; }
            button { width: 100%; padding: 12px; background: #0ea5e9; color: #111; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
            button:disabled { background: #555; cursor: not-allowed; }
            #status { margin-top: 1rem; font-size: 12px; color: #aaa; text-align: center; min-height: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🎵 Audio Fetcher</h2>
            <input type="text" id="songTitle" placeholder="Song Title (e.g. Ghetto Roses)" autocomplete="off">
            <input type="text" id="songArtist" placeholder="Artist Name (e.g. A.L.A)" autocomplete="off">
            <button id="downloadBtn" onclick="startDownload()">Search & Download 320kbps</button>
            <div id="status">Ready.</div>
        </div>

        <script>
            const statusEl = document.getElementById('status');
            const btn = document.getElementById('downloadBtn');
            const updateStatus = (msg) => { statusEl.innerText = msg; console.log(msg); };

            async function startDownload() {
                const title = document.getElementById('songTitle').value.trim();
                const artist = document.getElementById('songArtist').value.trim();
                if (!title) return updateStatus("⚠️ Please enter a song title.");

                btn.disabled = true;
                updateStatus("Searching...");

                try {
                    // Fetch API & Find match
                    const searchRes = await fetch('https://rthmx.vercel.app/api/songs?q=' + encodeURIComponent(title));
                    const searchData = await searchRes.json();
                    
                    const normalize = (str) => str.toLowerCase().replace(/[^\\w]/gi, '');
                    const match = searchData.results?.find(s => 
                        normalize(s.title).includes(normalize(title)) && 
                        normalize(s.subtitle || "").includes(normalize(artist))
                    );

                    if (!match) throw new Error("Exact match not found.");
                    updateStatus("Match found. Decrypting URL...");

                    // Get token data & Decrypt
                    const songRes = await fetch('https://rthmx.vercel.app/api/song?token=' + match.token);
                    const songData = await songRes.json();
                    const encUrl = songData.more_info?.encrypted_media_url;

                    const key = CryptoJS.enc.Utf8.parse('38346591');
                    const decrypted = CryptoJS.DES.decrypt(
                        { ciphertext: CryptoJS.enc.Base64.parse(encUrl) }, key, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
                    );
                    
                    let mediaUrl = decrypted.toString(CryptoJS.enc.Utf8).replace(/_96\\.mp4|_160\\.mp4|_12\\.mp4|_48\\.mp4/g, '_320.mp4');

                    updateStatus("Redirecting to server proxy for download...");

                    // Redirect browser to our backend proxy route to bypass CORS
                    window.location.href = \`/api/download?url=\${encodeURIComponent(mediaUrl)}&title=\${encodeURIComponent(match.title)}&artist=\${encodeURIComponent(match.subtitle || artist)}\`;
                    
                    setTimeout(() => { updateStatus("Download initiated!"); btn.disabled = false; }, 2000);

                } catch (error) {
                    updateStatus("❌ Error: " + error.message);
                    btn.disabled = false;
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});