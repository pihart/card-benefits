/**
 * Represents an expiry cycle for benefits.
 * Encapsulates logic for determining when a benefit resets or expires.
 * Uses dependency-injected current datetime for testability.
 */
class ExpiryCycle {
    /**
     * @param {Object} config
     * @param {string} config.frequency - 'monthly', 'quarterly', 'biannual', 'annual', 'every-4-years', 'one-time', or 'carryover'
     * @param {string|null} config.resetType - 'calendar' or 'anniversary' (null for one-time/carryover)
     * @param {Date|string|null} config.lastReset - Last reset date
     * @param {Date|string|null} config.anniversaryDate - Card anniversary date (for anniversary-based resets)
     */
    constructor({ frequency, resetType = null, lastReset = null, anniversaryDate = null }) {
        this.frequency = frequency;
        this.resetType = resetType;
        this.lastReset = lastReset ? new Date(lastReset) : null;
        this.anniversaryDate = anniversaryDate ? new Date(anniversaryDate) : null;
        
        if (this.lastReset) {
            this.lastReset.setHours(0, 0, 0, 0);
        }
        if (this.anniversaryDate) {
            this.anniversaryDate.setMinutes(this.anniversaryDate.getMinutes() + this.anniversaryDate.getTimezoneOffset());
            this.anniversaryDate.setHours(0, 0, 0, 0);
        }
    }

    /**
     * Checks if this cycle is a one-time benefit (no recurring reset).
     * @returns {boolean}
     */
    isOneTime() {
        return this.frequency === 'one-time';
    }

    /**
     * Checks if this cycle is a carryover benefit.
     * @returns {boolean}
     */
    isCarryover() {
        return this.frequency === 'carryover';
    }

    /**
     * Checks if this cycle is recurring (has periodic resets).
     * @returns {boolean}
     */
    isRecurring() {
        return !this.isOneTime() && !this.isCarryover();
    }

    /**
     * Checks if the benefit has expired and needs to be reset.
     * @param {Date} currentDate - The reference date (usually "today")
     * @returns {boolean} True if the next reset date is on or before currentDate
     */
    isExpired(currentDate) {
        if (!this.isRecurring()) {
            return false;
        }
        const nextReset = this.calculateNextResetDate(currentDate);
        return nextReset <= currentDate;
    }

    /**
     * Calculates the next date this benefit is scheduled to reset.
     * @param {Date} referenceDate - The reference date (usually "today")
     * @returns {Date} The next reset date
     */
    calculateNextResetDate(referenceDate) {
        if (!this.lastReset || !this.isRecurring()) {
            return null;
        }

        const normalizedReference = new Date(referenceDate);
        normalizedReference.setHours(0, 0, 0, 0);

        let lastReset = new Date(this.lastReset);
        lastReset.setHours(0, 0, 0, 0);

        let nextReset = this.resetType === 'calendar'
            ? this._calculateCalendarReset(lastReset)
            : this._calculateAnniversaryReset(lastReset);

        while (nextReset && nextReset < normalizedReference) {
            if (nextReset.getTime() === lastReset.getTime()) {
                break;
            }
            lastReset = nextReset;
            nextReset = this.resetType === 'calendar'
                ? this._calculateCalendarReset(lastReset)
                : this._calculateAnniversaryReset(lastReset);
        }

        return nextReset;
    }

    /**
     * @private
     */
    _calculateCalendarReset(lastReset) {
        const nextReset = new Date(lastReset.getTime());

        switch (this.frequency) {
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

        return nextReset;
    }

    /**
     * @private
     */
    _calculateAnniversaryReset(lastReset) {
        if (!this.anniversaryDate) {
            return new Date(lastReset);
        }

        let nextReset = new Date(lastReset.getFullYear(), lastReset.getMonth(), this.anniversaryDate.getDate());

        switch (this.frequency) {
            case 'monthly':
                if (nextReset <= lastReset) {
                    nextReset.setMonth(nextReset.getMonth() + 1);
                }
                break;
            case 'quarterly':
                nextReset = new Date(lastReset.getFullYear(), this.anniversaryDate.getMonth(), this.anniversaryDate.getDate());
                while (nextReset <= lastReset) {
                    nextReset.setMonth(nextReset.getMonth() + 3);
                }
                break;
            case 'biannual':
                nextReset = new Date(lastReset.getFullYear(), this.anniversaryDate.getMonth(), this.anniversaryDate.getDate());
                while (nextReset <= lastReset) {
                    nextReset.setMonth(nextReset.getMonth() + 6);
                }
                break;
            case 'annual':
                nextReset = new Date(lastReset.getFullYear(), this.anniversaryDate.getMonth(), this.anniversaryDate.getDate());
                if (nextReset <= lastReset) {
                    nextReset.setFullYear(nextReset.getFullYear() + 1);
                }
                break;
            case 'every-4-years':
                nextReset = new Date(lastReset.getFullYear() + 4, lastReset.getMonth(), lastReset.getDate());
                break;
        }

        return nextReset;
    }

    /**
     * Returns the number of days until the next reset.
     * @param {Date} currentDate - The reference date
     * @returns {number|null} Days until next reset, or null if not applicable
     */
    daysUntilReset(currentDate) {
        const nextReset = this.calculateNextResetDate(currentDate);
        if (!nextReset) {
            return null;
        }
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const diffTime = nextReset.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Checks if the benefit expires within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days to check
     * @returns {boolean}
     */
    expiresWithin(currentDate, days) {
        const daysUntil = this.daysUntilReset(currentDate);
        return daysUntil !== null && daysUntil > 0 && daysUntil <= days;
    }

    /**
     * Gets the deadline/end date of the current period.
     * For recurring cycles, this is the day before the next reset.
     * For one-time, this returns the deadline if set.
     * @param {Date} currentDate - The reference date
     * @param {Date|null} deadline - Optional specific deadline for one-time cycles
     * @returns {Date|null}
     */
    getDeadline(currentDate, deadline = null) {
        if (this.isOneTime()) {
            return deadline;
        }
        
        if (!this.isRecurring()) {
            return null;
        }
        
        // For recurring, deadline is the day before next reset
        const nextReset = this.calculateNextResetDate(currentDate);
        if (!nextReset) return null;
        
        const periodEnd = new Date(nextReset);
        periodEnd.setDate(periodEnd.getDate() - 1);
        return periodEnd;
    }

    /**
     * Gets the number of days until the deadline.
     * @param {Date} currentDate - The reference date
     * @param {Date|null} deadline - Optional specific deadline for one-time cycles
     * @returns {number|null}
     */
    daysUntilDeadline(currentDate, deadline = null) {
        const dl = this.getDeadline(currentDate, deadline);
        if (!dl) return null;
        
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const diffTime = dl.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Checks if the deadline is within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days to check
     * @param {Date|null} deadline - Optional specific deadline for one-time cycles
     * @returns {boolean}
     */
    deadlineWithin(currentDate, days, deadline = null) {
        const daysUntil = this.daysUntilDeadline(currentDate, deadline);
        return daysUntil !== null && daysUntil > 0 && daysUntil <= days;
    }

    /**
     * Checks if the deadline has passed (cycle expired).
     * @param {Date} currentDate - The reference date
     * @param {Date|null} deadline - Optional specific deadline for one-time cycles
     * @returns {boolean}
     */
    isDeadlinePassed(currentDate, deadline = null) {
        const dl = this.getDeadline(currentDate, deadline);
        if (!dl) return false;
        
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return today > dl;
    }

    /**
     * Creates a plain object representation for serialization.
     * @returns {Object}
     */
    toJSON() {
        return {
            frequency: this.frequency,
            resetType: this.resetType,
            lastReset: this.lastReset ? this.lastReset.toISOString() : null
        };
    }

    /**
     * Creates an ExpiryCycle from a plain object.
     * @param {Object} data
     * @param {Date|string|null} anniversaryDate
     * @returns {ExpiryCycle}
     */
    static fromJSON(data, anniversaryDate = null) {
        return new ExpiryCycle({
            frequency: data.frequency,
            resetType: data.resetType,
            lastReset: data.lastReset,
            anniversaryDate: anniversaryDate
        });
    }
}
