/**
 * Main Controller logic.
 * Coordinates Data (Store), Logic (Models), and View (UIRenderer).
 */

class BenefitTrackerApp {
    constructor() {
        /** @type {StorageInterface} */
        this.storage = null;
        this.ui = new UIRenderer(this); // Pass controller to View
        /** @type {Array<Card>} */
        this.cards = [];
        this.today = new Date();
        this.expiringDays = 30;
        this.expiringMinAmount = 0;
        this.pollInterval = 800;
        this.collapseSections = false; // Setting to group fully utilized/ignored items into sections
        this.hideMonthlyExpiring = false; // Setting to hide monthly benefits from Expiring Soon
        this.userSelectedThreshold = false; // Track if user manually selected a threshold

        // Concurrency Control
        this.pollAbortController = null;
        this.isSaving = false;
        this.lastProgressState = new Map();

        // Core References
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.cardListContainer = document.getElementById('card-list-container');
        this.expiringDaysSelect = document.getElementById('expiring-days-select');
        this.expiringMinAmountInput = document.getElementById('expiring-min-amount');

        // Add Card Form Logic
        this.addCardFormContainer = document.querySelector('.card-form-container');
        this.addCardForm = document.getElementById('add-card-form');
        this.showAddCardBtn = document.getElementById('show-add-card-btn');
        this.newCardNameInput = document.getElementById('new-card-name');
        this.newCardAnniversaryInput = document.getElementById('new-card-anniversary');

        // Settings References
        this.settingsSaveBtn = document.getElementById('settings-save');
        this.s3UrlInput = document.getElementById('s3-url-input');
        this.pollIntervalInput = document.getElementById('poll-interval-input');
        this.currentStorageLabel = document.getElementById('current-storage-type');

        // Custom Date References
        this.customDateInput = document.getElementById('custom-date-input');
        this.clearCustomDateBtn = document.getElementById('clear-custom-date-btn');
        
        // Display Options References
        this.collapseSectionsCheckbox = document.getElementById('collapse-sections-checkbox');
        this.hideMonthlyExpiringCheckbox = document.getElementById('hide-monthly-expiring-checkbox');

        this.initListeners();
    }

    initListeners() {
        this.addCardForm.addEventListener('submit', this.handleAddCard.bind(this));
        this.expiringDaysSelect.addEventListener('change', (e) => {
            this.expiringDays = parseInt(e.target.value, 10);
            this.userSelectedThreshold = true; // Mark as user selection
            this.render();
        });
        if (this.expiringMinAmountInput) {
            this.expiringMinAmountInput.addEventListener('change', (e) => {
                const newVal = parseFloat(e.target.value);
                this.expiringMinAmount = isNaN(newVal) ? 0 : Math.max(0, newVal);
                localStorage.setItem('creditCardBenefitTracker_expiringMinAmount', this.expiringMinAmount.toString());
                this.render();
            });
        }

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
            // Populate custom date input with stored value
            const storedCustomDate = localStorage.getItem('creditCardBenefitTracker_customDate');
            this.customDateInput.value = storedCustomDate || '';
            // Populate collapse sections checkbox
            this.collapseSectionsCheckbox.checked = this.collapseSections;
            // Populate hide monthly expiring checkbox
            this.hideMonthlyExpiringCheckbox.checked = this.hideMonthlyExpiring;
            document.getElementById('settings-modal').style.display = 'flex';
        };
        document.getElementById('settings-cancel').onclick = () => document.getElementById('settings-modal').style.display = 'none';
        document.getElementById('settings-save').onclick = this.handleConnectCloud.bind(this);
        document.getElementById('use-local-storage-btn').onclick = this.handleSwitchToLocal.bind(this);

        // Custom Date Listeners
        this.customDateInput.addEventListener('change', this.handleCustomDateChange.bind(this));
        this.clearCustomDateBtn.addEventListener('click', this.handleClearCustomDate.bind(this));
        
        // Collapse Sections Listener
        this.collapseSectionsCheckbox.addEventListener('change', this.handleCollapseSectionsChange.bind(this));
        
        // Hide monthly in expiring widget listener
        this.hideMonthlyExpiringCheckbox.addEventListener('change', this.handleHideMonthlyExpiringChange.bind(this));
    }

    // ... (init and initLiveSync unchanged) ...
    async init() {
        // Load custom date from localStorage if set
        const storedCustomDate = localStorage.getItem('creditCardBenefitTracker_customDate');
        this.setCurrentDate(storedCustomDate);
        this.expiringDays = parseInt(this.expiringDaysSelect.value, 10);
        const storedMinAmount = localStorage.getItem('creditCardBenefitTracker_expiringMinAmount');
        if (storedMinAmount !== null) {
            this.expiringMinAmount = Math.max(0, parseFloat(storedMinAmount) || 0);
            if (this.expiringMinAmountInput) {
                this.expiringMinAmountInput.value = this.expiringMinAmount.toString();
            }
        } else if (this.expiringMinAmountInput) {
            const parsedMin = parseFloat(this.expiringMinAmountInput.value);
            this.expiringMinAmount = isNaN(parsedMin) ? 0 : Math.max(0, parsedMin);
        }

        const storedInterval = localStorage.getItem('creditCardBenefitTracker_pollInterval');
        if (storedInterval) this.pollInterval = parseInt(storedInterval, 10);
        
        // Load collapse sections setting
        const storedCollapseSections = localStorage.getItem('creditCardBenefitTracker_collapseSections');
        this.collapseSections = storedCollapseSections === 'true';
        
        // Load hide monthly expiring setting
        const storedHideMonthlyExpiring = localStorage.getItem('creditCardBenefitTracker_hideMonthlyExpiring');
        this.hideMonthlyExpiring = storedHideMonthlyExpiring === 'true';

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
            const rawData = await this.storage.loadData();
            // Convert raw data to Card instances
            this.cards = rawData.map(cardData => Card.fromJSON(cardData));
        } catch (e) {
            console.error(e);
            alert("Error loading data. Please check settings.");
        } finally {
            this.toggleLoading(false);
        }

        // After loading data, auto-select the optimal threshold (overrides the default 30)
        // This only happens on page load; user selections will be preserved after that
        const defaultThreshold = this.findNearestThresholdWithActiveEntries();
        this.expiringDays = defaultThreshold;
        this.expiringDaysSelect.value = defaultThreshold.toString();

        this.initLiveSync();

        // Check for resets
        this.pendingResets = this.checkAndResetBenefits();
        if (this.pendingResets.length > 0) {
            this.showResetModal(this.pendingResets);
        } else {
            this.render();
        }
    }

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
        if (this.isSaving) return;

        this.pollAbortController = new AbortController();

        try {
            const remoteData = await this.storage.loadData({signal: this.pollAbortController.signal});
            this.pollAbortController = null;

            // Convert to Card instances for comparison
            const remoteCards = remoteData.map(cardData => Card.fromJSON(cardData));
            const currentJSON = JSON.stringify(this.cards.map(c => c.toJSON()));
            const remoteJSON = JSON.stringify(remoteCards.map(c => c.toJSON()));
            
            if (currentJSON !== remoteJSON) {
                this.cards = remoteCards;
                this.render();
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn('Background poll failed:', e.message);
            }
        }
    }

    toggleLoading(isLoading) {
        this.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    async saveState() {
        if (this.pollAbortController) {
            this.pollAbortController.abort();
            this.pollAbortController = null;
        }

        this.isSaving = true;
        this.toggleLoading(true);
        try {
            // Convert Card instances to plain objects for storage
            const dataToSave = this.cards.map(card => card.toJSON());
            await this.storage.saveData(dataToSave);
        } catch (e) {
            alert(`Save failed: ${e.message}`);
        } finally {
            this.toggleLoading(false);
            this.isSaving = false;
        }
    }

    // ==================== TYPE CHECK HELPERS ====================

    /**
     * Helper to check if a benefit is a carryover benefit.
     * Works with both Benefit instances and plain objects.
     * @param {Benefit|Object} benefit
     * @returns {boolean}
     */
    _isCarryoverBenefit(benefit) {
        return benefit.isCarryoverBenefit 
            ? benefit.isCarryoverBenefit() 
            : benefit.isCarryover === true;
    }

    /**
     * Helper to check if a benefit is a one-time benefit.
     * Works with both Benefit instances and plain objects.
     * @param {Benefit|Object} benefit
     * @returns {boolean}
     */
    _isOneTimeBenefit(benefit) {
        return benefit.isOneTime 
            ? benefit.isOneTime() 
            : benefit.frequency === 'one-time';
    }
    
    /**
     * Helper to check if a benefit is a monthly recurring benefit.
     * Excludes carryover and one-time benefits.
     * @param {Benefit|Object} benefit
     * @returns {boolean}
     */
    _isMonthlyRecurring(benefit) {
        return !this._isCarryoverBenefit(benefit) && !this._isOneTimeBenefit(benefit) && benefit.frequency === 'monthly';
    }

    /**
     * Checks if auto-claim is active for a benefit.
     * Delegates to Benefit.isAutoClaimActive().
     * @param {Benefit|Object} benefit - The benefit instance or object
     * @returns {boolean}
     */
    isAutoClaimActive(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.isAutoClaimActive(this.today);
        }
        // Fallback for plain objects
        if (benefit.frequency === 'one-time') return false;
        if (benefit.autoClaim !== true) return false;
        if (!benefit.autoClaimEndDate) return false;
        const endDate = new Date(benefit.autoClaimEndDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= this.today;
    }

    /**
     * Checks if a benefit is ignored.
     * Delegates to Benefit.isIgnoredActive().
     * @param {Benefit|Object} benefit - The benefit instance or object
     * @returns {boolean}
     */
    isIgnoredActive(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.isIgnoredActive(this.today);
        }
        // Fallback for plain objects
        if (benefit.frequency === 'one-time') return false;
        if (benefit.ignored !== true) return false;
        if (!benefit.ignoredEndDate) return false;
        const endDate = new Date(benefit.ignoredEndDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= this.today;
    }

    /**
     * Checks if a carryover benefit has any earned instances available.
     * Delegates to Benefit.hasActiveCarryoverInstances().
     * @param {Benefit|Object} benefit - The benefit object
     * @returns {boolean} True if the benefit has at least one active earned instance
     */
    isCarryoverEarned(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.hasActiveCarryoverInstances(this.today);
        }
        if (!benefit.isCarryover) return false;
        return DateUtils.hasActiveCarryoverInstance(benefit, this.today);
    }

    /**
     * Checks if a carryover benefit can be earned in the current year.
     * Delegates to Benefit.canEarnCarryoverThisYear().
     * @param {Benefit|Object} benefit - The benefit object
     * @returns {boolean} True if the benefit can still be earned this year
     */
    canEarnCarryoverThisYear(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.canEarnCarryoverThisYear(this.today);
        }
        return DateUtils.canEarnCarryoverThisYear(benefit, this.today);
    }

    /**
     * Gets all active (non-expired) earned instances for a carryover benefit.
     * Delegates to Benefit.getActiveCarryoverInstances().
     * @param {Benefit|Object} benefit - The benefit object
     * @returns {Array} Array of active earned instances
     */
    getActiveCarryoverInstances(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.getActiveCarryoverInstances(this.today);
        }
        return DateUtils.getActiveCarryoverInstances(benefit, this.today);
    }

    /**
     * Gets the total remaining credit across all active earned instances.
     * Delegates to Benefit.getTotalCarryoverRemaining().
     * @param {Benefit|Object} benefit - The benefit object
     * @returns {number} Total remaining credit
     */
    getTotalCarryoverRemaining(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.getTotalCarryoverRemaining(this.today);
        }
        return DateUtils.getTotalCarryoverRemaining(benefit, this.today);
    }

    /**
     * Gets the expiry date for the earliest expiring active instance.
     * Delegates to Benefit.getCarryoverExpiryDate().
     * @param {Benefit|Object} benefit - The benefit object
     * @returns {Date|null} The earliest expiry date or null if no active instances
     */
    getCarryoverExpiryDate(benefit) {
        if (benefit instanceof Benefit) {
            return benefit.getCarryoverExpiryDate(this.today);
        }
        if (!benefit.isCarryover) return null;
        const activeInstances = this.getActiveCarryoverInstances(benefit);
        if (activeInstances.length === 0) return null;
        
        // Return the earliest expiry date
        const expiryDates = activeInstances.map(instance => 
            DateUtils.calculateCarryoverExpiryDate(instance.earnedDate)
        );
        return expiryDates.reduce((earliest, date) => 
            date < earliest ? date : earliest
        );
    }

    checkAndResetBenefits() {
        const pendingManualResets = [];
        let stateChanged = false;

        this.cards.forEach(card => {
            // Reset recurring minimum spends if needed
            if (card.minimumSpends) {
                card.minimumSpends.forEach(minSpend => {
                    if (minSpend.shouldReset && minSpend.shouldReset(this.today)) {
                        minSpend.reset(this.today);
                        stateChanged = true;
                    }
                });
            }

            card.benefits.forEach(benefit => {
                // Handle carryover benefits separately
                if (this._isCarryoverBenefit(benefit)) {
                    // Migrate legacy single earnedDate to earnedInstances array
                    if (benefit.earnedDate && !benefit.earnedInstances) {
                        benefit.earnedInstances = [{
                            earnedDate: benefit.earnedDate,
                            usedAmount: benefit.usedAmount || 0
                        }];
                        benefit.earnedDate = null; // Clear legacy field
                        benefit.usedAmount = 0;
                        stateChanged = true;
                    }

                    // Initialize earnedInstances if not present
                    if (!benefit.earnedInstances) {
                        benefit.earnedInstances = [];
                    }

                    // Update lastEarnReset for calendar year tracking
                    const resetDate = CarryoverCycle.getResetDate(this.today);
                    const lastEarnReset = benefit.lastEarnReset ? new Date(benefit.lastEarnReset) : null;
                    
                    if (!lastEarnReset || lastEarnReset < resetDate) {
                        benefit.lastEarnReset = resetDate.toISOString();
                        stateChanged = true;
                    }

                    // Remove expired instances
                    const carryoverCycle = new CarryoverCycle({
                        earnedInstances: benefit.earnedInstances
                    });
                    const activeInstances = carryoverCycle.getActiveInstances(this.today);
                    
                    if (activeInstances.length !== benefit.earnedInstances.length) {
                        benefit.earnedInstances = activeInstances;
                        stateChanged = true;
                    }

                    return; // Don't process as regular benefit
                }

                if (this._isOneTimeBenefit(benefit)) return;

                if (this.isAutoClaimActive(benefit) && benefit.usedAmount < benefit.totalAmount) {
                    benefit.usedAmount = benefit.totalAmount;
                    stateChanged = true;
                }

                // Use Benefit method if available, otherwise use DateUtils
                const nextReset = benefit.getNextResetDate 
                    ? benefit.getNextResetDate(this.today)
                    : DateUtils.calculateNextResetDate(benefit, card, this.today);

                if (nextReset <= this.today) {
                    if (this.isAutoClaimActive(benefit)) {
                        benefit.lastReset = this.today.toISOString();
                        benefit.usedAmount = benefit.totalAmount;
                        stateChanged = true;
                    } else if (this.isIgnoredActive(benefit)) {
                        benefit.lastReset = this.today.toISOString();
                        benefit.usedAmount = 0;
                        stateChanged = true;
                    } else {
                        pendingManualResets.push({cardName: card.name, benefit: benefit});
                    }
                }
            });
        });

        if (stateChanged) {
            this.saveState();
        }
        return pendingManualResets;
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

    // --- NEW: Reordering Logic ---

    initSortables() {
        // 1. Sortable for Cards
        new Sortable(this.cardListContainer, {
            handle: '.draggable-card-handle',
            animation: 150,
            onEnd: (evt) => {
                this.handleReorderCards(evt.oldIndex, evt.newIndex);
            }
        });

        // 2. Sortable for Benefits within each Card
        // We need to find all benefit lists (ULs) and make them sortable
        const benefitLists = this.cardListContainer.querySelectorAll('.benefit-list');
        benefitLists.forEach(list => {
            new Sortable(list, {
                handle: '.draggable-benefit-handle',
                animation: 150,
                // Prevent dragging benefits between different cards (optional, but safer)
                group: list.dataset.cardId,
                onEnd: (evt) => {
                    const cardId = list.dataset.cardId;
                    this.handleReorderBenefits(cardId, evt.oldIndex, evt.newIndex);
                }
            });
        });
    }

    handleReorderCards(oldIndex, newIndex) {
        if (oldIndex === newIndex) return;

        // Remove from old index and insert at new
        const [movedCard] = this.cards.splice(oldIndex, 1);
        this.cards.splice(newIndex, 0, movedCard);

        this.saveState();
        // No need to re-render, SortableJS moved the DOM.
        // But saving state ensures refresh works.
    }

    handleReorderBenefits(cardId, oldIndex, newIndex) {
        if (oldIndex === newIndex) return;

        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            // Use Card method if available
            if (card.reorderBenefits) {
                card.reorderBenefits(oldIndex, newIndex);
            } else {
                const [movedBenefit] = card.benefits.splice(oldIndex, 1);
                card.benefits.splice(newIndex, 0, movedBenefit);
            }
            this.saveState();
        }
    }

    // --- Helper Methods for Default Threshold ---
    /**
     * Calculate the number of active (non-collapsed) entries for a given threshold.
     * Active entries are benefits that are not fully used and not ignored.
     * @param {number} days - The threshold in days
     * @returns {number} - Count of active entries
     */
    calculateActiveEntriesForThreshold(days) {
        let count = 0;
        const limitDate = new Date(this.today.getTime());
        limitDate.setDate(this.today.getDate() + days);

        this.cards.forEach(card => {
            // Count actionable minimum spends
            if (card.minimumSpends) {
                card.minimumSpends.forEach(minSpend => {
                    const isActionable = minSpend.isActionable 
                        ? minSpend.isActionable(this.today)
                        : (!minSpend.isMet && !this.isMinimumSpendIgnored(minSpend));
                    
                    if (isActionable) {
                        const deadline = minSpend.getDeadline 
                            ? minSpend.getDeadline(this.today)
                            : null;
                        
                        if (deadline && deadline > this.today && deadline <= limitDate) {
                            count++;
                        }
                    }
                });
            }

            card.benefits.forEach(benefit => {
                if (this.hideMonthlyExpiring && this._isMonthlyRecurring(benefit)) return;

                // Handle carryover benefits separately
                if (this._isCarryoverBenefit(benefit)) {
                    const activeInstances = this.getActiveCarryoverInstances(benefit);
                    activeInstances.forEach(instance => {
                        const expiryDate = CarryoverCycle.calculateExpiryDate(instance.earnedDate);
                        const rem = benefit.totalAmount - (instance.usedAmount || 0);
                        
                        // Only count if within limit, has remaining amount, and not ignored
                        if (expiryDate > this.today && expiryDate <= limitDate && rem > 0 && !this.isIgnoredActive(benefit)) {
                            count++;
                        }
                    });
                    return;
                }

                const rem = benefit.totalAmount - benefit.usedAmount;
                if (this._isOneTimeBenefit(benefit)) return;

                const next = benefit.getNextResetDate 
                    ? benefit.getNextResetDate(this.today)
                    : DateUtils.calculateNextResetDate(benefit, card, this.today);

                // Only count if within limit, has remaining amount, and not ignored
                if (next > this.today && next <= limitDate && rem > 0 && !this.isIgnoredActive(benefit)) {
                    count++;
                }
            });
        });

        return count;
    }

    /**
     * Find the nearest (smallest) threshold with active entries.
     * Checks thresholds in order: 7, 14, 30, 60, 90, 120 days.
     * @returns {number} - The threshold in days, defaults to 30 if none have active entries
     */
    findNearestThresholdWithActiveEntries() {
        const thresholds = [7, 14, 30, 60, 90, 120];
        
        for (const threshold of thresholds) {
            if (this.calculateActiveEntriesForThreshold(threshold) > 0) {
                return threshold;
            }
        }
        
        // Default to 30 if no threshold has active entries
        return 30;
    }

    /**
     * Updates the threshold to the nearest one with active entries.
     * Only updates if the user hasn't manually selected a threshold.
     */
    updateThresholdIfNeeded() {
        // Respect user's manual selection
        if (this.userSelectedThreshold) {
            return;
        }
        
        // Find the nearest threshold with active entries
        const newThreshold = this.findNearestThresholdWithActiveEntries();
        
        // Update if it's different from current
        if (newThreshold !== this.expiringDays) {
            this.expiringDays = newThreshold;
            this.expiringDaysSelect.value = newThreshold.toString();
        }
    }

    getExpiringItemValue(item) {
        if (!item) return 0;
        if (typeof item.remainingAmount === 'number' && item.remainingAmount > 0) {
            return item.remainingAmount;
        }
        if (item.minSpend && typeof item.remainingAmount === 'number') {
            return item.remainingAmount;
        }
        if (item.benefit && typeof item.benefit.totalAmount === 'number') {
            return item.benefit.totalAmount;
        }
        if (typeof item.remainingAmount === 'number') return item.remainingAmount;
        return 0;
    }

    filterExpiringItems(items) {
        const min = this.expiringMinAmount || 0;
        if (!Array.isArray(items) || min <= 0) return items;
        return items.filter(item => this.getExpiringItemValue(item) >= min);
    }

    // --- Rendering Proxy ---
    render() {
        const progressState = new Map();
        this.cardListContainer.querySelectorAll('.progress-bar-inner').forEach(el => {
            let key = el.dataset.progressKey;
            if (!key) {
                const benefitParent = el.closest('[data-benefit-id]');
                const minSpendParent = el.closest('[data-min-spend-id]');
                if (benefitParent) key = `benefit:${benefitParent.dataset.benefitId}`;
                else if (minSpendParent) key = `minSpend:${minSpendParent.dataset.minSpendId}`;
            }
            if (key) {
                const widthVal = parseFloat(el.style.width);
                if (!isNaN(widthVal)) progressState.set(key, widthVal);
            }
        });
        this.lastProgressState = progressState;

        // 1. SNAPSHOT UI STATE
        const cardState = new Map();
        const benefitState = new Map();
        const cardIgnoredSectionState = new Map();
        const cardFullyUsedSectionState = new Map();
        let ignoredSectionOpen = false;
        let fullyUsedSectionOpen = false;
        let minSpendSectionOpen = false;
        let mainWidgetOpen = true;

        this.cardListContainer.querySelectorAll('.card').forEach(el => {
            cardState.set(el.dataset.cardId, el.classList.contains('card-collapsed'));
            // Snapshot benefit section states for each card
            const ignoredSection = el.querySelector('.card-ignored-section');
            if (ignoredSection) {
                cardIgnoredSectionState.set(el.dataset.cardId, ignoredSection.hasAttribute('open'));
            }
            const fullyUsedSection = el.querySelector('.card-fully-used-section');
            if (fullyUsedSection) {
                cardFullyUsedSectionState.set(el.dataset.cardId, fullyUsedSection.hasAttribute('open'));
            }
        });
        this.cardListContainer.querySelectorAll('.benefit-item').forEach(el => {
            benefitState.set(el.dataset.benefitId, el.classList.contains('benefit-used'));
        });

        const widgetDetails = document.querySelector('#expiring-soon-container details.expiring-widget-details');
        if (widgetDetails) mainWidgetOpen = widgetDetails.hasAttribute('open');

        const ignoredDetails = document.querySelector('.ignored-section');
        if (ignoredDetails && ignoredDetails.hasAttribute('open')) ignoredSectionOpen = true;

        const fullyUsedDetails = document.querySelector('.fully-used-section');
        if (fullyUsedDetails && fullyUsedDetails.hasAttribute('open')) fullyUsedSectionOpen = true;

        const minSpendDetails = document.querySelector('.min-spend-section');
        if (minSpendDetails && minSpendDetails.hasAttribute('open')) minSpendSectionOpen = true;

        // Update threshold to nearest option with active entries
        this.updateThresholdIfNeeded();

        // 2. Calculate Data
        const expiringActive = [];
        const expiringIgnored = [];
        const expiringFullyUsed = [];
        const pendingMinSpends = [];

        const limitDate = new Date(this.today.getTime());
        limitDate.setDate(this.today.getDate() + this.expiringDays);

        this.cards.forEach(card => {
            // Process minimum spends
            if (card.minimumSpends) {
                card.minimumSpends.forEach(minSpend => {
                    // Only show actionable (not met, not expired, not ignored) minimum spends
                    const isActionable = minSpend.isActionable 
                        ? minSpend.isActionable(this.today)
                        : (!minSpend.isMet && !this.isMinimumSpendIgnored(minSpend));
                    
                    if (isActionable) {
                        const deadline = minSpend.getDeadline 
                            ? minSpend.getDeadline(this.today)
                            : null;
                        
                        // Only include if deadline is within the limit
                        if (deadline && deadline > this.today && deadline <= limitDate) {
                            pendingMinSpends.push({
                                cardName: card.name,
                                cardId: card.id,
                                minSpend: minSpend,
                                remainingAmount: minSpend.targetAmount - minSpend.currentAmount,
                                deadline: deadline
                            });
                        }
                    }
                });
            }

            card.benefits.forEach(benefit => {
                if (this.hideMonthlyExpiring && this._isMonthlyRecurring(benefit)) return;

                // Handle carryover benefits separately - each earned instance can expire
                if (this._isCarryoverBenefit(benefit)) {
                    const activeInstances = this.getActiveCarryoverInstances(benefit);
                    activeInstances.forEach((instance, index) => {
                        const expiryDate = CarryoverCycle.calculateExpiryDate(instance.earnedDate);
                        const rem = benefit.totalAmount - (instance.usedAmount || 0);
                        
                        // Only show in expiring list if the expiry is within the limit
                        if (expiryDate > this.today && expiryDate <= limitDate) {
                            const earnYear = CarryoverCycle.getEarnYear(instance.earnedDate);
                            const item = {
                                cardName: card.name, 
                                benefit: benefit, 
                                remainingAmount: rem, 
                                nextResetDate: expiryDate,
                                instanceIndex: index,
                                earnYear: earnYear
                            };
                            if (rem <= 0) {
                                expiringFullyUsed.push(item);
                            } else if (this.isIgnoredActive(benefit)) {
                                expiringIgnored.push(item);
                            } else {
                                expiringActive.push(item);
                            }
                        }
                    });
                    return; // Don't process as regular benefit
                }

                if (this.hideMonthlyExpiring && this._isMonthlyRecurring(benefit)) return;

                const rem = benefit.totalAmount - benefit.usedAmount;
                if (this._isOneTimeBenefit(benefit)) return;

                // Use Benefit method if available
                const next = benefit.getNextResetDate 
                    ? benefit.getNextResetDate(this.today)
                    : DateUtils.calculateNextResetDate(benefit, card, this.today);

                if (next > this.today && next <= limitDate) {
                    const item = {cardName: card.name, benefit: benefit, remainingAmount: rem, nextResetDate: next};
                    if (rem <= 0) {
                        expiringFullyUsed.push(item);
                    } else if (this.isIgnoredActive(benefit)) {
                        expiringIgnored.push(item);
                    } else {
                        expiringActive.push(item);
                    }
                }
            });
        });

        const sortFn = (a, b) => b.remainingAmount - a.remainingAmount;
        expiringActive.sort(sortFn);
        expiringIgnored.sort(sortFn);
        expiringFullyUsed.sort((a, b) => a.nextResetDate - b.nextResetDate);
        pendingMinSpends.sort((a, b) => a.deadline - b.deadline);
        const filteredActive = this.filterExpiringItems(expiringActive);
        const filteredIgnored = this.filterExpiringItems(expiringIgnored);
        const filteredFullyUsed = this.filterExpiringItems(expiringFullyUsed);
        const filteredMinSpends = this.filterExpiringItems(pendingMinSpends);

        // 3. Render Expiring
        this.ui.renderExpiringSoon(filteredActive, filteredIgnored, filteredFullyUsed, filteredMinSpends, this.expiringDays, mainWidgetOpen, ignoredSectionOpen, fullyUsedSectionOpen, minSpendSectionOpen);

        // 4. Render Cards
        this.cardListContainer.innerHTML = '';
        if (this.cards.length === 0) this.cardListContainer.innerHTML = '<p>No cards added yet.</p>';

        this.cards.forEach(card => {
            // Use Card method if available
            const allUsed = card.isAllBenefitsUsed 
                ? card.isAllBenefitsUsed(this.today)
                : (card.benefits.length > 0 && card.benefits.every(b => (b.totalAmount - b.usedAmount) <= 0));
            let isCardCollapsed = allUsed;
            if (cardState.has(card.id)) {
                isCardCollapsed = cardState.get(card.id);
            }

            const cardEl = this.ui.createCardElement(card, isCardCollapsed, this.collapseSections);
            const benefitList = cardEl.querySelector('.benefit-list');
            benefitList.innerHTML = '';

            if (card.benefits.length > 0) {
                if (this.collapseSections) {
                    // Group benefits into sections
                    const activeBenefits = [];
                    const ignoredBenefits = [];
                    const fullyUsedBenefits = [];
                    
                    card.benefits.forEach(benefit => {
                        const isUsed = benefit.isFullyUsed 
                            ? benefit.isFullyUsed(this.today)
                            : (benefit.totalAmount - benefit.usedAmount) <= 0;
                        const isIgnored = this.isIgnoredActive(benefit);
                        
                        if (isIgnored) {
                            ignoredBenefits.push(benefit);
                        } else if (isUsed) {
                            fullyUsedBenefits.push(benefit);
                        } else {
                            activeBenefits.push(benefit);
                        }
                    });
                    
                    // Render active benefits directly in the list
                    activeBenefits.forEach(benefit => {
                        let isBenefitCollapsed = false;
                        if (benefitState.has(benefit.id)) {
                            isBenefitCollapsed = benefitState.get(benefit.id);
                        }
                        benefitList.appendChild(this.ui.createBenefitElement(benefit, card, isBenefitCollapsed, false));
                    });
                    
                    // Create ignored section if there are ignored benefits
                    if (ignoredBenefits.length > 0) {
                        const ignoredSection = document.createElement('details');
                        ignoredSection.className = 'benefit-subsection card-ignored-section';
                        if (cardIgnoredSectionState.has(card.id) && cardIgnoredSectionState.get(card.id)) {
                            ignoredSection.setAttribute('open', 'true');
                        }
                        
                        const summary = document.createElement('summary');
                        summary.textContent = `🚫 Ignored Benefits (${ignoredBenefits.length})`;
                        ignoredSection.appendChild(summary);
                        
                        const sectionList = document.createElement('ul');
                        sectionList.className = 'benefit-list';
                        ignoredBenefits.forEach(benefit => {
                            // Don't allow per-item collapse within sections
                            sectionList.appendChild(this.ui.createBenefitElement(benefit, card, false, true));
                        });
                        ignoredSection.appendChild(sectionList);
                        
                        const sectionWrapper = document.createElement('li');
                        sectionWrapper.style.listStyle = 'none';
                        sectionWrapper.appendChild(ignoredSection);
                        benefitList.appendChild(sectionWrapper);
                    }
                    
                    // Create fully used section if there are fully used benefits
                    if (fullyUsedBenefits.length > 0) {
                        const fullyUsedSection = document.createElement('details');
                        fullyUsedSection.className = 'benefit-subsection card-fully-used-section';
                        if (cardFullyUsedSectionState.has(card.id) && cardFullyUsedSectionState.get(card.id)) {
                            fullyUsedSection.setAttribute('open', 'true');
                        }
                        
                        const summary = document.createElement('summary');
                        summary.textContent = `✅ Fully Utilized (${fullyUsedBenefits.length})`;
                        fullyUsedSection.appendChild(summary);
                        
                        const sectionList = document.createElement('ul');
                        sectionList.className = 'benefit-list';
                        fullyUsedBenefits.forEach(benefit => {
                            // Don't allow per-item collapse within sections
                            sectionList.appendChild(this.ui.createBenefitElement(benefit, card, false, true));
                        });
                        fullyUsedSection.appendChild(sectionList);
                        
                        const sectionWrapper = document.createElement('li');
                        sectionWrapper.style.listStyle = 'none';
                        sectionWrapper.appendChild(fullyUsedSection);
                        benefitList.appendChild(sectionWrapper);
                    }
                } else {
                    // Original behavior - render all benefits with individual collapse
                    card.benefits.forEach(benefit => {
                        // Use Benefit method if available
                        const isUsed = benefit.isFullyUsed 
                            ? benefit.isFullyUsed(this.today)
                            : (benefit.totalAmount - benefit.usedAmount) <= 0;
                        const isIgnored = this.isIgnoredActive(benefit);
                        let isBenefitCollapsed = isUsed || isIgnored;

                        if (benefitState.has(benefit.id)) {
                            isBenefitCollapsed = benefitState.get(benefit.id);
                        }

                        benefitList.appendChild(this.ui.createBenefitElement(benefit, card, isBenefitCollapsed, false));
                    });
                }
            } else {
                benefitList.innerHTML = '<li>No benefits added for this card yet.</li>';
            }
            this.cardListContainer.appendChild(cardEl);
        });

        this.initSortables();
    }

    // ... (Handlers same as before) ...
    handleAddCard(e) {
        e.preventDefault();
        const name = this.newCardNameInput.value.trim();
        const date = this.newCardAnniversaryInput.value;
        if (!name || !date) return;
        
        // Create a new Card instance
        const newCard = new Card({
            id: `card-${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            anniversaryDate: date,
            benefits: []
        });
        this.cards.push(newCard);
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
            const benefitData = {
                id: `benefit-${Math.random().toString(36).substr(2, 9)}`,
                ...data,
                usedAmount: 0,
                lastReset: this.today.toISOString()
            };
            
            // Handle carryover benefits
            if (benefitData.isCarryover) {
                benefitData.earnedInstances = []; // Use new array format
                benefitData.lastEarnReset = CarryoverCycle.getResetDate(this.today).toISOString();
            }
            
            // Use Card.addBenefit if available
            let newBenefit;
            if (card.addBenefit) {
                newBenefit = card.addBenefit(benefitData);
            } else {
                newBenefit = Benefit.fromJSON(benefitData, card.anniversaryDate);
                card.benefits.push(newBenefit);
            }
            
            if (this.isAutoClaimActive(newBenefit)) {
                newBenefit.usedAmount = newBenefit.totalAmount;
            }
            if (newBenefit.autoClaim && newBenefit.ignored) {
                newBenefit.ignored = false;
                newBenefit.ignoredEndDate = null;
            }
            this.saveState();
            this.render();
        }
    }

    handleUpdateBenefitUsage(bId, val) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(bId) : c.benefits.find(ben => ben.id === bId);
            if (b) {
                // Use Benefit method if available
                if (b.setUsedAmount) {
                    b.setUsedAmount(val);
                } else {
                    if (isNaN(val) || val < 0) val = 0;
                    if (val > b.totalAmount) val = b.totalAmount;
                    b.usedAmount = val;
                }
                this.saveState();
                // Note: render() re-inits sortables, which is fine.
                this.render();
                return;
            }
        }
    }

    /**
     * Updates the usage for a specific carryover earned instance.
     * @param {string} bId - The benefit ID
     * @param {number} instanceIndex - The index of the earned instance
     * @param {number} val - The new used amount value
     */
    handleUpdateCarryoverInstanceUsage(bId, instanceIndex, val) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(bId) : c.benefits.find(ben => ben.id === bId);
            if (b && this._isCarryoverBenefit(b) && b.earnedInstances && b.earnedInstances[instanceIndex]) {
                // Use Benefit method if available
                if (b.setCarryoverInstanceUsage) {
                    b.setCarryoverInstanceUsage(instanceIndex, val);
                } else {
                    if (isNaN(val) || val < 0) val = 0;
                    if (val > b.totalAmount) val = b.totalAmount;
                    b.earnedInstances[instanceIndex].usedAmount = val;
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    handleDeleteBenefit(bId) {
        if (!confirm('Delete benefit?')) return;
        for (const c of this.cards) {
            // Use Card method if available
            if (c.removeBenefit) {
                if (c.removeBenefit(bId)) {
                    this.saveState();
                    this.render();
                    return;
                }
            } else {
                const idx = c.benefits.findIndex(ben => ben.id === bId);
                if (idx > -1) {
                    c.benefits.splice(idx, 1);
                    this.saveState();
                    this.render();
                    return;
                }
            }
        }
    }

    handleUpdateCard(id, name, date) {
        const c = this.cards.find(card => card.id === id);
        if (c) {
            // Use Card method if available
            if (c.update) {
                c.update(name, date);
            } else {
                c.name = name;
                c.anniversaryDate = date;
            }
            this.saveState();
        }
        this.render();
    }

    handleUpdateBenefit(bId, data) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(bId) : c.benefits.find(ben => ben.id === bId);
            if (b) {
                // Use Benefit method if available
                if (b.update) {
                    b.update(data);
                } else {
                    Object.assign(b, data);
                }
                if (b.autoClaim && b.ignored) {
                    b.ignored = false;
                    b.ignoredEndDate = null;
                }
                if (this.isAutoClaimActive(b)) {
                    b.usedAmount = b.totalAmount;
                } else if (b.usedAmount > b.totalAmount) {
                    b.usedAmount = b.totalAmount;
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    // ==================== MINIMUM SPEND HANDLERS ====================

    /**
     * Adds a new minimum spend to a card.
     * @param {string} cardId - The card ID
     * @param {Object} data - The minimum spend data
     */
    handleAddMinimumSpend(cardId, data) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            const minSpendData = {
                id: `minspend-${Math.random().toString(36).substr(2, 9)}`,
                ...data,
                currentAmount: data.currentAmount || 0,
                isMet: false,
                metDate: null,
                lastReset: this.today.toISOString()
            };
            
            if (card.addMinimumSpend) {
                card.addMinimumSpend(minSpendData);
            } else {
                const minSpend = MinimumSpend.fromJSON(minSpendData, card.anniversaryDate);
                if (!card.minimumSpends) card.minimumSpends = [];
                card.minimumSpends.push(minSpend);
            }
            
            this.saveState();
            this.render();
        }
    }

    /**
     * Deletes a minimum spend.
     * @param {string} minSpendId - The minimum spend ID
     */
    handleDeleteMinimumSpend(minSpendId) {
        if (!confirm('Delete minimum spend? Any linked benefits will be unlinked.')) return;
        for (const c of this.cards) {
            if (c.removeMinimumSpend) {
                if (c.removeMinimumSpend(minSpendId)) {
                    this.saveState();
                    this.render();
                    return;
                }
            } else if (c.minimumSpends) {
                const idx = c.minimumSpends.findIndex(ms => ms.id === minSpendId);
                if (idx > -1) {
                    c.minimumSpends.splice(idx, 1);
                    // Clear references from benefits
                    c.benefits.forEach(benefit => {
                        if (benefit.requiredMinimumSpendId === minSpendId) {
                            benefit.requiredMinimumSpendId = null;
                        }
                    });
                    this.saveState();
                    this.render();
                    return;
                }
            }
        }
    }

    /**
     * Updates the current spend amount for a minimum spend.
     * When a minimum spend is met, any linked carryover benefits will earn an instance.
     * @param {string} minSpendId - The minimum spend ID
     * @param {number} val - The new current amount
     */
    handleUpdateMinimumSpendProgress(minSpendId, val) {
        for (const c of this.cards) {
            const ms = c.findMinimumSpend ? c.findMinimumSpend(minSpendId) : 
                (c.minimumSpends || []).find(m => m.id === minSpendId);
            if (ms) {
                const wasMetBefore = ms.isMet;
                
                if (ms.setCurrentAmount) {
                    ms.setCurrentAmount(val, this.today);
                } else {
                    if (isNaN(val) || val < 0) val = 0;
                    ms.currentAmount = val;
                    if (ms.currentAmount >= ms.targetAmount && !ms.isMet) {
                        ms.isMet = true;
                        ms.metDate = this.today.toISOString();
                    } else if (ms.currentAmount < ms.targetAmount && ms.isMet) {
                        ms.isMet = false;
                        ms.metDate = null;
                    }
                }
                
                // If minimum spend just became met, check for linked carryover benefits
                if (!wasMetBefore && ms.isMet) {
                    c.benefits.forEach(benefit => {
                        if (benefit.requiredMinimumSpendId === minSpendId && 
                            this._isCarryoverBenefit(benefit) &&
                            this.canEarnCarryoverThisYear(benefit)) {
                            // Earn a new carryover instance
                            if (!benefit.earnedInstances) {
                                benefit.earnedInstances = [];
                            }
                            benefit.earnedInstances.push({
                                earnedDate: this.today.toISOString(),
                                usedAmount: 0
                            });
                        }
                    });
                }
                
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Updates minimum spend properties.
     * @param {string} minSpendId - The minimum spend ID
     * @param {Object} data - The new data
     */
    handleUpdateMinimumSpend(minSpendId, data) {
        for (const c of this.cards) {
            const ms = c.findMinimumSpend ? c.findMinimumSpend(minSpendId) : 
                (c.minimumSpends || []).find(m => m.id === minSpendId);
            if (ms) {
                if (ms.update) {
                    ms.update(data);
                } else {
                    Object.assign(ms, data);
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Links a benefit to a minimum spend requirement.
     * @param {string} benefitId - The benefit ID
     * @param {string|null} minSpendId - The minimum spend ID to link (or null to unlink)
     */
    handleLinkBenefitToMinimumSpend(benefitId, minSpendId) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b) {
                b.requiredMinimumSpendId = minSpendId || null;
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Gets all minimum spends for a specific card.
     * @param {string} cardId - The card ID
     * @returns {Array<MinimumSpend>}
     */
    getMinimumSpendsForCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return [];
        return card.minimumSpends || [];
    }

    /**
     * Finds a minimum spend by ID across all cards.
     * @param {string} minSpendId - The minimum spend ID
     * @returns {MinimumSpend|null}
     */
    findMinimumSpend(minSpendId) {
        for (const c of this.cards) {
            const ms = c.findMinimumSpend ? c.findMinimumSpend(minSpendId) : 
                (c.minimumSpends || []).find(m => m.id === minSpendId);
            if (ms) return ms;
        }
        return null;
    }

    /**
     * Checks if a minimum spend is ignored.
     * @param {MinimumSpend|Object} minSpend - The minimum spend
     * @returns {boolean}
     */
    isMinimumSpendIgnored(minSpend) {
        if (minSpend instanceof MinimumSpend) {
            return minSpend.isIgnoredActive(this.today);
        }
        // Fallback for plain objects
        if (minSpend.frequency === 'one-time') return false;
        if (minSpend.ignored !== true) return false;
        if (!minSpend.ignoredEndDate) return false;
        const endDate = new Date(minSpend.ignoredEndDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= this.today;
    }

    /**
     * Checks if a benefit is locked by an unmet minimum spend.
     * @param {Benefit|Object} benefit - The benefit
     * @returns {boolean}
     */
    isBenefitLockedByMinimumSpend(benefit) {
        const minSpendId = benefit.requiredMinimumSpendId;
        if (!minSpendId) return false;
        
        const minSpend = this.findMinimumSpend(minSpendId);
        if (!minSpend) return false;
        
        return !minSpend.isMet;
    }

    /**
     * Gets the minimum spend that locks a benefit, if any.
     * @param {Benefit|Object} benefit - The benefit
     * @returns {MinimumSpend|null}
     */
    getLockedByMinimumSpend(benefit) {
        const minSpendId = benefit.requiredMinimumSpendId;
        if (!minSpendId) return null;
        
        return this.findMinimumSpend(minSpendId);
    }

    async handleConnectCloud() {
        const url = this.s3UrlInput.value.trim();
        const interval = parseInt(this.pollIntervalInput.value) || 800;
        if (!url) return;
        const tempStore = new CloudStore(url);
        this.settingsSaveBtn.textContent = 'Testing...';
        this.settingsSaveBtn.disabled = true;
        this.toggleLoading(true);
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
            this.toggleLoading(false);
        }
    }

    handleSwitchToLocal() {
        if (confirm('Switch to Local Storage? Cloud URL will be cleared.')) {
            localStorage.removeItem('creditCardBenefitTracker_config');
            location.reload();
        }
    }

    /**
     * Sets the current date based on a date string value.
     * @param {string|null} dateValue - ISO date string (e.g., '2025-06-15') or null for real date
     */
    setCurrentDate(dateValue) {
        if (dateValue) {
            this.today = new Date(dateValue);
            // Adjust for timezone offset to get the correct local date
            this.today.setMinutes(this.today.getMinutes() + this.today.getTimezoneOffset());
        } else {
            this.today = new Date();
        }
        this.today.setHours(0, 0, 0, 0);
    }

    /**
     * Checks for benefit resets and renders the UI.
     * Shows reset modal if there are pending resets.
     */
    refreshBenefitsAndRender() {
        this.pendingResets = this.checkAndResetBenefits();
        if (this.pendingResets.length > 0) {
            this.showResetModal(this.pendingResets);
        } else {
            this.render();
        }
    }

    handleCustomDateChange(e) {
        const dateValue = e.target.value;
        if (dateValue) {
            localStorage.setItem('creditCardBenefitTracker_customDate', dateValue);
        } else {
            localStorage.removeItem('creditCardBenefitTracker_customDate');
        }
        this.setCurrentDate(dateValue);
        this.refreshBenefitsAndRender();
    }

    handleClearCustomDate() {
        this.customDateInput.value = '';
        localStorage.removeItem('creditCardBenefitTracker_customDate');
        this.setCurrentDate(null);
        this.refreshBenefitsAndRender();
    }
    
    handleCollapseSectionsChange(e) {
        this.collapseSections = e.target.checked;
        localStorage.setItem('creditCardBenefitTracker_collapseSections', this.collapseSections);
        this.render();
    }
    
    handleHideMonthlyExpiringChange(e) {
        this.hideMonthlyExpiring = e.target.checked;
        localStorage.setItem('creditCardBenefitTracker_hideMonthlyExpiring', this.hideMonthlyExpiring);
        this.render();
    }

    // ==================== USAGE JUSTIFICATION HANDLERS ====================

    /**
     * Adds a usage justification to a benefit.
     * @param {string} benefitId - The benefit ID
     * @param {number} amount - The amount justified
     * @param {string} justification - The justification text
     * @param {string|null} reminderDate - Optional reminder date
     * @param {string|null} chargeDate - Optional charge date
     */
    handleAddJustification(benefitId, amount, justification, reminderDate = null, chargeDate = null) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b) {
                if (b.addUsageJustification) {
                    b.addUsageJustification(amount, justification, reminderDate, chargeDate);
                } else {
                    // Fallback for plain objects
                    if (!b.usageJustifications) b.usageJustifications = [];
                    b.usageJustifications.push({
                        id: `just-${Math.random().toString(36).substr(2, 9)}`,
                        amount: amount,
                        justification: justification,
                        reminderDate: reminderDate,
                        chargeDate: chargeDate,
                        confirmed: false
                    });
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Removes a usage justification from a benefit.
     * @param {string} benefitId - The benefit ID
     * @param {string} justificationId - The justification ID
     */
    handleRemoveJustification(benefitId, justificationId) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b) {
                if (b.removeUsageJustification) {
                    b.removeUsageJustification(justificationId);
                } else {
                    // Fallback for plain objects
                    if (b.usageJustifications) {
                        const idx = b.usageJustifications.findIndex(j => j.id === justificationId);
                        if (idx > -1) b.usageJustifications.splice(idx, 1);
                    }
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Updates a usage justification.
     * @param {string} benefitId - The benefit ID
     * @param {string} justificationId - The justification ID
     * @param {Object} updates - Fields to update
     */
    handleUpdateJustification(benefitId, justificationId, updates) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b) {
                if (b.updateUsageJustification) {
                    b.updateUsageJustification(justificationId, updates);
                } else {
                    // Fallback for plain objects
                    if (b.usageJustifications) {
                        const j = b.usageJustifications.find(just => just.id === justificationId);
                        if (j) Object.assign(j, updates);
                    }
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Confirms a justification (marks it as confirmed).
     * @param {string} benefitId - The benefit ID
     * @param {string} justificationId - The justification ID
     */
    handleConfirmJustification(benefitId, justificationId) {
        this.handleUpdateJustification(benefitId, justificationId, { confirmed: true });
    }

    /**
     * Adds a usage justification to a carryover instance.
     * @param {string} benefitId - The benefit ID
     * @param {number} instanceIndex - The carryover instance index
     * @param {number} amount - The amount justified
     * @param {string} justification - The justification text
     * @param {string|null} reminderDate - Optional reminder date
     * @param {string|null} chargeDate - Optional charge date
     */
    handleAddCarryoverJustification(benefitId, instanceIndex, amount, justification, reminderDate = null, chargeDate = null) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b && this._isCarryoverBenefit(b)) {
                if (b.addCarryoverInstanceJustification) {
                    b.addCarryoverInstanceJustification(instanceIndex, amount, justification, reminderDate, chargeDate);
                } else {
                    // Fallback for plain objects
                    const instance = b.earnedInstances[instanceIndex];
                    if (instance) {
                        if (!instance.usageJustifications) instance.usageJustifications = [];
                        instance.usageJustifications.push({
                            id: `just-${Math.random().toString(36).substr(2, 9)}`,
                            amount: amount,
                            justification: justification,
                            reminderDate: reminderDate,
                            chargeDate: chargeDate,
                            confirmed: false
                        });
                    }
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Removes a usage justification from a carryover instance.
     * @param {string} benefitId - The benefit ID
     * @param {number} instanceIndex - The carryover instance index
     * @param {string} justificationId - The justification ID
     */
    handleRemoveCarryoverJustification(benefitId, instanceIndex, justificationId) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b && this._isCarryoverBenefit(b)) {
                if (b.removeCarryoverInstanceJustification) {
                    b.removeCarryoverInstanceJustification(instanceIndex, justificationId);
                } else {
                    // Fallback for plain objects
                    const instance = b.earnedInstances[instanceIndex];
                    if (instance && instance.usageJustifications) {
                        const idx = instance.usageJustifications.findIndex(j => j.id === justificationId);
                        if (idx > -1) instance.usageJustifications.splice(idx, 1);
                    }
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Updates a usage justification in a carryover instance.
     * @param {string} benefitId - The benefit ID
     * @param {number} instanceIndex - The carryover instance index
     * @param {string} justificationId - The justification ID
     * @param {Object} updates - Fields to update
     */
    handleUpdateCarryoverJustification(benefitId, instanceIndex, justificationId, updates) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b && this._isCarryoverBenefit(b)) {
                if (b.updateCarryoverInstanceJustification) {
                    b.updateCarryoverInstanceJustification(instanceIndex, justificationId, updates);
                } else {
                    // Fallback for plain objects
                    const instance = b.earnedInstances[instanceIndex];
                    if (instance && instance.usageJustifications) {
                        const j = instance.usageJustifications.find(just => just.id === justificationId);
                        if (j) Object.assign(j, updates);
                    }
                }
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Confirms a carryover justification (marks it as confirmed).
     * @param {string} benefitId - The benefit ID
     * @param {number} instanceIndex - The carryover instance index
     * @param {string} justificationId - The justification ID
     */
    handleConfirmCarryoverJustification(benefitId, instanceIndex, justificationId) {
        this.handleUpdateCarryoverJustification(benefitId, instanceIndex, justificationId, { confirmed: true });
    }

    /**
     * Adds a usage entry - increments used amount and creates a justification simultaneously.
     * @param {string} benefitId - The benefit ID
     * @param {number} amount - The amount to add
     * @param {string} justification - The justification text
     * @param {string|null} reminderDate - Optional reminder date
     * @param {string|null} chargeDate - Optional charge date
     */
    handleAddUsageEntry(benefitId, amount, justification, reminderDate = null, chargeDate = null) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b) {
                // Increment used amount
                const newUsed = (b.usedAmount || 0) + amount;
                if (b.setUsedAmount) {
                    b.setUsedAmount(newUsed);
                } else {
                    const clamped = Math.max(0, Math.min(newUsed, b.totalAmount));
                    b.usedAmount = clamped;
                }
                
                // Add justification
                if (b.addUsageJustification) {
                    b.addUsageJustification(amount, justification, reminderDate, chargeDate);
                } else {
                    if (!b.usageJustifications) b.usageJustifications = [];
                    b.usageJustifications.push({
                        id: `just-${Math.random().toString(36).substr(2, 9)}`,
                        amount: amount,
                        justification: justification,
                        reminderDate: reminderDate,
                        chargeDate: chargeDate,
                        confirmed: false
                    });
                }
                
                this.saveState();
                this.render();
                return;
            }
        }
    }

    /**
     * Adds a usage entry to a carryover instance - increments used amount and creates a justification.
     * @param {string} benefitId - The benefit ID
     * @param {number} instanceIndex - The carryover instance index
     * @param {number} amount - The amount to add
     * @param {string} justification - The justification text
     * @param {string|null} reminderDate - Optional reminder date
     * @param {string|null} chargeDate - Optional charge date
     */
    handleAddCarryoverUsageEntry(benefitId, instanceIndex, amount, justification, reminderDate = null, chargeDate = null) {
        for (const c of this.cards) {
            const b = c.findBenefit ? c.findBenefit(benefitId) : c.benefits.find(ben => ben.id === benefitId);
            if (b && this._isCarryoverBenefit(b)) {
                const instance = b.earnedInstances[instanceIndex];
                if (instance) {
                    // Increment used amount
                    const newUsed = (instance.usedAmount || 0) + amount;
                    const clamped = Math.max(0, Math.min(newUsed, b.totalAmount));
                    instance.usedAmount = clamped;
                    
                    // Add justification
                    if (!instance.usageJustifications) instance.usageJustifications = [];
                    instance.usageJustifications.push({
                        id: `just-${Math.random().toString(36).substr(2, 9)}`,
                        amount: amount,
                        justification: justification,
                        reminderDate: reminderDate,
                        chargeDate: chargeDate,
                        confirmed: false
                    });
                }
                
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
