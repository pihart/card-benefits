/**
 * Handles DOM manipulation and HTML generation.
 */
class UIRenderer {
    constructor(app) {
        this.app = app; // Reference to the main controller
    }

    renderExpiringSoon(activeItems, ignoredItems, days) {
        const container = document.getElementById('expiring-soon-container');
        const list = document.getElementById('expiring-soon-list');

        container.style.display = 'block';
        list.innerHTML = '';

        // 1. Render Active Items
        if (activeItems.length === 0 && ignoredItems.length === 0) {
            const li = document.createElement('li');
            li.className = 'expiring-item-empty';
            li.textContent = `No unused benefits are expiring within ${days} days.`;
            list.appendChild(li);
            return;
        }

        // Helper to create items
        const createItem = (item) => {
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
            return li;
        };

        activeItems.forEach(item => list.appendChild(createItem(item)));

        // 2. Render Ignored Subsection (if any)
        if (ignoredItems.length > 0) {
            const details = document.createElement('details');
            details.className = 'ignored-section';

            const summary = document.createElement('summary');
            summary.textContent = `Ignored Items (${ignoredItems.length})`;
            details.appendChild(summary);

            const ignoredList = document.createElement('ul');
            ignoredList.className = 'expiring-list'; // Reuse style
            ignoredList.style.marginTop = '0';

            ignoredItems.forEach(item => ignoredList.appendChild(createItem(item)));

            details.appendChild(ignoredList);
            // Append subsection to main list container
            // Note: We append 'details' directly to 'list' parent or keep it separate?
            // Let's append to 'list' but wrap in li or just append to container?
            // Ideally append to container so it's separate from the UL.

            // Actually, the UL is for list items. Let's close UL and append details to container.
            // But 'renderExpiringSoon' only controls 'list'.
            // Let's append the details *after* the list in the container.

            // CLEAR previous subsection if exists
            const oldDetails = container.querySelector('.ignored-section');
            if (oldDetails) oldDetails.remove();

            container.appendChild(details);
        } else {
            // Cleanup if no ignored items
            const oldDetails = container.querySelector('.ignored-section');
            if (oldDetails) oldDetails.remove();
        }
    }

    createCardElement(card, allBenefitsUsed) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.dataset.cardId = card.id;
        if (allBenefitsUsed) cardDiv.classList.add('card-collapsed');

        // Header
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.style.cursor = 'pointer';
        cardHeader.onclick = (e) => {
            if (e.target.closest('.card-header-actions') || e.target.closest('.edit-form')) return;
            cardDiv.classList.toggle('card-collapsed');
        };

        const cardInfo = document.createElement('div');
        cardInfo.className = 'card-header-info';
        cardInfo.innerHTML = `<h3>${card.name}</h3>`;

        const cardMeta = document.createElement('div');
        cardMeta.className = 'card-meta';
        const anniversary = new Date(card.anniversaryDate);
        anniversary.setMinutes(anniversary.getMinutes() + anniversary.getTimezoneOffset());
        cardMeta.textContent = `Anniversary: ${anniversary.toLocaleDateString()}`;
        cardInfo.appendChild(cardMeta);
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
        if (card.benefits.length > 0) {
            card.benefits.forEach(benefit => {
                benefitList.appendChild(this.createBenefitElement(benefit, card));
            });
        } else {
            benefitList.innerHTML = '<li>No benefits added for this card yet.</li>';
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

    createBenefitElement(benefit, card) {
        const li = document.createElement('li');
        li.className = 'benefit-item';
        li.dataset.benefitId = benefit.id;

        const remaining = benefit.totalAmount - benefit.usedAmount;
        const progressPercent = (benefit.totalAmount > 0) ? (benefit.usedAmount / benefit.totalAmount) * 100 : 0;
        const isUsed = remaining <= 0;

        // --- Check for Active Statuses ---
        const isAutoClaimed = this.app.isAutoClaimActive(benefit);
        const isIgnored = this.app.isIgnoredActive(benefit);

        // Apply collapse class if used OR ignored
        if (isUsed || isIgnored) li.classList.add('benefit-used'); // Reusing 'benefit-used' style for collapse

        // Apply specific ignored class for styling if needed (optional)
        if (isIgnored) li.classList.add('benefit-ignored');

        // Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details';
        detailsDiv.style.cursor = 'pointer';

        let titleHtml = `<span class="description">${benefit.description}</span>`;
        if (isAutoClaimed) {
            titleHtml += `<span class="auto-claim-badge">🔄 Auto-Claim</span>`;
        }
        if (isIgnored) {
            titleHtml += `<span class="ignored-badge">🚫 Ignored</span>`;
        }

        detailsDiv.innerHTML = `
            <div>${titleHtml}</div>
            <span class="status" style="color: ${isUsed ? 'var(--success)' : 'var(--danger)'}">
                $${remaining.toFixed(2)} remaining
            </span>
        `;
        detailsDiv.onclick = (e) => {
            if (e.target.closest('.edit-form')) return;
            if (e.target.closest('.smart-stepper-btn')) return;
            if (e.target.tagName === 'INPUT') return;
            li.classList.toggle('benefit-used');
        };

        // Meta
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        let metaText = `($${benefit.usedAmount.toFixed(2)} / $${benefit.totalAmount.toFixed(2)}) - ${benefit.frequency} benefit`;
        if (benefit.frequency !== 'one-time') metaText += ` | ${benefit.resetType}`;
        metaDiv.textContent = metaText;

        // Progress
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar';
        progressContainer.innerHTML = `<div class="progress-bar-inner" style="width: ${progressPercent}%; background-color: ${isUsed ? 'var(--success)' : 'var(--primary-color)'};"></div>`;

        // Reset Date
        const nextResetDiv = document.createElement('div');
        nextResetDiv.className = 'next-reset';
        if (benefit.frequency !== 'one-time') {
            const nextResetDate = DateUtils.calculateNextResetDate(benefit, card, this.app.today);
            nextResetDiv.textContent = `Resets on: ${nextResetDate.toLocaleDateString()}`;
        } else {
            nextResetDiv.textContent = `One-time benefit`;
        }

        // Controls
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'benefit-controls';

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
                if (current % step === 0) {
                    nextVal = current - step;
                } else {
                    nextVal = Math.ceil(current / step) * step - step;
                }
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

        controlsDiv.appendChild(updateLabel);
        controlsDiv.appendChild(inputWrapper);
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

            <button type="submit">Add Benefit</button>
        `;

        const freqSelect = form.querySelector(`#freq-${uId}`);
        const resetGroup = form.querySelector(`#reset-group-${uId}`);
        const resetSelect = form.querySelector(`#reset-${uId}`);

        const acRow = form.querySelector(`#auto-claim-row-${uId}`);
        const acCheck = form.querySelector(`#ac-check-${uId}`);
        const acDateGroup = form.querySelector(`#ac-date-group-${uId}`);

        const igRow = form.querySelector(`#ignore-row-${uId}`);
        const igCheck = form.querySelector(`#ig-check-${uId}`);
        const igDateGroup = form.querySelector(`#ig-date-group-${uId}`);

        freqSelect.onchange = (e) => {
            const isOneTime = e.target.value === 'one-time';
            if (isOneTime) {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                acRow.style.display = 'none';
                igRow.style.display = 'none';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                acRow.style.display = 'flex';
                igRow.style.display = 'flex';
            }
        };

        // Mutual Exclusivity Logic
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
            const benefitData = {
                description: formData.get('description'),
                totalAmount: parseFloat(formData.get('totalAmount')),
                frequency: formData.get('frequency'),
                resetType: formData.get('frequency') === 'one-time' ? null : formData.get('resetType'),
                autoClaim: formData.get('autoClaim') === 'on',
                autoClaimEndDate: formData.get('autoClaimEndDate') || null,
                ignored: formData.get('ignored') === 'on',
                ignoredEndDate: formData.get('ignoredEndDate') || null
            };
            this.app.handleAddBenefit(cardId, benefitData);
            e.target.reset();
            // UI Reset
            resetGroup.style.display = 'none';
            acRow.style.display = 'none';
            acDateGroup.style.display = 'none';
            igRow.style.display = 'none';
            igDateGroup.style.display = 'none';
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

        const isRecurring = benefit.frequency !== 'one-time';
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

        const acRow = document.getElementById(`auto-claim-row-${uId}`);
        const acCheck = document.getElementById(`ac-check-${uId}`);
        const acDateGroup = document.getElementById(`ac-date-group-${uId}`);
        const acDateInput = document.getElementById(`ac-date-${uId}`);

        const igRow = document.getElementById(`ignore-row-${uId}`);
        const igCheck = document.getElementById(`ig-check-${uId}`);
        const igDateGroup = document.getElementById(`ig-date-group-${uId}`);
        const igDateInput = document.getElementById(`ig-date-${uId}`);

        freqSelect.onchange = (e) => {
            if (e.target.value === 'one-time') {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
                acRow.style.display = 'none';
                igRow.style.display = 'none';
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
                acRow.style.display = 'flex';
                igRow.style.display = 'flex';
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
            const newData = {
                description: document.getElementById(`desc-${uId}`).value.trim(),
                totalAmount: parseFloat(document.getElementById(`amt-${uId}`).value),
                frequency: freqSelect.value,
                resetType: null,
                autoClaim: acCheck.checked,
                autoClaimEndDate: acCheck.checked ? acDateInput.value : null,
                ignored: igCheck.checked,
                ignoredEndDate: igCheck.checked ? igDateInput.value : null
            };
            if (newData.frequency !== 'one-time') {
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
