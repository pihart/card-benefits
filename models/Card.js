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
     */
    constructor(data) {
        this.id = data.id || `card-${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name;
        this.anniversaryDate = data.anniversaryDate;
        
        // Convert benefit data to Benefit instances
        this.benefits = (data.benefits || []).map(benefitData => 
            Benefit.fromJSON(benefitData, this.anniversaryDate)
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
            benefits: this.benefits.map(benefit => benefit.toJSON())
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
