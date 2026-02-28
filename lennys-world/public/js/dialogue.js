export class DialogueSystem {
  constructor() {
    this.overlay = document.getElementById('dialogue-overlay');
    this.nameEl = document.getElementById('dialogue-name');
    this.titleEl = document.getElementById('dialogue-title');
    this.messagesEl = document.getElementById('dialogue-messages');
    this.inputEl = document.getElementById('dialogue-input');
    this.sendBtn = document.getElementById('dialogue-send');
    this.closeBtn = document.getElementById('dialogue-close');

    this.isOpen = false;
    this.currentGuest = null;
    this.conversationHistory = [];
    this.isSending = false;

    // Events
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
      // Stop game input propagation when typing
      e.stopPropagation();
    });
    this.inputEl.addEventListener('keyup', (e) => e.stopPropagation());
    this.closeBtn.addEventListener('click', () => this.close());

    // Global ESC to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.onOpen = null;
    this.onClose = null;
  }

  open(guestData) {
    this.currentGuest = guestData;
    this.conversationHistory = [];
    this.isOpen = true;

    // Set header
    this.nameEl.textContent = guestData.name;
    this.titleEl.textContent = guestData.title;

    // Clear messages
    this.messagesEl.innerHTML = '';

    // Show initial greeting from a random quote
    const greeting = guestData.quotes && guestData.quotes.length > 0
      ? guestData.quotes[Math.floor(Math.random() * guestData.quotes.length)]
      : `Hi! I'm ${guestData.name}. Ask me anything about my conversation on Lenny's Podcast.`;

    this.addMessage(greeting, 'npc');

    // System message
    const topicStr = guestData.keywords.slice(0, 5).join(', ');
    if (topicStr) {
      this.addMessage(`Topics: ${topicStr}`, 'system');
    }

    // Show overlay
    this.overlay.style.display = 'flex';

    // Focus input
    setTimeout(() => this.inputEl.focus(), 100);

    if (this.onOpen) this.onOpen();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    this.currentGuest = null;
    this.conversationHistory = [];
    if (this.onClose) this.onClose();
  }

  addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `msg ${type}`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msg;
  }

  async sendMessage() {
    if (this.isSending || !this.currentGuest) return;
    const text = this.inputEl.value.trim();
    if (!text) return;

    // Add player message
    this.addMessage(text, 'player');
    this.inputEl.value = '';

    // Track in conversation history
    this.conversationHistory.push({ role: 'user', content: text });

    // Show typing indicator
    this.isSending = true;
    this.sendBtn.disabled = true;
    const typingMsg = this.addMessage('', 'npc loading');
    typingMsg.innerHTML = '<span class="typing-dots">Thinking</span>';

    try {
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

      // Remove typing indicator
      typingMsg.remove();

      // Add NPC response
      this.addMessage(data.content, 'npc');

      // Track in history
      this.conversationHistory.push({ role: 'assistant', content: data.content });

    } catch (err) {
      typingMsg.remove();
      this.addMessage(`Error: ${err.message}`, 'system');
    }

    this.isSending = false;
    this.sendBtn.disabled = false;
    this.inputEl.focus();
  }
}
