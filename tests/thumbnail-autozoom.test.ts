import test from 'node:test';
import assert from 'node:assert/strict';
import { isLetterboxedThumb } from '../src/services/useTrackThumb';
import { canonicalThumbUrl, upgradeThumbQuality, FALLBACK_ART } from '../src/services/api';

test('isLetterboxedThumb accurately detects YouTube 4:3 letterboxed thumbnails', () => {
  // YouTube video CDN thumbnails (which have 45px black letterbox strips on 480x360 hqdefault)
  assert.equal(isLetterboxedThumb('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'), true);
  assert.equal(isLetterboxedThumb('https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg'), true);
  assert.equal(isLetterboxedThumb('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'), true);
  assert.equal(isLetterboxedThumb('https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg'), true);
  assert.equal(isLetterboxedThumb('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'), true);

  // Square album art sources and 16:9 HD sources should NOT be flagged as letterboxed
  assert.equal(isLetterboxedThumb('https://lh3.googleusercontent.com/somehash=w800-h800-l90-rj'), false);
  assert.equal(isLetterboxedThumb('https://c.saavncdn.com/123/500x500.jpg'), false);
  assert.equal(isLetterboxedThumb('https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/600x600bb.jpg'), false);
  assert.equal(isLetterboxedThumb('https://i.scdn.co/image/ab67616d0000b273abc'), false);
  assert.equal(isLetterboxedThumb('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'), false);
  assert.equal(isLetterboxedThumb('https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg'), false);
  assert.equal(isLetterboxedThumb('data:image/jpeg;base64,/9j/4AAQSkZJRg...'), false);
  assert.equal(isLetterboxedThumb(FALLBACK_ART), false);
  assert.equal(isLetterboxedThumb(null), false);
  assert.equal(isLetterboxedThumb(undefined), false);
});

test('canonicalThumbUrl produces stable valid YouTube CDN links for 11-char IDs', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(canonicalThumbUrl(id), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  assert.equal(canonicalThumbUrl('short'), FALLBACK_ART);
  assert.equal(canonicalThumbUrl(''), FALLBACK_ART);
});

test('upgradeThumbQuality enhances image URLs to high definition', () => {
  const ytmUrl = 'https://lh3.googleusercontent.com/abc=w120-h120-l90-rj';
  assert.equal(upgradeThumbQuality(ytmUrl), 'https://lh3.googleusercontent.com/abc=w1200-h1200-l90-rj');

  const saavnUrl = 'https://c.saavncdn.com/123/150x150.jpg';
  assert.equal(upgradeThumbQuality(saavnUrl), 'https://c.saavncdn.com/123/500x500.jpg');

  const ytThumb = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg';
  assert.equal(upgradeThumbQuality(ytThumb), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
});
