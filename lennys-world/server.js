require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load guest catalog for Lenny's recommendation engine
let guestCatalog = [];
const catalogPath = path.join(__dirname, 'data', 'guest-catalog.json');
if (fs.existsSync(catalogPath)) {
  guestCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
}

// Load full character data for batch endpoint
let allCharacters = [];
const charsPath = path.join(__dirname, 'data', 'characters.json');
if (fs.existsSync(charsPath)) {
  const data = JSON.parse(fs.readFileSync(charsPath, 'utf-8'));
  allCharacters = data.characters || [];
}

// Serve character data (kept for backwards compat, but clients no longer load all at startup)
app.get('/api/characters', (req, res) => {
  const dataPath = path.join(__dirname, 'data', 'characters.json');
  if (!fs.existsSync(dataPath)) {
    return res.status(404).json({ error: 'Character data not found. Run: npm run build-data' });
  }
  res.sendFile(dataPath);
});

// Lenny host endpoint — recommendation engine
app.post('/api/chat/lenny', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in .env' });
  }

  const { messages, spawnedGuestIds } = req.body;
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  const spawnedSet = new Set(spawnedGuestIds || []);
  const availableGuests = guestCatalog.filter(g => !spawnedSet.has(g.id));

  // Build catalog string for system prompt (compact format)
  const catalogStr = availableGuests.map(g =>
    `${g.id}: ${g.name} — ${g.title} [${(g.keywords || []).join(', ')}]`
  ).join('\n');

  const systemPrompt = `You are Lenny Rachitsky, host of Lenny's Podcast — one of the most popular podcasts in the product and business world. You interview top product leaders, founders, and operators.

You are the host of "Lenny's World," a virtual podcast studio lounge. Visitors walk up to chat with you, and you help connect them with the right podcast guests based on their interests.

YOUR ROLE:
- Be warm, welcoming, and genuinely enthusiastic about connecting people with great ideas
- When visitors mention a topic or interest, recommend relevant podcast guests they should talk to
- You know all your guests well — their stories, expertise, and what makes their episodes special
- Keep your conversational responses concise (2-3 sentences)
- When recommending guests, briefly explain why each guest is relevant

AVAILABLE GUESTS (not yet in the lounge):
${catalogStr}

RESPONSE FORMAT — You MUST respond with valid JSON only, no other text:
{
  "message": "your conversational response here",
  "recommendations": [{"id": "guest-id", "reason": "one-line reason why this guest is relevant"}],
  "suggestedTopics": ["topic1", "topic2", "topic3"]
}

RULES:
- "recommendations" should contain 2-7 guests when the visitor mentions a topic or interest. Use an empty array when just greeting or chatting casually.
- "suggestedTopics" should be 3 clickable topic suggestions based on the conversation so far (e.g. "growth strategies", "hiring tips", "AI in product"). Always include these.
- Only recommend guests from the AVAILABLE GUESTS list above
- Use the guest's exact "id" field in recommendations
- If the visitor's interest doesn't match any available guests well, say so honestly and suggest adjacent topics`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    let rawText = response.content[0].text;

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) rawText = fenceMatch[1].trim();

    // Parse the structured JSON response
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // If Claude didn't return valid JSON, wrap the text
      parsed = { message: rawText, recommendations: [], suggestedTopics: [] };
    }

    res.json({
      message: parsed.message || rawText,
      recommendations: parsed.recommendations || [],
      suggestedTopics: parsed.suggestedTopics || [],
      guestName: 'Lenny Rachitsky'
    });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch character endpoint — load specific guests on demand
app.post('/api/characters/batch', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Missing ids array' });
  }

  const idSet = new Set(ids);
  const found = allCharacters.filter(c => idSet.has(c.id));
  res.json(found);
});

// Chat endpoint — proxies to Anthropic API with transcript context (regular guests only)
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in .env' });
  }

  const { guestId, messages } = req.body;
  if (!guestId || !messages) {
    return res.status(400).json({ error: 'Missing guestId or messages' });
  }

  // Load transcript for context
  const transcriptPath = path.join(__dirname, '..', 'episodes', guestId, 'transcript.md');
  if (!fs.existsSync(transcriptPath)) {
    return res.status(404).json({ error: `Transcript not found for ${guestId}` });
  }
  const fullContent = fs.readFileSync(transcriptPath, 'utf-8');

  // Parse guest name from frontmatter
  const nameMatch = fullContent.match(/^guest:\s*(.+)$/m);
  const guestName = nameMatch ? nameMatch[1].trim() : guestId;

  // Extract transcript body (skip frontmatter)
  const bodyStart = fullContent.indexOf('---', 4);
  let transcriptContent = bodyStart > -1 ? fullContent.substring(bodyStart + 3) : fullContent;

  // Truncate to ~12000 chars to fit in context window while keeping cost reasonable
  if (transcriptContent.length > 12000) {
    transcriptContent = transcriptContent.substring(0, 8000) +
      '\n\n[...middle portion of conversation...]\n\n' +
      transcriptContent.substring(transcriptContent.length - 4000);
  }

  const systemPrompt = `You are ${guestName}, and you appeared as a guest on Lenny's Podcast. You are now a character in "Lenny's World," a virtual space where visitors can walk up and talk to podcast guests.

Here is the transcript of your conversation on the podcast — use this as the foundation for your knowledge, opinions, and speaking style:

${transcriptContent}

IMPORTANT RULES:
- Stay in character as ${guestName} at all times
- Draw your answers from the topics, opinions, and stories in the transcript above
- Match the speaking style and tone from the transcript
- If asked about something not covered in the transcript, you can briefly acknowledge it but steer back to topics you discussed on the show
- Be conversational and engaging, not robotic
- Keep responses concise (2-4 sentences) unless the visitor asks for more detail
- You can reference things Lenny said or asked during the conversation`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    res.json({
      content: response.content[0].text,
      guestName
    });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve Lenny's character data (for initial spawn)
app.get('/api/characters/lenny', (req, res) => {
  const lenny = allCharacters.find(c => c.isHost);
  if (!lenny) {
    return res.status(404).json({ error: 'Lenny not found. Run: npm run build-data' });
  }
  res.json(lenny);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nLenny's World is running at http://localhost:${PORT}\n`);
});
