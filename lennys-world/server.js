require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve character data
app.get('/api/characters', (req, res) => {
  const dataPath = path.join(__dirname, 'data', 'characters.json');
  if (!fs.existsSync(dataPath)) {
    return res.status(404).json({ error: 'Character data not found. Run: npm run build-data' });
  }
  res.sendFile(dataPath);
});

// Chat endpoint — proxies to Anthropic API with transcript context
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in .env' });
  }

  const { guestId, messages } = req.body;
  if (!guestId || !messages) {
    return res.status(400).json({ error: 'Missing guestId or messages' });
  }

  // Special case for Lenny
  const isLenny = guestId === 'lenny-rachitsky';

  // Load transcript for context
  let transcriptContent = '';
  let guestName = '';

  if (isLenny) {
    guestName = 'Lenny Rachitsky';
    // For Lenny, gather snippets from multiple transcripts
    const episodesDir = path.join(__dirname, '..', 'episodes');
    const dirs = fs.readdirSync(episodesDir).slice(0, 10);
    const snippets = [];
    for (const dir of dirs) {
      const tPath = path.join(episodesDir, dir, 'transcript.md');
      if (fs.existsSync(tPath)) {
        const content = fs.readFileSync(tPath, 'utf-8');
        // Get just Lenny's speaking parts (first few)
        const lennyLines = content.split('\n')
          .filter(l => l.startsWith('Lenny'))
          .slice(0, 3)
          .map(l => l.replace(/^Lenny.*?\):\s*/, ''));
        snippets.push(...lennyLines);
      }
    }
    transcriptContent = snippets.join('\n\n');
  } else {
    const transcriptPath = path.join(__dirname, '..', 'episodes', guestId, 'transcript.md');
    if (!fs.existsSync(transcriptPath)) {
      return res.status(404).json({ error: `Transcript not found for ${guestId}` });
    }
    const fullContent = fs.readFileSync(transcriptPath, 'utf-8');

    // Parse guest name from frontmatter
    const nameMatch = fullContent.match(/^guest:\s*(.+)$/m);
    guestName = nameMatch ? nameMatch[1].trim() : guestId;

    // Extract transcript body (skip frontmatter)
    const bodyStart = fullContent.indexOf('---', 4);
    transcriptContent = bodyStart > -1 ? fullContent.substring(bodyStart + 3) : fullContent;

    // Truncate to ~12000 chars to fit in context window while keeping cost reasonable
    if (transcriptContent.length > 12000) {
      // Keep first 8000 chars and last 4000 chars (captures intro and lightning round)
      transcriptContent = transcriptContent.substring(0, 8000) +
        '\n\n[...middle portion of conversation...]\n\n' +
        transcriptContent.substring(transcriptContent.length - 4000);
    }
  }

  const systemPrompt = isLenny
    ? `You are Lenny Rachitsky, host of Lenny's Podcast — one of the most popular podcasts in the product and business world. You interview top product leaders, founders, and operators.

You are standing in the lobby of "Lenny's World," a virtual space where visitors can meet you and all your podcast guests. Be warm, welcoming, and helpful. Guide visitors to different rooms based on their interests. You know your guests well and can recommend who to talk to.

Here are some of your typical speaking patterns from the podcast:
${transcriptContent}

Stay in character as Lenny. Be conversational, curious, and enthusiastic. Keep responses concise (2-3 sentences unless the visitor asks for more detail).`
    : `You are ${guestName}, and you appeared as a guest on Lenny's Podcast. You are now a character in "Lenny's World," a virtual space where visitors can walk up and talk to podcast guests.

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nLenny's World is running at http://localhost:${PORT}\n`);
});
