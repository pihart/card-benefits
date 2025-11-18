/**
 * Main application logic.
 */

class BenefitTrackerApp {
    constructor(storage) {
        /** @type {StorageInterface} */
        this.storage = storage;

        /** @type {Array<Object>} */
        this.cards = [];
        this.today = new Date(); // Store today's date at init
        this.expiringDays = 30; // Default expiring days

        // DOM element references
        this.cardListContainer = document.getElementById('card-list-container');
        
        // --- UPDATED: Add Card Form references ---
        this.addCardFormContainer = document.querySelector('.card-form-container');
        this.addCardForm = document.getElementById('add-card-form');
        this.newCardNameInput = document.getElementById('new-card-name');
        this.newCardAnniversaryInput = document.getElementById('new-card-anniversary');
        this.showAddCardBtn = document.getElementById('show-add-card-btn');

        // Modal element references
        this.modal = document.getElementById('reset-modal');
        this.modalList = document.getElementById('modal-reset-list');
        this.modalOk = document.getElementById('modal-ok');
        this.modalCancel = document.getElementById('modal-cancel');

        // Expiring Soon references
        this.expiringSoonContainer = document.getElementById('expiring-soon-container');
        this.expiringSoonList = document.getElementById('expiring-soon-list');
        this.expiringDaysSelect = document.getElementById('expiring-days-select');

        // Bind event listeners
        this.addCardForm.addEventListener('submit', this.handleAddCard.bind(this));
        this.expiringDaysSelect.addEventListener('change', this.handleExpiringDaysChange.bind(this));
        
        // --- NEW: Bind listener for show add card button ---
        this.showAddCardBtn.addEventListener('click', () => {
            this.showAddCardBtn.style.display = 'none';
            this.addCardFormContainer.style.display = 'block';
        });
    }

    /**
     * Initializes the application.
     */
    async init() {
        this.today.setHours(0, 0, 0, 0); 
        this.expiringDays = parseInt(this.expiringDaysSelect.value, 10);
        
        // 1. Load data
        this.cards = await this.storage.loadData();
        
        // 2. Check for resets
        const pendingResets = this.checkAndResetBenefits();

        // 3. Handle resets if any
        if (pendingResets.length > 0) {
            this.showResetModal(pendingResets);
        } else {
            // 4. Render as normal if no resets
            this.render();
        }
    }

    /**
     * Saves the current state to the storage layer.
     */
    async saveState() {
        await this.storage.saveData(this.cards);
    }

    // --- Benefit Reset Logic ---

    /**
     * Checks all benefits and returns a list of benefits that need to be reset.
     */
    checkAndResetBenefits() {
        const pendingResets = [];

        this.cards.forEach(card => {
            card.benefits.forEach(benefit => {
                if (benefit.frequency === 'one-time') return;

                const nextResetDate = this.calculateNextResetDate(benefit, card);
                
                // If the next reset date is on or before today, it needs a reset.
                if (nextResetDate <= this.today) {
                    // Don't reset it yet! Just add it to the list.
                    pendingResets.push({
                        cardName: card.name,
                        benefit: benefit // Pass the *actual* benefit object
                    });
                }
            });
        });
        
        return pendingResets;
    }

    /**
     * Calculates the *next* date a benefit is scheduled to reset.
     * @param {Object} benefit - The benefit object (CONTAINS 'resetType')
     * @param {Object} card - The card object (for anniversary)
     * @returns {Date} The next reset date.
     */
    calculateNextResetDate(benefit, card) {
        const lastReset = new Date(benefit.lastReset);
        lastReset.setHours(0, 0, 0, 0); 
        
        const anniversary = new Date(card.anniversaryDate);
        anniversary.setMinutes(anniversary.getMinutes() + anniversary.getTimezoneOffset());
        anniversary.setHours(0, 0, 0, 0);

        let nextReset = new Date(lastReset.getTime());

        if (benefit.resetType === 'calendar') {
            // --- CALENDAR-BASED RESETS ---
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
                    if (lastReset.getMonth() < 6) { // Period 1 (Jan-June), reset to July
                        nextReset.setMonth(6); // July
                    } else { // Period 2 (July-Dec), reset to Jan
                        nextReset.setMonth(0); // January
                        nextReset.setFullYear(nextReset.getFullYear() + 1);
                    }
                    break;
                case 'annual':
                    nextReset.setDate(1);
                    nextReset.setMonth(0); // January
                    nextReset.setFullYear(nextReset.getFullYear() + 1);
                    break;
                case 'every-4-years':
                    nextReset.setDate(1);
                    nextReset.setMonth(0); // January
                    nextReset.setFullYear(lastReset.getFullYear() + 4);
                    break;
            }
        } else {
            // --- ANNIVERSARY-BASED RESETS ---
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
                         nextReset.setMonth(nextReset.getMonth() + 6); // Add 6 months
                    }
                    break;
                case 'annual':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    if (nextReset <= lastReset) {
                        nextReset.setFullYear(nextReset.getFullYear() + 1);
                    }
                    break;
                case 'every-4-years':
                    // This simply resets 4 years from the *last reset date*.
                    nextReset = new Date(lastReset.getFullYear() + 4, lastReset.getMonth(), lastReset.getDate());
                    break;
            }
        }
        
        while (nextReset <= this.today && nextReset <= lastReset) {
            const tempLastReset = new Date(nextReset.getTime());
            tempLastReset.setDate(tempLastReset.getDate() + 1);
            return this.calculateNextResetDate({ ...benefit, lastReset: tempLastReset.toISOString() }, card);
        }

        return nextReset;
    }

    // --- END: Benefit Reset Logic ---

    // --- Modal Functions ---
    
    /**
     * Populates and displays the reset modal.
     * @param {Array<Object>} pendingResets 
     */
    showResetModal(pendingResets) {
        // Clear previous list
        this.modalList.innerHTML = '';

        // Populate list
        pendingResets.forEach(reset => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${reset.cardName}:</strong> ${reset.benefit.description}`;
            this.modalList.appendChild(li);
        });

        // Add event listeners (use .onclick to overwrite old ones)
        this.modalOk.onclick = () => {
            this.applyResets(pendingResets);
        };
        
        this.modalCancel.onclick = () => {
            this.hideResetModal();
            this.render(); // Render the app *without* applying resets
        };

        // Show the modal
        this.modal.style.display = 'flex';
    }

    /**
     * Hides the reset modal.
     */
    hideResetModal() {
        this.modal.style.display = 'none';
    }

    /**
     * Applies the pending resets, saves state, and re-renders.
     * @param {Array<Object>} pendingResets 
     */
    async applyResets(pendingResets) {
        pendingResets.forEach(reset => {
            // 'reset.benefit' is a direct reference to the object in this.cards
            reset.benefit.usedAmount = 0;
            reset.benefit.lastReset = this.today.toISOString();
        });

        await this.saveState();
        this.hideResetModal();
        this.render(); // Re-render with the updated (reset) state
    }

    // --- END: Modal Functions ---

    // --- Expiring Soon Functions ---

    /**
     * Handles the user changing the "expiring soon" day count.
     */
    handleExpiringDaysChange(e) {
        this.expiringDays = parseInt(e.target.value, 10);
        this.renderExpiringSoon(); // Only re-render this section
    }

    /**
     * Finds, filters, and sorts all benefits that are expiring soon.
     * @returns {Array<Object>}
     */
    getExpiringBenefits() {
        const allExpiring = [];
        
        // Define the time limit
        const limitDate = new Date(this.today.getTime());
        limitDate.setDate(this.today.getDate() + this.expiringDays);

        this.cards.forEach(card => {
            card.benefits.forEach(benefit => {
                // Filter 1: Must be unused
                const remaining = benefit.totalAmount - benefit.usedAmount;
                if (remaining <= 0) return;

                // Filter 2: Must not be one-time
                if (benefit.frequency === 'one-time') return;
                
                // Filter 3: Must be expiring within the window
                const nextReset = this.calculateNextResetDate(benefit, card);
                
                // Must be *after* today AND *before or on* the limit date
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

        // Sort by remaining dollar amount, descending
        allExpiring.sort((a, b) => b.remainingAmount - a.remainingAmount);

        return allExpiring;
    }
    
    /**
     * Renders the "Expiring Soon" list.
     */
    renderExpiringSoon() {
        const expiring = this.getExpiringBenefits();
        
        // Always show the container
        this.expiringSoonContainer.style.display = 'block';

        // Clear the list
        this.expiringSoonList.innerHTML = '';

        if (expiring.length === 0) {
            // Show a "nothing found" message instead of hiding
            const li = document.createElement('li');
            li.className = 'expiring-item-empty'; // New class for styling
            li.textContent = `No unused benefits are expiring within ${this.expiringDays} days.`;
            this.expiringSoonList.appendChild(li);
            return; // Exit
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

    // --- END: Expiring Soon Functions ---


    /**
     * Re-draws the entire UI based on the current state.
     */
    render() {
        // Render the expiring soon list first
        this.renderExpiringSoon();

        this.cardListContainer.innerHTML = '';
        if (this.cards.length === 0) {
            this.cardListContainer.innerHTML = '<p>No cards added yet. Add one below to get started!</p>';
        }

        this.cards.forEach(card => {
            // Check if all benefits are used
            const allBenefitsUsed = card.benefits.length > 0 && 
                                    card.benefits.every(b => (b.totalAmount - b.usedAmount) <= 0);

            const cardEl = this.createCardElement(card, allBenefitsUsed);
            this.cardListContainer.appendChild(cardEl);
        });
    }

    /**
     * Creates the DOM element for a single card.
     * @param {Object} card
     * @param {boolean} allBenefitsUsed - Flag to set initial collapse state
     * @returns {HTMLElement}
     */
    createCardElement(card, allBenefitsUsed) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.cardId = card.id;

        if (allBenefitsUsed) {
            cardDiv.classList.add('card-collapsed');
        }

        // Card Header
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        
        cardHeader.onclick = (e) => {
            // Only toggle if clicking on the info part, not buttons or edit forms
            if (e.target.closest('.card-header-actions') || e.target.closest('.edit-form')) {
                return;
            }
            cardDiv.classList.toggle('card-collapsed');
        };
        cardHeader.style.cursor = 'pointer'; // Indicate it's clickable

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
        
        // --- Card Header Actions ---
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
        // --- End Card Header Actions ---

        // Card Body
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

        // --- "Add New Benefit" section ---
        const addBenefitContainer = document.createElement('div');
        addBenefitContainer.className = 'add-benefit-container';

        const showAddBenefitBtn = document.createElement('button');
        showAddBenefitBtn.className = 'secondary-btn show-add-benefit-btn';
        showAddBenefitBtn.textContent = 'Add New Benefit';
        
        const addBenefitForm = this.createAddBenefitForm(card.id);
        addBenefitForm.style.display = 'none'; // Hide form by default

        showAddBenefitBtn.onclick = () => {
            showAddBenefitBtn.style.display = 'none';
            addBenefitForm.style.display = 'flex'; // 'flex' is what forms use
        };

        addBenefitContainer.appendChild(showAddBenefitBtn);
        addBenefitContainer.appendChild(addBenefitForm);
        // --- End "Add New Benefit" section ---

        cardBody.appendChild(benefitList);
        cardBody.appendChild(addBenefitContainer);

        cardDiv.appendChild(cardHeader);
        cardDiv.appendChild(cardBody);

        return cardDiv;
    }

    /**
     * Creates the DOM element for a single benefit.
     * @param {Object} benefit
     * @param {Object} card - The parent card object
     * @returns {HTMLElement}
     */
    createBenefitElement(benefit, card) {
        const li = document.createElement('li');
        li.className = 'benefit-item';
        li.dataset.benefitId = benefit.id;

        const remaining = benefit.totalAmount - benefit.usedAmount;
        const progressPercent = (benefit.totalAmount > 0) ? (benefit.usedAmount / benefit.totalAmount) * 100 : 0;
        const isUsed = remaining <= 0;

        // Add 'benefit-used' class to collapse it
        if (isUsed) {
            li.classList.add('benefit-used');
        }

        // Top Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details';
        detailsDiv.style.cursor = 'pointer'; // Make it clickable
        detailsDiv.innerHTML = `
            <span class="description">${benefit.description}</span>
            <span class="status" style="color: ${isUsed ? 'var(--success)' : 'var(--danger)'}">
                $${remaining.toFixed(2)} remaining
            </span>
        `;
        
        // Click handler to toggle collapse
        detailsDiv.onclick = (e) => {
            // Don't toggle if clicking on an edit form
            if (e.target.closest('.edit-form')) return;
            li.classList.toggle('benefit-used');
        };
        
        // Metadata
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        let metaText = `($${benefit.usedAmount.toFixed(2)} / $${benefit.totalAmount.toFixed(2)}) - ${benefit.frequency} benefit`;
        if (benefit.frequency !== 'one-time') {
            metaText += ` | ${benefit.resetType}`;
        }
        metaDiv.textContent = metaText;
        
        // Progress Bar
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar';
        progressContainer.innerHTML = `<div class="progress-bar-inner" style="width: ${progressPercent}%; background-color: ${isUsed ? 'var(--success)' : 'var(--primary-color)'};"></div>`;
        
        // Next Reset Date
        const nextResetDiv = document.createElement('div');
        nextResetDiv.className = 'next-reset';
        if (benefit.frequency !== 'one-time') {
            const nextResetDate = this.calculateNextResetDate(benefit, card);
            nextResetDiv.textContent = `Resets on: ${nextResetDate.toLocaleDateString()}`;
        } else {
            nextResetDiv.textContent = `One-time benefit`;
        }

        // --- Controls ---
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
        
        // On click/focus, clear the field
        updateInput.onfocus = (e) => {
            e.target.value = '';
        };

        // On blur (clicking away)
        updateInput.onblur = (e) => {
            if (e.target.value === '') {
                // If the user clicked away without entering a new value,
                // restore the original value from the state.
                e.target.value = benefit.usedAmount.toFixed(2);
            }
        };
        
        // On change (this handles the actual update)
        updateInput.onchange = (e) => {
            const newValue = e.target.value;
            // If user enters "" and hits enter, it will be NaN after parseFloat.
            // handleUpdateBenefitUsage already checks for NaN, so we're safe.
            this.handleUpdateBenefitUsage(benefit.id, parseFloat(newValue));
        };

        // Right-aligned controls
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
        // --- End Controls ---

        li.appendChild(detailsDiv);
        li.appendChild(metaDiv);
        li.appendChild(progressContainer);
        li.appendChild(nextResetDiv);
        li.appendChild(controlsDiv);

        return li;
    }

    /**
     * Creates the form for adding a new benefit to a card.
     * @param {string} cardId
     * @returns {HTMLElement}
     */
    createAddBenefitForm(cardId) {
        const form = document.createElement('form');
        form.className = 'benefit-form';

        // Use unique IDs for labels/inputs
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

        // --- Add conditional logic for the resetType field ---
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
            
            // --- Reset form visibility ---
            form.style.display = 'none';
            // Find the "Show" button in this container and display it again
            const container = form.closest('.add-benefit-container');
            if (container) {
                container.querySelector('.show-add-benefit-btn').style.display = 'block';
            }
        };

        return form;
    }

    // --- Edit Form Rendering Functions ---

    /**
     * Replaces a card's display with an edit form.
     * @param {Object} card
     */
    renderCardEdit(card) {
        const cardEl = document.querySelector(`.card[data-card-id="${card.id}"]`);
        if (!cardEl) return;

        // Use 'edit-form' class to get styling
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

        // Replace the card element's content with the form
        cardEl.innerHTML = '';
        cardEl.appendChild(form);

        // Add event listeners
        document.getElementById(`save-edit-card-${card.id}`).onclick = () => {
            const newName = document.getElementById(nameId).value.trim();
            const newDate = document.getElementById(dateId).value;
            if (newName && newDate) {
                this.handleUpdateCard(card.id, newName, newDate);
            }
        };

        document.getElementById(`cancel-edit-card-${card.id}`).onclick = () => {
            this.render(); // Just re-render to cancel
        };
    }

    /**
     * Replaces a benefit's display with an edit form.
     * @param {Object} benefit
     * @param {Object} card
     */
    renderBenefitEdit(benefit, card) {
        const benefitEl = document.querySelector(`.benefit-item[data-benefit-id="${benefit.id}"]`);
        if (!benefitEl) return;

        const form = document.createElement('div');
        form.className = 'edit-form';
        form.style.marginBottom = '0'; // Override margin

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

        // Replace element content with form
        benefitEl.innerHTML = '';
        benefitEl.appendChild(form);

        // Add conditional logic for frequency/reset fields
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

        // Add save/cancel listeners
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
            this.render(); // Just re-render
        };
    }

    // --- Event Handlers ---

    /**
     * Handles the "Add Card" form submission. (UPDATED)
     */
    handleAddCard(e) {
        e.preventDefault();
        const cardName = this.newCardNameInput.value.trim();
        const anniversaryDate = this.newCardAnniversaryInput.value;

        if (!cardName || !anniversaryDate) return;

        const newCard = {
            id: `card-${crypto.randomUUID()}`,
            name: cardName,
            anniversaryDate: anniversaryDate, // String 'YYYY-MM-DD'
            benefits: [],
        };

        this.cards.push(newCard);
        this.saveState();
        this.render();
        
        // Reset form
        this.newCardNameInput.value = '';
        this.newCardAnniversaryInput.value = '';

        // --- NEW: Hide form and show button again ---
        this.addCardFormContainer.style.display = 'none';
        this.showAddCardBtn.style.display = 'block';
    }

    /**
     * Handles clicking the "Delete Card" button.
     */
    handleDeleteCard(cardId) {
        if (!confirm('Are you sure you want to delete this card and all its benefits?')) {
            return;
        }
        this.cards = this.cards.filter(card => card.id !== cardId);
        this.saveState();
        this.render();
    }

    /**
     * Handles the "Add Benefit" form submission.
     */
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

    /**
     * Handles changing the "used amount" for a benefit.
     */
    handleUpdateBenefitUsage(benefitId, newUsedAmount) {
        for (const card of this.cards) {
            const benefit = card.benefits.find(b => b.id === benefitId);
            if (benefit) {
                // Check for NaN, which happens on a blank "change" event
                if (isNaN(newUsedAmount) || newUsedAmount < 0) {
                    newUsedAmount = 0;
                } else if (newUsedAmount > benefit.totalAmount) {
                    newUsedAmount = benefit.totalAmount;
                }
                
                benefit.usedAmount = newUsedAmount;
                
                this.saveState();
                this.render(); 
                return;
            }
        }
    }

    /**
     * Handles clicking the "Delete" button for a benefit.
     */
    handleDeleteBenefit(benefitId) {
        if (!confirm('Are you sure you want to delete this benefit?')) {
            return;
        }
        
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

    // --- Update Handlers ---

    /**
     * Saves changes to an existing card.
     * @param {string} cardId
     * @param {string} newName
     * @param {string} newDate
     */
    handleUpdateCard(cardId, newName, newDate) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            card.name = newName;
            card.anniversaryDate = newDate;
            this.saveState();
        }
        this.render(); // Re-render the whole app
    }

    /**
     * Saves changes to an existing benefit.
     * @param {string} benefitId
     * @param {Object} newData
     */
    handleUpdateBenefit(benefitId, newData) {
        for (const card of this.cards) {
            const benefit = card.benefits.find(b => b.id === benefitId);
            if (benefit) {
                benefit.description = newData.description;
                benefit.totalAmount = newData.totalAmount;
                benefit.frequency = newData.frequency;
                benefit.resetType = newData.resetType;

                // If total amount was lowered, cap the used amount
                if (benefit.usedAmount > benefit.totalAmount) {
                    benefit.usedAmount = benefit.totalAmount;
                }
                
                this.saveState();
                this.render(); // Re-render the whole app
                return;
            }
        }
    }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new BenefitTrackerApp(new LocalStorageStore());
    app.init();
});
