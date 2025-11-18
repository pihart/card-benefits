/**
 * Main Controller logic.
 * Coordinates Data (Store), Logic (Utils), and View (UIRenderer).
 */

class BenefitTrackerApp {
    constructor() {
        /** @type {StorageInterface} */
        this.storage = null;
        this.ui = new UIRenderer(this); // Pass controller to View
        this.cards = [];
        this.today = new Date();
        this.expiringDays = 30;
        this.pollInterval = 800;

        // Core References
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.cardListContainer = document.getElementById('card-list-container');
        this.expiringDaysSelect = document.getElementById('expiring-days-select');

        // Add Card Form Logic
        this.addCardFormContainer = document.querySelector('.card-form-container');
        this.addCardForm = document.getElementById('add-card-form');
        this.showAddCardBtn = document.getElementById('show-add-card-btn');
        this.newCardNameInput = document.getElementById('new-card-name');
        this.newCardAnniversaryInput = document.getElementById('new-card-anniversary');

        // Settings References
        this.s3UrlInput = document.getElementById('s3-url-input');
        this.pollIntervalInput = document.getElementById('poll-interval-input');
        this.currentStorageLabel = document.getElementById('current-storage-type');

        this.initListeners();
    }

    initListeners() {
        this.addCardForm.addEventListener('submit', this.handleAddCard.bind(this));
        this.expiringDaysSelect.addEventListener('change', (e) => {
            this.expiringDays = parseInt(e.target.value, 10);
            this.render(); // Re-render entire view
        });

        this.showAddCardBtn.addEventListener('click', () => {
            this.showAddCardBtn.style.display = 'none';
            this.addCardFormContainer.style.display = 'block';
        });

        // Modal & Settings Listeners
        document.getElementById('modal-ok').onclick = () => this.applyResets(this.pendingResets || []);
        document.getElementById('modal-cancel').onclick = () => {
            document.getElementById('reset-modal').style.display = 'none';
            this.render();
        };
        document.getElementById('settings-btn').onclick = () => {
            this.pollIntervalInput.value = this.pollInterval;
            document.getElementById('settings-modal').style.display = 'flex';
        };
        document.getElementById('settings-cancel').onclick = () => document.getElementById('settings-modal').style.display = 'none';
        document.getElementById('settings-save').onclick = this.handleConnectCloud.bind(this);
        document.getElementById('use-local-storage-btn').onclick = this.handleSwitchToLocal.bind(this);
    }

    async init() {
        this.today.setHours(0, 0, 0, 0);
        this.expiringDays = parseInt(this.expiringDaysSelect.value, 10);

        const storedInterval = localStorage.getItem('creditCardBenefitTracker_pollInterval');
        if (storedInterval) this.pollInterval = parseInt(storedInterval, 10);

        const cloudConfig = localStorage.getItem('creditCardBenefitTracker_config');
        if (cloudConfig) {
            this.storage = new CloudStore(cloudConfig);
            this.currentStorageLabel.textContent = 'Cloud Object Storage';
            this.s3UrlInput.value = cloudConfig;
        } else {
            this.storage = new LocalStorageStore();
            this.currentStorageLabel.textContent = 'Local Storage';
        }

        this.toggleLoading(true);
        try {
            this.cards = await this.storage.loadData();
        } catch (e) {
            console.error(e);
            alert("Error loading data.");
        } finally {
            this.toggleLoading(false);
        }

        this.initLiveSync();

        // Check for resets
        this.pendingResets = this.checkAndResetBenefits();
        if (this.pendingResets.length > 0) {
            this.showResetModal(this.pendingResets);
        } else {
            this.render();
        }
    }

    // --- Logic ---

    initLiveSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'creditCardBenefitTracker') this.checkForUpdates();
        });
        if (this.storage instanceof CloudStore) {
            setInterval(() => this.checkForUpdates(), this.pollInterval);
        }
    }

    async checkForUpdates() {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        try {
            const remoteData = await this.storage.loadData();
            if (JSON.stringify(this.cards) !== JSON.stringify(remoteData)) {
                this.cards = remoteData;
                this.render();
            }
        } catch (e) { /* Silent fail on poll */
        }
    }

    toggleLoading(isLoading) {
        this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    async saveState() {
        this.toggleLoading(true);
        try {
            await this.storage.saveData(this.cards);
        } catch (e) {
            alert(`Save failed: ${e.message}`);
        } finally {
            this.toggleLoading(false);
        }
    }

    checkAndResetBenefits() {
        const pending = [];
        this.cards.forEach(card => {
            card.benefits.forEach(benefit => {
                if (benefit.frequency === 'one-time') return;
                const next = DateUtils.calculateNextResetDate(benefit, card, this.today);
                if (next <= this.today) pending.push({cardName: card.name, benefit: benefit});
            });
        });
        return pending;
    }

    showResetModal(pending) {
        const list = document.getElementById('modal-reset-list');
        list.innerHTML = '';
        pending.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.cardName}:</strong> ${item.benefit.description}`;
            list.appendChild(li);
        });
        document.getElementById('reset-modal').style.display = 'flex';
    }

    async applyResets(pending) {
        pending.forEach(p => {
            p.benefit.usedAmount = 0;
            p.benefit.lastReset = this.today.toISOString();
        });
        await this.saveState();
        document.getElementById('reset-modal').style.display = 'none';
        this.render();
    }

    // --- Rendering Proxy ---
    render() {
        // Filter expiring items logic
        const allExpiring = [];
        const limitDate = new Date(this.today.getTime());
        limitDate.setDate(this.today.getDate() + this.expiringDays);

        this.cards.forEach(card => {
            card.benefits.forEach(benefit => {
                const rem = benefit.totalAmount - benefit.usedAmount;
                if (rem <= 0 || benefit.frequency === 'one-time') return;
                const next = DateUtils.calculateNextResetDate(benefit, card, this.today);
                if (next > this.today && next <= limitDate) {
                    allExpiring.push({
                        cardName: card.name,
                        benefit: benefit,
                        remainingAmount: rem,
                        nextResetDate: next
                    });
                }
            });
        });
        allExpiring.sort((a, b) => b.remainingAmount - a.remainingAmount);

        // Delegate to UI Renderer
        this.ui.renderExpiringSoon(allExpiring, this.expiringDays);

        this.cardListContainer.innerHTML = '';
        if (this.cards.length === 0) this.cardListContainer.innerHTML = '<p>No cards added yet.</p>';

        this.cards.forEach(card => {
            const allUsed = card.benefits.length > 0 && card.benefits.every(b => (b.totalAmount - b.usedAmount) <= 0);
            this.cardListContainer.appendChild(this.ui.createCardElement(card, allUsed));
        });
    }

    // --- Handlers ---

    handleAddCard(e) {
        e.preventDefault();
        const name = this.newCardNameInput.value.trim();
        const date = this.newCardAnniversaryInput.value;
        if (!name || !date) return;

        this.cards.push({
            id: `card-${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            anniversaryDate: date,
            benefits: []
        });
        this.saveState();
        this.render();
        this.newCardNameInput.value = '';
        this.newCardAnniversaryInput.value = '';
        this.addCardFormContainer.style.display = 'none';
        this.showAddCardBtn.style.display = 'block';
    }

    handleDeleteCard(id) {
        if (!confirm('Delete card?')) return;
        this.cards = this.cards.filter(c => c.id !== id);
        this.saveState();
        this.render();
    }

    handleAddBenefit(cardId, data) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            card.benefits.push({
                id: `benefit-${Math.random().toString(36).substr(2, 9)}`,
                ...data,
                usedAmount: 0,
                lastReset: this.today.toISOString()
            });
            this.saveState();
            this.render();
        }
    }

    handleUpdateBenefitUsage(bId, val) {
        for (const c of this.cards) {
            const b = c.benefits.find(ben => ben.id === bId);
            if (b) {
                if (isNaN(val) || val < 0) val = 0;
                if (val > b.totalAmount) val = b.totalAmount;
                b.usedAmount = val;
                this.saveState();
                this.render();
                return;
            }
        }
    }

    handleDeleteBenefit(bId) {
        if (!confirm('Delete benefit?')) return;
        for (const c of this.cards) {
            const idx = c.benefits.findIndex(ben => ben.id === bId);
            if (idx > -1) {
                c.benefits.splice(idx, 1);
                this.saveState();
                this.render();
                return;
            }
        }
    }

    handleUpdateCard(id, name, date) {
        const c = this.cards.find(card => card.id === id);
        if (c) {
            c.name = name;
            c.anniversaryDate = date;
            this.saveState();
        }
        this.render();
    }

    handleUpdateBenefit(bId, data) {
        for (const c of this.cards) {
            const b = c.benefits.find(ben => ben.id === bId);
            if (b) {
                Object.assign(b, data);
                if (b.usedAmount > b.totalAmount) b.usedAmount = b.totalAmount;
                this.saveState();
                this.render();
                return;
            }
        }
    }

    async handleConnectCloud() {
        const url = this.s3UrlInput.value.trim();
        const interval = parseInt(this.pollIntervalInput.value) || 800;
        if (!url) return;

        const tempStore = new CloudStore(url);
        this.settingsSaveBtn.textContent = 'Testing...';
        this.settingsSaveBtn.disabled = true;

        try {
            await tempStore.loadData();
            localStorage.setItem('creditCardBenefitTracker_config', url);
            localStorage.setItem('creditCardBenefitTracker_pollInterval', interval);
            location.reload();
        } catch (e) {
            alert(`Connection Failed: ${e.message}`);
        } finally {
            this.settingsSaveBtn.textContent = 'Save & Connect';
            this.settingsSaveBtn.disabled = false;
        }
    }

    handleSwitchToLocal() {
        if (confirm('Switch to Local Storage? Cloud URL will be cleared.')) {
            localStorage.removeItem('creditCardBenefitTracker_config');
            location.reload();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new BenefitTrackerApp();
    app.init();
});
