/**
 * Represents an expiry cycle for minimum spend requirements.
 * Minimum spends can be one-time (by a specific date), yearly, or other frequencies.
 * Uses dependency-injected current datetime for testability.
 */
class MinimumSpendCycle {
    /**
     * @param {Object} config
     * @param {string} config.frequency - 'one-time', 'yearly', 'monthly', 'quarterly', etc.
     * @param {string|null} config.resetType - 'calendar' or 'anniversary' (null for one-time)
     * @param {Date|string|null} config.deadline - Specific deadline for one-time minimum spends
     * @param {Date|string|null} config.lastReset - Last reset date for recurring minimum spends
     * @param {Date|string|null} config.anniversaryDate - Card anniversary date (for anniversary-based resets)
     */
    constructor({ frequency, resetType = null, deadline = null, lastReset = null, anniversaryDate = null }) {
        this.frequency = frequency;
        this.resetType = resetType;
        this.deadline = deadline ? new Date(deadline) : null;
        this.lastReset = lastReset ? new Date(lastReset) : null;
        this.anniversaryDate = anniversaryDate ? new Date(anniversaryDate) : null;
        
        if (this.deadline) {
            this.deadline.setHours(0, 0, 0, 0);
        }
        if (this.lastReset) {
            this.lastReset.setHours(0, 0, 0, 0);
        }
        if (this.anniversaryDate) {
            this.anniversaryDate.setMinutes(this.anniversaryDate.getMinutes() + this.anniversaryDate.getTimezoneOffset());
            this.anniversaryDate.setHours(0, 0, 0, 0);
        }
    }

    /**
     * Checks if this is a one-time minimum spend.
     * @returns {boolean}
     */
    isOneTime() {
        return this.frequency === 'one-time';
    }

    /**
     * Checks if this is a yearly minimum spend.
     * @returns {boolean}
     */
    isYearly() {
        return this.frequency === 'yearly';
    }

    /**
     * Checks if this is a recurring minimum spend.
     * @returns {boolean}
     */
    isRecurring() {
        return !this.isOneTime();
    }

    /**
     * Gets the deadline for the current minimum spend period.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null} The deadline date
     */
    getDeadline(currentDate) {
        if (this.isOneTime()) {
            return this.deadline;
        }
        
        // For recurring minimum spends, calculate the end of the current period
        return this._calculatePeriodEndDate(currentDate);
    }

    /**
     * Checks if the minimum spend period has expired (deadline passed without meeting requirement).
     * @param {Date} currentDate - The reference date
     * @returns {boolean} True if the deadline has passed
     */
    isExpired(currentDate) {
        const deadline = this.getDeadline(currentDate);
        if (!deadline) return false;
        
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return today > deadline;
    }

    /**
     * Gets the number of days until the deadline.
     * @param {Date} currentDate - The reference date
     * @returns {number|null} Days until deadline, or null if no deadline
     */
    daysUntilDeadline(currentDate) {
        const deadline = this.getDeadline(currentDate);
        if (!deadline) return null;
        
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const diffTime = deadline.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Checks if the deadline is within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days to check
     * @returns {boolean}
     */
    deadlineWithin(currentDate, days) {
        const daysUntil = this.daysUntilDeadline(currentDate);
        return daysUntil !== null && daysUntil > 0 && daysUntil <= days;
    }

    /**
     * Gets the start date of the current minimum spend period.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null}
     */
    getPeriodStartDate(currentDate) {
        if (this.isOneTime()) {
            // For one-time, there's no defined start - could be creation date
            return null;
        }
        
        return this._calculatePeriodStartDate(currentDate);
    }

    /**
     * Checks if the minimum spend should be reset (new period started).
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    shouldReset(currentDate) {
        if (this.isOneTime()) return false;
        
        const periodStart = this.getPeriodStartDate(currentDate);
        if (!periodStart || !this.lastReset) return false;
        
        return this.lastReset < periodStart;
    }

    /**
     * @private
     */
    _calculatePeriodEndDate(currentDate) {
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        
        if (this.resetType === 'calendar') {
            return this._calculateCalendarPeriodEnd(today);
        } else {
            return this._calculateAnniversaryPeriodEnd(today);
        }
    }

    /**
     * @private
     */
    _calculatePeriodStartDate(currentDate) {
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        
        if (this.resetType === 'calendar') {
            return this._calculateCalendarPeriodStart(today);
        } else {
            return this._calculateAnniversaryPeriodStart(today);
        }
    }

    /**
     * @private
     */
    _calculateCalendarPeriodEnd(today) {
        const periodEnd = new Date(today);
        
        switch (this.frequency) {
            case 'monthly':
                // End of current month
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                periodEnd.setDate(0); // Last day of previous month (i.e., current month)
                break;
            case 'quarterly':
                // End of current quarter
                const currentQuarter = Math.floor(today.getMonth() / 3);
                periodEnd.setMonth((currentQuarter + 1) * 3);
                periodEnd.setDate(0);
                break;
            case 'biannual':
                // End of current half-year - use setDate(0) for consistency
                if (today.getMonth() < 6) {
                    periodEnd.setMonth(6);
                    periodEnd.setDate(0); // Last day of June
                } else {
                    periodEnd.setMonth(12);
                    periodEnd.setDate(0); // Last day of December (month 11)
                }
                break;
            case 'yearly':
            case 'annual':
                // End of current year
                periodEnd.setMonth(11);
                periodEnd.setDate(31);
                break;
        }
        
        return periodEnd;
    }

    /**
     * @private
     */
    _calculateCalendarPeriodStart(today) {
        const periodStart = new Date(today);
        
        switch (this.frequency) {
            case 'monthly':
                periodStart.setDate(1);
                break;
            case 'quarterly':
                const currentQuarter = Math.floor(today.getMonth() / 3);
                periodStart.setMonth(currentQuarter * 3);
                periodStart.setDate(1);
                break;
            case 'biannual':
                if (today.getMonth() < 6) {
                    periodStart.setMonth(0);
                } else {
                    periodStart.setMonth(6);
                }
                periodStart.setDate(1);
                break;
            case 'yearly':
            case 'annual':
                periodStart.setMonth(0);
                periodStart.setDate(1);
                break;
        }
        
        return periodStart;
    }

    /**
     * @private
     */
    _calculateAnniversaryPeriodEnd(today) {
        if (!this.anniversaryDate) {
            return this._calculateCalendarPeriodEnd(today);
        }

        const anniversaryMonth = this.anniversaryDate.getMonth();
        const anniversaryDay = this.anniversaryDate.getDate();
        
        // Find the next anniversary date
        let periodEnd = new Date(today.getFullYear(), anniversaryMonth, anniversaryDay);
        
        switch (this.frequency) {
            case 'monthly':
                periodEnd = new Date(today.getFullYear(), today.getMonth(), anniversaryDay);
                if (periodEnd <= today) {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                }
                // Go back one day to get end of period
                periodEnd.setDate(periodEnd.getDate() - 1);
                break;
            case 'quarterly':
                periodEnd = new Date(today.getFullYear(), anniversaryMonth, anniversaryDay);
                while (periodEnd <= today) {
                    periodEnd.setMonth(periodEnd.getMonth() + 3);
                }
                periodEnd.setDate(periodEnd.getDate() - 1);
                break;
            case 'biannual':
                periodEnd = new Date(today.getFullYear(), anniversaryMonth, anniversaryDay);
                while (periodEnd <= today) {
                    periodEnd.setMonth(periodEnd.getMonth() + 6);
                }
                periodEnd.setDate(periodEnd.getDate() - 1);
                break;
            case 'yearly':
            case 'annual':
                if (periodEnd <= today) {
                    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
                }
                periodEnd.setDate(periodEnd.getDate() - 1);
                break;
        }
        
        return periodEnd;
    }

    /**
     * @private
     */
    _calculateAnniversaryPeriodStart(today) {
        if (!this.anniversaryDate) {
            return this._calculateCalendarPeriodStart(today);
        }

        const anniversaryMonth = this.anniversaryDate.getMonth();
        const anniversaryDay = this.anniversaryDate.getDate();
        
        let periodStart = new Date(today.getFullYear(), anniversaryMonth, anniversaryDay);
        
        switch (this.frequency) {
            case 'monthly':
                periodStart = new Date(today.getFullYear(), today.getMonth(), anniversaryDay);
                if (periodStart > today) {
                    periodStart.setMonth(periodStart.getMonth() - 1);
                }
                break;
            case 'quarterly':
                periodStart = new Date(today.getFullYear(), anniversaryMonth, anniversaryDay);
                while (periodStart > today) {
                    periodStart.setMonth(periodStart.getMonth() - 3);
                }
                break;
            case 'biannual':
                periodStart = new Date(today.getFullYear(), anniversaryMonth, anniversaryDay);
                while (periodStart > today) {
                    periodStart.setMonth(periodStart.getMonth() - 6);
                }
                break;
            case 'yearly':
            case 'annual':
                if (periodStart > today) {
                    periodStart.setFullYear(periodStart.getFullYear() - 1);
                }
                break;
        }
        
        return periodStart;
    }

    /**
     * Creates a plain object representation for serialization.
     * @returns {Object}
     */
    toJSON() {
        return {
            frequency: this.frequency,
            resetType: this.resetType,
            deadline: this.deadline ? this.deadline.toISOString() : null,
            lastReset: this.lastReset ? this.lastReset.toISOString() : null
        };
    }

    /**
     * Creates a MinimumSpendCycle from a plain object.
     * @param {Object} data
     * @param {Date|string|null} anniversaryDate
     * @returns {MinimumSpendCycle}
     */
    static fromJSON(data, anniversaryDate = null) {
        return new MinimumSpendCycle({
            frequency: data.frequency,
            resetType: data.resetType,
            deadline: data.deadline,
            lastReset: data.lastReset,
            anniversaryDate: anniversaryDate
        });
    }
}
