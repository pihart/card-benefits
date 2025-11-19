/**
 * Represents the interface for a persistence layer.
 * Any storage mechanism (localStorage, API, etc.) should implement
 * these methods.
 */
class StorageInterface {
    /**
     * Loads the entire application state.
     * @param {Object} options - Optional parameters (e.g., { signal: AbortSignal })
     * @returns {Promise<Array<Object>>} A promise that resolves with the application data.
     */
    async loadData(options = {}) {
        throw new Error('StorageInterface.loadData() must be implemented');
    }

    /**
     * Saves the entire application state.
     * @param {Array<Object>} data The data to save.
     * @returns {Promise<void>} A promise that resolves when saving is complete.
     */
    async saveData(data) {
        throw new Error('StorageInterface.saveData(data) must be implemented');
    }
}
