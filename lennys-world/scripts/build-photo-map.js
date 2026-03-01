#!/usr/bin/env node

/**
 * build-photo-map.js
 *
 * Fetches YouTube video thumbnails for all episodes and builds photo-map.json.
 * Uses YouTube Data API v3 (batches of 50 video IDs).
 * Also fetches Lenny's profile photo from his Substack.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY in .env');
  process.exit(1);
}

const CHARACTERS_FILE = path.resolve(__dirname, '../data/characters.json');
const OUTPUT_FILE = path.resolve(__dirname, '../public/data/photo-map.json');

async function fetchThumbnails(videoIds) {
  const results = {};
  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const ids = batch.map(v => v.videoId).join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`YouTube API error (batch ${i / 50 + 1}): ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(body.substring(0, 200));
      continue;
    }

    const data = await res.json();
    for (const item of data.items) {
      // Find the guest ID for this video
      const entry = batch.find(v => v.videoId === item.id);
      if (!entry) continue;

      // Pick best available thumbnail (maxres > high > medium > default)
      const thumbs = item.snippet.thumbnails;
      const thumbUrl = (thumbs.maxres || thumbs.high || thumbs.medium || thumbs.default)?.url;
      if (thumbUrl) {
        results[entry.guestId] = thumbUrl;
      }
    }

    process.stdout.write(`  Fetched batch ${Math.floor(i / 50) + 1}/${Math.ceil(videoIds.length / 50)}\n`);
  }
  return results;
}

async function main() {
  console.log('Building photo map from YouTube thumbnails...\n');

  // Load characters to get video IDs
  const data = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf-8'));
  const characters = data.characters;

  // Build list of {guestId, videoId} pairs
  const videoEntries = [];
  const episodesDir = path.resolve(__dirname, '../../episodes');

  for (const char of characters) {
    if (char.isHost) continue;

    // Read video_id from transcript frontmatter
    const transcriptPath = path.join(episodesDir, char.id, 'transcript.md');
    if (!fs.existsSync(transcriptPath)) continue;

    const content = fs.readFileSync(transcriptPath, 'utf-8').substring(0, 500);
    const match = content.match(/video_id:\s*(.+)/);
    if (match) {
      videoEntries.push({ guestId: char.id, videoId: match[1].trim() });
    }
  }

  console.log(`Found ${videoEntries.length} episodes with video IDs`);

  // Fetch thumbnails from YouTube API
  const photoMap = await fetchThumbnails(videoEntries);

  // Add Lenny's photo (from Substack profile)
  photoMap['lenny-rachitsky'] = 'https://substackcdn.com/image/fetch/w_256,h_256,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fafba5161-65bb-4d99-8d6b-cce660917fa1_1540x1540.png';

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(photoMap, null, 2));

  console.log(`\nPhoto map: ${Object.keys(photoMap).length} entries`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
