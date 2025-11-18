/**
 * A persistence layer implementation using the browser's localStorage.
 * This class extends the global StorageInterface.
 *
 * Note: localStorage is synchronous, but we wrap methods in async
 * to match the interface contract, allowing for a future async
 * replacement (like fetch or IndexedDB) without changing app logic.
 */

const STORAGE_KEY = 'creditCardBenefitTracker';

class LocalStorageStore extends StorageInterface {

    /**
     * Loads the card data from localStorage.
     * @returns {Promise<Array<Object>>}
     */
    async loadData() {
        const data = localStorage.getItem(STORAGE_KEY);
        // Parse the data, or return an empty array if no data exists
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
