/**
 * Main application logic.
 */

class BenefitTrackerApp {
    constructor() {
        /** @type {StorageInterface} */
        this.storage = null;

        /** @type {Array<Object>} */
        this.cards = [];
        this.today = new Date();
        this.expiringDays = 30;
        this.pollInterval = 800; // Default poll interval

        // -- References --
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.cardListContainer = document.getElementById('card-list-container');
        this.addCardFormContainer = document.querySelector('.card-form-container');
        this.addCardForm = document.getElementById('add-card-form');
        this.newCardNameInput = document.getElementById('new-card-name');
        this.newCardAnniversaryInput = document.getElementById('new-card-anniversary');
        this.showAddCardBtn = document.getElementById('show-add-card-btn');

        // Reset Modal
        this.resetModal = document.getElementById('reset-modal');
        this.resetModalList = document.getElementById('modal-reset-list');
        this.resetModalOk = document.getElementById('modal-ok');
        this.resetModalCancel = document.getElementById('modal-cancel');

        // Settings Modal
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsSaveBtn = document.getElementById('settings-save');
        this.settingsCancelBtn = document.getElementById('settings-cancel');
        this.settingsLocalBtn = document.getElementById('use-local-storage-btn');
        this.s3UrlInput = document.getElementById('s3-url-input');
        this.pollIntervalInput = document.getElementById('poll-interval-input'); // NEW reference
        this.currentStorageLabel = document.getElementById('current-storage-type');

        // Expiring Soon
        this.expiringSoonContainer = document.getElementById('expiring-soon-container');
        this.expiringSoonList = document.getElementById('expiring-soon-list');
        this.expiringDaysSelect = document.getElementById('expiring-days-select');

        // -- Listeners --
        this.addCardForm.addEventListener('submit', this.handleAddCard.bind(this));
        this.expiringDaysSelect.addEventListener('change', this.handleExpiringDaysChange.bind(this));

        this.showAddCardBtn.addEventListener('click', () => {
            this.showAddCardBtn.style.display = 'none';
            this.addCardFormContainer.style.display = 'block';
        });

        // Settings Modal Listeners
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.settingsCancelBtn.addEventListener('click', () => this.settingsModal.style.display = 'none');
        this.settingsSaveBtn.addEventListener('click', this.handleConnectCloud.bind(this));
        this.settingsLocalBtn.addEventListener('click', this.handleSwitchToLocal.bind(this));
    }

    /**
     * Initializes the application.
     */
    async init() {
        this.today.setHours(0, 0, 0, 0);
        this.expiringDays = parseInt(this.expiringDaysSelect.value, 10);

        // Load Poll Interval Config
        const storedInterval = localStorage.getItem('creditCardBenefitTracker_pollInterval');
        if (storedInterval) {
            this.pollInterval = parseInt(storedInterval, 10);
        }

        // 1. Determine Storage Provider
        const cloudConfig = localStorage.getItem('creditCardBenefitTracker_config');
        if (cloudConfig) {
            this.storage = new CloudStore(cloudConfig);
            this.currentStorageLabel.textContent = 'Cloud Object Storage';
            this.s3UrlInput.value = cloudConfig;
        } else {
            this.storage = new LocalStorageStore();
            this.currentStorageLabel.textContent = 'Local Storage';
        }

        // 2. Load data with Loader
        this.toggleLoading(true);
        try {
            this.cards = await this.storage.loadData();
        } catch (e) {
            console.error("Init Load Error", e);
            alert("Failed to load data. Please check your settings or network connection.");
        } finally {
            this.toggleLoading(false);
        }

        // 3. Start Live Tracking
        this.initLiveSync();

        // 4. Check for resets
        const pendingResets = this.checkAndResetBenefits();

        // 5. Handle resets if any, else render
        if (pendingResets.length > 0) {
            this.showResetModal(pendingResets);
        } else {
            this.render();
        }
    }

    /**
     * Sets up live synchronization mechanisms.
     */
    initLiveSync() {
        // Mechanism 1: LocalStorage Event (Instant sync across tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'creditCardBenefitTracker') {
                console.log('Local change detected in another tab.');
                this.checkForUpdates();
            }
        });

        // Mechanism 2: Cloud Polling (Sync across devices)
        if (this.storage instanceof CloudStore) {
            console.log(`Starting cloud polling every ${this.pollInterval}ms`);
            setInterval(() => {
                this.checkForUpdates();
            }, this.pollInterval);
        }
    }

    /**
     * checks storage for updates and refreshes UI if data has changed.
     * Runs silently (no alerts on failure).
     */
    async checkForUpdates() {
        // Safety: Don't update if the user is currently typing in a field.
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            return;
        }

        try {
            const remoteData = await this.storage.loadData();

            if (JSON.stringify(this.cards) !== JSON.stringify(remoteData)) {
                console.log('New data detected, updating UI...');
                this.cards = remoteData;
                this.render();
            }
        } catch (e) {
            console.warn('Background sync failed:', e.message);
        }
    }

    /**
     * Toggles the visual loading indicator.
     * @param {boolean} isLoading
     */
    toggleLoading(isLoading) {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
        }
    }

    /**
     * Saves the current state to the storage layer with loading indicator.
     */
    async saveState() {
        this.toggleLoading(true);
        try {
            await this.storage.saveData(this.cards);
        } catch (e) {
            console.error("Save Error", e);
            alert(`Failed to save changes.\n${e.message}`);
        } finally {
            this.toggleLoading(false);
        }
    }

    // --- Settings / Storage Logic ---

    openSettings() {
        // Pre-fill current values
        this.pollIntervalInput.value = this.pollInterval;
        this.settingsModal.style.display = 'flex';
    }

    async handleConnectCloud() {
        const url = this.s3UrlInput.value.trim();
        // Default to 800 if empty or invalid
        const interval = parseInt(this.pollIntervalInput.value) || 800;

        if (!url) return;

        // Create a temporary store to test connection
        const tempStore = new CloudStore(url);

        // Change button to loading state
        const originalText = this.settingsSaveBtn.textContent;
        this.settingsSaveBtn.textContent = 'Testing Connection...';
        this.settingsSaveBtn.disabled = true;
        this.toggleLoading(true);

        try {
            // Try to fetch data.
            await tempStore.loadData();

            // If success: Save config and interval
            localStorage.setItem('creditCardBenefitTracker_config', url);
            localStorage.setItem('creditCardBenefitTracker_pollInterval', interval);

            alert(`Connection successful! Switching to Cloud storage (Poll: ${interval}ms).`);
            location.reload(); // Reload to re-init with new storage
        } catch (e) {
            alert(`Could not connect to that URL.\n${e.message}`);
        } finally {
            this.settingsSaveBtn.textContent = originalText;
            this.settingsSaveBtn.disabled = false;
            this.toggleLoading(false);
        }
    }

    handleSwitchToLocal() {
        if (confirm('Switch back to Local Storage? Your Cloud URL will be forgotten.')) {
            localStorage.removeItem('creditCardBenefitTracker_config');
            // Note: We usually keep the poll interval setting, or we could clear it too.
            // keeping it is harmless.
            location.reload();
        }
    }

    // --- Benefit Reset Logic ---

    checkAndResetBenefits() {
        const pendingResets = [];
        this.cards.forEach(card => {
            card.benefits.forEach(benefit => {
                if (benefit.frequency === 'one-time') return;
                const nextResetDate = this.calculateNextResetDate(benefit, card);
                if (nextResetDate <= this.today) {
                    pendingResets.push({cardName: card.name, benefit: benefit});
                }
            });
        });
        return pendingResets;
    }

    calculateNextResetDate(benefit, card) {
        const lastReset = new Date(benefit.lastReset);
        lastReset.setHours(0, 0, 0, 0);
        const anniversary = new Date(card.anniversaryDate);
        anniversary.setMinutes(anniversary.getMinutes() + anniversary.getTimezoneOffset());
        anniversary.setHours(0, 0, 0, 0);
        let nextReset = new Date(lastReset.getTime());

        if (benefit.resetType === 'calendar') {
            switch (benefit.frequency) {
                case 'monthly':
                    nextReset.setDate(1);
                    nextReset.setMonth(nextReset.getMonth() + 1);
                    break;
                case 'quarterly':
                    const currentQuarterMonth = Math.floor(lastReset.getMonth() / 3) * 3;
                    nextReset.setDate(1);
                    nextReset.setMonth(currentQuarterMonth + 3);
                    break;
                case 'biannual':
                    nextReset.setDate(1);
                    if (lastReset.getMonth() < 6) {
                        nextReset.setMonth(6);
                    } else {
                        nextReset.setMonth(0);
                        nextReset.setFullYear(nextReset.getFullYear() + 1);
                    }
                    break;
                case 'annual':
                    nextReset.setDate(1);
                    nextReset.setMonth(0);
                    nextReset.setFullYear(nextReset.getFullYear() + 1);
                    break;
                case 'every-4-years':
                    nextReset.setDate(1);
                    nextReset.setMonth(0);
                    nextReset.setFullYear(lastReset.getFullYear() + 4);
                    break;
            }
        } else {
            nextReset = new Date(lastReset.getFullYear(), lastReset.getMonth(), anniversary.getDate());
            switch (benefit.frequency) {
                case 'monthly':
                    if (nextReset <= lastReset) {
                        nextReset.setMonth(nextReset.getMonth() + 1);
                    }
                    break;
                case 'quarterly':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    while (nextReset <= lastReset) {
                        nextReset.setMonth(nextReset.getMonth() + 3);
                    }
                    break;
                case 'biannual':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    while (nextReset <= lastReset) {
                        nextReset.setMonth(nextReset.getMonth() + 6);
                    }
                    break;
                case 'annual':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    if (nextReset <= lastReset) {
                        nextReset.setFullYear(nextReset.getFullYear() + 1);
                    }
                    break;
                case 'every-4-years':
                    nextReset = new Date(lastReset.getFullYear() + 4, lastReset.getMonth(), lastReset.getDate());
                    break;
            }
        }
        while (nextReset <= this.today && nextReset <= lastReset) {
            const tempLastReset = new Date(nextReset.getTime());
            tempLastReset.setDate(tempLastReset.getDate() + 1);
            return this.calculateNextResetDate({...benefit, lastReset: tempLastReset.toISOString()}, card);
        }
        return nextReset;
    }

    // --- Modal Functions ---

    showResetModal(pendingResets) {
        this.resetModalList.innerHTML = '';
        pendingResets.forEach(reset => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${reset.cardName}:</strong> ${reset.benefit.description}`;
            this.resetModalList.appendChild(li);
        });
        this.resetModalOk.onclick = () => {
            this.applyResets(pendingResets);
        };
        this.resetModalCancel.onclick = () => {
            this.resetModal.style.display = 'none';
            this.render();
        };
        this.resetModal.style.display = 'flex';
    }

    async applyResets(pendingResets) {
        pendingResets.forEach(reset => {
            reset.benefit.usedAmount = 0;
            reset.benefit.lastReset = this.today.toISOString();
        });
        await this.saveState();
        this.resetModal.style.display = 'none';
        this.render();
    }

    // --- Expiring Soon Functions ---

    handleExpiringDaysChange(e) {
        this.expiringDays = parseInt(e.target.value, 10);
        this.renderExpiringSoon();
    }

    getExpiringBenefits() {
        const allExpiring = [];
        const limitDate = new Date(this.today.getTime());
        limitDate.setDate(this.today.getDate() + this.expiringDays);

        this.cards.forEach(card => {
            card.benefits.forEach(benefit => {
                const remaining = benefit.totalAmount - benefit.usedAmount;
                if (remaining <= 0) return;
                if (benefit.frequency === 'one-time') return;
                const nextReset = this.calculateNextResetDate(benefit, card);
                if (nextReset > this.today && nextReset <= limitDate) {
                    allExpiring.push({
                        cardName: card.name,
                        benefit: benefit,
                        remainingAmount: remaining,
                        nextResetDate: nextReset
                    });
                }
            });
        });
        allExpiring.sort((a, b) => b.remainingAmount - a.remainingAmount);
        return allExpiring;
    }

    renderExpiringSoon() {
        const expiring = this.getExpiringBenefits();
        this.expiringSoonContainer.style.display = 'block';
        this.expiringSoonList.innerHTML = '';

        if (expiring.length === 0) {
            const li = document.createElement('li');
            li.className = 'expiring-item-empty';
            li.textContent = `No unused benefits are expiring within ${this.expiringDays} days.`;
            this.expiringSoonList.appendChild(li);
            return;
        }

        expiring.forEach(item => {
            const li = document.createElement('li');
            li.className = 'expiring-item';
            li.innerHTML = `
                <span class="expiring-item-amount">$${item.remainingAmount.toFixed(2)}</span>
                <div class="expiring-item-details">
                    <div class="expiring-item-benefit">${item.benefit.description}</div>
                    <div class="expiring-item-card">${item.cardName}</div>
                </div>
                <span class="expiring-item-date">Resets: ${item.nextResetDate.toLocaleDateString()}</span>
            `;
            this.expiringSoonList.appendChild(li);
        });
    }

    // --- Core Render Logic ---

    render() {
        this.renderExpiringSoon();
        this.cardListContainer.innerHTML = '';
        if (this.cards.length === 0) {
            this.cardListContainer.innerHTML = '<p>No cards added yet. Add one below to get started!</p>';
        }
        this.cards.forEach(card => {
            const allBenefitsUsed = card.benefits.length > 0 &&
                card.benefits.every(b => (b.totalAmount - b.usedAmount) <= 0);
            const cardEl = this.createCardElement(card, allBenefitsUsed);
            this.cardListContainer.appendChild(cardEl);
        });
    }

    createCardElement(card, allBenefitsUsed) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.cardId = card.id;
        if (allBenefitsUsed) cardDiv.classList.add('card-collapsed');

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.onclick = (e) => {
            if (e.target.closest('.card-header-actions') || e.target.closest('.edit-form')) return;
            cardDiv.classList.toggle('card-collapsed');
        };
        cardHeader.style.cursor = 'pointer';

        const cardInfo = document.createElement('div');
        cardInfo.className = 'card-header-info';

        const cardName = document.createElement('h3');
        cardName.textContent = card.name;
        cardInfo.appendChild(cardName);

        const cardMeta = document.createElement('div');
        cardMeta.className = 'card-meta';
        const anniversary = new Date(card.anniversaryDate);
        anniversary.setMinutes(anniversary.getMinutes() + anniversary.getTimezoneOffset());
        cardMeta.textContent = `Anniversary: ${anniversary.toLocaleDateString()}`;
        cardInfo.appendChild(cardMeta);

        cardHeader.appendChild(cardInfo);

        const cardActions = document.createElement('div');
        cardActions.className = 'card-header-actions';
        const editCardBtn = document.createElement('button');
        editCardBtn.className = 'secondary-btn';
        editCardBtn.textContent = 'Edit';
        editCardBtn.onclick = () => this.renderCardEdit(card);
        const deleteCardBtn = document.createElement('button');
        deleteCardBtn.className = 'danger-btn';
        deleteCardBtn.textContent = 'Delete';
        deleteCardBtn.onclick = () => this.handleDeleteCard(card.id);

        cardActions.appendChild(editCardBtn);
        cardActions.appendChild(deleteCardBtn);
        cardHeader.appendChild(cardActions);

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        const benefitList = document.createElement('ul');
        benefitList.className = 'benefit-list';
        if (card.benefits.length > 0) {
            card.benefits.forEach(benefit => {
                benefitList.appendChild(this.createBenefitElement(benefit, card));
            });
        } else {
            benefitList.innerHTML = '<li>No benefits added for this card yet.</li>';
        }

        const addBenefitContainer = document.createElement('div');
        addBenefitContainer.className = 'add-benefit-container';
        const showAddBenefitBtn = document.createElement('button');
        showAddBenefitBtn.className = 'secondary-btn show-add-benefit-btn';
        showAddBenefitBtn.textContent = 'Add New Benefit';
        const addBenefitForm = this.createAddBenefitForm(card.id);
        addBenefitForm.style.display = 'none';
        showAddBenefitBtn.onclick = () => {
            showAddBenefitBtn.style.display = 'none';
            addBenefitForm.style.display = 'flex';
        };
        addBenefitContainer.appendChild(showAddBenefitBtn);
        addBenefitContainer.appendChild(addBenefitForm);

        cardBody.appendChild(benefitList);
        cardBody.appendChild(addBenefitContainer);
        cardDiv.appendChild(cardHeader);
        cardDiv.appendChild(cardBody);
        return cardDiv;
    }

    createBenefitElement(benefit, card) {
        const li = document.createElement('li');
        li.className = 'benefit-item';
        li.dataset.benefitId = benefit.id;
        const remaining = benefit.totalAmount - benefit.usedAmount;
        const progressPercent = (benefit.totalAmount > 0) ? (benefit.usedAmount / benefit.totalAmount) * 100 : 0;
        const isUsed = remaining <= 0;
        if (isUsed) li.classList.add('benefit-used');

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details';
        detailsDiv.style.cursor = 'pointer';
        detailsDiv.innerHTML = `
            <span class="description">${benefit.description}</span>
            <span class="status" style="color: ${isUsed ? 'var(--success)' : 'var(--danger)'}">
                $${remaining.toFixed(2)} remaining
            </span>
        `;
        detailsDiv.onclick = (e) => {
            if (e.target.closest('.edit-form')) return;
            li.classList.toggle('benefit-used');
        };

        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        let metaText = `($${benefit.usedAmount.toFixed(2)} / $${benefit.totalAmount.toFixed(2)}) - ${benefit.frequency} benefit`;
        if (benefit.frequency !== 'one-time') metaText += ` | ${benefit.resetType}`;
        metaDiv.textContent = metaText;

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar';
        progressContainer.innerHTML = `<div class="progress-bar-inner" style="width: ${progressPercent}%; background-color: ${isUsed ? 'var(--success)' : 'var(--primary-color)'};"></div>`;

        const nextResetDiv = document.createElement('div');
        nextResetDiv.className = 'next-reset';
        if (benefit.frequency !== 'one-time') {
            const nextResetDate = this.calculateNextResetDate(benefit, card);
            nextResetDiv.textContent = `Resets on: ${nextResetDate.toLocaleDateString()}`;
        } else {
            nextResetDiv.textContent = `One-time benefit`;
        }

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'benefit-controls';
        const updateLabel = document.createElement('label');
        updateLabel.textContent = 'Set used: $';
        updateLabel.htmlFor = `update-${benefit.id}`;
        const updateInput = document.createElement('input');
        updateInput.type = 'number';
        updateInput.id = `update-${benefit.id}`;
        updateInput.value = benefit.usedAmount.toFixed(2);
        updateInput.min = "0";
        updateInput.max = benefit.totalAmount;
        updateInput.step = "0.01";

        updateInput.onfocus = (e) => {
            e.target.value = '';
        };
        updateInput.onblur = (e) => {
            if (e.target.value === '') {
                e.target.value = benefit.usedAmount.toFixed(2);
            }
        };
        updateInput.onchange = (e) => {
            this.handleUpdateBenefitUsage(benefit.id, parseFloat(e.target.value));
        };

        const rightControls = document.createElement('div');
        rightControls.className = 'controls-right';
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => this.renderBenefitEdit(benefit, card);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => this.handleDeleteBenefit(benefit.id);

        rightControls.appendChild(editBtn);
        rightControls.appendChild(deleteBtn);
        controlsDiv.appendChild(updateLabel);
        controlsDiv.appendChild(updateInput);
        controlsDiv.appendChild(rightControls);

        li.appendChild(detailsDiv);
        li.appendChild(metaDiv);
        li.appendChild(progressContainer);
        li.appendChild(nextResetDiv);
        li.appendChild(controlsDiv);
        return li;
    }

    createAddBenefitForm(cardId) {
        const form = document.createElement('form');
        form.className = 'benefit-form';
        const descId = `benefit-desc-${cardId}`;
        const amountId = `benefit-amount-${cardId}`;
        const freqId = `benefit-freq-${cardId}`;
        const resetId = `benefit-reset-${cardId}`;
        const resetGroupId = `benefit-reset-group-${cardId}`;

        form.innerHTML = `
            <h3 style="margin: 0; font-size: 1.1rem;">Add New Benefit</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="${descId}">Benefit Description</label>
                    <input type="text" id="${descId}" name="description" placeholder="E.g., $10 Uber Cash" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="${amountId}">Total Amount (per period)</label>
                    <input type="number" id="${amountId}" name="totalAmount" placeholder="10.00" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="${freqId}">Frequency</label>
                    <select id="${freqId}" name="frequency" required>
                        <option value="" disabled selected>Select...</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannual">Biannual (2x/yr)</option>
                        <option value="annual">Annual</option>
                        <option value="every-4-years">Every 4 Years</option>
                        <option value="one-time">One-Time</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" id="${resetGroupId}" style="display: none;">
                    <label for="${resetId}">Reset Type</label>
                    <select id="${resetId}" name="resetType">
                        <option value="calendar">Calendar (Jan 1, Apr 1, etc.)</option>
                        <option value="anniversary">Anniversary-Dated</option>
                    </select>
                </div>
            </div>
            <button type="submit">Add Benefit</button>
        `;
        const frequencySelect = form.querySelector(`#${freqId}`);
        const resetTypeGroup = form.querySelector(`#${resetGroupId}`);
        const resetTypeSelect = form.querySelector(`#${resetId}`);
        frequencySelect.onchange = (e) => {
            if (e.target.value === 'one-time') {
                resetTypeGroup.style.display = 'none';
                resetTypeSelect.required = false;
            } else {
                resetTypeGroup.style.display = 'block';
                resetTypeSelect.required = true;
            }
        };
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const benefitData = {
                description: formData.get('description'),
                totalAmount: parseFloat(formData.get('totalAmount')),
                frequency: formData.get('frequency'),
                resetType: formData.get('frequency') === 'one-time' ? null : formData.get('resetType'),
            };
            this.handleAddBenefit(cardId, benefitData);
            e.target.reset();
            resetTypeGroup.style.display = 'none';
            form.style.display = 'none';
            const container = form.closest('.add-benefit-container');
            if (container) {
                container.querySelector('.show-add-benefit-btn').style.display = 'block';
            }
        };
        return form;
    }

    renderCardEdit(card) {
        const cardEl = document.querySelector(`.card[data-card-id="${card.id}"]`);
        if (!cardEl) return;
        const form = document.createElement('div');
        form.className = 'edit-form';
        const nameId = `edit-name-${card.id}`;
        const dateId = `edit-date-${card.id}`;
        form.innerHTML = `
            <h3 style="margin: 0;">Editing: ${card.name}</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="${nameId}">Card Name</label>
                    <input type="text" id="${nameId}" value="${card.name}" required>
                </div>
                <div class="form-group">
                    <label for="${dateId}">Anniversary Date</label>
                    <input type="date" id="${dateId}" value="${card.anniversaryDate}" required>
                </div>
            </div>
            <div class="form-row" style="justify-content: flex-end;">
                <button type="button" class="secondary-btn" id="cancel-edit-card-${card.id}">Cancel</button>
                <button type="button" id="save-edit-card-${card.id}">Save Changes</button>
            </div>
        `;
        cardEl.innerHTML = '';
        cardEl.appendChild(form);
        document.getElementById(`save-edit-card-${card.id}`).onclick = () => {
            const newName = document.getElementById(nameId).value.trim();
            const newDate = document.getElementById(dateId).value;
            if (newName && newDate) {
                this.handleUpdateCard(card.id, newName, newDate);
            }
        };
        document.getElementById(`cancel-edit-card-${card.id}`).onclick = () => {
            this.render();
        };
    }

    renderBenefitEdit(benefit, card) {
        const benefitEl = document.querySelector(`.benefit-item[data-benefit-id="${benefit.id}"]`);
        if (!benefitEl) return;
        const form = document.createElement('div');
        form.className = 'edit-form';
        form.style.marginBottom = '0';
        const descId = `edit-desc-${benefit.id}`;
        const amountId = `edit-amount-${benefit.id}`;
        const freqId = `edit-freq-${benefit.id}`;
        const resetId = `edit-reset-${benefit.id}`;
        const resetGroupId = `edit-reset-group-${benefit.id}`;
        const isOneTime = benefit.frequency === 'one-time';

        form.innerHTML = `
            <h3 style="margin: 0; font-size: 1.1rem;">Editing: ${benefit.description}</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="${descId}">Benefit Description</label>
                    <input type="text" id="${descId}" name="description" value="${benefit.description}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="${amountId}">Total Amount (per period)</label>
                    <input type="number" id="${amountId}" name="totalAmount" value="${benefit.totalAmount.toFixed(2)}" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="${freqId}">Frequency</label>
                    <select id="${freqId}" name="frequency" required>
                        <option value="monthly" ${benefit.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="quarterly" ${benefit.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                        <option value="biannual" ${benefit.frequency === 'biannual' ? 'selected' : ''}>Biannual (2x/yr)</option>
                        <option value="annual" ${benefit.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                        <option value="every-4-years" ${benefit.frequency === 'every-4-years' ? 'selected' : ''}>Every 4 Years</option>
                        <option value="one-time" ${benefit.frequency === 'one-time' ? 'selected' : ''}>One-Time</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" id="${resetGroupId}" style="display: ${isOneTime ? 'none' : 'block'};">
                    <label for="${resetId}">Reset Type</label>
                    <select id="${resetId}" name="resetType" ${isOneTime ? '' : 'required'}>
                        <option value="calendar" ${benefit.resetType === 'calendar' ? 'selected' : ''}>Calendar (Jan 1, Apr 1, etc.)</option>
                        <option value="anniversary" ${benefit.resetType === 'anniversary' ? 'selected' : ''}>Anniversary-Dated</option>
                    </select>
                </div>
            </div>
            <div class="form-row" style="justify-content: flex-end;">
                <button type="button" class="secondary-btn" id="cancel-edit-benefit-${benefit.id}">Cancel</button>
                <button type="button" id="save-edit-benefit-${benefit.id}">Save Changes</button>
            </div>
        `;
        benefitEl.innerHTML = '';
        benefitEl.appendChild(form);
        const frequencySelect = document.getElementById(freqId);
        const resetTypeGroup = document.getElementById(resetGroupId);
        const resetTypeSelect = document.getElementById(resetId);
        frequencySelect.onchange = (e) => {
            if (e.target.value === 'one-time') {
                resetTypeGroup.style.display = 'none';
                resetTypeSelect.required = false;
            } else {
                resetTypeGroup.style.display = 'block';
                resetTypeSelect.required = true;
            }
        };
        document.getElementById(`save-edit-benefit-${benefit.id}`).onclick = () => {
            const newData = {
                description: document.getElementById(descId).value.trim(),
                totalAmount: parseFloat(document.getElementById(amountId).value),
                frequency: document.getElementById(freqId).value,
                resetType: null
            };
            if (newData.frequency !== 'one-time') {
                newData.resetType = document.getElementById(resetId).value;
            }
            if (newData.description && newData.totalAmount) {
                this.handleUpdateBenefit(benefit.id, newData);
            }
        };
        document.getElementById(`cancel-edit-benefit-${benefit.id}`).onclick = () => {
            this.render();
        };
    }

    handleAddCard(e) {
        e.preventDefault();
        const cardName = this.newCardNameInput.value.trim();
        const anniversaryDate = this.newCardAnniversaryInput.value;
        if (!cardName || !anniversaryDate) return;
        const newCard = {
            id: `card-${crypto.randomUUID()}`,
            name: cardName,
            anniversaryDate: anniversaryDate,
            benefits: [],
        };
        this.cards.push(newCard);
        this.saveState();
        this.render();
        this.newCardNameInput.value = '';
        this.newCardAnniversaryInput.value = '';
        this.addCardFormContainer.style.display = 'none';
        this.showAddCardBtn.style.display = 'block';
    }

    handleDeleteCard(cardId) {
        if (!confirm('Are you sure you want to delete this card and all its benefits?')) return;
        this.cards = this.cards.filter(card => card.id !== cardId);
        this.saveState();
        this.render();
    }

    handleAddBenefit(cardId, benefitData) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;
        const newBenefit = {
            id: `benefit-${crypto.randomUUID()}`,
            description: benefitData.description,
            totalAmount: benefitData.totalAmount,
            usedAmount: 0,
            frequency: benefitData.frequency,
            resetType: benefitData.resetType,
            lastReset: this.today.toISOString(),
        };
        card.benefits.push(newBenefit);
        this.saveState();
        this.render();
    }

    handleUpdateBenefitUsage(benefitId, newUsedAmount) {
        for (const card of this.cards) {
            const benefit = card.benefits.find(b => b.id === benefitId);
            if (benefit) {
                if (isNaN(newUsedAmount) || newUsedAmount < 0) newUsedAmount = 0;
                else if (newUsedAmount > benefit.totalAmount) newUsedAmount = benefit.totalAmount;
                benefit.usedAmount = newUsedAmount;
                this.saveState();
                this.render();
                return;
            }
        }
    }

    handleDeleteBenefit(benefitId) {
        if (!confirm('Are you sure you want to delete this benefit?')) return;
        for (const card of this.cards) {
            const benefitIndex = card.benefits.findIndex(b => b.id === benefitId);
            if (benefitIndex > -1) {
                card.benefits.splice(benefitIndex, 1);
                this.saveState();
                this.render();
                return;
            }
        }
    }

    handleUpdateCard(cardId, newName, newDate) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            card.name = newName;
            card.anniversaryDate = newDate;
            this.saveState();
        }
        this.render();
    }

    handleUpdateBenefit(benefitId, newData) {
        for (const card of this.cards) {
            const benefit = card.benefits.find(b => b.id === benefitId);
            if (benefit) {
                benefit.description = newData.description;
                benefit.totalAmount = newData.totalAmount;
                benefit.frequency = newData.frequency;
                benefit.resetType = newData.resetType;
                if (benefit.usedAmount > benefit.totalAmount) benefit.usedAmount = benefit.totalAmount;
                this.saveState();
                this.render();
                return;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new BenefitTrackerApp();
    app.init();
});
