/**
 * Utility functions for date calculations.
 * Delegates to model classes for consistent behavior.
 * Maintained for backward compatibility with existing code.
 */
const DateUtils = {
    /**
     * Calculates the expiry date for a carryover benefit instance.
     * Delegates to CarryoverCycle.calculateExpiryDate.
     * @param {Date|string} earnedDate - The date when the benefit was earned
     * @returns {Date} The expiry date (end of next calendar year)
     */
    calculateCarryoverExpiryDate(earnedDate) {
        return CarryoverCycle.calculateExpiryDate(earnedDate);
    },

    /**
     * Checks if a specific carryover instance is currently active (not expired).
     * @param {Object} instance - The earned instance object with earnedDate
     * @param {Date} referenceDate - Usually "today"
     * @returns {boolean} True if the instance is not expired
     */
    isCarryoverInstanceActive(instance, referenceDate) {
        if (!instance || !instance.earnedDate) return false;
        const cycle = new CarryoverCycle({ earnedInstances: [instance] });
        return cycle.isInstanceActive(instance, referenceDate);
    },

    /**
     * Gets all active (non-expired) earned instances for a carryover benefit.
     * Works with both Benefit instances and plain objects.
     * @param {Object|Benefit} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {Array} Array of active earned instances
     */
    getActiveCarryoverInstances(benefit, referenceDate) {
        // If it's a Benefit instance, use its method
        if (benefit instanceof Benefit) {
            return benefit.getActiveCarryoverInstances(referenceDate);
        }
        
        // Handle plain object (backward compatibility)
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
        
        const cycle = new CarryoverCycle({
            earnedInstances: benefit.earnedInstances || []
        });
        return cycle.getActiveInstances(referenceDate);
    },

    /**
     * Checks if a carryover benefit has any active (non-expired) earned instances.
     * @param {Object|Benefit} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {boolean} True if there's at least one active earned instance
     */
    hasActiveCarryoverInstance(benefit, referenceDate) {
        return this.getActiveCarryoverInstances(benefit, referenceDate).length > 0;
    },

    /**
     * Gets the total remaining credit across all active earned instances.
     * @param {Object|Benefit} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {number} Total remaining credit
     */
    getTotalCarryoverRemaining(benefit, referenceDate) {
        // If it's a Benefit instance, use its method
        if (benefit instanceof Benefit) {
            return benefit.getTotalCarryoverRemaining(referenceDate);
        }
        
        const cycle = new CarryoverCycle({
            earnedInstances: benefit.earnedInstances || []
        });
        return cycle.getTotalRemaining(benefit.totalAmount, referenceDate);
    },

    /**
     * Gets the earn year from a date.
     * Delegates to CarryoverCycle.getEarnYear.
     * @param {Date|string} earnedDate - The date when the benefit was earned  
     * @returns {number} The year the benefit was earned
     */
    getEarnYear(earnedDate) {
        return CarryoverCycle.getEarnYear(earnedDate);
    },

    /**
     * Checks if a carryover benefit can be earned in the current year.
     * @param {Object|Benefit} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {boolean} True if the benefit can still be earned this year
     */
    canEarnCarryoverThisYear(benefit, referenceDate) {
        // If it's a Benefit instance, use its method
        if (benefit instanceof Benefit) {
            return benefit.canEarnCarryoverThisYear(referenceDate);
        }
        
        if (!benefit.isCarryover) return false;
        
        const currentYear = new Date(referenceDate).getFullYear();
        
        // Handle legacy format
        if (benefit.earnedDate && !benefit.earnedInstances) {
            return this.getEarnYear(benefit.earnedDate) !== currentYear;
        }
        
        const cycle = new CarryoverCycle({
            earnedInstances: benefit.earnedInstances || []
        });
        return cycle.canEarnThisYear(referenceDate);
    },

    /**
     * Calculates the next earn deadline for a carryover benefit.
     * @param {Object|Benefit} benefit - The benefit object
     * @param {Date} referenceDate - Usually "today"
     * @returns {Date} The end of the current calendar year (earn deadline)
     */
    calculateCarryoverEarnDeadline(benefit, referenceDate) {
        // If it's a Benefit instance, use its method
        if (benefit instanceof Benefit) {
            return benefit.getCarryoverEarnDeadline(referenceDate);
        }
        
        const cycle = new CarryoverCycle({});
        return cycle.getEarnDeadline(referenceDate);
    },

    /**
     * Gets the reset date for a carryover benefit.
     * Delegates to CarryoverCycle.getResetDate.
     * @param {Date} referenceDate - Usually "today"
     * @returns {Date} The start of the current calendar year
     */
    getCarryoverResetDate(referenceDate) {
        return CarryoverCycle.getResetDate(referenceDate);
    },

    /**
     * Calculates the next date a benefit is scheduled to reset.
     * Works with both Benefit instances and plain objects.
     * @param {Object|Benefit} benefit - The benefit object
     * @param {Object|Card} card - The card object
     * @param {Date} referenceDate - Usually "today"
     * @returns {Date} The next reset date.
     */
    calculateNextResetDate(benefit, card, referenceDate) {
        // If it's a Benefit instance, use its method
        if (benefit instanceof Benefit) {
            return benefit.getNextResetDate(referenceDate);
        }
        
        // Get anniversary date from card
        const anniversaryDate = card instanceof Card 
            ? card.anniversaryDate 
            : card.anniversaryDate;
        
        // Use ExpiryCycle for calculation
        const cycle = new ExpiryCycle({
            frequency: benefit.frequency,
            resetType: benefit.resetType,
            lastReset: benefit.lastReset,
            anniversaryDate: anniversaryDate
        });
        
        return cycle.calculateNextResetDate(referenceDate);
    }
};
