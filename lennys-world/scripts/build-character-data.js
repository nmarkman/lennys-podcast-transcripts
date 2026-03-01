#!/usr/bin/env node

/**
 * build-character-data.js
 *
 * Processes all 303 Lenny's Podcast transcripts and generates characters.json
 * containing: room assignment, color scheme, accessories, and key quotes for each guest.
 */

const fs = require('fs');
const path = require('path');

const EPISODES_DIR = path.resolve(__dirname, '../../episodes');
const INDEX_DIR = path.resolve(__dirname, '../../index');
const OUTPUT_FILE = path.resolve(__dirname, '../data/characters.json');
const CATALOG_FILE = path.resolve(__dirname, '../data/guest-catalog.json');

// ── Room definitions ──────────────────────────────────────────────────────────
// Each room maps to a set of keyword topics from the index.
const ROOMS = {
  'The Product Lab': {
    id: 'product-lab',
    keywords: ['product-management', 'product-development', 'product-strategy', 'product-leadership',
      'product-market-fit', 'user-experience', 'design', 'experimentation', 'ab-testing',
      'analytics', 'data-analytics', 'customer-research', 'customer-experience', 'prioritization',
      'okrs', 'agile'],
    color: '#4A90D9',
    description: 'The craft of building great products'
  },
  'The Growth Floor': {
    id: 'growth-floor',
    keywords: ['growth-strategy', 'startup-growth', 'product-led-growth', 'marketing',
      'brand-building', 'branding', 'personal-branding', 'community-building',
      'network-effects', 'word-of-mouth', 'sales', 'enterprise-sales', 'marketplaces',
      'retention'],
    color: '#50C878',
    description: 'Scaling products and acquiring users'
  },
  'The Leadership Lounge': {
    id: 'leadership-lounge',
    keywords: ['leadership', 'management', 'hiring', 'recruiting', 'team-building',
      'organizational-design', 'company-culture', 'startup-culture', 'feedback',
      'communication', 'executive-coaching', 'executive-search'],
    color: '#E8A838',
    description: 'Managing people and organizations'
  },
  "The Founder's Garage": {
    id: 'founders-garage',
    keywords: ['entrepreneurship', 'venture-capital', 'founder-mode', 'bootstrapping',
      'business-strategy', 'innovation', 'creativity', 'strategy'],
    color: '#E85D3A',
    description: 'Starting and funding companies'
  },
  'The Career Cafe': {
    id: 'career-cafe',
    keywords: ['career-development', 'career-growth', 'personal-development',
      'personal-transformation', 'mentorship', 'decision-making', 'productivity',
      'time-management', 'focus', 'skill-building', 'work-life-balance',
      'mental-health', 'anxiety-management', 'stress-management', 'psychology',
      'neuroscience', 'storytelling', 'influence', 'power', 'networking'],
    color: '#9B59B6',
    description: 'Personal growth and career craft'
  },
  'The AI Arena': {
    id: 'ai-arena',
    keywords: ['ai', 'machine-learning', 'chatgpt', 'openai', 'engineering',
      'open-source', 'remote-work'],
    color: '#00CED1',
    description: 'Technology, AI, and the future'
  },
  'Tech Company Campus': {
    id: 'tech-campus',
    keywords: ['google', 'facebook', 'meta', 'microsoft', 'airbnb', 'uber',
      'slack', 'stripe', 'linkedin', 'media-relations'],
    color: '#FF6B9D',
    description: 'War stories from iconic tech companies'
  }
};

// ── Accessory mappings ────────────────────────────────────────────────────────
// Keywords/phrases found in lightning rounds → visual accessories
const ACCESSORY_PATTERNS = [
  { patterns: [/surf/i, /ocean/i, /waves?\b/i], accessory: 'surfboard', color: '#00BFFF' },
  { patterns: [/book/i, /read/i, /library/i], accessory: 'book', color: '#8B4513' },
  { patterns: [/coffee/i, /espresso/i, /caffeine/i], accessory: 'coffee', color: '#6F4E37' },
  { patterns: [/guitar/i, /music/i, /piano/i, /band\b/i, /drums?/i], accessory: 'guitar', color: '#CD853F' },
  { patterns: [/running/i, /marathon/i, /jog/i], accessory: 'sneakers', color: '#FF4500' },
  { patterns: [/cook/i, /chef/i, /baking/i, /kitchen/i], accessory: 'chef-hat', color: '#FFFFFF' },
  { patterns: [/dog/i, /puppy/i, /golden retriever/i], accessory: 'dog', color: '#DAA520' },
  { patterns: [/cat\b/i, /kitten/i], accessory: 'cat', color: '#808080' },
  { patterns: [/yoga/i, /meditat/i, /mindful/i], accessory: 'lotus', color: '#FF69B4' },
  { patterns: [/hik/i, /mountain/i, /climb/i, /trail/i], accessory: 'backpack', color: '#228B22' },
  { patterns: [/wine/i, /vineyard/i, /sommelier/i], accessory: 'wine', color: '#722F37' },
  { patterns: [/travel/i, /adventure/i, /explore/i], accessory: 'globe', color: '#4169E1' },
  { patterns: [/paint/i, /art\b/i, /sketch/i, /draw/i], accessory: 'paintbrush', color: '#FF6347' },
  { patterns: [/tennis/i, /basketball/i, /soccer/i, /football/i, /sport/i], accessory: 'ball', color: '#FFA500' },
  { patterns: [/garden/i, /plant/i, /flower/i], accessory: 'plant', color: '#32CD32' },
  { patterns: [/podcast/i, /audio/i, /listen/i], accessory: 'headphones', color: '#333333' },
  { patterns: [/bike/i, /cycling/i, /bicycle/i], accessory: 'bike', color: '#C0C0C0' },
  { patterns: [/movie/i, /film/i, /cinema/i, /tv show/i], accessory: 'clapperboard', color: '#2F4F4F' },
  { patterns: [/game/i, /gaming/i, /video game/i], accessory: 'controller', color: '#4B0082' },
  { patterns: [/kid/i, /children/i, /parent/i, /family/i, /daughter/i, /son\b/i], accessory: 'heart', color: '#FF1493' },
];

// ── Color generation ──────────────────────────────────────────────────────────
// Deterministic color from a string hash
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function generateCharacterColors(name) {
  const h = hashString(name);
  // Shirt colors - vibrant
  const shirtHues = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330];
  const shirtHue = shirtHues[h % shirtHues.length];
  const shirtSat = 50 + (h % 30);
  const shirtLight = 40 + (h % 20);

  // Skin tone range
  const skinTones = ['#FDDBB4', '#E8B88A', '#D4956A', '#C68642', '#8D5524', '#6B3A1F', '#F5D6B8', '#E0AC69'];
  const skin = skinTones[(h >> 4) % skinTones.length];

  // Hair colors
  const hairColors = ['#2C1810', '#4A3728', '#8B6F47', '#D4A76A', '#1A1A2E', '#3D1C02', '#8B0000', '#C0C0C0', '#FFD700', '#000000'];
  const hair = hairColors[(h >> 8) % hairColors.length];

  return {
    shirt: `hsl(${shirtHue}, ${shirtSat}%, ${shirtLight}%)`,
    skin,
    hair,
    pants: `hsl(${(shirtHue + 180) % 360}, 20%, ${25 + (h % 15)}%)`
  };
}

// ── Parse YAML frontmatter ────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result = {};

  // Simple YAML parser for our known fields
  const lines = yaml.split('\n');
  let currentKey = null;
  let inArray = false;
  let arrayValues = [];

  for (const line of lines) {
    // Array item
    if (inArray && line.match(/^- /)) {
      arrayValues.push(line.replace(/^- /, '').trim());
      continue;
    }
    // End of array
    if (inArray && !line.match(/^- /) && !line.match(/^\s*$/)) {
      result[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();

      if (value === '') {
        // Could be start of array or multiline
        inArray = true;
        arrayValues = [];
        continue;
      }

      // Remove quotes
      value = value.replace(/^['"]|['"]$/g, '');

      // Try to parse numbers
      if (/^\d+(\.\d+)?$/.test(value)) {
        value = parseFloat(value);
      }

      result[currentKey] = value;
    }
  }

  // Flush final array
  if (inArray) {
    result[currentKey] = arrayValues;
  }

  // Handle inline array format: [a, b, c]
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string' && result[key].startsWith('[') && result[key].endsWith(']')) {
      result[key] = result[key].slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
  }

  return result;
}

// ── Extract lightning round content ───────────────────────────────────────────
function extractLightningRound(content) {
  const idx = content.toLowerCase().indexOf('lightning round');
  if (idx === -1) return null;
  // Get ~3000 chars after the lightning round marker
  return content.substring(idx, idx + 3000);
}

// ── Extract key quotes ────────────────────────────────────────────────────────
function extractKeyQuotes(content, guestName) {
  // Skip frontmatter
  const bodyStart = content.indexOf('---', 4);
  const body = bodyStart > -1 ? content.substring(bodyStart + 3) : content;
  const lines = body.split('\n');
  const quotes = [];
  const firstName = guestName.split(' ')[0];

  for (let i = 0; i < lines.length && quotes.length < 8; i++) {
    const line = lines[i];
    // Look for guest speaking lines that are substantial
    if ((line.includes(guestName) || line.includes(firstName)) && line.includes('(')) {
      // Grab the text content (might span multiple lines)
      let text = line.replace(/^.*?\):\s*/, '');
      // Continue grabbing next lines if they don't start a new speaker
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        if (lines[j].match(/^[A-Z][\w\s]+ \(\d/)) break;
        if (lines[j].trim()) text += ' ' + lines[j].trim();
      }

      // Only keep substantial quotes (50-400 chars)
      if (text.length > 50 && text.length < 400 && !text.includes('[Omitted')) {
        quotes.push(text.trim());
      }
    }
  }

  // Return best 5 (spread evenly through the episode)
  if (quotes.length <= 5) return quotes;
  const step = Math.floor(quotes.length / 5);
  return [0, step, step * 2, step * 3, quotes.length - 1].map(i => quotes[i]);
}

// ── Detect accessories from lightning round ───────────────────────────────────
function detectAccessories(lightningText) {
  if (!lightningText) return [];
  const found = [];
  for (const { patterns, accessory, color } of ACCESSORY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(lightningText)) {
        found.push({ type: accessory, color });
        break;
      }
    }
  }
  // Limit to 2 accessories per character
  return found.slice(0, 2);
}

// ── Assign guest to a room ───────────────────────────────────────────────────
// Build a reverse index: topic keyword → room name
function buildTopicToRoomMap() {
  const map = {};
  for (const [roomName, room] of Object.entries(ROOMS)) {
    for (const kw of room.keywords) {
      map[kw] = roomName;
    }
  }
  return map;
}

// Read the index files to see which topics each guest appears in
function buildGuestTopicMap() {
  const guestTopics = {}; // guestDir → [topic, topic, ...]
  const indexFiles = fs.readdirSync(INDEX_DIR).filter(f => f.endsWith('.md') && f !== 'README.md');

  for (const file of indexFiles) {
    const topic = file.replace('.md', '');
    const content = fs.readFileSync(path.join(INDEX_DIR, file), 'utf-8');
    // Extract guest directory names from markdown links like [Name](../episodes/guest-dir/transcript.md)
    const linkRegex = /\[.*?\]\(\.\.\/episodes\/([\w-]+)\/transcript\.md\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const guestDir = match[1];
      if (!guestTopics[guestDir]) guestTopics[guestDir] = [];
      guestTopics[guestDir].push(topic);
    }
  }
  return guestTopics;
}

function assignRoom(guestDir, guestTopics, topicToRoom) {
  const topics = guestTopics[guestDir] || [];
  // Count how many topics fall into each room
  const roomScores = {};
  for (const topic of topics) {
    const room = topicToRoom[topic];
    if (room) {
      roomScores[room] = (roomScores[room] || 0) + 1;
    }
  }

  // Return room with highest score, default to Product Lab
  let bestRoom = 'The Product Lab';
  let bestScore = 0;
  for (const [room, score] of Object.entries(roomScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestRoom = room;
    }
  }
  return bestRoom;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('Building character data from transcripts...\n');

  const topicToRoom = buildTopicToRoomMap();
  const guestTopics = buildGuestTopicMap();

  const guestDirs = fs.readdirSync(EPISODES_DIR)
    .filter(d => fs.statSync(path.join(EPISODES_DIR, d)).isDirectory())
    .sort();

  console.log(`Found ${guestDirs.length} guest directories`);

  const characters = [];
  const roomCounts = {};

  for (const guestDir of guestDirs) {
    const transcriptPath = path.join(EPISODES_DIR, guestDir, 'transcript.md');
    if (!fs.existsSync(transcriptPath)) {
      console.warn(`  Skipping ${guestDir}: no transcript.md`);
      continue;
    }

    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter.guest) {
      console.warn(`  Skipping ${guestDir}: no guest field in frontmatter`);
      continue;
    }

    const room = assignRoom(guestDir, guestTopics, topicToRoom);
    const lightningRound = extractLightningRound(content);
    const accessories = detectAccessories(lightningRound);
    const quotes = extractKeyQuotes(content, frontmatter.guest);
    const colors = generateCharacterColors(frontmatter.guest);

    roomCounts[room] = (roomCounts[room] || 0) + 1;

    characters.push({
      id: guestDir,
      name: frontmatter.guest,
      title: frontmatter.title || '',
      episodeUrl: frontmatter.youtube_url || '',
      publishDate: frontmatter.publish_date || '',
      duration: frontmatter.duration || '',
      viewCount: frontmatter.view_count || 0,
      room,
      roomId: ROOMS[room].id,
      colors,
      accessories,
      quotes,
      keywords: frontmatter.keywords || [],
      hasLightningRound: !!lightningRound
    });

    process.stdout.write('.');
  }

  console.log('\n');

  // Add Lenny himself as a special character in the lobby
  characters.push({
    id: 'lenny-rachitsky',
    name: 'Lenny Rachitsky',
    title: "Host of Lenny's Podcast",
    episodeUrl: 'https://www.youtube.com/@LennysPodcast',
    publishDate: '',
    duration: '',
    viewCount: 0,
    room: 'lobby',
    roomId: 'lobby',
    colors: {
      shirt: 'hsl(210, 70%, 45%)',
      skin: '#FDDBB4',
      hair: '#4A3728',
      pants: 'hsl(220, 30%, 30%)'
    },
    accessories: [{ type: 'headphones', color: '#333333' }],
    quotes: [
      "Welcome to Lenny's Podcast! I help you build and grow your product.",
      "This is a place to learn from the best product people in the world.",
      "Walk into any room and talk to my guests. They have incredible stories to share.",
      "Each room is a different world of expertise. Explore and discover!",
      "The best product advice comes from people who've actually done it."
    ],
    keywords: [],
    isHost: true,
    hasLightningRound: false
  });

  // Build output
  const output = {
    generatedAt: new Date().toISOString(),
    totalCharacters: characters.length,
    rooms: Object.entries(ROOMS).map(([name, room]) => ({
      name,
      id: room.id,
      color: room.color,
      description: room.description,
      guestCount: roomCounts[name] || 0
    })),
    characters
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  // Generate guest catalog (compact index for Lenny's recommendation engine)
  const catalog = characters
    .filter(c => !c.isHost)
    .map(c => ({
      id: c.id,
      name: c.name,
      title: c.title,
      keywords: c.keywords
    }));
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
  console.log(`Guest catalog: ${CATALOG_FILE} (${catalog.length} guests, ${(JSON.stringify(catalog).length / 1024).toFixed(1)}KB)`);

  console.log('Room distribution:');
  for (const [room, count] of Object.entries(roomCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${room}: ${count} guests`);
  }
  console.log(`\nTotal: ${characters.length} characters (including Lenny)`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();
