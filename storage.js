/**
 * IndexedDB Storage Manager
 * Handles local storage of recordings, settings, and sync queue
 */

class StorageManager {
    constructor() {
        this.dbName = 'AudioRecorderDB';
        this.dbVersion = 1;
        this.db = null;
        
        this.stores = {
            RECORDINGS: 'recordings',
            SETTINGS: 'settings',
            SYNC_QUEUE: 'syncQueue'
        };
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create recordings store
                if (!db.objectStoreNames.contains(this.stores.RECORDINGS)) {
                    const recordingsStore = db.createObjectStore(this.stores.RECORDINGS, { keyPath: 'id' });
                    recordingsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recordingsStore.createIndex('synced', 'synced', { unique: false });
                    recordingsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                    recordingsStore.createIndex('size', 'size', { unique: false });
                }

                // Create settings store
                if (!db.objectStoreNames.contains(this.stores.SETTINGS)) {
                    db.createObjectStore(this.stores.SETTINGS, { keyPath: 'id' });
                }

                // Create sync queue store
                if (!db.objectStoreNames.contains(this.stores.SYNC_QUEUE)) {
                    const syncStore = db.createObjectStore(this.stores.SYNC_QUEUE, { keyPath: 'id' });
                    syncStore.createIndex('status', 'status', { unique: false });
                    syncStore.createIndex('priority', 'priority', { unique: false });
                    syncStore.createIndex('recordingId', 'recordingId', { unique: false });
                }
            };
        });
    }

    /**
     * Generate UUID for records
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get a transaction for the specified store
     */
    getTransaction(storeName, mode = 'readonly') {
        return this.db.transaction([storeName], mode);
    }

    /**
     * Get an object store
     */
    getStore(storeName, mode = 'readonly') {
        const transaction = this.getTransaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    // ==================== RECORDINGS ====================

    /**
     * Create a new recording
     */
    async createRecording(recordingData) {
        console.log('💾 STORAGE: Creating recording with data:', {
            filename: recordingData.filename,
            hasBlob: !!recordingData.blob,
            blobType: recordingData.blob?.type,
            blobSize: recordingData.blob?.size,
            duration: recordingData.duration
        });
        
        // Convert blob to ArrayBuffer for more reliable storage
        let blobArrayBuffer = null;
        if (recordingData.blob) {
            try {
                blobArrayBuffer = await recordingData.blob.arrayBuffer();
                console.log('💾 STORAGE: Converted blob to ArrayBuffer, size:', blobArrayBuffer.byteLength);
            } catch (error) {
                console.error('❌ STORAGE: Error converting blob to ArrayBuffer:', error);
                throw error;
            }
        }
        
        const recording = {
            id: this.generateUUID(),
            timestamp: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            synced: false,
            syncAttempts: 0,
            tags: [],
            ...recordingData,
            // Store as ArrayBuffer instead of Blob
            blobArrayBuffer: blobArrayBuffer,
            originalBlobType: recordingData.blob?.type
        };
        
        // Remove the original blob to avoid storing it twice
        delete recording.blob;

        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS, 'readwrite');
            const request = store.add(recording);
            
            request.onsuccess = () => {
                console.log('✅ STORAGE: Recording saved successfully:', recording.id);
                // Convert back to blob for return value
                if (blobArrayBuffer) {
                    recording.blob = new Blob([blobArrayBuffer], { type: recording.originalBlobType });
                }
                resolve(recording);
            };
            request.onerror = () => {
                console.error('❌ STORAGE: Error saving recording:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get all recordings (sorted by timestamp, newest first)
     */
    async getRecordings(limit = 50) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            const recordings = [];
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    const recording = cursor.value;
                    
                    // Convert ArrayBuffer back to Blob if needed
                    if (recording.blobArrayBuffer && !recording.blob) {
                        try {
                            recording.blob = new Blob([recording.blobArrayBuffer], { 
                                type: recording.originalBlobType || recording.format 
                            });
                            console.log('📖 STORAGE: Converted ArrayBuffer back to Blob');
                        } catch (error) {
                            console.error('❌ STORAGE: Error converting ArrayBuffer to Blob:', error);
                        }
                    }
                    
                    console.log('📖 STORAGE: Retrieved recording:', {
                        id: recording.id,
                        filename: recording.filename,
                        hasBlob: !!recording.blob,
                        hasArrayBuffer: !!recording.blobArrayBuffer,
                        blobType: recording.blob?.type,
                        blobSize: recording.blob?.size,
                        arrayBufferSize: recording.blobArrayBuffer?.byteLength,
                        blobConstructor: recording.blob?.constructor?.name
                    });
                    recordings.push(recording);
                    count++;
                    cursor.continue();
                } else {
                    console.log('📖 STORAGE: Retrieved', recordings.length, 'recordings total');
                    resolve(recordings);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a recording by ID
     */
    async getRecording(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a recording
     */
    async updateRecording(id, updates) {
        const recording = await this.getRecording(id);
        if (!recording) {
            throw new Error('Recording not found');
        }

        const updated = {
            ...recording,
            ...updates,
            lastModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS, 'readwrite');
            const request = store.put(updated);
            
            request.onsuccess = () => resolve(updated);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a recording
     */
    async deleteRecording(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS, 'readwrite');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get recordings by sync status
     */
    async getRecordingsBySync(synced = false) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS);
            const index = store.index('synced');
            const request = index.getAll(synced);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search recordings by tags
     */
    async getRecordingsByTag(tag) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.RECORDINGS);
            const index = store.index('tags');
            const request = index.getAll(tag);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== SETTINGS ====================

    /**
     * Get application settings
     */
    async getSettings() {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.SETTINGS);
            const request = store.get('app-settings');
            
            request.onsuccess = () => {
                const settings = request.result || this.getDefaultSettings();
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update application settings
     */
    async updateSettings(updates) {
        const currentSettings = await this.getSettings();
        const newSettings = { ...currentSettings, ...updates };

        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.SETTINGS, 'readwrite');
            const request = store.put(newSettings);
            
            request.onsuccess = () => resolve(newSettings);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            id: 'app-settings',
            s3BucketName: 'app-recordings-prod',
            s3PathPattern: 'audio-recordings/{user_id}/{filename}',
            maxLocalStorage: 100 * 1024 * 1024, // 100MB
            defaultChunkDuration: 60, // 1 minute
            overlapDuration: 500, // 500ms overlap between chunks
            skipDeleteConfirm: false, // Whether to skip delete confirmation
            syncOnMobileData: false,
            autoSync: true,
            audioFormat: 'audio/webm',
            audioQuality: 128000 // 128kbps
        };
    }

    // ==================== SYNC QUEUE ====================

    /**
     * Add recording to sync queue
     */
    async addToSyncQueue(recordingId, priority = 5) {
        const queueItem = {
            id: this.generateUUID(),
            recordingId,
            priority,
            attempts: 0,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.SYNC_QUEUE, 'readwrite');
            const request = store.add(queueItem);
            
            request.onsuccess = () => resolve(queueItem);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get queued items for sync
     */
    async getQueuedItems(limit = 10) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.SYNC_QUEUE);
            const index = store.index('status');
            const request = index.getAll('pending');
            
            request.onsuccess = () => {
                const items = request.result
                    .sort((a, b) => b.priority - a.priority)
                    .slice(0, limit);
                resolve(items);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update sync queue item
     */
    async updateQueueItem(id, updates) {
        return new Promise(async (resolve, reject) => {
            const store = this.getStore(this.stores.SYNC_QUEUE, 'readwrite');
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item) {
                    reject(new Error('Queue item not found'));
                    return;
                }

                const updated = { ...item, ...updates };
                const putRequest = store.put(updated);
                
                putRequest.onsuccess = () => resolve(updated);
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Remove item from sync queue
     */
    async removeFromQueue(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.SYNC_QUEUE, 'readwrite');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get failed sync items
     */
    async getFailedSyncItems() {
        return new Promise((resolve, reject) => {
            const store = this.getStore(this.stores.SYNC_QUEUE);
            const index = store.index('status');
            const request = index.getAll('failed');
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== STORAGE INFO ====================

    /**
     * Calculate total storage used by recordings
     */
    async calculateStorageUsed() {
        const recordings = await this.getRecordings(1000); // Get all recordings
        return recordings.reduce((total, recording) => total + (recording.size || 0), 0);
    }

    /**
     * Get storage information
     */
    async getStorageInfo() {
        let estimate = { usage: 0, quota: 100 * 1024 * 1024 }; // Default 100MB
        
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                estimate = await navigator.storage.estimate();
            } catch (error) {
                console.warn('Could not get storage estimate:', error);
            }
        }

        const usedByApp = await this.calculateStorageUsed();
        const settings = await this.getSettings();

        return {
            used: estimate.usage || 0,
            available: estimate.quota || settings.maxLocalStorage,
            usedByApp,
            maxAllowed: settings.maxLocalStorage,
            percentUsed: Math.round((usedByApp / settings.maxLocalStorage) * 100)
        };
    }

    /**
     * Check if storage is available for new recording
     */
    async isStorageAvailable(requiredBytes) {
        const info = await this.getStorageInfo();
        const wouldExceedLimit = (info.usedByApp + requiredBytes) > info.maxAllowed;
        return !wouldExceedLimit;
    }

    /**
     * Clean up old synced recordings if storage is low
     */
    async cleanupOldRecordings() {
        const recordings = await this.getRecordings(1000);
        const syncedRecordings = recordings.filter(r => r.synced);
        
        // Sort by timestamp, oldest first
        syncedRecordings.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const info = await this.getStorageInfo();
        const targetUsage = info.maxAllowed * 0.7; // Keep under 70%
        let currentUsage = info.usedByApp;

        for (const recording of syncedRecordings) {
            if (currentUsage <= targetUsage) break;
            
            await this.deleteRecording(recording.id);
            currentUsage -= recording.size;
        }
    }
}

// Export for use in other modules
window.StorageManager = StorageManager;