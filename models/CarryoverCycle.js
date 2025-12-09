/**
 * Represents a carryover expiry cycle for benefits.
 * Carryover benefits can be earned once per year and are valid until the end of the following year.
 * The earning requirement (minimum spend) is now handled separately by linking to a MinimumSpend object.
 * Uses dependency-injected current datetime for testability.
 */
class CarryoverCycle {
    /**
     * @param {Object} config
     * @param {Array<Object>} config.earnedInstances - Array of earned instances [{earnedDate, usedAmount}]
     * @param {Date|string|null} config.lastEarnReset - When the earn progress was last reset (for backward compatibility)
     */
    constructor({ earnedInstances = [], lastEarnReset = null }) {
        this.earnedInstances = earnedInstances || [];
        this.lastEarnReset = lastEarnReset ? new Date(lastEarnReset) : null;
        
        if (this.lastEarnReset) {
            this.lastEarnReset.setHours(0, 0, 0, 0);
        }
    }

    /**
     * Calculates the expiry date for an earned instance.
     * Credits earned in year X expire at the end of year X+1.
     * @param {Date|string} earnedDate - The date when the benefit was earned
     * @returns {Date} The expiry date (Dec 31 of the following year)
     */
    static calculateExpiryDate(earnedDate) {
        const earned = new Date(earnedDate);
        earned.setHours(0, 0, 0, 0);
        const expiryYear = earned.getFullYear() + 1;
        return new Date(expiryYear, 11, 31); // Dec 31 of next year
    }

    /**
     * Checks if a specific earned instance is still active (not expired).
     * @param {Object} instance - The earned instance {earnedDate, usedAmount}
     * @param {Date} currentDate - The reference date
     * @returns {boolean} True if the instance is not expired
     */
    isInstanceActive(instance, currentDate) {
        if (!instance || !instance.earnedDate) {
            return false;
        }
        const expiryDate = CarryoverCycle.calculateExpiryDate(instance.earnedDate);
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return today <= expiryDate;
    }

    /**
     * Gets all active (non-expired) earned instances.
     * @param {Date} currentDate - The reference date
     * @returns {Array<Object>} Array of active earned instances
     */
    getActiveInstances(currentDate) {
        return this.earnedInstances.filter(instance => 
            this.isInstanceActive(instance, currentDate)
        );
    }

    /**
     * Checks if there are any active earned instances.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    hasActiveInstances(currentDate) {
        return this.getActiveInstances(currentDate).length > 0;
    }

    /**
     * Gets the total remaining credit across all active instances.
     * @param {number} totalAmount - The credit amount per earned instance
     * @param {Date} currentDate - The reference date
     * @returns {number} Total remaining credit
     */
    getTotalRemaining(totalAmount, currentDate) {
        const activeInstances = this.getActiveInstances(currentDate);
        return activeInstances.reduce((total, instance) => {
            const remaining = totalAmount - (instance.usedAmount || 0);
            return total + Math.max(0, remaining);
        }, 0);
    }

    /**
     * Gets the year when an instance was earned.
     * @param {Date|string} earnedDate - The earned date
     * @returns {number} The year
     */
    static getEarnYear(earnedDate) {
        return new Date(earnedDate).getFullYear();
    }

    /**
     * Checks if a new credit can be earned in the current year.
     * Only one credit can be earned per calendar year.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    canEarnThisYear(currentDate) {
        const currentYear = new Date(currentDate).getFullYear();
        const earnedThisYear = this.earnedInstances.some(instance =>
            CarryoverCycle.getEarnYear(instance.earnedDate) === currentYear
        );
        return !earnedThisYear;
    }

    /**
     * Gets the earn deadline for the current year (Dec 31).
     * @param {Date} currentDate - The reference date
     * @returns {Date}
     */
    getEarnDeadline(currentDate) {
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return new Date(today.getFullYear(), 11, 31);
    }

    /**
     * Gets the start of the current calendar year (for earn progress reset).
     * @param {Date} currentDate - The reference date
     * @returns {Date}
     */
    static getResetDate(currentDate) {
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        return new Date(today.getFullYear(), 0, 1); // Jan 1
    }

    /**
     * Gets the earliest expiry date among all active instances.
     * @param {Date} currentDate - The reference date
     * @returns {Date|null}
     */
    getEarliestExpiryDate(currentDate) {
        const activeInstances = this.getActiveInstances(currentDate);
        if (activeInstances.length === 0) {
            return null;
        }
        
        const expiryDates = activeInstances.map(instance =>
            CarryoverCycle.calculateExpiryDate(instance.earnedDate)
        );
        return expiryDates.reduce((earliest, date) =>
            date < earliest ? date : earliest
        );
    }

    /**
     * Returns the number of days until the earliest instance expires.
     * @param {Date} currentDate - The reference date
     * @returns {number|null}
     */
    daysUntilEarliestExpiry(currentDate) {
        const earliestExpiry = this.getEarliestExpiryDate(currentDate);
        if (!earliestExpiry) {
            return null;
        }
        const today = new Date(currentDate);
        today.setHours(0, 0, 0, 0);
        const diffTime = earliestExpiry.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Checks if any instance expires within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days to check
     * @returns {boolean}
     */
    hasExpiringWithin(currentDate, days) {
        const activeInstances = this.getActiveInstances(currentDate);
        const limitDate = new Date(currentDate);
        limitDate.setDate(limitDate.getDate() + days);
        
        return activeInstances.some(instance => {
            const expiryDate = CarryoverCycle.calculateExpiryDate(instance.earnedDate);
            return expiryDate > currentDate && expiryDate <= limitDate;
        });
    }

    /**
     * Gets instances that expire within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days to check
     * @returns {Array<{instance: Object, expiryDate: Date}>}
     */
    getExpiringInstances(currentDate, days) {
        const activeInstances = this.getActiveInstances(currentDate);
        const limitDate = new Date(currentDate);
        limitDate.setDate(limitDate.getDate() + days);
        
        return activeInstances
            .map(instance => ({
                instance,
                expiryDate: CarryoverCycle.calculateExpiryDate(instance.earnedDate)
            }))
            .filter(({ expiryDate }) => expiryDate > currentDate && expiryDate <= limitDate);
    }

    /**
     * Creates a plain object representation for serialization.
     * @returns {Object}
     */
    toJSON() {
        return {
            earnedInstances: this.earnedInstances,
            lastEarnReset: this.lastEarnReset ? this.lastEarnReset.toISOString() : null
        };
    }

    /**
     * Creates a CarryoverCycle from a plain object.
     * @param {Object} data
     * @returns {CarryoverCycle}
     */
    static fromJSON(data) {
        return new CarryoverCycle({
            earnedInstances: data.earnedInstances || [],
            lastEarnReset: data.lastEarnReset
        });
    }
}
