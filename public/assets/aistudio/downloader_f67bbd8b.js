const https = require('https');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION
// ==========================================
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=VgmeHYDayL8';
const DOWNLOAD_TYPE = 'audio'; // Set to 'audio' for MP3 or 'video' for MP4
const OUTPUT_DIR = './downloads'; // Directory where files will be saved

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Normalize URL to match the format that bypasses backend regex issues
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            const videoId = urlObj.hostname.includes('youtu.be') 
                ? urlObj.pathname.slice(1) 
                : urlObj.searchParams.get('v');
            if (videoId) {
                return `http://youtube.com/watch?v=${videoId}`;
            }
        }
    } catch (e) {
        console.error('❌ Invalid URL provided.');
    }
    return url;
}

// Helper function to make HTTPS GET requests and return a Promise
function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            // If we expect a file stream (not JSON)
            if (options.isStream) {
                const filepath = path.join(OUTPUT_DIR, options.filename);
                const fileStream = fs.createWriteStream(filepath);
                
                res.pipe(fileStream);
                
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve({ success: true, filepath, statusCode: res.statusCode });
                });
                
                fileStream.on('error', (err) => {
                    reject(new Error(`File write error: ${err.message}`));
                });
                return;
            }

            // Otherwise, collect JSON/text data
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data); // Return raw string if not JSON
                    }
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Network error: ${error.message}`));
        });

        req.end();
    });
}

async function downloadFromCybrox(url, type = 'audio') {
    console.log(`\n🔍 Starting download process for: ${url}`);
    const cleanUrl = normalizeUrl(url);
    console.log(`📡 Normalized URL: ${cleanUrl}`);

    try {
        // 1. Fetch metadata and formats
        console.log('⏳ Fetching video metadata from cybrox.pro...');
        
        const metadata = await makeRequest({
            hostname: 'cybrox.pro',
            path: `/api/extract?url=${encodeURIComponent(cleanUrl)}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
                'Referer': 'https://cybrox.pro/',
                'Origin': 'https://cybrox.pro',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });

        if (!metadata.success || !metadata.formats || metadata.formats.length === 0) {
            throw new Error('Failed to extract formats or video not found. The server may have returned an error.');
        }

        console.log(`✅ Found: ${metadata.title}`);

        // 2. Select the best format based on preference
        let targetFormat;
        if (type === 'audio') {
            targetFormat = metadata.formats.find(f => f.ext === 'mp3') || 
                           metadata.formats.find(f => f.label.toLowerCase().includes('audio'));
        } else {
            targetFormat = metadata.formats.find(f => f.ext === 'mp4' && f.height >= 720) || 
                           metadata.formats.find(f => f.ext === 'mp4') ||
                           metadata.formats.find(f => f.label.toLowerCase().includes('video'));
        }

        if (!targetFormat) {
            throw new Error(`Could not find a suitable ${type} format.`);
 each
        }

        console.log(`⬇️ Selected format: ${targetFormat.label}`);

        // 3. Download the file
        console.log('⏳ Downloading file to server disk...');
        
        // Parse the relative download_url into a full URL to get hostname and path
        const fullDownloadUrl = new URL(targetFormat.download_url, 'https://cybrox.pro');
        
        // Clean up filename to be safe for the filesystem
        const safeTitle = (metadata.title || 'cybrox-download').replace(/[^\w\s.-]/gi, '').trim();
        const filename = `${safeTitle}.${targetFormat.ext}`;

        await makeRequest({
            hostname: fullDownloadUrl.hostname,
            path: fullDownloadUrl.pathname + fullDownloadUrl.search,
            method: 'GET',
            isStream: true,
            filename: filename,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
                'Referer': 'https://cybrox.pro/',
                'Origin': 'https://cybrox.pro',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });

        console.log(`🎉 Success! File saved to: ${path.resolve(path.join(OUTPUT_DIR, filename))}`);

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    }
}

// ==========================================
// EXECUTE
// ==========================================
downloadFromCybrox(YOUTUBE_URL, DOWNLOAD_TYPE);