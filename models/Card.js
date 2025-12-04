/**
 * Represents a credit card with associated benefits.
 */
class Card {
    /**
     * @param {Object} data - Card data
     * @param {string} data.id - Unique identifier
     * @param {string} data.name - Card name
     * @param {string} data.anniversaryDate - Card anniversary date (ISO date string)
     * @param {Array<Object>} data.benefits - Array of benefit data objects
     * @param {Array<Object>} data.minimumSpends - Array of minimum spend data objects
     */
    constructor(data) {
        this.id = data.id || `card-${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name;
        this.anniversaryDate = data.anniversaryDate;
        
        // Convert benefit data to Benefit instances
        this.benefits = (data.benefits || []).map(benefitData => 
            Benefit.fromJSON(benefitData, this.anniversaryDate)
        );

        // Convert minimum spend data to MinimumSpend instances
        this.minimumSpends = (data.minimumSpends || []).map(minSpendData => 
            MinimumSpend.fromJSON(minSpendData, this.anniversaryDate)
        );
    }

    /**
     * Gets the anniversary date as a Date object.
     * @returns {Date}
     */
    getAnniversaryDate() {
        const anniversary = new Date(this.anniversaryDate);
        anniversary.setMinutes(anniversary.getMinutes() + anniversary.getTimezoneOffset());
        anniversary.setHours(0, 0, 0, 0);
        return anniversary;
    }

    /**
     * Checks if all benefits are fully used.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    isAllBenefitsUsed(currentDate) {
        return this.benefits.length > 0 && 
            this.benefits.every(benefit => benefit.isFullyUsed(currentDate));
    }

    /**
     * Gets all benefits that need to be reset.
     * @param {Date} currentDate - The reference date
     * @returns {Array<Benefit>}
     */
    getBenefitsNeedingReset(currentDate) {
        return this.benefits.filter(benefit => 
            benefit.isRecurring() && benefit.needsReset(currentDate)
        );
    }

    /**
     * Gets all benefits expiring within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days
     * @returns {Array<Benefit>}
     */
    getBenefitsExpiringWithin(currentDate, days) {
        return this.benefits.filter(benefit => 
            benefit.expiresWithin(currentDate, days)
        );
    }

    /**
     * Adds a new benefit to the card.
     * @param {Object} benefitData - Benefit data
     * @returns {Benefit} The created benefit
     */
    addBenefit(benefitData) {
        const benefit = Benefit.fromJSON(benefitData, this.anniversaryDate);
        this.benefits.push(benefit);
        return benefit;
    }

    /**
     * Removes a benefit by ID.
     * @param {string} benefitId
     * @returns {boolean} True if removed
     */
    removeBenefit(benefitId) {
        const index = this.benefits.findIndex(b => b.id === benefitId);
        if (index > -1) {
            this.benefits.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Finds a benefit by ID.
     * @param {string} benefitId
     * @returns {Benefit|null}
     */
    findBenefit(benefitId) {
        return this.benefits.find(b => b.id === benefitId) || null;
    }

    /**
     * Updates card properties.
     * @param {string} name
     * @param {string} anniversaryDate
     */
    update(name, anniversaryDate) {
        this.name = name;
        this.anniversaryDate = anniversaryDate;
        
        // Update anniversary date for all benefits
        this.benefits.forEach(benefit => {
            benefit.setAnniversaryDate(anniversaryDate);
        });

        // Update anniversary date for all minimum spends
        this.minimumSpends.forEach(minSpend => {
            minSpend.setAnniversaryDate(anniversaryDate);
        });
    }

    /**
     * Reorders benefits.
     * @param {number} oldIndex
     * @param {number} newIndex
     */
    reorderBenefits(oldIndex, newIndex) {
        if (oldIndex === newIndex) return;
        const [movedBenefit] = this.benefits.splice(oldIndex, 1);
        this.benefits.splice(newIndex, 0, movedBenefit);
    }

    // ==================== MINIMUM SPEND METHODS ====================

    /**
     * Adds a new minimum spend to the card.
     * @param {Object} minSpendData - Minimum spend data
     * @returns {MinimumSpend} The created minimum spend
     */
    addMinimumSpend(minSpendData) {
        const minSpend = MinimumSpend.fromJSON(minSpendData, this.anniversaryDate);
        this.minimumSpends.push(minSpend);
        return minSpend;
    }

    /**
     * Removes a minimum spend by ID.
     * Also clears the requiredMinimumSpendId from any benefits that reference it.
     * @param {string} minSpendId
     * @returns {boolean} True if removed
     */
    removeMinimumSpend(minSpendId) {
        const index = this.minimumSpends.findIndex(ms => ms.id === minSpendId);
        if (index > -1) {
            this.minimumSpends.splice(index, 1);
            // Clear references from benefits
            this.benefits.forEach(benefit => {
                if (benefit.requiredMinimumSpendId === minSpendId) {
                    benefit.requiredMinimumSpendId = null;
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Finds a minimum spend by ID.
     * @param {string} minSpendId
     * @returns {MinimumSpend|null}
     */
    findMinimumSpend(minSpendId) {
        return this.minimumSpends.find(ms => ms.id === minSpendId) || null;
    }

    /**
     * Gets all minimum spends that need to be reset.
     * @param {Date} currentDate - The reference date
     * @returns {Array<MinimumSpend>}
     */
    getMinimumSpendsNeedingReset(currentDate) {
        return this.minimumSpends.filter(minSpend => 
            minSpend.isRecurring() && minSpend.shouldReset(currentDate)
        );
    }

    /**
     * Gets all actionable minimum spends (not met, not expired, not ignored).
     * @param {Date} currentDate - The reference date
     * @returns {Array<MinimumSpend>}
     */
    getActionableMinimumSpends(currentDate) {
        return this.minimumSpends.filter(minSpend => 
            minSpend.isActionable(currentDate)
        );
    }

    /**
     * Gets minimum spends that have deadlines within a given number of days.
     * @param {Date} currentDate - The reference date
     * @param {number} days - Number of days
     * @returns {Array<MinimumSpend>}
     */
    getMinimumSpendsExpiringWithin(currentDate, days) {
        return this.minimumSpends.filter(minSpend => 
            minSpend.isActionable(currentDate) && minSpend.deadlineWithin(currentDate, days)
        );
    }

    /**
     * Gets benefits that require a specific minimum spend.
     * @param {string} minSpendId - The minimum spend ID
     * @returns {Array<Benefit>}
     */
    getBenefitsRequiringMinimumSpend(minSpendId) {
        return this.benefits.filter(benefit => 
            benefit.requiredMinimumSpendId === minSpendId
        );
    }

    /**
     * Checks if a minimum spend is met and returns the associated benefits that are now unlocked.
     * @param {string} minSpendId - The minimum spend ID
     * @returns {Array<Benefit>} Benefits that are now unlocked
     */
    getUnlockedBenefits(minSpendId) {
        const minSpend = this.findMinimumSpend(minSpendId);
        if (!minSpend || !minSpend.isMet) {
            return [];
        }
        return this.getBenefitsRequiringMinimumSpend(minSpendId);
    }

    /**
     * Checks if all benefits in the card are either fully used or locked by unmet minimum spends.
     * @param {Date} currentDate - The reference date
     * @returns {boolean}
     */
    isAllBenefitsUsedOrLocked(currentDate) {
        return this.benefits.length > 0 && 
            this.benefits.every(benefit => {
                // Check if locked by minimum spend
                if (benefit.requiredMinimumSpendId) {
                    const minSpend = this.findMinimumSpend(benefit.requiredMinimumSpendId);
                    if (minSpend && !minSpend.isMet) {
                        return true; // Locked, so count as "handled"
                    }
                }
                return benefit.isFullyUsed(currentDate);
            });
    }

    // ==================== FILTERING METHODS ====================

    /**
     * Gets benefits filtered by used status.
     * @param {Date} currentDate - The reference date
     * @param {boolean} fullyUsed - Filter for fully used or not
     * @returns {Array<Benefit>}
     */
    filterByUsedStatus(currentDate, fullyUsed) {
        return this.benefits.filter(benefit => 
            benefit.isFullyUsed(currentDate) === fullyUsed
        );
    }

    /**
     * Gets benefits filtered by ignored status.
     * @param {Date} currentDate - The reference date
     * @param {boolean} isIgnored - Filter for ignored or not
     * @returns {Array<Benefit>}
     */
    filterByIgnoredStatus(currentDate, isIgnored) {
        return this.benefits.filter(benefit =>
            benefit.isIgnoredActive(currentDate) === isIgnored
        );
    }

    /**
     * Gets benefits filtered by auto-claim status.
     * @param {Date} currentDate - The reference date
     * @param {boolean} isAutoClaim - Filter for auto-claim or not
     * @returns {Array<Benefit>}
     */
    filterByAutoClaimStatus(currentDate, isAutoClaim) {
        return this.benefits.filter(benefit =>
            benefit.isAutoClaimActive(currentDate) === isAutoClaim
        );
    }

    /**
     * Gets recurring benefits.
     * @returns {Array<Benefit>}
     */
    getRecurringBenefits() {
        return this.benefits.filter(benefit => benefit.isRecurring());
    }

    /**
     * Gets carryover benefits.
     * @returns {Array<Benefit>}
     */
    getCarryoverBenefits() {
        return this.benefits.filter(benefit => benefit.isCarryoverBenefit());
    }

    /**
     * Gets one-time benefits.
     * @returns {Array<Benefit>}
     */
    getOneTimeBenefits() {
        return this.benefits.filter(benefit => benefit.isOneTime());
    }

    // ==================== SERIALIZATION ====================

    /**
     * Creates a plain object representation for serialization.
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            anniversaryDate: this.anniversaryDate,
            benefits: this.benefits.map(benefit => benefit.toJSON()),
            minimumSpends: this.minimumSpends.map(minSpend => minSpend.toJSON())
        };
    }

    /**
     * Creates a Card from a plain object.
     * @param {Object} data
     * @returns {Card}
     */
    static fromJSON(data) {
        return new Card(data);
    }
}
