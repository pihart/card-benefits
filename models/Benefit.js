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
     * Updates earn progress for carryover benefits.
     * @param {number} progress
     * @param {Date} currentDate - Current date for earning new instance
     * @returns {boolean} True if a new instance was earned
     */
    setEarnProgress(progress, currentDate) {
        if (!this.isCarryoverBenefit()) return false;
        if (isNaN(progress) || progress < 0) progress = 0;
        this.earnProgress = progress;

        // Check if threshold is met and can earn this year
        if (progress >= this.earnThreshold && this.canEarnCarryoverThisYear(currentDate)) {
            this.earnedInstances.push({
                earnedDate: currentDate.toISOString(),
                usedAmount: 0
            });
            return true;
        }
        return false;
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
            requiredMinimumSpendId: this.requiredMinimumSpendId
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
