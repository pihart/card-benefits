/**
 * Handles DOM manipulation and HTML generation.
 */
class UIRenderer {
    constructor(app) {
        this.app = app; // Reference to the main controller
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
     * Creates a progress bar that animates from the previous value to the new value.
     * @param {string} key - Unique key for the progress bar (e.g., benefit or minSpend id)
     * @param {number} targetPercent - The target width percentage
     * @param {string} color - The bar color
     * @returns {HTMLDivElement}
     */
    _createProgressBar(key, targetPercent, color) {
        const container = document.createElement('div');
        container.className = 'progress-bar';

        const bar = document.createElement('div');
        bar.className = 'progress-bar-inner';
        if (key) bar.dataset.progressKey = key;

        const lastState = this.app.lastProgressState;
        const prevVal = key && lastState?.has(key) ? parseFloat(lastState.get(key)) : NaN;
        const startWidth = isNaN(prevVal) ? 0 : prevVal;

        const clampedTarget = Math.max(0, Math.min(targetPercent, 100));
        bar.style.backgroundColor = color;
        bar.style.width = `${startWidth}%`;

        container.appendChild(bar);

        requestAnimationFrame(() => {
            if (bar.isConnected) {
                bar.style.width = `${clampedTarget}%`;
            }
        });

        return container;
    }

    // ... (renderExpiringSoon unchanged) ...
    renderExpiringSoon(activeItems, ignoredItems, fullyUsedItems, pendingMinSpends, days, mainOpen, isIgnoredOpen, isFullyUsedOpen, isMinSpendOpen) {
        const activeList = document.getElementById('expiring-active-list');
        const subsections = document.getElementById('expiring-subsections');

        activeList.textContent = "";
        subsections.textContent = "";

        const createItem = (item, isFull) => {
            const li = document.createElement('li');
            li.className = 'expiring-item';
            const benefitDesc = item.earnYear 
                ? `${item.benefit.description} (${item.earnYear})` 
                : item.benefit.description;
            // Check if carryover using helper
            const isCarryover = this._isCarryoverBenefit(item.benefit);
            const dateLabel = isCarryover ? 'Expires' : 'Resets';
            li.innerHTML = `
                <span class="expiring-item-amount" style="${isFull ? 'color:var(--success)' : ''}">
                    $${isFull ? item.benefit.totalAmount.toFixed(2) : item.remainingAmount.toFixed(2)}
                </span>
                <div class="expiring-item-details">
                    <div class="expiring-item-benefit">${benefitDesc}</div>
                    <div class="expiring-item-card">${item.cardName}</div>
                </div>
                <span class="expiring-item-date">${dateLabel}: ${item.nextResetDate.toLocaleDateString()}</span>
            `;
            return li;
        };

        const createMinSpendItem = (item) => {
            const li = document.createElement('li');
            li.className = 'expiring-item min-spend-item';
            const progressPercent = ((item.minSpend.currentAmount / item.minSpend.targetAmount) * 100).toFixed(0);
            li.innerHTML = `
                <span class="expiring-item-amount" style="color:var(--warning)">
                    $${item.remainingAmount.toFixed(2)}
                </span>
                <div class="expiring-item-details">
                    <div class="expiring-item-benefit">📋 ${item.minSpend.description}</div>
                    <div class="expiring-item-card">${item.cardName}</div>
                    <div class="expiring-item-progress">${progressPercent}% complete ($${item.minSpend.currentAmount.toFixed(2)} / $${item.minSpend.targetAmount.toFixed(2)})</div>
                </div>
                <span class="expiring-item-date">Due: ${item.deadline.toLocaleDateString()}</span>
            `;
            return li;
        };

        if (activeItems.length === 0) {
            const li = document.createElement('li');
            li.className = 'expiring-item-empty';
            li.textContent = "No active benefits expiring soon.";
            activeList.appendChild(li);
        } else {
            activeItems.forEach(item => activeList.appendChild(createItem(item, false)));
        }

        // Pending minimum spends section
        if (pendingMinSpends && pendingMinSpends.length > 0) {
            const details = document.createElement('details');
            details.className = 'expiring-subsection min-spend-section';
            if (isMinSpendOpen) details.setAttribute('open', 'true');

            const summary = document.createElement('summary');
            summary.textContent = `📋 Pending Min Spends (${pendingMinSpends.length})`;
            details.appendChild(summary);

            const list = document.createElement('ul');
            list.className = 'expiring-list';
            pendingMinSpends.forEach(item => list.appendChild(createMinSpendItem(item)));
            details.appendChild(list);
            subsections.appendChild(details);
        }

        if (ignoredItems.length > 0) {
            const details = document.createElement('details');
            details.className = 'expiring-subsection ignored-section';
            if (isIgnoredOpen) details.setAttribute('open', 'true');

            const summary = document.createElement('summary');
            summary.textContent = `Ignored Items (${ignoredItems.length})`;
            details.appendChild(summary);

            const list = document.createElement('ul');
            list.className = 'expiring-list';
            ignoredItems.forEach(item => list.appendChild(createItem(item, false)));
            details.appendChild(list);
            subsections.appendChild(details);
        }

        if (fullyUsedItems.length > 0) {
            const details = document.createElement('details');
            details.className = 'expiring-subsection fully-used-section';
            if (isFullyUsedOpen) details.setAttribute('open', 'true');

            const summary = document.createElement('summary');
            summary.textContent = `Fully Utilized (${fullyUsedItems.length})`;
            details.appendChild(summary);

            const list = document.createElement('ul');
            list.className = 'expiring-list';
            fullyUsedItems.forEach(item => list.appendChild(createItem(item, true)));
            details.appendChild(list);
            subsections.appendChild(details);
        }
    }

    createCardElement(card, isCollapsed, collapseSections = false) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.cardId = card.id;

        if (isCollapsed) {
            cardDiv.classList.add('card-collapsed');
        }

        // Header
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.style.cursor = 'pointer';
        cardHeader.onclick = (e) => {
            if (e.target.closest('.card-header-actions') || e.target.closest('.edit-form') || e.target.closest('.draggable-card-handle')) return;
            cardDiv.classList.toggle('card-collapsed');
        };

        // NEW: Drag Handle for Card
        const dragHandle = document.createElement('div');
        dragHandle.className = 'draggable-card-handle';
        dragHandle.style.cssText = "cursor: grab; margin-right: 10px; font-size: 1.2rem; color: #aaa;";
        dragHandle.innerHTML = '⋮⋮';

        const cardInfo = document.createElement('div');
        cardInfo.className = 'card-header-info';
        cardInfo.innerHTML = `<h3>${card.name}</h3>`;

        const cardMeta = document.createElement('div');
        cardMeta.className = 'card-meta';
        // Use Card method if available
        const anniversary = card.getAnniversaryDate 
            ? card.getAnniversaryDate() 
            : (() => {
                const d = new Date(card.anniversaryDate);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                return d;
              })();
        cardMeta.textContent = `Anniversary: ${anniversary.toLocaleDateString()}`;
        cardInfo.appendChild(cardMeta);

        cardHeader.appendChild(dragHandle); // Add handle
        cardHeader.appendChild(cardInfo);

        // Actions
        const cardActions = document.createElement('div');
        cardActions.className = 'card-header-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => this.renderCardEdit(card);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => this.app.handleDeleteCard(card.id);
        cardActions.appendChild(editBtn);
        cardActions.appendChild(deleteBtn);
        cardHeader.appendChild(cardActions);

        // Body
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        const benefitList = document.createElement('ul');
        benefitList.className = 'benefit-list';
        // Add data-card-id to UL for sortable identification
        benefitList.dataset.cardId = card.id;

        if (card.benefits.length > 0) {
            card.benefits.forEach(benefit => {
                benefitList.appendChild(this.createBenefitElement(benefit, card));
            });
        } else {
            // Add a dummy item if empty so we can still drag *into* it (optional, requires min-height on ul)
            benefitList.style.minHeight = '10px';
        }

        // Add Benefit Form
        const addBenefitContainer = document.createElement('div');
        addBenefitContainer.className = 'add-benefit-container';
        const showBtn = document.createElement('button');
        showBtn.className = 'secondary-btn show-add-benefit-btn';
        showBtn.textContent = 'Add New Benefit';

        const form = this.createAddBenefitForm(card.id);
        form.style.display = 'none';

        showBtn.onclick = () => {
            showBtn.style.display = 'none';
            form.style.display = 'flex';
        };

        addBenefitContainer.appendChild(showBtn);
        addBenefitContainer.appendChild(form);

        // Minimum Spends Section
        const minSpendSection = this.createMinimumSpendsSection(card);

        cardBody.appendChild(benefitList);
        cardBody.appendChild(addBenefitContainer);
        cardBody.appendChild(minSpendSection);
        cardDiv.appendChild(cardHeader);
        cardDiv.appendChild(cardBody);

        return cardDiv;
    }

    /**
     * Creates the minimum spends section for a card.
     * @param {Card} card - The card
     * @returns {HTMLElement}
     */
    createMinimumSpendsSection(card) {
        const section = document.createElement('div');
        section.className = 'min-spend-section-container';
        
        const minimumSpends = card.minimumSpends || [];
        
        // Header
        const header = document.createElement('div');
        header.className = 'min-spend-header';
        header.innerHTML = `<h4 style="margin: 0; font-size: 0.95rem;">📋 Minimum Spend Requirements (${minimumSpends.length})</h4>`;
        section.appendChild(header);

        // List of minimum spends
        if (minimumSpends.length > 0) {
            const list = document.createElement('ul');
            list.className = 'min-spend-list';
            minimumSpends.forEach(minSpend => {
                list.appendChild(this.createMinimumSpendElement(minSpend, card));
            });
            section.appendChild(list);
        }

        // Add Minimum Spend Form
        const addContainer = document.createElement('div');
        addContainer.className = 'add-min-spend-container';
        const showBtn = document.createElement('button');
        showBtn.className = 'secondary-btn show-add-min-spend-btn';
        showBtn.textContent = 'Add Minimum Spend';

        const form = this.createAddMinimumSpendForm(card.id);
        form.style.display = 'none';

        showBtn.onclick = () => {
            showBtn.style.display = 'none';
            form.style.display = 'flex';
        };

        addContainer.appendChild(showBtn);
        addContainer.appendChild(form);
        section.appendChild(addContainer);

        return section;
    }

    /**
     * Creates a minimum spend element.
     * @param {MinimumSpend} minSpend - The minimum spend
     * @param {Card} card - The parent card
     * @returns {HTMLElement}
     */
    createMinimumSpendElement(minSpend, card) {
        const li = document.createElement('li');
        li.className = 'min-spend-item';
        li.dataset.minSpendId = minSpend.id;

        const isMet = minSpend.isMet;
        const isIgnored = minSpend.isIgnoredActive ? minSpend.isIgnoredActive(this.app.today) : this.app.isMinimumSpendIgnored(minSpend);
        const progressPercent = minSpend.getProgressPercent ? minSpend.getProgressPercent() : 
            ((minSpend.currentAmount / minSpend.targetAmount) * 100);
        const remainingAmount = minSpend.getRemainingAmount ? minSpend.getRemainingAmount() :
            Math.max(minSpend.targetAmount - minSpend.currentAmount, 0);

        if (isMet) li.classList.add('min-spend-met');
        if (isIgnored) li.classList.add('min-spend-ignored');

        // Details section
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details';
        detailsDiv.style.cursor = 'pointer';

        // Title row
        let titleHtml = `<span class="description">${minSpend.description}</span>`;
        if (isMet) {
            titleHtml += `<span class="min-spend-badge min-spend-met-badge">✅ Met</span>`;
        }
        if (isIgnored) {
            titleHtml += `<span class="min-spend-badge min-spend-ignored-badge">🚫 Ignored</span>`;
        }

        // Get linked benefits
        const linkedBenefits = card.getBenefitsRequiringMinimumSpend 
            ? card.getBenefitsRequiringMinimumSpend(minSpend.id)
            : card.benefits.filter(b => b.requiredMinimumSpendId === minSpend.id);
        
        if (linkedBenefits.length > 0) {
            titleHtml += `<span class="min-spend-badge min-spend-linked-badge">🔗 ${linkedBenefits.length} benefit(s)</span>`;
        }

        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.gap = '8px';
        titleRow.innerHTML = titleHtml;
        detailsDiv.appendChild(titleRow);

        // Status
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status';
        if (isMet) {
            statusSpan.style.color = 'var(--success)';
            statusSpan.textContent = `Completed! $${minSpend.targetAmount.toFixed(2)} spent`;
        } else {
            statusSpan.style.color = 'var(--warning)';
            statusSpan.textContent = `$${remainingAmount.toFixed(2)} to go`;
        }
        detailsDiv.appendChild(statusSpan);

        detailsDiv.onclick = (e) => {
            if (e.target.closest('.edit-form')) return;
            if (e.target.closest('.smart-stepper-btn')) return;
            if (e.target.tagName === 'INPUT') return;
            li.classList.toggle('min-spend-collapsed');
        };

        // Meta
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        let metaText = `($${minSpend.currentAmount.toFixed(2)} / $${minSpend.targetAmount.toFixed(2)}) - ${minSpend.frequency}`;
        if (minSpend.frequency !== 'one-time') metaText += ` | ${minSpend.resetType}`;
        metaDiv.textContent = metaText;

        // Progress bar
        const barColor = isMet ? 'var(--success)' : 'var(--warning)';
        const progressContainer = this._createProgressBar(
            `minSpend:${minSpend.id}`,
            Math.min(progressPercent, 100),
            barColor
        );

        // Deadline
        const deadlineDiv = document.createElement('div');
        deadlineDiv.className = 'next-reset';
        const deadline = minSpend.getDeadline ? minSpend.getDeadline(this.app.today) : 
            (minSpend.deadline ? new Date(minSpend.deadline) : null);
        if (deadline) {
            deadlineDiv.textContent = isMet 
                ? `Met on: ${minSpend.metDate ? new Date(minSpend.metDate).toLocaleDateString() : 'N/A'}`
                : `Deadline: ${deadline.toLocaleDateString()}`;
        } else {
            deadlineDiv.textContent = minSpend.frequency === 'one-time' ? 'No deadline set' : `${minSpend.frequency} requirement`;
        }

        // Controls
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'benefit-controls';

        if (!isMet) {
            // Spend progress controls
            const updateLabel = document.createElement('label');
            updateLabel.textContent = 'Current spend: $';

            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'smart-input-wrapper';
            const decBtn = document.createElement('button');
            decBtn.className = 'smart-stepper-btn';
            decBtn.textContent = '−';
            decBtn.tabIndex = -1;
            const updateInput = document.createElement('input');
            updateInput.type = 'number';
            updateInput.value = minSpend.currentAmount.toFixed(2);
            updateInput.min = "0";
            updateInput.step = "0.01";
            const incBtn = document.createElement('button');
            incBtn.className = 'smart-stepper-btn';
            incBtn.textContent = '+';
            incBtn.tabIndex = -1;

            const getSmartStep = () => {
                if (minSpend.targetAmount >= 1000) return 50;
                if (minSpend.targetAmount >= 200) return 10;
                if (minSpend.targetAmount >= 10) return 1;
                return 0.01;
            };

            const handleSmartIncrement = (direction) => {
                const step = getSmartStep();
                let current = parseFloat(updateInput.value) || 0;
                let nextVal;
                if (direction === 'up') {
                    nextVal = (Math.floor(current / step) + 1) * step;
                } else {
                    if (current % step === 0) nextVal = current - step;
                    else nextVal = Math.ceil(current / step) * step - step;
                }
                if (nextVal < 0) nextVal = 0;
                nextVal = parseFloat(nextVal.toFixed(2));
                updateInput.value = nextVal.toFixed(2);
                this.app.handleUpdateMinimumSpendProgress(minSpend.id, nextVal);
            };

            decBtn.onclick = (e) => {
                e.stopPropagation();
                handleSmartIncrement('down');
            };
            incBtn.onclick = (e) => {
                e.stopPropagation();
                handleSmartIncrement('up');
            };
            updateInput.onfocus = (e) => e.target.select();
            updateInput.onblur = (e) => {
                if (e.target.value === '') e.target.value = minSpend.currentAmount.toFixed(2);
            };
            updateInput.onchange = (e) => {
                this.app.handleUpdateMinimumSpendProgress(minSpend.id, parseFloat(e.target.value));
            };

            inputWrapper.appendChild(decBtn);
            inputWrapper.appendChild(updateInput);
            inputWrapper.appendChild(incBtn);

            controlsDiv.appendChild(updateLabel);
            controlsDiv.appendChild(inputWrapper);
        }

        const rightControls = document.createElement('div');
        rightControls.className = 'controls-right';
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => this.renderMinimumSpendEdit(minSpend, card);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => this.app.handleDeleteMinimumSpend(minSpend.id);

        rightControls.appendChild(editBtn);
        rightControls.appendChild(deleteBtn);
        controlsDiv.appendChild(rightControls);

        li.appendChild(detailsDiv);
        li.appendChild(metaDiv);
        li.appendChild(progressContainer);
        li.appendChild(deadlineDiv);
        li.appendChild(controlsDiv);

        return li;
    }

    /**
     * Creates the add minimum spend form.
     * @param {string} cardId - The card ID
     * @returns {HTMLFormElement}
     */
    createAddMinimumSpendForm(cardId) {
        const form = document.createElement('form');
        form.className = 'benefit-form';
        const uId = Math.random().toString(36).substr(2, 9);

        form.innerHTML = `
            <h3 style="margin: 0; font-size: 1.1rem;">Add Minimum Spend Requirement</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" name="description" placeholder="E.g., $3,000 in first 3 months" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Target Amount</label>
                    <input type="number" name="targetAmount" placeholder="3000.00" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Frequency</label>
                    <select name="frequency" id="ms-freq-${uId}" required>
                        <option value="" disabled selected>Select...</option>
                        <option value="one-time">One-Time</option>
                        <option value="yearly">Yearly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" id="ms-reset-group-${uId}" style="display: none;">
                    <label>Reset Type</label>
                    <select name="resetType" id="ms-reset-${uId}">
                        <option value="calendar">Calendar</option>
                        <option value="anniversary">Anniversary-Dated</option>
                    </select>
                </div>
            </div>
            <div class="form-row" id="ms-deadline-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>Deadline</label>
                    <input type="date" name="deadline" id="ms-deadline-${uId}">
                    <small style="color: #666;">When must this minimum spend be met?</small>
                </div>
            </div>
            <!-- Ignore Inputs -->
            <div class="form-row" id="ms-ignore-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group" style="flex-direction:row; align-items:center; gap:10px; flex:0;">
                    <input type="checkbox" name="ignored" id="ms-ig-check-${uId}" style="width:auto;">
                    <label for="ms-ig-check-${uId}" style="margin:0; white-space:nowrap;">Ignore?</label>
                </div>
                <div class="form-group" id="ms-ig-date-group-${uId}" style="display:none;">
                    <label style="margin-bottom:2px;">Until Date</label>
                    <input type="date" name="ignoredEndDate">
                </div>
            </div>
            <button type="submit">Add Minimum Spend</button>
        `;

        const freqSelect = form.querySelector(`#ms-freq-${uId}`);
        const resetGroup = form.querySelector(`#ms-reset-group-${uId}`);
        const resetSelect = form.querySelector(`#ms-reset-${uId}`);
        const deadlineRow = form.querySelector(`#ms-deadline-row-${uId}`);
        const ignoreRow = form.querySelector(`#ms-ignore-row-${uId}`);
        const igCheck = form.querySelector(`#ms-ig-check-${uId}`);
        const igDateGroup = form.querySelector(`#ms-ig-date-group-${uId}`);

        freqSelect.onchange = (e) => {
            const isOneTime = e.target.value === 'one-time';
            if (isOneTime) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                deadlineRow.style.display = 'flex';
                ignoreRow.style.display = 'none';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                deadlineRow.style.display = 'none';
                ignoreRow.style.display = 'flex';
            }
        };

        igCheck.onchange = (e) => {
            igDateGroup.style.display = e.target.checked ? 'flex' : 'none';
            igDateGroup.querySelector('input').required = e.target.checked;
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const frequency = formData.get('frequency');
            
            const minSpendData = {
                description: formData.get('description'),
                targetAmount: parseFloat(formData.get('targetAmount')),
                frequency: frequency,
                resetType: frequency === 'one-time' ? null : formData.get('resetType'),
                deadline: frequency === 'one-time' ? (formData.get('deadline') || null) : null,
                ignored: formData.get('ignored') === 'on',
                ignoredEndDate: formData.get('ignoredEndDate') || null
            };
            this.app.handleAddMinimumSpend(cardId, minSpendData);
            e.target.reset();
            resetGroup.style.display = 'none';
            deadlineRow.style.display = 'none';
            ignoreRow.style.display = 'none';
            igDateGroup.style.display = 'none';
            form.style.display = 'none';
            form.previousElementSibling.style.display = 'block';
        };

        return form;
    }

    /**
     * Renders the edit form for a minimum spend.
     * @param {MinimumSpend} minSpend - The minimum spend
     * @param {Card} card - The parent card
     */
    renderMinimumSpendEdit(minSpend, card) {
        const minSpendEl = document.querySelector(`.min-spend-item[data-min-spend-id="${minSpend.id}"]`);
        if (!minSpendEl) return;

        const form = document.createElement('div');
        form.className = 'edit-form';
        form.style.marginBottom = '0';
        const uId = Math.random().toString(36).substr(2, 9);

        const isOneTime = minSpend.frequency === 'one-time';
        const isRecurring = !isOneTime;
        const hasIgnored = minSpend.ignored === true;

        form.innerHTML = `
            <h3 style="margin: 0; font-size: 1.1rem;">Editing: ${minSpend.description}</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="ms-desc-${uId}" value="${minSpend.description}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Target Amount</label>
                    <input type="number" id="ms-amt-${uId}" value="${minSpend.targetAmount.toFixed(2)}" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Frequency</label>
                    <select id="ms-freq-${uId}" required>
                        <option value="one-time" ${minSpend.frequency === 'one-time' ? 'selected' : ''}>One-Time</option>
                        <option value="yearly" ${minSpend.frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
                        <option value="quarterly" ${minSpend.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                        <option value="monthly" ${minSpend.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" id="ms-reset-group-${uId}" style="display: ${isRecurring ? 'block' : 'none'};">
                    <label>Reset Type</label>
                    <select id="ms-reset-${uId}" ${isRecurring ? 'required' : ''}>
                        <option value="calendar" ${minSpend.resetType === 'calendar' ? 'selected' : ''}>Calendar</option>
                        <option value="anniversary" ${minSpend.resetType === 'anniversary' ? 'selected' : ''}>Anniversary-Dated</option>
                    </select>
                </div>
            </div>
            <div class="form-row" id="ms-deadline-row-${uId}" style="display:${isOneTime ? 'flex' : 'none'}; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>Deadline</label>
                    <input type="date" id="ms-deadline-${uId}" value="${minSpend.deadline || ''}">
                </div>
            </div>
            <div class="form-row" id="ms-ignore-row-${uId}" style="display:${isRecurring ? 'flex' : 'none'}; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group" style="flex-direction:row; align-items:center; gap:10px; flex:0;">
                    <input type="checkbox" id="ms-ig-check-${uId}" style="width:auto;" ${hasIgnored ? 'checked' : ''}>
                    <label for="ms-ig-check-${uId}" style="margin:0;">Ignore?</label>
                </div>
                <div class="form-group" id="ms-ig-date-group-${uId}" style="display:${hasIgnored ? 'flex' : 'none'};">
                    <label style="margin-bottom:2px;">Until Date</label>
                    <input type="date" id="ms-ig-date-${uId}" value="${minSpend.ignoredEndDate || ''}" ${hasIgnored ? 'required' : ''}>
                </div>
            </div>
            <div class="form-row" style="justify-content: flex-end;">
                <button class="secondary-btn" id="ms-cancel-${uId}">Cancel</button>
                <button id="ms-save-${uId}">Save Changes</button>
            </div>
        `;

        minSpendEl.innerHTML = '';
        minSpendEl.appendChild(form);

        const freqSelect = document.getElementById(`ms-freq-${uId}`);
        const resetGroup = document.getElementById(`ms-reset-group-${uId}`);
        const resetSelect = document.getElementById(`ms-reset-${uId}`);
        const deadlineRow = document.getElementById(`ms-deadline-row-${uId}`);
        const deadlineInput = document.getElementById(`ms-deadline-${uId}`);
        const ignoreRow = document.getElementById(`ms-ignore-row-${uId}`);
        const igCheck = document.getElementById(`ms-ig-check-${uId}`);
        const igDateGroup = document.getElementById(`ms-ig-date-group-${uId}`);
        const igDateInput = document.getElementById(`ms-ig-date-${uId}`);

        freqSelect.onchange = (e) => {
            const isOneTimeSelected = e.target.value === 'one-time';
            if (isOneTimeSelected) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                deadlineRow.style.display = 'flex';
                ignoreRow.style.display = 'none';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                deadlineRow.style.display = 'none';
                ignoreRow.style.display = 'flex';
            }
        };

        igCheck.onchange = (e) => {
            igDateGroup.style.display = e.target.checked ? 'flex' : 'none';
            igDateInput.required = e.target.checked;
        };

        document.getElementById(`ms-save-${uId}`).onclick = () => {
            const frequency = freqSelect.value;
            const isOneTimeSelected = frequency === 'one-time';
            
            const newData = {
                description: document.getElementById(`ms-desc-${uId}`).value.trim(),
                targetAmount: parseFloat(document.getElementById(`ms-amt-${uId}`).value),
                frequency: frequency,
                resetType: isOneTimeSelected ? null : resetSelect.value,
                deadline: isOneTimeSelected ? (deadlineInput.value || null) : null,
                ignored: igCheck.checked,
                ignoredEndDate: igCheck.checked ? igDateInput.value : null
            };
            
            if (newData.description && newData.targetAmount) {
                this.app.handleUpdateMinimumSpend(minSpend.id, newData);
            }
        };

        document.getElementById(`ms-cancel-${uId}`).onclick = () => {
            this.app.render();
        };
    }

    createBenefitElement(benefit, card, isCollapsed, disablePerItemCollapse = false) {
        const li = document.createElement('li');
        li.className = 'benefit-item';
        li.dataset.benefitId = benefit.id;

        const isAutoClaimed = this.app.isAutoClaimActive(benefit);
        const isIgnored = this.app.isIgnoredActive(benefit);
        // Check carryover using helper
        const isCarryover = this._isCarryoverBenefit(benefit);
        
        // Check if benefit is locked by minimum spend
        const isLockedByMinSpend = this.app.isBenefitLockedByMinimumSpend(benefit);
        const lockedByMinSpend = isLockedByMinSpend ? this.app.getLockedByMinimumSpend(benefit) : null;
        
        // For carryover benefits, get active instances
        const activeInstances = isCarryover ? this.app.getActiveCarryoverInstances(benefit) : [];
        const hasEarnedInstances = activeInstances.length > 0;
        const canEarnThisYear = isCarryover ? this.app.canEarnCarryoverThisYear(benefit) : false;
        
        // Calculate total remaining for carryover
        let remaining, progressPercent, isUsed;
        if (isCarryover && hasEarnedInstances) {
            remaining = this.app.getTotalCarryoverRemaining(benefit);
            const totalCredit = activeInstances.length * benefit.totalAmount;
            const totalUsed = activeInstances.reduce((sum, inst) => sum + (inst.usedAmount || 0), 0);
            progressPercent = (totalCredit > 0) ? (totalUsed / totalCredit) * 100 : 0;
            isUsed = remaining <= 0;
        } else {
            // Use Benefit method if available
            remaining = benefit.getRemainingAmount 
                ? benefit.getRemainingAmount() 
                : benefit.totalAmount - benefit.usedAmount;
            progressPercent = (benefit.totalAmount > 0) ? (benefit.usedAmount / benefit.totalAmount) * 100 : 0;
            isUsed = remaining <= 0;
        }

        if (isCollapsed && !disablePerItemCollapse) li.classList.add('benefit-used');
        if (isIgnored) li.classList.add('benefit-ignored');
        if (isLockedByMinSpend) li.classList.add('benefit-locked');
        
        // Mark benefits in sections to disable per-item collapse
        if (disablePerItemCollapse) li.classList.add('benefit-in-section');

        // Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details';
        detailsDiv.style.cursor = 'pointer';

        // NEW: Drag Handle for Benefit
        const dragHandle = document.createElement('span');
        dragHandle.className = 'draggable-benefit-handle';
        dragHandle.style.cssText = "cursor: grab; margin-right: 8px; color: #bbb; font-size: 1.1rem;";
        dragHandle.innerHTML = '⋮⋮';

        let titleHtml = `<span class="description">${benefit.description}</span>`;
        if (isLockedByMinSpend) {
            titleHtml += `<span class="locked-badge">🔒 Locked</span>`;
        }
        if (isAutoClaimed) titleHtml += `<span class="auto-claim-badge">🔄 Auto-Claim</span>`;
        if (isIgnored) titleHtml += `<span class="ignored-badge">🚫 Ignored</span>`;
        if (isCarryover) {
            if (hasEarnedInstances) {
                const instanceCount = activeInstances.length;
                titleHtml += `<span class="carryover-badge carryover-earned">✅ ${instanceCount} Earned</span>`;
            }
            if (canEarnThisYear) {
                titleHtml += `<span class="carryover-badge carryover-pending">⏳ Earning</span>`;
            }
        }

        // Flex wrapper for title row
        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.appendChild(dragHandle); // Add handle

        // Need a span wrapper for title HTML to append it
        const titleTextWrapper = document.createElement('span');
        titleTextWrapper.innerHTML = titleHtml;
        titleRow.appendChild(titleTextWrapper);

        detailsDiv.appendChild(titleRow);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'status';
        
        if (isLockedByMinSpend) {
            // Show locked status
            statusSpan.style.color = 'var(--secondary-color)';
            const minSpendProgress = lockedByMinSpend.currentAmount || 0;
            const minSpendTarget = lockedByMinSpend.targetAmount || 0;
            statusSpan.textContent = `🔒 Requires: ${lockedByMinSpend.description} ($${minSpendProgress.toFixed(2)} / $${minSpendTarget.toFixed(2)})`;
        } else if (isCarryover) {
            if (hasEarnedInstances) {
                // Show total remaining across all instances
                statusSpan.style.color = isUsed ? 'var(--success)' : 'var(--danger)';
                statusSpan.textContent = `$${remaining.toFixed(2)} remaining`;
            } else if (canEarnThisYear) {
                // Carryover can earn - check for linked minimum spend
                if (benefit.requiredMinimumSpendId) {
                    // Has a linked minimum spend - show that the benefit will be earned when met
                    statusSpan.style.color = 'var(--warning)';
                    statusSpan.textContent = 'Pending minimum spend...';
                } else {
                    // No linked minimum spend - can't earn
                    statusSpan.style.color = 'var(--secondary-color)';
                    statusSpan.textContent = 'Link to minimum spend to earn';
                }
            } else {
                statusSpan.style.color = 'var(--secondary-color)';
                statusSpan.textContent = 'No active credits';
            }
        } else {
            // Normal remaining status
            statusSpan.style.color = isUsed ? 'var(--success)' : 'var(--danger)';
            statusSpan.textContent = `$${remaining.toFixed(2)} remaining`;
        }
        detailsDiv.appendChild(statusSpan);

        detailsDiv.onclick = (e) => {
            if (e.target.closest('.edit-form')) return;
            if (e.target.closest('.smart-stepper-btn')) return;
            if (e.target.closest('.draggable-benefit-handle')) return; // Don't toggle on handle click
            if (e.target.tagName === 'INPUT') return;
            // Don't allow per-item collapse within sections
            if (!disablePerItemCollapse) {
                li.classList.toggle('benefit-used');
            }
        };

        // Meta
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        let metaText;
        if (isLockedByMinSpend) {
            metaText = `Unlocked when minimum spend is met: ${lockedByMinSpend.description}`;
        } else if (isCarryover) {
            if (hasEarnedInstances) {
                const totalUsed = activeInstances.reduce((sum, inst) => sum + (inst.usedAmount || 0), 0);
                const totalCredit = activeInstances.length * benefit.totalAmount;
                metaText = `($${totalUsed.toFixed(2)} / $${totalCredit.toFixed(2)}) - ${activeInstances.length} carryover credit(s)`;
            } else if (canEarnThisYear) {
                if (benefit.requiredMinimumSpendId) {
                    metaText = `Carryover benefit - pending minimum spend requirement`;
                } else {
                    metaText = `Carryover benefit - link to minimum spend to earn $${benefit.totalAmount.toFixed(2)} credit`;
                }
            } else {
                metaText = `Carryover benefit - no active credits`;
            }
        } else {
            metaText = `($${benefit.usedAmount.toFixed(2)} / $${benefit.totalAmount.toFixed(2)}) - ${benefit.frequency} benefit`;
            if (benefit.frequency !== 'one-time') metaText += ` | ${benefit.resetType}`;
        }
        metaDiv.textContent = metaText;

        // Progress bar - show earn progress for earning carryover, usage progress otherwise
        const progressKey = `benefit:${benefit.id}`;
        let progressContainer;
        if (isLockedByMinSpend) {
            // Show minimum spend progress
            const minSpendProgress = lockedByMinSpend.currentAmount || 0;
            const minSpendTarget = lockedByMinSpend.targetAmount || 1;
            const minSpendPercent = Math.min((minSpendProgress / minSpendTarget) * 100, 100);
            progressContainer = this._createProgressBar(progressKey, minSpendPercent, 'var(--secondary-color)');
        } else if (isCarryover && canEarnThisYear && !hasEarnedInstances && benefit.requiredMinimumSpendId) {
            // Show linked minimum spend progress for carryover benefits
            const linkedMinSpend = this.app.findMinimumSpend(benefit.requiredMinimumSpendId);
            if (linkedMinSpend) {
                const minSpendProgress = linkedMinSpend.currentAmount || 0;
                const minSpendTarget = linkedMinSpend.targetAmount || 1;
                const minSpendPercent = Math.min((minSpendProgress / minSpendTarget) * 100, 100);
                progressContainer = this._createProgressBar(progressKey, minSpendPercent, 'var(--warning)');
            } else {
                progressContainer = this._createProgressBar(progressKey, 0, 'var(--primary-color)');
            }
        } else {
            // Normal usage progress bar
            progressContainer = this._createProgressBar(progressKey, progressPercent, isUsed ? 'var(--success)' : 'var(--primary-color)');
        }

        // Reset/Expiry Date section
        const nextResetDiv = document.createElement('div');
        nextResetDiv.className = 'next-reset';
        if (isCarryover) {
            let dateInfo = [];
            if (hasEarnedInstances) {
                // Show expiry info for each instance
                activeInstances.forEach((instance, index) => {
                    const expiryDate = CarryoverCycle.calculateExpiryDate(instance.earnedDate);
                    const earnYear = CarryoverCycle.getEarnYear(instance.earnedDate);
                    const instanceRemaining = benefit.totalAmount - (instance.usedAmount || 0);
                    dateInfo.push(`${earnYear} credit ($${instanceRemaining.toFixed(2)}): expires ${expiryDate.toLocaleDateString()}`);
                });
            }
            if (canEarnThisYear) {
                // Use Benefit method if available
                const earnDeadline = benefit.getCarryoverEarnDeadline 
                    ? benefit.getCarryoverEarnDeadline(this.app.today)
                    : DateUtils.calculateCarryoverEarnDeadline(benefit, this.app.today);
                dateInfo.push(`New credit: earn by ${earnDeadline.toLocaleDateString()}`);
            }
            nextResetDiv.innerHTML = dateInfo.join('<br>');
        } else {
            // Check if one-time using helper
            if (!this._isOneTimeBenefit(benefit)) {
                // Use Benefit method if available
                const nextResetDate = benefit.getNextResetDate 
                    ? benefit.getNextResetDate(this.app.today)
                    : DateUtils.calculateNextResetDate(benefit, card, this.app.today);
                nextResetDiv.textContent = `Resets on: ${nextResetDate.toLocaleDateString()}`;
            } else {
                if (benefit.expiryDate) {
                    const expiryDate = new Date(benefit.expiryDate);
                    expiryDate.setMinutes(expiryDate.getMinutes() + expiryDate.getTimezoneOffset());
                    nextResetDiv.textContent = `Expires on: ${expiryDate.toLocaleDateString()}`;
                } else {
                    nextResetDiv.textContent = `One-time benefit`;
                }
            }
        }

        // Controls - different for carryover vs regular
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'benefit-controls';
        
        // For carryover benefits, show instance usage controls (earn progress is now managed via MinimumSpend)
        if (isCarryover) {
            // Show usage controls for each earned instance
            if (hasEarnedInstances) {
                activeInstances.forEach((instance, index) => {
                    const earnYear = CarryoverCycle.getEarnYear(instance.earnedDate);
                    const instanceContainer = document.createElement('div');
                    instanceContainer.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 5px;';
                    
                    const usageLabel = document.createElement('label');
                    usageLabel.textContent = `${earnYear} used: $`;

                    const inputWrapper = document.createElement('div');
                    inputWrapper.className = 'smart-input-wrapper';
                    const decBtn = document.createElement('button');
                    decBtn.className = 'smart-stepper-btn';
                    decBtn.textContent = '−';
                    decBtn.tabIndex = -1;
                    const updateInput = document.createElement('input');
                    updateInput.type = 'number';
                    updateInput.value = (instance.usedAmount || 0).toFixed(2);
                    updateInput.min = "0";
                    updateInput.max = benefit.totalAmount;
                    updateInput.step = "0.01";
                    const incBtn = document.createElement('button');
                    incBtn.className = 'smart-stepper-btn';
                    incBtn.textContent = '+';
                    incBtn.tabIndex = -1;

                    const getSmartStep = () => {
                        if (benefit.totalAmount >= 200) return 5;
                        if (benefit.totalAmount >= 10) return 1;
                        return 0.01;
                    };
                    const handleSmartIncrement = (direction) => {
                        const step = getSmartStep();
                        let current = parseFloat(updateInput.value) || 0;
                        let nextVal;
                        if (direction === 'up') {
                            nextVal = (Math.floor(current / step) + 1) * step;
                        } else {
                            if (current % step === 0) nextVal = current - step;
                            else nextVal = Math.ceil(current / step) * step - step;
                        }
                        if (nextVal < 0) nextVal = 0;
                        if (nextVal > benefit.totalAmount) nextVal = benefit.totalAmount;
                        nextVal = parseFloat(nextVal.toFixed(2));
                        updateInput.value = nextVal.toFixed(2);
                        this.app.handleUpdateCarryoverInstanceUsage(benefit.id, index, nextVal);
                    };

                    decBtn.onclick = (e) => {
                        e.stopPropagation();
                        handleSmartIncrement('down');
                    };
                    incBtn.onclick = (e) => {
                        e.stopPropagation();
                        handleSmartIncrement('up');
                    };
                    updateInput.onfocus = (e) => e.target.select();
                    updateInput.onblur = (e) => {
                        if (e.target.value === '') e.target.value = (instance.usedAmount || 0).toFixed(2);
                    };
                    updateInput.onchange = (e) => {
                        this.app.handleUpdateCarryoverInstanceUsage(benefit.id, index, parseFloat(e.target.value));
                    };

                    inputWrapper.appendChild(decBtn);
                    inputWrapper.appendChild(updateInput);
                    inputWrapper.appendChild(incBtn);

                    instanceContainer.appendChild(usageLabel);
                    instanceContainer.appendChild(inputWrapper);
                    controlsDiv.appendChild(instanceContainer);
                });
            }
        } else {
            // Normal usage controls (for non-carryover benefits)
            const updateLabel = document.createElement('label');
            updateLabel.textContent = 'Set used: $';

            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'smart-input-wrapper';
            const decBtn = document.createElement('button');
            decBtn.className = 'smart-stepper-btn';
            decBtn.textContent = '−';
            decBtn.tabIndex = -1;
            const updateInput = document.createElement('input');
            updateInput.type = 'number';
            updateInput.value = benefit.usedAmount.toFixed(2);
            updateInput.min = "0";
            updateInput.max = benefit.totalAmount;
            updateInput.step = "0.01";
            const incBtn = document.createElement('button');
            incBtn.className = 'smart-stepper-btn';
            incBtn.textContent = '+';
            incBtn.tabIndex = -1;

            const getSmartStep = () => {
                if (benefit.totalAmount >= 200) return 5;
                if (benefit.totalAmount >= 10) return 1;
                return 0.01;
            };
            const handleSmartIncrement = (direction) => {
                const step = getSmartStep();
                let current = parseFloat(updateInput.value) || 0;
                let nextVal;
                if (direction === 'up') {
                    nextVal = (Math.floor(current / step) + 1) * step;
                } else {
                    if (current % step === 0) nextVal = current - step;
                    else nextVal = Math.ceil(current / step) * step - step;
                }
                if (nextVal < 0) nextVal = 0;
                if (nextVal > benefit.totalAmount) nextVal = benefit.totalAmount;
                nextVal = parseFloat(nextVal.toFixed(2));
                updateInput.value = nextVal.toFixed(2);
                this.app.handleUpdateBenefitUsage(benefit.id, nextVal);
            };

            decBtn.onclick = (e) => {
                e.stopPropagation();
                handleSmartIncrement('down');
            };
            incBtn.onclick = (e) => {
                e.stopPropagation();
                handleSmartIncrement('up');
            };
            updateInput.onfocus = (e) => {
                e.target.select();
            };
            updateInput.onblur = (e) => {
                if (e.target.value === '') e.target.value = benefit.usedAmount.toFixed(2);
            };
            updateInput.onchange = (e) => {
                this.app.handleUpdateBenefitUsage(benefit.id, parseFloat(e.target.value));
            };

            inputWrapper.appendChild(decBtn);
            inputWrapper.appendChild(updateInput);
            inputWrapper.appendChild(incBtn);

            controlsDiv.appendChild(updateLabel);
            controlsDiv.appendChild(inputWrapper);
        }

        const rightControls = document.createElement('div');
        rightControls.className = 'controls-right';
        
        const justifyBtn = document.createElement('button');
        justifyBtn.className = 'secondary-btn';
        justifyBtn.textContent = '📝 Justifications';
        justifyBtn.onclick = (e) => {
            e.stopPropagation();
            this.showJustificationsModal(benefit, card, isCarryover ? activeInstances : null);
        };
        
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => this.renderBenefitEdit(benefit, card);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => this.app.handleDeleteBenefit(benefit.id);

        rightControls.appendChild(justifyBtn);
        rightControls.appendChild(editBtn);
        rightControls.appendChild(deleteBtn);
        controlsDiv.appendChild(rightControls);

        li.appendChild(detailsDiv);
        li.appendChild(metaDiv);
        li.appendChild(progressContainer);
        li.appendChild(nextResetDiv);
        li.appendChild(controlsDiv);

        return li;
    }

    // ... (rest of methods: createAddBenefitForm, renderCardEdit, renderBenefitEdit remain unchanged) ...
    createAddBenefitForm(cardId) {
        const form = document.createElement('form');
        form.className = 'benefit-form';
        const uId = Math.random().toString(36).substring(2, 11);

        // Get minimum spends for dropdown
        const card = this.app.cards.find(c => c.id === cardId);
        const minSpends = card && card.minimumSpends ? card.minimumSpends : [];
        const minSpendOptions = minSpends.map(ms => 
            `<option value="${ms.id}">${ms.description} ($${ms.targetAmount.toFixed(2)})</option>`
        ).join('');

        form.innerHTML = `
            <h3 style="margin: 0; font-size: 1.1rem;">Add New Benefit</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Benefit Description</label>
                    <input type="text" name="description" placeholder="E.g., $10 Uber Cash" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="number" name="totalAmount" placeholder="10.00" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Frequency</label>
                    <select name="frequency" id="freq-${uId}" required>
                        <option value="" disabled selected>Select...</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannual">Biannual (2x/yr)</option>
                        <option value="annual">Annual</option>
                        <option value="every-4-years">Every 4 Years</option>
                        <option value="one-time">One-Time</option>
                        <option value="carryover">Carryover (earn in year X, use til end of year X+1)</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" id="reset-group-${uId}" style="display: none;">
                    <label>Reset Type</label>
                    <select name="resetType" id="reset-${uId}">
                        <option value="calendar">Calendar (Jan 1, Apr 1, etc.)</option>
                        <option value="anniversary">Anniversary-Dated</option>
                    </select>
                </div>
            </div>
            
            <!-- Minimum Spend Requirement (for one-time and carryover benefits) -->
            <div class="form-row" id="min-spend-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>🔗 Required Minimum Spend</label>
                    <select name="requiredMinimumSpendId" id="min-spend-${uId}">
                        <option value="">None (no requirement)</option>
                        ${minSpendOptions}
                    </select>
                    <small style="color: #666;">Link this benefit to a minimum spend requirement to unlock it.</small>
                </div>
            </div>
            
            <!-- Auto Claim Inputs -->
            <div class="form-row" id="auto-claim-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group" style="flex-direction:row; align-items:center; gap:10px; flex:0;">
                    <input type="checkbox" name="autoClaim" id="ac-check-${uId}" style="width:auto;">
                    <label for="ac-check-${uId}" style="margin:0; white-space:nowrap;">Auto-Claim?</label>
                </div>
                <div class="form-group" id="ac-date-group-${uId}" style="display:none;">
                    <label style="margin-bottom:2px;">Until Date</label>
                    <input type="date" name="autoClaimEndDate">
                </div>
            </div>

            <!-- Ignore Inputs -->
            <div class="form-row" id="ignore-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group" style="flex-direction:row; align-items:center; gap:10px; flex:0;">
                    <input type="checkbox" name="ignored" id="ig-check-${uId}" style="width:auto;">
                    <label for="ig-check-${uId}" style="margin:0; white-space:nowrap;">Ignore?</label>
                </div>
                <div class="form-group" id="ig-date-group-${uId}" style="display:none;">
                    <label style="margin-bottom:2px;">Until Date</label>
                    <input type="date" name="ignoredEndDate">
                </div>
            </div>

            <!-- Expiry Date for One-Time Benefits -->
            <div class="form-row" id="expiry-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>Expiry Date</label>
                    <input type="date" name="expiryDate" id="expiry-date-${uId}">
                </div>
            </div>

            <button type="submit">Add Benefit</button>
        `;

        const freqSelect = form.querySelector(`#freq-${uId}`);
        const resetGroup = form.querySelector(`#reset-group-${uId}`);
        const resetSelect = form.querySelector(`#reset-${uId}`);

        const minSpendRow = form.querySelector(`#min-spend-row-${uId}`);

        const acRow = form.querySelector(`#auto-claim-row-${uId}`);
        const acCheck = form.querySelector(`#ac-check-${uId}`);
        const acDateGroup = form.querySelector(`#ac-date-group-${uId}`);

        const igRow = form.querySelector(`#ignore-row-${uId}`);
        const igCheck = form.querySelector(`#ig-check-${uId}`);
        const igDateGroup = form.querySelector(`#ig-date-group-${uId}`);

        const expiryRow = form.querySelector(`#expiry-row-${uId}`);

        freqSelect.onchange = (e) => {
            const isOneTime = e.target.value === 'one-time';
            const isCarryover = e.target.value === 'carryover';
            
            if (isCarryover) {
                // Show carryover-specific fields - use minimum spend for earning
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                minSpendRow.style.display = 'flex'; // Show minimum spend dropdown
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'none';
            } else if (isOneTime) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                minSpendRow.style.display = 'flex'; // Show minimum spend dropdown
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'flex';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                minSpendRow.style.display = 'none';
                acRow.style.display = 'flex';
                igRow.style.display = 'flex';
                expiryRow.style.display = 'none';
            }
        };

        acCheck.onchange = (e) => {
            acDateGroup.style.display = e.target.checked ? 'flex' : 'none';
            acDateGroup.querySelector('input').required = e.target.checked;
            if (e.target.checked) {
                igCheck.checked = false;
                igDateGroup.style.display = 'none';
                igDateGroup.querySelector('input').required = false;
            }
        };

        igCheck.onchange = (e) => {
            igDateGroup.style.display = e.target.checked ? 'flex' : 'none';
            igDateGroup.querySelector('input').required = e.target.checked;
            if (e.target.checked) {
                acCheck.checked = false;
                acDateGroup.style.display = 'none';
                acDateGroup.querySelector('input').required = false;
            }
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const frequency = formData.get('frequency');
            const isCarryover = frequency === 'carryover';
            const isOneTime = frequency === 'one-time';
            
            const benefitData = {
                description: formData.get('description'),
                totalAmount: parseFloat(formData.get('totalAmount')),
                frequency: isCarryover ? 'carryover' : frequency,
                resetType: (frequency === 'one-time' || isCarryover) ? null : formData.get('resetType'),
                autoClaim: formData.get('autoClaim') === 'on',
                autoClaimEndDate: formData.get('autoClaimEndDate') || null,
                ignored: formData.get('ignored') === 'on',
                ignoredEndDate: formData.get('ignoredEndDate') || null,
                expiryDate: frequency === 'one-time' ? (formData.get('expiryDate') || null) : null,
                // Carryover-specific fields
                isCarryover: isCarryover,
                earnedDate: null,
                // Link to minimum spend for earning (for both carryover and one-time)
                requiredMinimumSpendId: (isCarryover || isOneTime) ? (formData.get('requiredMinimumSpendId') || null) : null
            };
            this.app.handleAddBenefit(cardId, benefitData);
            e.target.reset();
            resetGroup.style.display = 'none';
            acRow.style.display = 'none';
            minSpendRow.style.display = 'none';
            acDateGroup.style.display = 'none';
            igRow.style.display = 'none';
            igDateGroup.style.display = 'none';
            expiryRow.style.display = 'none';
            form.style.display = 'none';
            form.previousElementSibling.style.display = 'block';
        };
        return form;
    }

    renderCardEdit(card) {
        const cardEl = document.querySelector(`.card[data-card-id="${card.id}"]`);
        if (!cardEl) return;

        const form = document.createElement('div');
        form.className = 'edit-form';
        const uId = Math.random().toString(36).substring(2, 11);

        form.innerHTML = `
            <h3 style="margin: 0;">Editing: ${card.name}</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Card Name</label>
                    <input type="text" id="name-${uId}" value="${card.name}" required>
                </div>
                <div class="form-group">
                    <label>Anniversary Date</label>
                    <input type="date" id="date-${uId}" value="${card.anniversaryDate}" required>
                </div>
            </div>
            <div class="form-row" style="justify-content: flex-end;">
                <button class="secondary-btn" id="cancel-${uId}">Cancel</button>
                <button id="save-${uId}">Save Changes</button>
            </div>
        `;

        cardEl.innerHTML = '';
        cardEl.appendChild(form);

        document.getElementById(`save-${uId}`).onclick = () => {
            const newName = document.getElementById(`name-${uId}`).value.trim();
            const newDate = document.getElementById(`date-${uId}`).value;
            if (newName && newDate) {
                this.app.handleUpdateCard(card.id, newName, newDate);
            }
        };
        document.getElementById(`cancel-${uId}`).onclick = () => {
            this.app.render();
        };
    }

    renderBenefitEdit(benefit, card) {
        const benefitEl = document.querySelector(`.benefit-item[data-benefit-id="${benefit.id}"]`);
        if (!benefitEl) return;

        const form = document.createElement('div');
        form.className = 'edit-form';
        form.style.marginBottom = '0';
        const uId = Math.random().toString(36).substr(2, 9);

        // Check carryover and one-time using helpers
        const isCarryover = this._isCarryoverBenefit(benefit);
        const isOneTime = this._isOneTimeBenefit(benefit);
        const isRecurring = !isOneTime && !isCarryover;
        const hasAutoClaim = benefit.autoClaim === true;
        const hasIgnored = benefit.ignored === true;

        // Build minimum spend options
        const minimumSpends = card.minimumSpends || [];
        let minSpendOptions = '<option value="">None (no requirement)</option>';
        minimumSpends.forEach(ms => {
            const selected = benefit.requiredMinimumSpendId === ms.id ? 'selected' : '';
            minSpendOptions += `<option value="${ms.id}" ${selected}>${ms.description} ($${ms.targetAmount.toFixed(2)})</option>`;
        });

        form.innerHTML = `
            <h3 style="margin: 0; font-size: 1.1rem;">Editing: ${benefit.description}</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Benefit Description</label>
                    <input type="text" id="desc-${uId}" value="${benefit.description}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="number" id="amt-${uId}" value="${benefit.totalAmount.toFixed(2)}" min="0.01" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Frequency</label>
                    <select id="freq-${uId}" required>
                        <option value="monthly" ${benefit.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                        <option value="quarterly" ${benefit.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                        <option value="biannual" ${benefit.frequency === 'biannual' ? 'selected' : ''}>Biannual</option>
                        <option value="annual" ${benefit.frequency === 'annual' ? 'selected' : ''}>Annual</option>
                        <option value="every-4-years" ${benefit.frequency === 'every-4-years' ? 'selected' : ''}>Every 4 Years</option>
                        <option value="one-time" ${benefit.frequency === 'one-time' ? 'selected' : ''}>One-Time</option>
                        <option value="carryover" ${isCarryover ? 'selected' : ''}>Carryover</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" id="reset-group-${uId}" style="display: ${isRecurring ? 'block' : 'none'};">
                    <label>Reset Type</label>
                    <select id="reset-${uId}" ${isRecurring ? 'required' : ''}>
                        <option value="calendar" ${benefit.resetType === 'calendar' ? 'selected' : ''}>Calendar</option>
                        <option value="anniversary" ${benefit.resetType === 'anniversary' ? 'selected' : ''}>Anniversary-Dated</option>
                    </select>
                </div>
            </div>

            <!-- Minimum Spend Requirement Link -->
            <div class="form-row" id="min-spend-row-${uId}" style="border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>🔗 Required Minimum Spend</label>
                    <select id="min-spend-${uId}">
                        ${minSpendOptions}
                    </select>
                    <small style="color: #666;">Link this benefit to a minimum spend requirement to unlock it.</small>
                </div>
            </div>

            <!-- Auto Claim Edit -->
            <div class="form-row" id="auto-claim-row-${uId}" style="display:${isRecurring ? 'flex' : 'none'}; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group" style="flex-direction:row; align-items:center; gap:10px; flex:0;">
                    <input type="checkbox" id="ac-check-${uId}" style="width:auto;" ${hasAutoClaim ? 'checked' : ''}>
                    <label for="ac-check-${uId}" style="margin:0;">Auto-Claim?</label>
                </div>
                <div class="form-group" id="ac-date-group-${uId}" style="display:${hasAutoClaim ? 'flex' : 'none'};">
                    <label style="margin-bottom:2px;">Until Date</label>
                    <input type="date" id="ac-date-${uId}" value="${benefit.autoClaimEndDate || ''}" ${hasAutoClaim ? 'required' : ''}>
                </div>
            </div>

            <!-- NEW: Ignore Edit -->
            <div class="form-row" id="ignore-row-${uId}" style="display:${isRecurring ? 'flex' : 'none'}; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group" style="flex-direction:row; align-items:center; gap:10px; flex:0;">
                    <input type="checkbox" id="ig-check-${uId}" style="width:auto;" ${hasIgnored ? 'checked' : ''}>
                    <label for="ig-check-${uId}" style="margin:0;">Ignore?</label>
                </div>
                <div class="form-group" id="ig-date-group-${uId}" style="display:${hasIgnored ? 'flex' : 'none'};">
                    <label style="margin-bottom:2px;">Until Date</label>
                    <input type="date" id="ig-date-${uId}" value="${benefit.ignoredEndDate || ''}" ${hasIgnored ? 'required' : ''}>
                </div>
            </div>

            <!-- Expiry Date for One-Time Benefits -->
            <div class="form-row" id="expiry-row-${uId}" style="display:${(!isRecurring && !isCarryover) ? 'flex' : 'none'}; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>Expiry Date</label>
                    <input type="date" id="expiry-date-${uId}" value="${benefit.expiryDate || ''}">
                </div>
            </div>

            <div class="form-row" style="justify-content: flex-end;">
                <button class="secondary-btn" id="cancel-${uId}">Cancel</button>
                <button id="save-${uId}">Save Changes</button>
            </div>
        `;

        benefitEl.innerHTML = '';
        benefitEl.appendChild(form);

        const freqSelect = document.getElementById(`freq-${uId}`);
        const resetGroup = document.getElementById(`reset-group-${uId}`);
        const resetSelect = document.getElementById(`reset-${uId}`);
        
        const minSpendRow = document.getElementById(`min-spend-row-${uId}`);
        const minSpendSelect = document.getElementById(`min-spend-${uId}`);
        
        const acRow = document.getElementById(`auto-claim-row-${uId}`);
        const acCheck = document.getElementById(`ac-check-${uId}`);
        const acDateGroup = document.getElementById(`ac-date-group-${uId}`);
        const acDateInput = document.getElementById(`ac-date-${uId}`);

        const igRow = document.getElementById(`ignore-row-${uId}`);
        const igCheck = document.getElementById(`ig-check-${uId}`);
        const igDateGroup = document.getElementById(`ig-date-group-${uId}`);
        const igDateInput = document.getElementById(`ig-date-${uId}`);

        const expiryRow = document.getElementById(`expiry-row-${uId}`);
        const expiryDateInput = document.getElementById(`expiry-date-${uId}`);

        freqSelect.onchange = (e) => {
            const isCarryoverSelected = e.target.value === 'carryover';
            const isOneTimeSelected = e.target.value === 'one-time';
            
            if (isCarryoverSelected) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                minSpendRow.style.display = 'flex'; // Show min spend for carryover
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'none';
            } else if (isOneTimeSelected) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                minSpendRow.style.display = 'flex'; // Show min spend for one-time
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'flex';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                minSpendRow.style.display = 'none';
                acRow.style.display = 'flex';
                igRow.style.display = 'flex';
                expiryRow.style.display = 'none';
            }
        };

        acCheck.onchange = (e) => {
            acDateGroup.style.display = e.target.checked ? 'flex' : 'none';
            acDateInput.required = e.target.checked;
            if (e.target.checked) {
                igCheck.checked = false;
                igDateGroup.style.display = 'none';
                igDateInput.required = false;
            }
        };

        igCheck.onchange = (e) => {
            igDateGroup.style.display = e.target.checked ? 'flex' : 'none';
            igDateInput.required = e.target.checked;
            if (e.target.checked) {
                acCheck.checked = false;
                acDateGroup.style.display = 'none';
                acDateInput.required = false;
            }
        };

        document.getElementById(`save-${uId}`).onclick = () => {
            const frequency = freqSelect.value;
            const isCarryoverSelected = frequency === 'carryover';
            const isOneTimeSelected = frequency === 'one-time';
            
            const newData = {
                description: document.getElementById(`desc-${uId}`).value.trim(),
                totalAmount: parseFloat(document.getElementById(`amt-${uId}`).value),
                frequency: frequency,
                resetType: null,
                autoClaim: acCheck.checked,
                autoClaimEndDate: acCheck.checked ? acDateInput.value : null,
                ignored: igCheck.checked,
                ignoredEndDate: igCheck.checked ? igDateInput.value : null,
                expiryDate: frequency === 'one-time' ? (expiryDateInput.value || null) : null,
                // Carryover-specific fields
                isCarryover: isCarryoverSelected,
                // Minimum spend link (for both carryover and one-time benefits)
                requiredMinimumSpendId: (isCarryoverSelected || isOneTimeSelected) ? (minSpendSelect.value || null) : null
            };
            
            // Preserve existing carryover earned instances if still a carryover benefit
            if (isCarryoverSelected && benefit.isCarryover) {
                newData.earnedInstances = benefit.earnedInstances || [];
                newData.lastEarnReset = benefit.lastEarnReset || null;
            } else if (isCarryoverSelected) {
                // Converting to carryover
                newData.earnedInstances = [];
            }
            
            if (frequency !== 'one-time' && !isCarryoverSelected) {
                newData.resetType = resetSelect.value;
            }
            if (newData.description && newData.totalAmount) {
                this.app.handleUpdateBenefit(benefit.id, newData);
            }
        };
        document.getElementById(`cancel-${uId}`).onclick = () => {
            this.app.render();
        };
    }

    /**
     * Shows a modal for managing usage justifications for a benefit.
     * @param {Benefit} benefit - The benefit
     * @param {Card} card - The parent card
     * @param {Array|null} instances - For carryover benefits, the active instances
     */
    showJustificationsModal(benefit, card, instances = null) {
        const isCarryover = this._isCarryoverBenefit(benefit);
        
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.display = 'flex';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '600px';
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflow = 'auto';
        
        const title = document.createElement('h2');
        title.textContent = `Justifications: ${benefit.description}`;
        modalContent.appendChild(title);
        
        // For carryover benefits, show tabs for each instance
        if (isCarryover && instances && instances.length > 0) {
            instances.forEach((instance, index) => {
                const earnYear = CarryoverCycle.getEarnYear(instance.earnedDate);
                const instanceSection = document.createElement('div');
                instanceSection.style.marginBottom = '20px';
                instanceSection.style.borderBottom = '1px solid #ddd';
                instanceSection.style.paddingBottom = '15px';
                
                const instanceTitle = document.createElement('h3');
                instanceTitle.textContent = `${earnYear} Credit`;
                instanceTitle.style.fontSize = '1.1rem';
                instanceTitle.style.marginBottom = '10px';
                instanceSection.appendChild(instanceTitle);
                
                // Show existing justifications
                const justifications = instance.usageJustifications || [];
                const justList = this.createJustificationsList(benefit, justifications, true, index);
                instanceSection.appendChild(justList);
                
                // Add justification button
                const addBtn = document.createElement('button');
                addBtn.className = 'secondary-btn';
                addBtn.textContent = '+ Add Justification';
                addBtn.style.marginTop = '10px';
                addBtn.onclick = () => {
                    const form = this.createJustificationForm(benefit, true, index, addBtn);
                    instanceSection.insertBefore(form, addBtn);
                    addBtn.style.display = 'none';
                };
                instanceSection.appendChild(addBtn);
                
                // Quick add usage button
                const quickAddBtn = document.createElement('button');
                quickAddBtn.className = 'secondary-btn';
                quickAddBtn.textContent = '⚡ Quick Add Usage';
                quickAddBtn.style.marginTop = '10px';
                quickAddBtn.style.marginLeft = '10px';
                quickAddBtn.onclick = () => {
                    const form = this.createQuickUsageForm(benefit, true, index, quickAddBtn);
                    instanceSection.insertBefore(form, addBtn);
                    quickAddBtn.style.display = 'none';
                };
                instanceSection.appendChild(quickAddBtn);
                
                modalContent.appendChild(instanceSection);
            });
        } else {
            // Regular benefit justifications
            const justifications = benefit.usageJustifications || [];
            const justList = this.createJustificationsList(benefit, justifications, false, null);
            modalContent.appendChild(justList);
            
            // Add justification button
            const addBtn = document.createElement('button');
            addBtn.className = 'secondary-btn';
            addBtn.textContent = '+ Add Justification';
            addBtn.style.marginTop = '10px';
            addBtn.onclick = () => {
                const form = this.createJustificationForm(benefit, false, null, addBtn);
                modalContent.insertBefore(form, addBtn);
                addBtn.style.display = 'none';
            };
            modalContent.appendChild(addBtn);
            
            // Quick add usage button
            const quickAddBtn = document.createElement('button');
            quickAddBtn.className = 'secondary-btn';
            quickAddBtn.textContent = '⚡ Quick Add Usage';
            quickAddBtn.style.marginTop = '10px';
            quickAddBtn.style.marginLeft = '10px';
            quickAddBtn.onclick = () => {
                const form = this.createQuickUsageForm(benefit, false, null, quickAddBtn);
                modalContent.insertBefore(form, addBtn);
                quickAddBtn.style.display = 'none';
            };
            modalContent.appendChild(quickAddBtn);
        }
        
        // Summary info
        const summary = document.createElement('div');
        summary.style.marginTop = '20px';
        summary.style.padding = '10px';
        summary.style.backgroundColor = '#f5f5f5';
        summary.style.borderRadius = '5px';
        
        let totalJustified = 0;
        let totalUsed = 0;
        
        if (isCarryover && instances) {
            instances.forEach(inst => {
                totalUsed += inst.usedAmount || 0;
                if (inst.usageJustifications) {
                    totalJustified += inst.usageJustifications.reduce((sum, j) => sum + (j.amount || 0), 0);
                }
            });
        } else {
            totalUsed = benefit.usedAmount || 0;
            if (benefit.usageJustifications) {
                totalJustified = benefit.usageJustifications.reduce((sum, j) => sum + (j.amount || 0), 0);
            }
        }
        
        summary.innerHTML = `
            <strong>Summary:</strong><br>
            Total Used: $${totalUsed.toFixed(2)}<br>
            Total Justified: $${totalJustified.toFixed(2)}<br>
            Unjustified: $${(totalUsed - totalJustified).toFixed(2)}
        `;
        modalContent.appendChild(summary);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '15px';
        closeBtn.onclick = () => {
            document.body.removeChild(modalOverlay);
        };
        modalContent.appendChild(closeBtn);
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Close on overlay click
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        };
    }

    /**
     * Creates a list of justifications.
     * @param {Benefit} benefit - The benefit
     * @param {Array} justifications - Array of justification objects
     * @param {boolean} isCarryover - Whether this is for a carryover instance
     * @param {number|null} instanceIndex - Instance index for carryover
     * @returns {HTMLElement}
     */
    createJustificationsList(benefit, justifications, isCarryover, instanceIndex) {
        const container = document.createElement('div');
        
        if (justifications.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'No justifications added yet.';
            emptyMsg.style.color = '#999';
            emptyMsg.style.fontStyle = 'italic';
            container.appendChild(emptyMsg);
            return container;
        }
        
        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';
        
        justifications.forEach(just => {
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.marginBottom = '8px';
            li.style.border = '1px solid #ddd';
            li.style.borderRadius = '5px';
            li.style.backgroundColor = just.confirmed ? '#e8f5e9' : '#fff';
            
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '5px';
            
            const amountSpan = document.createElement('span');
            amountSpan.style.fontWeight = 'bold';
            amountSpan.textContent = `$${(just.amount || 0).toFixed(2)}`;
            header.appendChild(amountSpan);
            
            const badges = document.createElement('div');
            badges.style.display = 'flex';
            badges.style.gap = '5px';
            
            if (just.confirmed) {
                const confirmedBadge = document.createElement('span');
                confirmedBadge.textContent = '✅ Confirmed';
                confirmedBadge.style.fontSize = '0.8rem';
                confirmedBadge.style.color = '#4caf50';
                badges.appendChild(confirmedBadge);
            }
            
            if (just.reminderDate) {
                const reminderBadge = document.createElement('span');
                const reminderDate = new Date(just.reminderDate);
                const isPast = reminderDate <= this.app.today && !just.confirmed;
                reminderBadge.textContent = `🔔 ${reminderDate.toLocaleDateString()}`;
                reminderBadge.style.fontSize = '0.8rem';
                reminderBadge.style.color = isPast ? '#ff9800' : '#666';
                if (isPast) reminderBadge.style.fontWeight = 'bold';
                badges.appendChild(reminderBadge);
            }
            
            if (just.chargeDate) {
                const chargeBadge = document.createElement('span');
                const chargeDate = new Date(just.chargeDate);
                chargeBadge.textContent = `📅 ${chargeDate.toLocaleDateString()}`;
                chargeBadge.style.fontSize = '0.8rem';
                chargeBadge.style.color = '#2196f3';
                badges.appendChild(chargeBadge);
            }
            
            header.appendChild(badges);
            li.appendChild(header);
            
            const textDiv = document.createElement('div');
            textDiv.textContent = just.justification || '(No description)';
            textDiv.style.marginBottom = '8px';
            li.appendChild(textDiv);
            
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '5px';
            
            if (!just.confirmed) {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'secondary-btn';
                confirmBtn.textContent = 'Confirm';
                confirmBtn.style.fontSize = '0.85rem';
                confirmBtn.style.padding = '3px 8px';
                confirmBtn.onclick = () => {
                    if (isCarryover) {
                        this.app.handleConfirmCarryoverJustification(benefit.id, instanceIndex, just.id);
                    } else {
                        this.app.handleConfirmJustification(benefit.id, just.id);
                    }
                    
                    // Close and reopen modal to refresh
                    const modalOverlay = confirmBtn.closest('.modal-overlay');
                    if (modalOverlay) {
                        document.body.removeChild(modalOverlay);
                        const card = this.app.cards.find(c => c.findBenefit(benefit.id));
                        if (card) {
                            const updatedBenefit = card.findBenefit(benefit.id);
                            const activeInstances = isCarryover ? this.app.getActiveCarryoverInstances(updatedBenefit) : null;
                            this.showJustificationsModal(updatedBenefit, card, activeInstances);
                        }
                    }
                };
                actions.appendChild(confirmBtn);
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'danger-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.fontSize = '0.85rem';
            deleteBtn.style.padding = '3px 8px';
            deleteBtn.onclick = () => {
                if (confirm('Delete this justification?')) {
                    if (isCarryover) {
                        this.app.handleRemoveCarryoverJustification(benefit.id, instanceIndex, just.id);
                    } else {
                        this.app.handleRemoveJustification(benefit.id, just.id);
                    }
                    
                    // Close and reopen modal to refresh
                    const modalOverlay = deleteBtn.closest('.modal-overlay');
                    if (modalOverlay) {
                        document.body.removeChild(modalOverlay);
                        const card = this.app.cards.find(c => c.findBenefit(benefit.id));
                        if (card) {
                            const updatedBenefit = card.findBenefit(benefit.id);
                            const activeInstances = isCarryover ? this.app.getActiveCarryoverInstances(updatedBenefit) : null;
                            this.showJustificationsModal(updatedBenefit, card, activeInstances);
                        }
                    }
                }
            };
            actions.appendChild(deleteBtn);
            
            li.appendChild(actions);
            list.appendChild(li);
        });
        
        container.appendChild(list);
        return container;
    }

    /**
     * Creates a form for adding a new justification.
     * @param {Benefit} benefit - The benefit
     * @param {boolean} isCarryover - Whether this is for a carryover instance
     * @param {number|null} instanceIndex - Instance index for carryover
     * @param {HTMLElement} addBtn - Reference to the add button to re-show on cancel
     * @returns {HTMLElement}
     */
    createJustificationForm(benefit, isCarryover, instanceIndex, addBtn) {
        const form = document.createElement('form');
        form.style.padding = '15px';
        form.style.backgroundColor = '#f9f9f9';
        form.style.borderRadius = '5px';
        form.style.marginBottom = '15px';
        
        form.innerHTML = `
            <h4 style="margin-top: 0;">Add Justification</h4>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Amount</label>
                <input type="number" name="amount" placeholder="0.00" min="0.01" step="0.01" required style="width: 100%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Description</label>
                <textarea name="justification" placeholder="E.g., Trip to Spain" required style="width: 100%; padding: 8px; min-height: 60px;"></textarea>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Charge Date (optional)</label>
                <input type="date" name="chargeDate" style="width: 100%; padding: 8px;">
                <small style="color: #666;">When did this charge occur?</small>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Reminder Date (optional)</label>
                <input type="date" name="reminderDate" style="width: 100%; padding: 8px;">
                <small style="color: #666;">Set a reminder to confirm this charge posted</small>
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="submit">Add</button>
                <button type="button" class="secondary-btn cancel-btn">Cancel</button>
            </div>
        `;
        
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const amount = parseFloat(formData.get('amount'));
            const justification = formData.get('justification');
            const reminderDate = formData.get('reminderDate') || null;
            const chargeDate = formData.get('chargeDate') || null;
            
            if (isCarryover) {
                this.app.handleAddCarryoverJustification(benefit.id, instanceIndex, amount, justification, reminderDate, chargeDate);
            } else {
                this.app.handleAddJustification(benefit.id, amount, justification, reminderDate, chargeDate);
            }
            
            // Close and reopen modal to refresh content
            const modalOverlay = form.closest('.modal-overlay');
            if (modalOverlay) {
                document.body.removeChild(modalOverlay);
                // Reopen the modal with updated data
                const card = this.app.cards.find(c => c.findBenefit(benefit.id));
                if (card) {
                    const updatedBenefit = card.findBenefit(benefit.id);
                    const activeInstances = isCarryover ? this.app.getActiveCarryoverInstances(updatedBenefit) : null;
                    this.showJustificationsModal(updatedBenefit, card, activeInstances);
                }
            }
        };
        
        form.querySelector('.cancel-btn').onclick = () => {
            form.remove();
            // Re-show the add button using the passed reference
            if (addBtn) {
                addBtn.style.display = 'block';
            }
        };
        
        return form;
    }

    /**
     * Creates a form for quickly adding a usage entry (increments used and adds justification).
     * @param {Benefit} benefit - The benefit
     * @param {boolean} isCarryover - Whether this is for a carryover instance
     * @param {number|null} instanceIndex - Instance index for carryover
     * @param {HTMLElement} quickAddBtn - Reference to the quick add button to re-show on cancel
     * @returns {HTMLElement}
     */
    createQuickUsageForm(benefit, isCarryover, instanceIndex, quickAddBtn) {
        const form = document.createElement('form');
        form.style.padding = '15px';
        form.style.backgroundColor = '#e3f2fd';
        form.style.borderRadius = '5px';
        form.style.marginBottom = '15px';
        form.style.border = '2px solid #2196f3';
        
        form.innerHTML = `
            <h4 style="margin-top: 0; color: #1976d2;">⚡ Quick Add Usage</h4>
            <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666;">This will increment the used amount and add a justification</p>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Amount</label>
                <input type="number" name="amount" placeholder="0.00" min="0.01" step="0.01" required style="width: 100%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description</label>
                <textarea name="justification" placeholder="E.g., Trip to Spain" required style="width: 100%; padding: 8px; min-height: 60px;"></textarea>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Charge Date (optional)</label>
                <input type="date" name="chargeDate" style="width: 100%; padding: 8px;">
                <small style="color: #666;">When did this charge occur?</small>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Reminder Date (optional)</label>
                <input type="date" name="reminderDate" style="width: 100%; padding: 8px;">
                <small style="color: #666;">Set a reminder to confirm this charge posted</small>
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="submit" style="background-color: #2196f3;">Add & Increment Used</button>
                <button type="button" class="secondary-btn cancel-btn">Cancel</button>
            </div>
        `;
        
        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const amount = parseFloat(formData.get('amount'));
            const justification = formData.get('justification');
            const reminderDate = formData.get('reminderDate') || null;
            const chargeDate = formData.get('chargeDate') || null;
            
            if (isCarryover) {
                this.app.handleAddCarryoverUsageEntry(benefit.id, instanceIndex, amount, justification, reminderDate, chargeDate);
            } else {
                this.app.handleAddUsageEntry(benefit.id, amount, justification, reminderDate, chargeDate);
            }
            
            // Close and reopen modal to refresh content
            const modalOverlay = form.closest('.modal-overlay');
            if (modalOverlay) {
                document.body.removeChild(modalOverlay);
                // Reopen the modal with updated data
                const card = this.app.cards.find(c => c.findBenefit(benefit.id));
                if (card) {
                    const updatedBenefit = card.findBenefit(benefit.id);
                    const activeInstances = isCarryover ? this.app.getActiveCarryoverInstances(updatedBenefit) : null;
                    this.showJustificationsModal(updatedBenefit, card, activeInstances);
                }
            }
        };
        
        form.querySelector('.cancel-btn').onclick = () => {
            form.remove();
            // Re-show the quick add button using the passed reference
            if (quickAddBtn) {
                quickAddBtn.style.display = 'inline-block';
            }
        };
        
        return form;
    }
}
