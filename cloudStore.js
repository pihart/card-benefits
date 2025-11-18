/**
 * Cloud Object Storage Implementation.
 * Uses simple GET and PUT requests to a pre-authenticated URL.
 * Works with OCI PARs, AWS S3 Presigned URLs, Azure SAS, etc.
 */
class CloudStore extends StorageInterface {
    constructor(url) {
        super();
        this.url = url;
    }

    async loadData() {
        try {
            // timestamp prevents caching on some aggressive browsers/proxies
            const fetchUrl = `${this.url}${this.url.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;

            const response = await fetch(fetchUrl, {
                method: 'GET',
                cache: 'no-store'
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
            // We throw the error so the app can decide to alert (user action) or log (background poll)
            throw new Error(`Cloud Load Error: ${error.message}`);
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
