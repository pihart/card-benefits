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
            const response = await fetch(this.url, {
                method: 'GET',
                cache: 'no-cache' // Ensure we get fresh data
            });

            if (response.status === 404) {
                // File doesn't exist yet, treat as empty
                return [];
            }

            if (!response.ok) {
                throw new Error(`Failed to load data: ${response.statusText}`);
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Cloud Load Error:', error);
            alert('Error loading data from Cloud Storage. Check console for details.');
            return [];
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
                throw new Error(`Failed to save data: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Cloud Save Error:', error);
            alert('Error saving data to Cloud Storage. Check console for details.');
        }
    }
}
