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

    // ... (renderExpiringSoon unchanged) ...
    renderExpiringSoon(activeItems, ignoredItems, fullyUsedItems, days, mainOpen, isIgnoredOpen, isFullyUsedOpen) {
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

        if (activeItems.length === 0) {
            const li = document.createElement('li');
            li.className = 'expiring-item-empty';
            li.textContent = "No active benefits expiring soon.";
            activeList.appendChild(li);
        } else {
            activeItems.forEach(item => activeList.appendChild(createItem(item, false)));
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

    createCardElement(card, isCollapsed) {
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

        cardBody.appendChild(benefitList);
        cardBody.appendChild(addBenefitContainer);
        cardDiv.appendChild(cardHeader);
        cardDiv.appendChild(cardBody);

        return cardDiv;
    }

    createBenefitElement(benefit, card, isCollapsed) {
        const li = document.createElement('li');
        li.className = 'benefit-item';
        li.dataset.benefitId = benefit.id;

        const isAutoClaimed = this.app.isAutoClaimActive(benefit);
        const isIgnored = this.app.isIgnoredActive(benefit);
        // Check carryover using helper
        const isCarryover = this._isCarryoverBenefit(benefit);
        
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

        if (isCollapsed) li.classList.add('benefit-used');
        if (isIgnored) li.classList.add('benefit-ignored');

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
        
        if (isCarryover) {
            if (hasEarnedInstances) {
                // Show total remaining across all instances
                statusSpan.style.color = isUsed ? 'var(--success)' : 'var(--danger)';
                statusSpan.textContent = `$${remaining.toFixed(2)} remaining`;
            } else if (canEarnThisYear) {
                // Show earn progress status
                statusSpan.style.color = 'var(--warning)';
                const earnProgress = benefit.earnProgress || 0;
                const earnThreshold = benefit.earnThreshold || 0;
                statusSpan.textContent = `$${earnProgress.toFixed(2)} / $${earnThreshold.toFixed(2)} to earn`;
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
            li.classList.toggle('benefit-used');
        };

        // Meta
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        let metaText;
        if (isCarryover) {
            if (hasEarnedInstances) {
                const totalUsed = activeInstances.reduce((sum, inst) => sum + (inst.usedAmount || 0), 0);
                const totalCredit = activeInstances.length * benefit.totalAmount;
                metaText = `($${totalUsed.toFixed(2)} / $${totalCredit.toFixed(2)}) - ${activeInstances.length} carryover credit(s)`;
            } else if (canEarnThisYear) {
                metaText = `Earn $${benefit.earnThreshold.toFixed(2)} spend to unlock $${benefit.totalAmount.toFixed(2)} credit`;
            } else {
                metaText = `Carryover benefit - no active credits`;
            }
        } else {
            metaText = `($${benefit.usedAmount.toFixed(2)} / $${benefit.totalAmount.toFixed(2)}) - ${benefit.frequency} benefit`;
            if (benefit.frequency !== 'one-time') metaText += ` | ${benefit.resetType}`;
        }
        metaDiv.textContent = metaText;

        // Progress bar - show earn progress for earning carryover, usage progress otherwise
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar';
        if (isCarryover && canEarnThisYear && !hasEarnedInstances) {
            // Earn progress bar (only show when earning and no earned instances)
            const earnProgress = benefit.earnProgress || 0;
            const earnThreshold = benefit.earnThreshold || 1;
            const earnPercent = Math.min((earnProgress / earnThreshold) * 100, 100);
            progressContainer.innerHTML = `<div class="progress-bar-inner" style="width: ${earnPercent}%; background-color: var(--warning);"></div>`;
        } else {
            // Normal usage progress bar
            progressContainer.innerHTML = `<div class="progress-bar-inner" style="width: ${progressPercent}%; background-color: ${isUsed ? 'var(--success)' : 'var(--primary-color)'};"></div>`;
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
        
        // For carryover benefits, show earn progress and/or instance usage controls
        if (isCarryover) {
            // Show earn progress controls if can still earn this year
            if (canEarnThisYear) {
                const earnLabel = document.createElement('label');
                earnLabel.textContent = 'Spend progress: $';

                const earnInputWrapper = document.createElement('div');
                earnInputWrapper.className = 'smart-input-wrapper';
                const earnDecBtn = document.createElement('button');
                earnDecBtn.className = 'smart-stepper-btn';
                earnDecBtn.textContent = '−';
                earnDecBtn.tabIndex = -1;
                const earnInput = document.createElement('input');
                earnInput.type = 'number';
                earnInput.value = (benefit.earnProgress || 0).toFixed(2);
                earnInput.min = "0";
                earnInput.step = "0.01";
                const earnIncBtn = document.createElement('button');
                earnIncBtn.className = 'smart-stepper-btn';
                earnIncBtn.textContent = '+';
                earnIncBtn.tabIndex = -1;

                const getEarnSmartStep = () => {
                    if (benefit.earnThreshold >= 1000) return 50;
                    if (benefit.earnThreshold >= 200) return 10;
                    if (benefit.earnThreshold >= 10) return 1;
                    return 0.01;
                };
                const handleEarnSmartIncrement = (direction) => {
                    const step = getEarnSmartStep();
                    let current = parseFloat(earnInput.value) || 0;
                    let nextVal;
                    if (direction === 'up') {
                        nextVal = (Math.floor(current / step) + 1) * step;
                    } else {
                        if (current % step === 0) nextVal = current - step;
                        else nextVal = Math.ceil(current / step) * step - step;
                    }
                    if (nextVal < 0) nextVal = 0;
                    nextVal = parseFloat(nextVal.toFixed(2));
                    earnInput.value = nextVal.toFixed(2);
                    this.app.handleUpdateEarnProgress(benefit.id, nextVal);
                };

                earnDecBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleEarnSmartIncrement('down');
                };
                earnIncBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleEarnSmartIncrement('up');
                };
                earnInput.onfocus = (e) => e.target.select();
                earnInput.onblur = (e) => {
                    if (e.target.value === '') e.target.value = (benefit.earnProgress || 0).toFixed(2);
                };
                earnInput.onchange = (e) => {
                    this.app.handleUpdateEarnProgress(benefit.id, parseFloat(e.target.value));
                };

                earnInputWrapper.appendChild(earnDecBtn);
                earnInputWrapper.appendChild(earnInput);
                earnInputWrapper.appendChild(earnIncBtn);

                controlsDiv.appendChild(earnLabel);
                controlsDiv.appendChild(earnInputWrapper);
            }

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
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => this.renderBenefitEdit(benefit, card);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => this.app.handleDeleteBenefit(benefit.id);

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
        const uId = Math.random().toString(36).substr(2, 9);

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
            
            <!-- Carryover Earn Threshold -->
            <div class="form-row" id="carryover-row-${uId}" style="display:none; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>Earn Threshold (minimum spend to earn)</label>
                    <input type="number" name="earnThreshold" id="earn-threshold-${uId}" placeholder="3000.00" min="0.01" step="0.01">
                    <small style="color: #666;">Spend this amount to unlock the credit. Credit is valid until end of next year.</small>
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

        const carryoverRow = form.querySelector(`#carryover-row-${uId}`);
        const earnThresholdInput = form.querySelector(`#earn-threshold-${uId}`);

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
                // Show carryover-specific fields only
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                carryoverRow.style.display = 'flex';
                earnThresholdInput.required = true;
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'none';
            } else if (isOneTime) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                carryoverRow.style.display = 'none';
                earnThresholdInput.required = false;
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'flex';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                carryoverRow.style.display = 'none';
                earnThresholdInput.required = false;
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
                earnThreshold: isCarryover ? parseFloat(formData.get('earnThreshold')) : null,
                earnProgress: isCarryover ? 0 : null,
                earnedDate: null
            };
            this.app.handleAddBenefit(cardId, benefitData);
            e.target.reset();
            resetGroup.style.display = 'none';
            acRow.style.display = 'none';
            carryoverRow.style.display = 'none';
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
        const uId = Math.random().toString(36).substr(2, 9);

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

            <!-- Carryover Earn Threshold -->
            <div class="form-row" id="carryover-row-${uId}" style="display:${isCarryover ? 'flex' : 'none'}; border-top:1px dashed #ccc; padding-top:10px;">
                <div class="form-group">
                    <label>Earn Threshold (minimum spend to earn)</label>
                    <input type="number" id="earn-threshold-${uId}" value="${(benefit.earnThreshold || 0).toFixed(2)}" min="0.01" step="0.01" ${isCarryover ? 'required' : ''}>
                    <small style="color: #666;">Spend this amount to unlock the credit.</small>
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
        
        const carryoverRow = document.getElementById(`carryover-row-${uId}`);
        const earnThresholdInput = document.getElementById(`earn-threshold-${uId}`);
        
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
                carryoverRow.style.display = 'flex';
                earnThresholdInput.required = true;
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'none';
            } else if (isOneTimeSelected) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                carryoverRow.style.display = 'none';
                earnThresholdInput.required = false;
                acRow.style.display = 'none';
                igRow.style.display = 'none';
                expiryRow.style.display = 'flex';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                carryoverRow.style.display = 'none';
                earnThresholdInput.required = false;
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
            
            const earnThresholdValue = parseFloat(earnThresholdInput.value);
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
                earnThreshold: isCarryoverSelected ? (isNaN(earnThresholdValue) ? 0 : earnThresholdValue) : null
            };
            
            // Preserve existing carryover state if still a carryover benefit
            if (isCarryoverSelected && benefit.isCarryover) {
                newData.earnProgress = benefit.earnProgress || 0;
                newData.earnedDate = benefit.earnedDate || null;
                newData.lastEarnReset = benefit.lastEarnReset || null;
            } else if (isCarryoverSelected) {
                // Converting to carryover
                newData.earnProgress = 0;
                newData.earnedDate = null;
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
}
