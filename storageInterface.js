/**
 * Represents the interface for a persistence layer.
 * Any storage mechanism (localStorage, API, etc.) should implement
 * these methods.
 *
 * This class is loaded first and will be available in the global scope.
 */
class StorageInterface {
    /**
     * Loads the entire application state.
     * @returns {Promise<Array<Object>>} A promise that resolves with the application data (e.g., array of cards).
     */
    async loadData() {
        throw new Error('StorageInterface.loadData() must be implemented');
    }

    /**
     * Saves the entire application state.
     * @param {Array<Object>} data The data to save (e.g., array of cards).
     * @returns {Promise<void>} A promise that resolves when saving is complete.
     */
    async saveData(data) {
        throw new Error('StorageInterface.saveData(data) must be implemented');
    }
}
