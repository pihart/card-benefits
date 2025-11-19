/**
 * Cloud Object Storage Implementation.
 * Uses simple GET and PUT requests to a pre-authenticated URL.
 */
class CloudStore extends StorageInterface {
    constructor(url) {
        super();
        this.url = url;
    }

    /**
     * @param {Object} options - { signal: AbortSignal }
     */
    async loadData(options = {}) {
        try {
            // timestamp prevents caching on some aggressive browsers/proxies
            const fetchUrl = `${this.url}${this.url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;

            const response = await fetch(fetchUrl, {
                method: 'GET',
                cache: 'no-store',
                signal: options.signal // Pass the abort signal to fetch
            });

            if (response.status === 404) {
                // File doesn't exist yet on the cloud, return empty array
                return [];
            }

            if (!response.ok) {
                throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            // Rethrow so App can handle AbortError specifically
            throw error;
        }
    }

    async saveData(data) {
        try {
            const response = await fetch(this.url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Failed to save data: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            throw new Error(`Cloud Save Error: ${error.message}`);
        }
    }
}
