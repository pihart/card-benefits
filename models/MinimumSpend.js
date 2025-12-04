/**
 * Represents a minimum spend requirement that can be associated with benefits.
 * Minimum spends can unlock benefits when a spending threshold is met within a deadline.
 */
class MinimumSpend {
    /**
     * @param {Object} data - MinimumSpend data
     * @param {string} data.id - Unique identifier
     * @param {string} data.description - Description of the minimum spend requirement
     * @param {number} data.targetAmount - Target spend amount to meet
     * @param {number} data.currentAmount - Current progress toward target
     * @param {string} data.frequency - 'one-time', 'yearly', 'monthly', 'quarterly', 'biannual', 'annual'
     * @param {string|null} data.resetType - 'calendar' or 'anniversary' (null for one-time)
     * @param {string|null} data.deadline - Specific deadline for one-time minimum spends
     * @param {string|null} data.lastReset - ISO date string of last reset
     * @param {boolean} data.isMet - Whether the minimum spend has been met in the current period
     * @param {string|null} data.metDate - Date when the minimum spend was met
     * @param {boolean} data.ignored - Whether minimum spend is currently ignored
     * @param {string|null} data.ignoredEndDate - End date for ignored status
     * @param {Date|string|null} anniversaryDate - Card anniversary date (for anniversary-based cycles)
     */
    constructor(data, anniversaryDate = null) {
        this.id = data.id || `minspend-${Math.random().toString(36).substring(2, 11)}`;
        this.description = data.description;
        this.targetAmount = data.targetAmount;
        this.currentAmount = data.currentAmount || 0;
        this.frequency = data.frequency;
        this.resetType = data.resetType || null;
        this.deadline = data.deadline || null;
        this.lastReset = data.lastReset || null;
        this.isMet = data.isMet || false;
        this.metDate = data.metDate || null;
        this.ignored = data.ignored || false;
        this.ignoredEndDate = data.ignoredEndDate || null;

        // Store anniversary date for cycle calculations
        this._anniversaryDate = anniversaryDate;

        // Create the cycle instance
        this._cycle = new MinimumSpendCycle({
            frequency: this.frequency,
            resetType: this.resetType,
            deadline: this.deadline,
            lastReset: this.lastReset,
            anniversaryDate: this._anniversaryDate
        });
    }

    /**
     * Updates the anniversary date (when the parent card's anniversary changes).
     * @param {Date|string} anniversaryDate
     */
    setAnniversaryDate(anniversaryDate) {
        this._anniversaryDate = anniversaryDate;
        this._syncCycle();
    }

    /**
     * Syncs the cycle with current minimum spend state.
     * @private
     */
    _syncCycle() {
        this._cycle = new MinimumSpendCycle({
            frequency: this.frequency,
            resetType: this.resetType,
            deadline: this.deadline,
            lastReset: this.lastReset,
            anniversaryDate: this._anniversaryDate
        });
    }

    // ==================== STATUS METHODS ====================

    /**
     * Checks if this is a one-time minimum spend.
     * @returns {boolean}
     */
    isOneTime() {
        return this.frequency === 'one-time';
    }

    /**
     * Checks if this is a recurring minimum spend.
     * @returns {boolean}
     */
    isRecurring() {
        return !this.isOneTime();
    }

    /**
     * Gets the progress percentage toward the target.
     * @returns {number} Percentage from 0-100
     */
    getProgressPercent() {
        if (this.targetAmount <= 0) return 100;
        return Math.min((this.currentAmount / this.targetAmount) * 100, 100);
    }

    /**
     * Gets the remaining amount needed to meet the minimum spend.
     * @returns {number}
     */
    getRemainingAmount() {
        return Math.max(this.targetAmount - this.currentAmount, 0);
    }

    /**
     * Checks if the minimum spend has been met.
     * @returns {boolean}
     */
    checkIsMet() {
        return this.currentAmount >= this.targetAmount;
    }

    /**
     * Checks if the ignored status is currently active.
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
     * Checks if the minimum spend deadline has passed without being met.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    isExpired(currentDate) {
        if (this.isMet) return false;
        this._syncCycle();
        return this._cycle.isExpired(currentDate);
    }

    /**
     * Checks if the minimum spend is currently actionable (not expired, not fully met, not ignored).
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    isActionable(currentDate) {
        return !this.isMet && !this.isExpired(currentDate) && !this.isIgnoredActive(currentDate);
    }

    // ==================== DEADLINE METHODS ====================

    /**
     * Gets the deadline for the current minimum spend period.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null}
     */
    getDeadline(currentDate) {
        this._syncCycle();
        return this._cycle.getDeadline(currentDate);
    }

    /**
     * Gets the number of days until the deadline.
     * @param {Date} currentDate - The reference date
     * @returns {number|null}
     */
    daysUntilDeadline(currentDate) {
        this._syncCycle();
        return this._cycle.daysUntilDeadline(currentDate);
    }

    /**
     * Checks if the deadline is within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days
     * @returns {boolean}
     */
    deadlineWithin(currentDate, days) {
        this._syncCycle();
        return this._cycle.deadlineWithin(currentDate, days);
    }

    // ==================== RESET METHODS ====================

    /**
     * Checks if the minimum spend should be reset for a new period.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    shouldReset(currentDate) {
        this._syncCycle();
        return this._cycle.shouldReset(currentDate);
    }

    /**
     * Resets the minimum spend for a new period.
     * @param {Date} currentDate - The current date for lastReset
     */
    reset(currentDate) {
        this.currentAmount = 0;
        this.isMet = false;
        this.metDate = null;
        this.lastReset = currentDate.toISOString();
        this._syncCycle();
    }

    // ==================== MUTATION METHODS ====================

    /**
     * Updates the current spend amount.
     * Automatically marks as met when target is reached.
     * @param {number} amount - The new current amount
     * @param {Date} currentDate - The current date (for metDate)
     * @returns {boolean} True if this update caused the minimum spend to be met
     */
    setCurrentAmount(amount, currentDate) {
        if (isNaN(amount) || amount < 0) amount = 0;
        
        const wasMet = this.isMet;
        this.currentAmount = amount;
        
        if (this.currentAmount >= this.targetAmount && !this.isMet) {
            this.isMet = true;
            this.metDate = currentDate.toISOString();
            return true;
        }
        
        // If amount was reduced below target, unmet it
        if (this.currentAmount < this.targetAmount && this.isMet) {
            this.isMet = false;
            this.metDate = null;
        }
        
        return false;
    }

    /**
     * Adds to the current spend amount.
     * @param {number} amount - The amount to add
     * @param {Date} currentDate - The current date
     * @returns {boolean} True if this update caused the minimum spend to be met
     */
    addSpend(amount, currentDate) {
        if (isNaN(amount) || amount < 0) return false;
        return this.setCurrentAmount(this.currentAmount + amount, currentDate);
    }

    /**
     * Updates minimum spend properties.
     * @param {Object} data - New data to merge
     */
    update(data) {
        Object.assign(this, data);
        this._syncCycle();
    }

    // ==================== SERIALIZATION ====================

    /**
     * Creates a plain object representation for serialization.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            description: this.description,
            targetAmount: this.targetAmount,
            currentAmount: this.currentAmount,
            frequency: this.frequency,
            resetType: this.resetType,
            deadline: this.deadline,
            lastReset: this.lastReset,
            isMet: this.isMet,
            metDate: this.metDate,
            ignored: this.ignored,
            ignoredEndDate: this.ignoredEndDate
        };
    }

    /**
     * Creates a MinimumSpend from a plain object.
     * @param {Object} data
     * @param {Date|string|null} anniversaryDate
     * @returns {MinimumSpend}
     */
    static fromJSON(data, anniversaryDate = null) {
        return new MinimumSpend(data, anniversaryDate);
    }
}
