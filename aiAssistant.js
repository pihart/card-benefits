class AIAssistant {
    constructor(app, schema = globalThis.DATA_SCHEMA) {
        this.app = app;
        this.schema = schema;
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
        this.refreshSummaryBtn = document.getElementById('ai-refresh-summary');

        this.attachListeners();
        this.refreshAvailability();
    }

    getModelApi() {
        if (typeof window === 'undefined') return null;
        return window.LanguageModel || null;
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
        return typeof window !== 'undefined' && typeof LanguageModel !== 'undefined' && typeof LanguageModel.create === 'function';
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
        this.setStatus('Preparing model...');
        this.disableChat();
        await this.startDownload();
    }

    baseSystemPrompt() {
        const schemaText = this.schema
            ? JSON.stringify(this.schema)
            : 'No JSON schema available; respond with concise text only.';
        return [
            'You are an assistant for a credit card benefit tracker.',
            'Respect this JSON schema when proposing data updates:',
            schemaText,
            'Use concise answers and include card/benefit names as references.'
        ].join('\n');
    }

    async startDownload() {
        if (!this.availabilitySupported()) return;
        if (this.progressShellEl) this.progressShellEl.classList.add('indeterminate');
        try {
            this.session = await LanguageModel.create({
                systemPrompt: this.baseSystemPrompt()
            });
            console.log('[AI][download] model ready');
            this.modelReady = true;
            this.enableChat();
            this.setProgress(100);
            if (this.progressShellEl) this.progressShellEl.classList.remove('indeterminate');
            this.setStatus('Model ready');
            this.refreshSummary();
        } catch (err) {
            this.session = null;
            this.modelReady = false;
            console.log('[AI][download] failed', err);
            this.setStatus(`AI unavailable: ${err.message}`);
            this.disableChat();
        } finally {
            if (this.downloadTimer) clearInterval(this.downloadTimer);
        }
    }

    async ensureSession() {
        if (this.session || !this.availabilitySupported()) return this.session;
        try {
            this.session = await LanguageModel.create({
                systemPrompt: this.baseSystemPrompt()
            });
            console.log('[AI][session] created');
            this.modelReady = true;
            return this.session;
        } catch (err) {
            this.setStatus(`AI init failed: ${err.message}`);
            console.log('[AI][session] create failed', err);
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

    async detectIntent(text) {
        if (this.modelReady && this.session && this.session.prompt) {
            try {
                const intentPrompt = [
                    'Classify the user request as either "modification" or "question".',
                    'Return only one word: modification or question.',
                    `User text: ${text}`
                ].join('\n');
                const aiIntent = await this.session.prompt(intentPrompt);
                const normalized = (aiIntent || '').toString().trim().toLowerCase();
                if (normalized.startsWith('modification')) return 'modification';
                if (normalized.startsWith('question')) return 'question';
            } catch (e) {
                console.log('[AI][intent] fallback to heuristic', e);
            }
        }
        const lowered = text.toLowerCase();
        const modifiers = ['mark', 'set', 'update', 'change', 'ignore', 'reset', 'remove', 'add'];
        const pattern = new RegExp(`\\b(${modifiers.join('|')})\\b`, 'i');
        return pattern.test(lowered) ? 'modification' : 'question';
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

    getNextMonthStartDate() {
        const date = new Date(this.app.today);
        date.setHours(0, 0, 0, 0);
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        return date;
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
            const result = await this.session.prompt(prompt);
            console.log('[AI][prompt]', { promptSnippet: prompt.slice(0, 200), responseSnippet: typeof result === 'string' ? result.slice(0, 200) : result });
            return result;
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
        const hasWord = (word) => new RegExp(`\\b${word}\\b`, 'i').test(lowered);

        const shouldMatch = (text) => keywords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(text));

        this.app.cards.forEach((card) => {
            card.benefits.forEach((benefit) => {
                const desc = (benefit.description || '').toLowerCase();
                if (!shouldMatch(desc)) return;

                if (hasWord('ignore')) {
                    benefit.ignored = true;
                    const until = this.getNextMonthStartDate();
                    benefit.ignoredEndDate = until.toISOString();
                    matches.push({ cardId: card.id, card: card.name, benefit: benefit.description, action: 'ignored until next month' });
                }

                else if (hasWord('mark') || hasWord('use') || hasWord('set')) {
                    benefit.usedAmount = benefit.totalAmount;
                    matches.push({ cardId: card.id, card: card.name, benefit: benefit.description, action: 'marked as fully used' });
                }
            });
        });

        return matches;
    }

    async handleModification(userText) {
        console.log('[AI][request][modification]', { text: userText });
        await this.ensureSession();
        if (!this.session) {
            return 'AI is unavailable to process the modification.';
        }

        const schemaText = this.schema ? JSON.stringify(this.schema) : '';
        const currentData = this.app.cards.map((c) => c.toJSON());
        const modifyPrompt = [
            'You are an assistant that edits credit card benefit data.',
            'Use the following JSON schema to shape the output:',
            schemaText,
            'Current data (JSON):',
            JSON.stringify(currentData),
            'User request:',
            userText,
            'Return ONLY the full updated data as JSON matching the schema. Do not include any extra text.'
        ].join('\n');

        const aiResult = await this.promptModel(modifyPrompt);
        let proposedData = null;
        try {
            proposedData = JSON.parse(aiResult);
        } catch (e) {
            // Attempt to extract JSON block if wrapped
            const match = aiResult && aiResult.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                try {
                    proposedData = JSON.parse(match[0]);
                } catch (_) {
                    proposedData = null;
                }
            }
        }

        if (!proposedData) {
            return 'AI did not return valid JSON. Please rephrase your request.';
        }

        const validation = validateDataAgainstSchema(proposedData);
        if (!validation.valid) {
            return `AI returned invalid data: ${validation.errors.join('; ')}`;
        }

        // Apply data
        this.app.cards = proposedData.map((c) => Card.fromJSON(c));
        await this.app.saveState();
        this.app.render();
        this.refreshSummary();

        // Verification step
        let verification = '';
        try {
            const verifyPrompt = [
                'Verify whether the updated data satisfies the user request.',
                'Respond with "yes" or "no" followed by a short reason.',
                'User request:',
                userText,
                'Updated data:',
                JSON.stringify(proposedData)
            ].join('\n');
            verification = await this.promptModel(verifyPrompt);
        } catch (e) {
            console.log('[AI][verify] failed', e);
        }

        return verification || 'Applied AI changes.';
    }

    async answerQuestion(userText) {
        console.log('[AI][request][question]', { text: userText });
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

        const intent = await this.detectIntent(userText);
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
