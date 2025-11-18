/**
 * Utility functions for date calculations.
 * Pure logic, no DOM manipulation.
 */
const DateUtils = {
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
