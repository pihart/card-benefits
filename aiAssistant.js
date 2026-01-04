class AIAssistant {
    constructor(app) {
        this.app = app;
        this.session = null;
        this.modelReady = false;
        this.downloadTimer = null;

        this.container = document.getElementById('ai-assistant');
        if (!this.container) return;

        this.messagesEl = document.getElementById('ai-messages');
        this.inputEl = document.getElementById('ai-input');
        this.formEl = document.getElementById('ai-chat-form');
        this.intentEl = document.getElementById('ai-intent');
        this.summaryEl = document.getElementById('ai-summary');
        this.availabilityEl = document.getElementById('ai-availability');
        this.settingsStatusEl = document.getElementById('ai-settings-status');
        this.progressShellEl = document.getElementById('ai-download-progress');
        this.progressBarEl = document.getElementById('ai-download-bar');
        this.downloadNoteEl = document.getElementById('ai-download-note');
        this.refreshSummaryBtn = document.getElementById('ai-refresh-summary');

        this.attachListeners();
        this.refreshAvailability();
    }

    attachListeners() {
        if (this.formEl) {
            this.formEl.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }
        if (this.refreshSummaryBtn) {
            this.refreshSummaryBtn.addEventListener('click', () => this.refreshSummary(true));
        }
    }

    availabilitySupported() {
        return typeof window !== 'undefined' && window.ai && window.ai.languageModel;
    }

    setStatus(text) {
        if (this.availabilityEl) this.availabilityEl.textContent = text;
        if (this.settingsStatusEl) this.settingsStatusEl.textContent = text;
    }

    setProgress(percent) {
        if (this.progressShellEl) this.progressShellEl.style.display = 'block';
        if (this.progressBarEl) this.progressBarEl.style.width = `${percent}%`;
    }

    disableChat() {
        if (this.inputEl) this.inputEl.disabled = true;
        if (this.formEl) this.formEl.querySelector('button')?.setAttribute('disabled', 'disabled');
    }

    enableChat() {
        if (this.inputEl) this.inputEl.disabled = false;
        if (this.formEl) this.formEl.querySelector('button')?.removeAttribute('disabled');
    }

    async refreshAvailability() {
        if (!this.availabilitySupported()) {
            this.setStatus('AI model not supported in this browser');
            this.disableChat();
            this.refreshSummary();
            return;
        }
        try {
            const caps = await window.ai.languageModel.capabilities();
            if (caps.available === 'readily') {
                this.modelReady = true;
                this.setStatus('Model ready');
                await this.ensureSession();
                this.enableChat();
                this.refreshSummary();
            } else if (caps.available === 'after-download') {
                this.setStatus('Downloading model in background...');
                this.disableChat();
                this.startDownload();
            } else {
                this.setStatus('Model unavailable');
                this.disableChat();
                this.refreshSummary();
            }
        } catch (err) {
            this.setStatus(`AI check failed: ${err.message}`);
            this.disableChat();
            this.refreshSummary();
        }
    }

    baseSystemPrompt() {
        return [
            'You are an assistant for a credit card benefit tracker.',
            'Respect this JSON schema when proposing data updates:',
            JSON.stringify(globalThis.DATA_SCHEMA || {}),
            'Use concise answers and include card/benefit names as references.'
        ].join('\n');
    }

    async startDownload() {
        if (!this.availabilitySupported()) return;
        let progress = 5;
        this.setProgress(progress);
        this.downloadTimer = setInterval(() => {
            progress = Math.min(95, progress + 5);
            this.setProgress(progress);
        }, 600);
        try {
            this.session = await window.ai.languageModel.create({
                systemPrompt: this.baseSystemPrompt()
            });
            this.modelReady = true;
            this.enableChat();
            this.setProgress(100);
            this.setStatus('Model ready');
            this.refreshSummary();
        } catch (err) {
            this.setStatus(`AI download failed: ${err.message}`);
        } finally {
            if (this.downloadTimer) clearInterval(this.downloadTimer);
        }
    }

    async ensureSession() {
        if (this.session || !this.availabilitySupported()) return this.session;
        try {
            this.session = await window.ai.languageModel.create({
                systemPrompt: this.baseSystemPrompt()
            });
            this.modelReady = true;
            return this.session;
        } catch (err) {
            this.setStatus(`AI init failed: ${err.message}`);
            return null;
        }
    }

    appendMessage(role, text) {
        if (!this.messagesEl) return;
        const bubble = document.createElement('div');
        bubble.className = `ai-message ai-${role}`;
        bubble.textContent = text;
        this.messagesEl.appendChild(bubble);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    detectIntent(text) {
        const lowered = text.toLowerCase();
        const modifiers = ['mark', 'set', 'update', 'change', 'ignore', 'reset', 'remove', 'add'];
        return modifiers.some((word) => lowered.includes(word)) ? 'modification' : 'question';
    }

    buildContextSnapshot() {
        return this.app.cards.map((card) => ({
            cardId: card.id,
            cardName: card.name,
            benefits: (card.benefits || []).map((b) => ({
                id: b.id,
                description: b.description,
                remaining: Math.max(0, (b.totalAmount || 0) - (b.usedAmount || 0)),
                frequency: b.frequency,
                nextReset: b.getNextResetDate ? b.getNextResetDate(this.app.today) : null,
                ignored: !!b.ignored
            }))
        }));
    }

    buildFallbackSummary() {
        const snapshot = this.buildContextSnapshot();
        if (snapshot.length === 0) return 'No cards or benefits to summarize yet.';

        const priority = [];
        snapshot.forEach((card) => {
            (card.benefits || []).forEach((benefit) => {
                priority.push({
                    card: card.cardName,
                    benefit: benefit.description,
                    remaining: benefit.remaining,
                    nextReset: benefit.nextReset
                });
            });
        });
        priority.sort((a, b) => {
            if (a.nextReset && b.nextReset) return a.nextReset - b.nextReset;
            return b.remaining - a.remaining;
        });
        const top = priority.slice(0, 3).map((p) => {
            const resetLabel = p.nextReset ? `resets ${new Date(p.nextReset).toLocaleDateString()}` : 'no reset date';
            return `• ${p.benefit} on ${p.card} (${resetLabel}, $${p.remaining.toFixed(2)} remaining)`;
        });
        return ['Prioritize benefits expiring soon:', ...top].join('\n');
    }

    async refreshSummary(force = false) {
        if (!this.summaryEl) return;
        if (!this.modelReady && !force) {
            this.summaryEl.textContent = this.buildFallbackSummary();
            return;
        }

        const snapshot = JSON.stringify(this.buildContextSnapshot());
        const prompt = [
            'Provide a short summary (bullets) of how to prioritize benefits.',
            'Base it strictly on this data:',
            snapshot,
            'Keep it concise and actionable.'
        ].join('\n');

        const aiAnswer = await this.promptModel(prompt);
        this.summaryEl.textContent = aiAnswer || this.buildFallbackSummary();
    }

    async promptModel(prompt) {
        if (!this.modelReady) return null;
        await this.ensureSession();
        if (!this.session || !this.session.prompt) return null;
        try {
            return await this.session.prompt(prompt);
        } catch (err) {
            this.setStatus(`AI prompt failed: ${err.message}`);
            return null;
        }
    }

    cloneCards() {
        return this.app.cards.map((c) => Card.fromJSON(c.toJSON()));
    }

    performHeuristicUpdates(userText) {
        const lowered = userText.toLowerCase();
        const keywords = lowered.split(/[^a-z0-9]+/).filter((k) => k && k.length > 3);
        const matches = [];

        const shouldMatch = (text) => keywords.some((word) => text.includes(word));

        this.app.cards.forEach((card) => {
            card.benefits.forEach((benefit) => {
                const desc = (benefit.description || '').toLowerCase();
                if (!shouldMatch(desc)) return;

                if (lowered.includes('ignore')) {
                    benefit.ignored = true;
                    const until = new Date(this.app.today);
                    until.setMonth(until.getMonth() + 1);
                    until.setHours(0, 0, 0, 0);
                    benefit.ignoredEndDate = until.toISOString();
                    matches.push({ card: card.name, benefit: benefit.description, action: 'ignored until next month' });
                }

                if (lowered.includes('mark') || lowered.includes('use') || lowered.includes('set')) {
                    benefit.usedAmount = benefit.totalAmount;
                    matches.push({ card: card.name, benefit: benefit.description, action: 'marked as fully used' });
                }
            });
        });

        return matches;
    }

    async handleModification(userText) {
        const before = this.cloneCards();
        const matches = this.performHeuristicUpdates(userText);
        if (matches.length === 0) {
            return 'I could not find a matching benefit to modify. Please mention the card or benefit name.';
        }

        const validation = validateDataAgainstSchema(this.app.cards.map((c) => c.toJSON()));
        if (!validation.valid) {
            this.app.cards = before;
            this.app.render();
            return `Schema validation failed: ${validation.errors.join('; ')}`;
        }

        await this.app.saveState();
        this.app.render();
        this.refreshSummary();

        const reference = matches.map((m) => `${m.benefit} (${m.card}) - ${m.action}`).join('; ');
        const modelResponse = await this.promptModel(
            `We applied these updates: ${reference}. Confirm changes in plain language and restate the updated data as JSON that matches the schema when possible.`
        );
        return modelResponse || `Updated ${matches.length} item(s): ${reference}`;
    }

    async answerQuestion(userText) {
        const context = JSON.stringify(this.buildContextSnapshot());
        const modelResponse = await this.promptModel(
            `Answer the user's question about card benefits. Include card/benefit names as references.\nData: ${context}\nQuestion: ${userText}`
        );
        if (modelResponse) return modelResponse;
        return `Based on current data: ${this.buildFallbackSummary()}`;
    }

    async handleSubmit() {
        if (!this.inputEl) return;
        const userText = this.inputEl.value.trim();
        if (!userText) return;

        this.appendMessage('user', userText);
        this.inputEl.value = '';

        const intent = this.detectIntent(userText);
        if (this.intentEl) this.intentEl.textContent = `Intent: ${intent}`;

        let reply;
        if (intent === 'modification') {
            reply = await this.handleModification(userText);
        } else {
            reply = await this.answerQuestion(userText);
        }

        this.appendMessage('assistant', reply || 'No response available.');
    }
}

(function (global) {
    global.AIAssistant = AIAssistant;
})(typeof window !== 'undefined' ? window : globalThis);
