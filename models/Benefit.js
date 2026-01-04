/**
 * Represents a credit card benefit.
 * Encapsulates benefit data and provides methods for checking status, expiry, etc.
 */
class Benefit {
    /**
     * @param {Object} data - Benefit data
     * @param {string} data.id - Unique identifier
     * @param {string} data.description - Benefit description
     * @param {number} data.totalAmount - Total credit amount
     * @param {number} data.usedAmount - Amount used
     * @param {string} data.frequency - 'monthly', 'quarterly', 'biannual', 'annual', 'every-4-years', 'one-time', or 'carryover'
     * @param {string|null} data.resetType - 'calendar' or 'anniversary'
     * @param {string|null} data.lastReset - ISO date string of last reset
     * @param {boolean} data.autoClaim - Whether to auto-claim
     * @param {string|null} data.autoClaimEndDate - End date for auto-claim
     * @param {boolean} data.ignored - Whether benefit is ignored
     * @param {string|null} data.ignoredEndDate - End date for ignored status
     * @param {string|null} data.expiryDate - Expiry date for one-time benefits
     * @param {boolean} data.isCarryover - Whether this is a carryover benefit
     * @param {Array|null} data.earnedInstances - Earned instances for carryover
     * @param {string|null} data.lastEarnReset - Last earn reset date for carryover (for backward compatibility)
     * @param {string|null} data.requiredMinimumSpendId - ID of the minimum spend that must be met to unlock/earn this benefit
     * @param {Array<Object>|null} data.usageJustifications - Array of usage justifications with amounts, notes, and reminders
     * @param {Date|string|null} anniversaryDate - Card anniversary date (for anniversary-based resets)
     */
    constructor(data, anniversaryDate = null) {
        this.id = data.id || `benefit-${Math.random().toString(36).substr(2, 9)}`;
        this.description = data.description;
        this.totalAmount = data.totalAmount;
        this.usedAmount = data.usedAmount || 0;
        this.frequency = data.frequency;
        this.resetType = data.resetType || null;
        this.lastReset = data.lastReset || null;
        this.autoClaim = data.autoClaim || false;
        this.autoClaimEndDate = data.autoClaimEndDate || null;
        this.ignored = data.ignored || false;
        this.ignoredEndDate = data.ignoredEndDate || null;
        this.expiryDate = data.expiryDate || null;
        
        // Carryover-specific fields
        this.isCarryover = data.isCarryover || false;
        this.earnedInstances = data.earnedInstances || [];
        this.lastEarnReset = data.lastEarnReset || null;

        // Minimum spend precondition - links benefit to a minimum spend requirement
        // For carryover benefits, this replaces the old earnThreshold field
        this.requiredMinimumSpendId = data.requiredMinimumSpendId || null;

        // Usage justifications - track why credits were used
        // Each entry: { id, amount, justification, reminderDate, confirmed }
        this.usageJustifications = data.usageJustifications || [];

        // Store anniversary date for cycle calculations
        this._anniversaryDate = anniversaryDate;

        // Create appropriate cycle instance
        if (this.isCarryover) {
            this._carryoverCycle = new CarryoverCycle({
                earnedInstances: this.earnedInstances,
                lastEarnReset: this.lastEarnReset
            });
        } else {
            this._expiryCycle = new ExpiryCycle({
                frequency: this.frequency,
                resetType: this.resetType,
                lastReset: this.lastReset,
                anniversaryDate: this._anniversaryDate
            });
        }
    }

    /**
     * Updates the anniversary date (when the parent card's anniversary changes).
     * @param {Date|string} anniversaryDate
     */
    setAnniversaryDate(anniversaryDate) {
        this._anniversaryDate = anniversaryDate;
        if (!this.isCarryover) {
            this._expiryCycle = new ExpiryCycle({
                frequency: this.frequency,
                resetType: this.resetType,
                lastReset: this.lastReset,
                anniversaryDate: this._anniversaryDate
            });
        }
    }

    /**
     * Checks if auto-claim is currently active.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    isAutoClaimActive(currentDate) {
        if (this.isOneTime()) return false;
        if (this.autoClaim !== true) return false;
        if (!this.autoClaimEndDate) return false;
        const endDate = new Date(this.autoClaimEndDate);
        endDate.setHours(0, 0, 0, 0);
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return endDate >= today;
    }

    /**
     * Checks if the benefit is currently ignored.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    isIgnoredActive(currentDate) {
        if (this.isOneTime()) return false;
        if (this.ignored !== true) return false;
        if (!this.ignoredEndDate) return false;
        const endDate = new Date(this.ignoredEndDate);
        endDate.setHours(0, 0, 0, 0);
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return endDate >= today;
    }

    /**
     * Checks if this is a one-time benefit.
     * @returns {boolean}
     */
    isOneTime() {
        return this.frequency === 'one-time';
    }

    /**
     * Checks if this is a carryover benefit.
     * @returns {boolean}
     */
    isCarryoverBenefit() {
        return this.isCarryover === true;
    }

    /**
     * Checks if this is a recurring benefit.
     * @returns {boolean}
     */
    isRecurring() {
        return !this.isOneTime() && !this.isCarryoverBenefit();
    }

    /**
     * Checks if this benefit has a required minimum spend.
     * @returns {boolean}
     */
    hasRequiredMinimumSpend() {
        return this.requiredMinimumSpendId !== null && this.requiredMinimumSpendId !== undefined;
    }

    /**
     * Gets the required minimum spend ID.
     * @returns {string|null}
     */
    getRequiredMinimumSpendId() {
        return this.requiredMinimumSpendId;
    }

    /**
     * Sets the required minimum spend ID.
     * @param {string|null} minSpendId - The minimum spend ID or null to remove requirement
     */
    setRequiredMinimumSpendId(minSpendId) {
        this.requiredMinimumSpendId = minSpendId || null;
    }

    /**
     * Gets the remaining amount for regular benefits.
     * @returns {number}
     */
    getRemainingAmount() {
        return this.totalAmount - this.usedAmount;
    }

    /**
     * Checks if the benefit is fully used.
     * @param {Date} currentDate - The reference date (for carryover benefits)
     * @returns {boolean}
     */
    isFullyUsed(currentDate) {
        if (this.isCarryoverBenefit()) {
            return this.getTotalCarryoverRemaining(currentDate) <= 0;
        }
        return this.getRemainingAmount() <= 0;
    }

    // ==================== CARRYOVER METHODS ====================

    /**
     * Gets all active (non-expired) earned instances.
     * @param {Date} currentDate - The reference date
     * @returns {Array<Object>}
     */
    getActiveCarryoverInstances(currentDate) {
        if (!this.isCarryoverBenefit()) return [];
        this._syncCarryoverCycle();
        return this._carryoverCycle.getActiveInstances(currentDate);
    }

    /**
     * Checks if there are any active earned instances.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    hasActiveCarryoverInstances(currentDate) {
        if (!this.isCarryoverBenefit()) return false;
        this._syncCarryoverCycle();
        return this._carryoverCycle.hasActiveInstances(currentDate);
    }

    /**
     * Gets the total remaining credit across all active carryover instances.
     * @param {Date} currentDate - The reference date
     * @returns {number}
     */
    getTotalCarryoverRemaining(currentDate) {
        if (!this.isCarryoverBenefit()) return 0;
        this._syncCarryoverCycle();
        return this._carryoverCycle.getTotalRemaining(this.totalAmount, currentDate);
    }

    /**
     * Checks if a new carryover credit can be earned this year.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    canEarnCarryoverThisYear(currentDate) {
        if (!this.isCarryoverBenefit()) return false;
        this._syncCarryoverCycle();
        return this._carryoverCycle.canEarnThisYear(currentDate);
    }

    /**
     * Gets the earliest expiry date for carryover instances.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null}
     */
    getCarryoverExpiryDate(currentDate) {
        if (!this.isCarryoverBenefit()) return null;
        this._syncCarryoverCycle();
        return this._carryoverCycle.getEarliestExpiryDate(currentDate);
    }

    /**
     * Gets the earn deadline for carryover benefits.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null}
     */
    getCarryoverEarnDeadline(currentDate) {
        if (!this.isCarryoverBenefit()) return null;
        this._syncCarryoverCycle();
        return this._carryoverCycle.getEarnDeadline(currentDate);
    }

    /**
     * Gets instances that expire within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days
     * @returns {Array}
     */
    getExpiringCarryoverInstances(currentDate, days) {
        if (!this.isCarryoverBenefit()) return [];
        this._syncCarryoverCycle();
        return this._carryoverCycle.getExpiringInstances(currentDate, days);
    }

    /**
     * Syncs the carryover cycle with current benefit state.
     * @private
     */
    _syncCarryoverCycle() {
        this._carryoverCycle = new CarryoverCycle({
            earnedInstances: this.earnedInstances,
            lastEarnReset: this.lastEarnReset
        });
    }

    // ==================== REGULAR BENEFIT METHODS ====================

    /**
     * Calculates the next reset date for recurring benefits.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null}
     */
    getNextResetDate(currentDate) {
        if (!this.isRecurring()) return null;
        this._syncExpiryCycle();
        return this._expiryCycle.calculateNextResetDate(currentDate);
    }

    /**
     * Checks if the benefit needs to be reset.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    needsReset(currentDate) {
        if (!this.isRecurring()) return false;
        this._syncExpiryCycle();
        return this._expiryCycle.isExpired(currentDate);
    }

    /**
     * Checks if the benefit expires within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days
     * @returns {boolean}
     */
    expiresWithin(currentDate, days) {
        if (this.isCarryoverBenefit()) {
            this._syncCarryoverCycle();
            return this._carryoverCycle.hasExpiringWithin(currentDate, days);
        }
        if (!this.isRecurring()) return false;
        this._syncExpiryCycle();
        return this._expiryCycle.expiresWithin(currentDate, days);
    }

    /**
     * Syncs the expiry cycle with current benefit state.
     * @private
     */
    _syncExpiryCycle() {
        this._expiryCycle = new ExpiryCycle({
            frequency: this.frequency,
            resetType: this.resetType,
            lastReset: this.lastReset,
            anniversaryDate: this._anniversaryDate
        });
    }

    // ==================== MUTATION METHODS ====================

    /**
     * Resets the benefit usage.
     * @param {Date} currentDate - The current date for lastReset
     */
    reset(currentDate) {
        this.usedAmount = 0;
        this.lastReset = currentDate.toISOString();
    }

    /**
     * Marks the benefit as fully claimed.
     */
    markFullyClaimed() {
        this.usedAmount = this.totalAmount;
    }

    /**
     * Updates the used amount.
     * @param {number} amount
     */
    setUsedAmount(amount) {
        if (isNaN(amount) || amount < 0) amount = 0;
        if (amount > this.totalAmount) amount = this.totalAmount;
        this.usedAmount = amount;
    }

    /**
     * Updates usage for a specific carryover instance.
     * @param {number} instanceIndex
     * @param {number} amount
     */
    setCarryoverInstanceUsage(instanceIndex, amount) {
        if (!this.isCarryoverBenefit()) return;
        if (!this.earnedInstances || !this.earnedInstances[instanceIndex]) return;
        if (isNaN(amount) || amount < 0) amount = 0;
        if (amount > this.totalAmount) amount = this.totalAmount;
        this.earnedInstances[instanceIndex].usedAmount = amount;
    }

    /**
     * Adds a usage justification to a carryover instance.
     * @param {number} instanceIndex
     * @param {number} amount
     * @param {string} justification
     * @param {string|null} reminderDate
     * @param {string|null} chargeDate
     * @returns {Object|null} The created justification entry or null if failed
     */
    addCarryoverInstanceJustification(instanceIndex, amount, justification, reminderDate = null, chargeDate = null) {
        if (!this.isCarryoverBenefit()) return null;
        if (!this.earnedInstances || !this.earnedInstances[instanceIndex]) return null;
        
        const instance = this.earnedInstances[instanceIndex];
        if (!instance.usageJustifications) {
            instance.usageJustifications = [];
        }
        
        const entry = {
            id: `just-${Math.random().toString(36).substr(2, 9)}`,
            amount: amount,
            justification: justification,
            reminderDate: reminderDate,
            chargeDate: chargeDate,
            confirmed: false
        };
        instance.usageJustifications.push(entry);
        return entry;
    }

    /**
     * Removes a usage justification from a carryover instance.
     * @param {number} instanceIndex
     * @param {string} justificationId
     * @returns {boolean} True if removed
     */
    removeCarryoverInstanceJustification(instanceIndex, justificationId) {
        if (!this.isCarryoverBenefit()) return false;
        if (!this.earnedInstances || !this.earnedInstances[instanceIndex]) return false;
        
        const instance = this.earnedInstances[instanceIndex];
        if (!instance.usageJustifications) return false;
        
        const index = instance.usageJustifications.findIndex(j => j.id === justificationId);
        if (index > -1) {
            instance.usageJustifications.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Updates a usage justification in a carryover instance.
     * @param {number} instanceIndex
     * @param {string} justificationId
     * @param {Object} updates
     * @returns {boolean} True if updated
     */
    updateCarryoverInstanceJustification(instanceIndex, justificationId, updates) {
        if (!this.isCarryoverBenefit()) return false;
        if (!this.earnedInstances || !this.earnedInstances[instanceIndex]) return false;
        
        const instance = this.earnedInstances[instanceIndex];
        if (!instance.usageJustifications) return false;
        
        const entry = instance.usageJustifications.find(j => j.id === justificationId);
        if (entry) {
            Object.assign(entry, updates);
            return true;
        }
        return false;
    }

    /**
     * Gets pending reminders for carryover instance justifications.
     * @param {number} instanceIndex
     * @param {Date} currentDate
     * @returns {Array<Object>}
     */
    getCarryoverInstancePendingReminders(instanceIndex, currentDate) {
        if (!this.isCarryoverBenefit()) return [];
        if (!this.earnedInstances || !this.earnedInstances[instanceIndex]) return [];
        
        const instance = this.earnedInstances[instanceIndex];
        if (!instance.usageJustifications) return [];
        
        return instance.usageJustifications.filter(j => {
            if (!j.reminderDate || j.confirmed) return false;
            const reminderDate = new Date(j.reminderDate);
            reminderDate.setHours(0, 0, 0, 0);
            const today = new Date(currentDate);
            today.setHours(0, 0, 0, 0);
            return reminderDate <= today;
        });
    }

    // ==================== USAGE JUSTIFICATION METHODS ====================

    /**
     * Adds a usage justification entry.
     * @param {number} amount - The amount used for this justification
     * @param {string} justification - The justification text (e.g., "Trip to Spain")
     * @param {string|null} reminderDate - Optional ISO date string for reminder
     * @param {string|null} chargeDate - Optional ISO date string for when the charge occurred
     * @returns {Object} The created justification entry
     */
    addUsageJustification(amount, justification, reminderDate = null, chargeDate = null) {
        const entry = {
            id: `just-${Math.random().toString(36).substr(2, 9)}`,
            amount: amount,
            justification: justification,
            reminderDate: reminderDate,
            chargeDate: chargeDate,
            confirmed: false
        };
        this.usageJustifications.push(entry);
        return entry;
    }

    /**
     * Removes a usage justification by ID.
     * @param {string} justificationId
     * @returns {boolean} True if removed
     */
    removeUsageJustification(justificationId) {
        const index = this.usageJustifications.findIndex(j => j.id === justificationId);
        if (index > -1) {
            this.usageJustifications.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Updates a usage justification.
     * @param {string} justificationId
     * @param {Object} updates - Object with fields to update
     * @returns {boolean} True if updated
     */
    updateUsageJustification(justificationId, updates) {
        const entry = this.usageJustifications.find(j => j.id === justificationId);
        if (entry) {
            Object.assign(entry, updates);
            return true;
        }
        return false;
    }

    /**
     * Gets the total amount from all justifications.
     * @returns {number}
     */
    getTotalJustifiedAmount() {
        return this.usageJustifications.reduce((sum, j) => sum + (j.amount || 0), 0);
    }

    /**
     * Gets justifications with pending reminders (reminder date in the past, not confirmed).
     * @param {Date} currentDate
     * @returns {Array<Object>}
     */
    getPendingReminders(currentDate) {
        return this.usageJustifications.filter(j => {
            if (!j.reminderDate || j.confirmed) return false;
            const reminderDate = new Date(j.reminderDate);
            reminderDate.setHours(0, 0, 0, 0);
            const today = new Date(currentDate);
            today.setHours(0, 0, 0, 0);
            return reminderDate <= today;
        });
    }

    /**
     * Marks a justification as confirmed.
     * @param {string} justificationId
     * @returns {boolean} True if confirmed
     */
    confirmJustification(justificationId) {
        const entry = this.usageJustifications.find(j => j.id === justificationId);
        if (entry) {
            entry.confirmed = true;
            return true;
        }
        return false;
    }

    /**
     * Updates benefit properties.
     * @param {Object} data - New data to merge
     */
    update(data) {
        Object.assign(this, data);
        
        // Re-create cycles after update
        if (this.isCarryover) {
            this._syncCarryoverCycle();
        } else {
            this._syncExpiryCycle();
        }
    }

    // ==================== SERIALIZATION ====================

    /**
     * Creates a plain object representation for serialization.
     * @returns {Object}
     */
    toJSON() {
        const data = {
            id: this.id,
            description: this.description,
            totalAmount: this.totalAmount,
            usedAmount: this.usedAmount,
            frequency: this.frequency,
            resetType: this.resetType,
            lastReset: this.lastReset,
            autoClaim: this.autoClaim,
            autoClaimEndDate: this.autoClaimEndDate,
            ignored: this.ignored,
            ignoredEndDate: this.ignoredEndDate,
            expiryDate: this.expiryDate,
            isCarryover: this.isCarryover,
            earnedInstances: this.earnedInstances,
            lastEarnReset: this.lastEarnReset,
            requiredMinimumSpendId: this.requiredMinimumSpendId,
            usageJustifications: this.usageJustifications
        };
        return data;
    }

    /**
     * Creates a Benefit from a plain object.
     * @param {Object} data
     * @param {Date|string|null} anniversaryDate
     * @returns {Benefit}
     */
    static fromJSON(data, anniversaryDate = null) {
        return new Benefit(data, anniversaryDate);
    }
}
