export class DialogueSystem {
  constructor() {
    this.overlay = document.getElementById('dialogue-overlay');
    this.nameEl = document.getElementById('dialogue-name');
    this.titleEl = document.getElementById('dialogue-title');
    this.messagesEl = document.getElementById('dialogue-messages');
    this.inputEl = document.getElementById('dialogue-input');
    this.sendBtn = document.getElementById('dialogue-send');
    this.closeBtn = document.getElementById('dialogue-close');
    this.topicSuggestionsEl = document.getElementById('topic-suggestions');
    this.avatarEl = document.getElementById('dialogue-avatar');
    this.headerEl = document.getElementById('dialogue-header');
    this.boxEl = document.getElementById('dialogue-box');

    this.isOpen = false;
    this.currentGuest = null;
    this.conversationHistory = [];
    this.isSending = false;
    this.spawnedGuestIds = []; // Tracked externally, set by main.js
    this.photoMap = {}; // Set by main.js

    // Callbacks
    this.onOpen = null;
    this.onClose = null;
    this.onGuestsRecommended = null;

    // Events
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
      e.stopPropagation();
    });
    this.inputEl.addEventListener('keyup', (e) => e.stopPropagation());
    this.closeBtn.addEventListener('click', () => this.close());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  get isLennyMode() {
    return this.currentGuest && this.currentGuest.isHost;
  }

  open(guestData) {
    this.currentGuest = guestData;
    this.conversationHistory = [];
    this.isOpen = true;

    // Set header
    this.nameEl.textContent = guestData.name;
    this.titleEl.textContent = guestData.title;

    // Set avatar photo
    const photoUrl = this.photoMap[guestData.id];
    if (photoUrl) {
      this.avatarEl.style.backgroundImage = `url(${photoUrl})`;
      this.avatarEl.style.display = 'block';
    } else {
      this.avatarEl.style.display = 'none';
    }

    // Set accent color from character's shirt color
    const accent = guestData.colors?.shirt || '#4A90D9';
    this.headerEl.style.borderBottom = `2px solid ${accent}`;
    this.boxEl.style.borderColor = accent + '66';
    this.nameEl.style.color = accent;

    // Clear messages
    this.messagesEl.innerHTML = '';

    // Show/hide topic suggestions based on mode
    this.topicSuggestionsEl.style.display = this.isLennyMode ? 'flex' : 'none';

    if (this.isLennyMode) {
      // Lenny greeting with topic suggestions
      this.addMessage(
        "Hey! Welcome to the studio. I've had some incredible conversations with product leaders, founders, and operators. What topics are you most interested in? I can introduce you to the right people.",
        'npc'
      );
      this.showTopicChips(['growth strategies', 'product-market fit', 'leadership & management']);
    } else {
      // Regular guest greeting
      const greeting = guestData.quotes && guestData.quotes.length > 0
        ? guestData.quotes[Math.floor(Math.random() * guestData.quotes.length)]
        : `Hi! I'm ${guestData.name}. Ask me anything about my conversation on Lenny's Podcast.`;
      this.addMessage(greeting, 'npc');

      const topicStr = (guestData.keywords || []).slice(0, 5).join(', ');
      if (topicStr) {
        this.addMessage(`Topics: ${topicStr}`, 'system');
      }
    }

    // Show overlay
    this.overlay.style.display = 'flex';
    setTimeout(() => this.inputEl.focus(), 100);
    if (this.onOpen) this.onOpen();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    if (this.onClose) this.onClose(); // Fire before nulling currentGuest
    this.currentGuest = null;
    this.conversationHistory = [];
    this.topicSuggestionsEl.style.display = 'none';
  }

  addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `msg ${type}`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msg;
  }

  showTopicChips(topics) {
    this.topicSuggestionsEl.innerHTML = '';
    for (const topic of topics) {
      const chip = document.createElement('button');
      chip.className = 'topic-chip';
      chip.textContent = topic;
      chip.addEventListener('click', () => {
        this.inputEl.value = topic;
        this.sendMessage();
      });
      this.topicSuggestionsEl.appendChild(chip);
    }
    this.topicSuggestionsEl.style.display = 'flex';
  }

  async sendMessage() {
    if (this.isSending || !this.currentGuest) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.addMessage(text, 'player');
    this.inputEl.value = '';
    this.conversationHistory.push({ role: 'user', content: text });

    this.isSending = true;
    this.sendBtn.disabled = true;
    const typingMsg = this.addMessage('', 'npc loading');
    typingMsg.innerHTML = '<span class="typing-dots">Thinking</span>';

    try {
      if (this.isLennyMode) {
        await this.sendLennyMessage(typingMsg);
      } else {
        await this.sendGuestMessage(typingMsg);
      }
    } catch (err) {
      typingMsg.remove();
      this.addMessage(`Error: ${err.message}`, 'system');
    }

    this.isSending = false;
    this.sendBtn.disabled = false;
    this.inputEl.focus();
  }

  async sendLennyMessage(typingMsg) {
    const response = await fetch('/api/chat/lenny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: this.conversationHistory,
        spawnedGuestIds: this.spawnedGuestIds
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'API request failed');
    }

    const data = await response.json();
    typingMsg.remove();

    // Show Lenny's conversational message
    this.addMessage(data.message, 'npc');
    this.conversationHistory.push({ role: 'assistant', content: data.message });

    // Handle recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      const names = data.recommendations.map(r => r.reason ? `${r.id} — ${r.reason}` : r.id);
      this.addMessage(`Guests arriving: ${data.recommendations.map(r => r.id.replace(/-/g, ' ')).join(', ')}...`, 'system');

      if (this.onGuestsRecommended) {
        this.onGuestsRecommended(data.recommendations);
      }
    }

    // Update topic chips
    if (data.suggestedTopics && data.suggestedTopics.length > 0) {
      this.showTopicChips(data.suggestedTopics);
    }
  }

  async sendGuestMessage(typingMsg) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: this.currentGuest.id,
        messages: this.conversationHistory
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'API request failed');
    }

    const data = await response.json();
    typingMsg.remove();
    this.addMessage(data.content, 'npc');
    this.conversationHistory.push({ role: 'assistant', content: data.content });
  }
}
