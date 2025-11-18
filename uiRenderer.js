/**
 * Handles DOM manipulation and HTML generation.
 */
class UIRenderer {
    constructor(app) {
        this.app = app; // Reference to the main controller
    }

    renderExpiringSoon(expiringItems, days) {
        const container = document.getElementById('expiring-soon-container');
        const list = document.getElementById('expiring-soon-list');

        container.style.display = 'block';
        list.innerHTML = '';

        if (expiringItems.length === 0) {
            const li = document.createElement('li');
            li.className = 'expiring-item-empty';
            li.textContent = `No unused benefits are expiring within ${days} days.`;
            list.appendChild(li);
            return;
        }

        expiringItems.forEach(item => {
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
            list.appendChild(li);
        });
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
        if (isUsed) li.classList.add('benefit-used');

        // Details
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
            // Call the static utility
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
        const updateInput = document.createElement('input');
        updateInput.type = 'number';
        updateInput.value = benefit.usedAmount.toFixed(2);
        updateInput.min = "0";
        updateInput.max = benefit.totalAmount;
        updateInput.step = "0.01";

        updateInput.onfocus = (e) => {
            // Highlight text so typing overwrites it, but spinners still work
            e.target.select();
        };

        updateInput.onblur = (e) => {
            if (e.target.value === '') e.target.value = benefit.usedAmount.toFixed(2);
        };

        updateInput.onchange = (e) => {
            this.app.handleUpdateBenefitUsage(benefit.id, parseFloat(e.target.value));
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
        deleteBtn.onclick = () => this.app.handleDeleteBenefit(benefit.id);

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
            <button type="submit">Add Benefit</button>
        `;

        const freqSelect = form.querySelector(`#freq-${uId}`);
        const resetGroup = form.querySelector(`#reset-group-${uId}`);
        const resetSelect = form.querySelector(`#reset-${uId}`);

        freqSelect.onchange = (e) => {
            if (e.target.value === 'one-time') {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
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
            this.app.handleAddBenefit(cardId, benefitData);
            // Reset UI state
            e.target.reset();
            resetGroup.style.display = 'none';
            form.style.display = 'none';
            form.previousElementSibling.style.display = 'block'; // Show the "Add" button again
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
                <div class="form-group" id="reset-group-${uId}" style="display: ${benefit.frequency === 'one-time' ? 'none' : 'block'};">
                    <label>Reset Type</label>
                    <select id="reset-${uId}" ${benefit.frequency === 'one-time' ? '' : 'required'}>
                        <option value="calendar" ${benefit.resetType === 'calendar' ? 'selected' : ''}>Calendar</option>
                        <option value="anniversary" ${benefit.resetType === 'anniversary' ? 'selected' : ''}>Anniversary-Dated</option>
                    </select>
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

        freqSelect.onchange = (e) => {
            if (e.target.value === 'one-time') {
                resetGroup.style.display = 'none';
                resetSelect.required = false;
            } else {
                resetGroup.style.display = 'block';
                resetSelect.required = true;
            }
        };

        document.getElementById(`save-${uId}`).onclick = () => {
            const newData = {
                description: document.getElementById(`desc-${uId}`).value.trim(),
                totalAmount: parseFloat(document.getElementById(`amt-${uId}`).value),
                frequency: freqSelect.value,
                resetType: null
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
