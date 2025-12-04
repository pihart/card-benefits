/**
 * Utility functions for date calculations.
 * Pure logic, no DOM manipulation.
 */
const DateUtils = {
    /**
     * Calculates the expiry date for a carryover benefit instance.
     * For carryover benefits, the credit earned in year X is available until the end of year X+1.
     * @param {Date|string} earnedDate - The date when the benefit was earned
     * @returns {Date} The expiry date (end of next calendar year)
     */
    calculateCarryoverExpiryDate(earnedDate) {
        const earned = new Date(earnedDate);
        earned.setHours(0, 0, 0, 0);
        // End of next calendar year (Dec 31 of year + 1)
        const expiryYear = earned.getFullYear() + 1;
        return new Date(expiryYear, 11, 31); // Dec 31 of next year
    },

    /**
     * Checks if a specific carryover instance is currently active (not expired).
     * @param {Object} instance - The earned instance object with earnedDate
     * @param {Date} referenceDate - Usually "today"
     * @returns {boolean} True if the instance is not expired
     */
    isCarryoverInstanceActive(instance, referenceDate) {
        if (!instance || !instance.earnedDate) return false;
        
        const expiryDate = this.calculateCarryoverExpiryDate(instance.earnedDate);
        const today = new Date(referenceDate);
        today.setHours(0, 0, 0, 0);
        
        return today <= expiryDate;
    },

    /**
     * Gets all active (non-expired) earned instances for a carryover benefit.
     * @param {Object} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {Array} Array of active earned instances
     */
    getActiveCarryoverInstances(benefit, referenceDate) {
        if (!benefit.isCarryover) return [];
        
        // Handle legacy single earnedDate format
        if (benefit.earnedDate && !benefit.earnedInstances) {
            const legacyInstance = {
                earnedDate: benefit.earnedDate,
                usedAmount: benefit.usedAmount || 0
            };
            if (this.isCarryoverInstanceActive(legacyInstance, referenceDate)) {
                return [legacyInstance];
            }
            return [];
        }
        
        // Handle new array format
        if (!benefit.earnedInstances || !Array.isArray(benefit.earnedInstances)) {
            return [];
        }
        
        return benefit.earnedInstances.filter(instance => 
            this.isCarryoverInstanceActive(instance, referenceDate)
        );
    },

    /**
     * Checks if a carryover benefit has any active (non-expired) earned instances.
     * @param {Object} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {boolean} True if there's at least one active earned instance
     */
    hasActiveCarryoverInstance(benefit, referenceDate) {
        return this.getActiveCarryoverInstances(benefit, referenceDate).length > 0;
    },

    /**
     * Gets the total remaining credit across all active earned instances.
     * @param {Object} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {number} Total remaining credit
     */
    getTotalCarryoverRemaining(benefit, referenceDate) {
        const activeInstances = this.getActiveCarryoverInstances(benefit, referenceDate);
        return activeInstances.reduce((total, instance) => {
            const remaining = benefit.totalAmount - (instance.usedAmount || 0);
            return total + Math.max(0, remaining);
        }, 0);
    },

    /**
     * Gets the earn year from a date (used to determine when the benefit expires).
     * @param {Date|string} earnedDate - The date when the benefit was earned  
     * @returns {number} The year the benefit was earned
     */
    getEarnYear(earnedDate) {
        return new Date(earnedDate).getFullYear();
    },

    /**
     * Checks if a carryover benefit can be earned in the current year.
     * Returns true if no instance has been earned in the current year yet.
     * @param {Object} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {boolean} True if the benefit can still be earned this year
     */
    canEarnCarryoverThisYear(benefit, referenceDate) {
        if (!benefit.isCarryover) return false;
        
        const currentYear = new Date(referenceDate).getFullYear();
        
        // Handle legacy format
        if (benefit.earnedDate && !benefit.earnedInstances) {
            return this.getEarnYear(benefit.earnedDate) !== currentYear;
        }
        
        // Check if any instance was already earned this year
        if (benefit.earnedInstances && Array.isArray(benefit.earnedInstances)) {
            const earnedThisYear = benefit.earnedInstances.some(instance => 
                this.getEarnYear(instance.earnedDate) === currentYear
            );
            return !earnedThisYear;
        }
        
        return true; // No instances earned yet
    },

    /**
     * Calculates the next earn deadline for a carryover benefit.
     * Carryover benefits can be earned annually (calendar year-based).
     * @param {Object} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {Date} The end of the current calendar year (earn deadline)
     */
    calculateCarryoverEarnDeadline(benefit, referenceDate) {
        const today = new Date(referenceDate);
        today.setHours(0, 0, 0, 0);
        // End of current calendar year
        return new Date(today.getFullYear(), 11, 31);
    },

    /**
     * Gets the reset date for a carryover benefit (when the earn progress resets).
     * This is the start of a new calendar year.
     * @param {Date} referenceDate - Usually "today"
     * @returns {Date} The start of the current calendar year
     */
    getCarryoverResetDate(referenceDate) {
        const today = new Date(referenceDate);
        today.setHours(0, 0, 0, 0);
        return new Date(today.getFullYear(), 0, 1); // Jan 1 of current year
    },

    /**
     * Calculates the *next* date a benefit is scheduled to reset.
     * @param {Object} benefit - The benefit object
     * @param {Object} card - The card object
     * @param {Date} referenceDate - Usually "today"
     * @returns {Date} The next reset date.
     */
    calculateNextResetDate(benefit, card, referenceDate) {
        const lastReset = new Date(benefit.lastReset);
        lastReset.setHours(0, 0, 0, 0);

        const anniversary = new Date(card.anniversaryDate);
        anniversary.setMinutes(anniversary.getMinutes() + anniversary.getTimezoneOffset());
        anniversary.setHours(0, 0, 0, 0);

        let nextReset = new Date(lastReset.getTime());

        if (benefit.resetType === 'calendar') {
            switch (benefit.frequency) {
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
        } else {
            // Anniversary based
            nextReset = new Date(lastReset.getFullYear(), lastReset.getMonth(), anniversary.getDate());
            switch (benefit.frequency) {
                case 'monthly':
                    if (nextReset <= lastReset) {
                        nextReset.setMonth(nextReset.getMonth() + 1);
                    }
                    break;
                case 'quarterly':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    while (nextReset <= lastReset) {
                        nextReset.setMonth(nextReset.getMonth() + 3);
                    }
                    break;
                case 'biannual':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    while (nextReset <= lastReset) {
                        nextReset.setMonth(nextReset.getMonth() + 6);
                    }
                    break;
                case 'annual':
                    nextReset = new Date(lastReset.getFullYear(), anniversary.getMonth(), anniversary.getDate());
                    if (nextReset <= lastReset) {
                        nextReset.setFullYear(nextReset.getFullYear() + 1);
                    }
                    break;
                case 'every-4-years':
                    nextReset = new Date(lastReset.getFullYear() + 4, lastReset.getMonth(), lastReset.getDate());
                    break;
            }
        }

        // Loop to ensure next reset is in the future relative to the last reset,
        // but stop if we pass referenceDate (today) to find the immediate pending reset
        while (nextReset <= referenceDate && nextReset <= lastReset) {
            const tempLastReset = new Date(nextReset.getTime());
            tempLastReset.setDate(tempLastReset.getDate() + 1);
            // Recursive call with updated lastReset
            return this.calculateNextResetDate({
                ...benefit,
                lastReset: tempLastReset.toISOString()
            }, card, referenceDate);
        }

        return nextReset;
    }
};
