/**
 * A persistence layer implementation using the browser's localStorage.
 */

const STORAGE_KEY = 'creditCardBenefitTracker';

class LocalStorageStore extends StorageInterface {

    /**
     * Loads the card data from localStorage.
     * @param {Object} options - Ignored for localStorage
     * @returns {Promise<Array<Object>>}
     */
    async loadData(options = {}) {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Saves the provided card data to localStorage.
     * @param {Array<Object>} data
     * @returns {Promise<void>}
     */
    async saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}
