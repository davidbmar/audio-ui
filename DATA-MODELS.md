# Data Models & IndexedDB Schema

## Core Data Models

### Recording Model
```typescript
interface Recording {
  id: string;              // UUID v4
  filename: string;        // User-editable filename
  originalName: string;    // Original generated filename
  blob: Blob;             // Audio blob data
  size: number;           // File size in bytes
  duration: number;       // Duration in seconds
  format: string;         // MIME type (audio/webm, audio/wav)
  timestamp: string;      // ISO 8601 creation date
  lastModified: string;   // ISO 8601 last modified date
  tags: string[];         // Array of tags (#meeting, #idea)
  synced: boolean;        // Sync status to S3
  syncAttempts: number;   // Number of failed sync attempts
  lastSyncAttempt?: string; // ISO 8601 last sync attempt
  s3Key?: string;         // S3 object key if synced
  chunkSize: number;      // Original chunk size setting
}
```

### AppSettings Model
```typescript
interface AppSettings {
  id: 'app-settings';     // Single settings record
  s3BucketName: string;   // S3 bucket name
  s3PathPattern: string;  // Path pattern with variables
  maxLocalStorage: number; // Max storage in bytes
  defaultChunkDuration: number; // Default chunk size in seconds
  syncOnMobileData: boolean; // Allow sync over mobile data
  autoSync: boolean;      // Auto-sync when online
  audioFormat: string;    // Preferred audio format
  audioQuality: number;   // Audio quality/bitrate
  lastBackup?: string;    // Last successful backup timestamp
}
```

### SyncQueue Model
```typescript
interface SyncQueueItem {
  id: string;             // UUID v4
  recordingId: string;    // Reference to Recording.id
  priority: number;       // Sync priority (1-10)
  attempts: number;       // Number of attempts
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  createdAt: string;      // ISO 8601
  lastAttempt?: string;   // ISO 8601 last attempt
  error?: string;         // Last error message
  retryAt?: string;       // ISO 8601 next retry time
}
```

## IndexedDB Schema

### Database Configuration
```javascript
const DB_NAME = 'AudioRecorderDB';
const DB_VERSION = 1;

const DB_STORES = {
  RECORDINGS: 'recordings',
  SETTINGS: 'settings',
  SYNC_QUEUE: 'syncQueue'
};
```

### Object Stores Definition

#### 1. Recordings Store
```javascript
// Primary store for audio recordings
const recordingsStore = {
  name: 'recordings',
  keyPath: 'id',
  indexes: [
    { name: 'timestamp', keyPath: 'timestamp', unique: false },
    { name: 'synced', keyPath: 'synced', unique: false },
    { name: 'tags', keyPath: 'tags', unique: false, multiEntry: true },
    { name: 'size', keyPath: 'size', unique: false }
  ]
};
```

#### 2. Settings Store
```javascript
// Application settings (single record)
const settingsStore = {
  name: 'settings',
  keyPath: 'id',
  indexes: []
};
```

#### 3. Sync Queue Store
```javascript
// Queue for managing S3 sync operations
const syncQueueStore = {
  name: 'syncQueue',
  keyPath: 'id',
  indexes: [
    { name: 'status', keyPath: 'status', unique: false },
    { name: 'priority', keyPath: 'priority', unique: false },
    { name: 'recordingId', keyPath: 'recordingId', unique: false },
    { name: 'retryAt', keyPath: 'retryAt', unique: false }
  ]
};
```

## Database Operations

### Recording Operations
```javascript
class RecordingStore {
  // Create new recording
  async createRecording(recordingData) {
    const recording = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      synced: false,
      syncAttempts: 0,
      tags: [],
      ...recordingData
    };
    
    return await this.db.add('recordings', recording);
  }

  // Get all recordings (with pagination)
  async getRecordings(limit = 50, offset = 0) {
    return await this.db.getAll('recordings', {
      index: 'timestamp',
      direction: 'prev',
      limit,
      offset
    });
  }

  // Get recordings by sync status
  async getUnsyncedRecordings() {
    return await this.db.getAllFromIndex('recordings', 'synced', false);
  }

  // Update recording
  async updateRecording(id, updates) {
    const recording = await this.db.get('recordings', id);
    if (recording) {
      const updated = {
        ...recording,
        ...updates,
        lastModified: new Date().toISOString()
      };
      return await this.db.put('recordings', updated);
    }
  }

  // Delete recording
  async deleteRecording(id) {
    return await this.db.delete('recordings', id);
  }

  // Search recordings by tags
  async getRecordingsByTag(tag) {
    return await this.db.getAllFromIndex('recordings', 'tags', tag);
  }
}
```

### Settings Operations
```javascript
class SettingsStore {
  async getSettings() {
    const settings = await this.db.get('settings', 'app-settings');
    return settings || this.getDefaultSettings();
  }

  async updateSettings(updates) {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, ...updates };
    return await this.db.put('settings', newSettings);
  }

  getDefaultSettings() {
    return {
      id: 'app-settings',
      s3BucketName: 'app-recordings-prod',
      s3PathPattern: 'audio-recordings/{user_id}/{filename}',
      maxLocalStorage: 100 * 1024 * 1024, // 100MB
      defaultChunkDuration: 60, // 1 minute
      syncOnMobileData: false,
      autoSync: true,
      audioFormat: 'audio/webm',
      audioQuality: 128000 // 128kbps
    };
  }
}
```

### Sync Queue Operations
```javascript
class SyncQueueStore {
  async addToQueue(recordingId, priority = 5) {
    const queueItem = {
      id: generateUUID(),
      recordingId,
      priority,
      attempts: 0,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    return await this.db.add('syncQueue', queueItem);
  }

  async getQueuedItems(limit = 10) {
    // Get pending items sorted by priority (high to low)
    return await this.db.getAllFromIndex('syncQueue', 'status', 'pending', {
      limit
    }).then(items => 
      items.sort((a, b) => b.priority - a.priority)
    );
  }

  async updateQueueItem(id, updates) {
    const item = await this.db.get('syncQueue', id);
    if (item) {
      const updated = { ...item, ...updates };
      return await this.db.put('syncQueue', updated);
    }
  }

  async removeFromQueue(id) {
    return await this.db.delete('syncQueue', id);
  }

  async getFailedItems() {
    return await this.db.getAllFromIndex('syncQueue', 'status', 'failed');
  }
}
```

## Storage Quota Management

### Quota Monitoring
```javascript
class StorageManager {
  async getStorageInfo() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0,
        usedByApp: await this.calculateAppUsage()
      };
    }
    
    // Fallback for browsers without StorageManager
    return {
      used: await this.calculateAppUsage(),
      available: 100 * 1024 * 1024, // Assume 100MB
      usedByApp: await this.calculateAppUsage()
    };
  }

  async calculateAppUsage() {
    const recordings = await this.recordingStore.getRecordings();
    return recordings.reduce((total, recording) => total + recording.size, 0);
  }

  async isStorageAvailable(requiredBytes) {
    const info = await this.getStorageInfo();
    const settings = await this.settingsStore.getSettings();
    const wouldExceedLimit = (info.usedByApp + requiredBytes) > settings.maxLocalStorage;
    const wouldExceedQuota = (info.used + requiredBytes) > (info.available * 0.9); // 90% safety margin
    
    return !wouldExceedLimit && !wouldExceedQuota;
  }

  async cleanupOldRecordings() {
    const recordings = await this.recordingStore.getRecordings();
    const syncedRecordings = recordings.filter(r => r.synced);
    
    // Sort by timestamp, oldest first
    syncedRecordings.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Remove oldest synced recordings until under limit
    const settings = await this.settingsStore.getSettings();
    let currentUsage = await this.calculateAppUsage();
    
    for (const recording of syncedRecordings) {
      if (currentUsage <= settings.maxLocalStorage * 0.7) break; // Keep under 70%
      
      await this.recordingStore.deleteRecording(recording.id);
      currentUsage -= recording.size;
    }
  }
}
```

## Migration Strategy

### Version 1 → Version 2 (Example)
```javascript
function upgradeDB(event) {
  const db = event.target.result;
  const oldVersion = event.oldVersion;
  
  if (oldVersion < 2) {
    // Add new index for faster tag searches
    const recordingsStore = event.target.transaction.objectStore('recordings');
    if (!recordingsStore.indexNames.contains('tags')) {
      recordingsStore.createIndex('tags', 'tags', { 
        unique: false, 
        multiEntry: true 
      });
    }
  }
}
```

This schema provides a robust foundation for offline-first audio recording with efficient querying, sync management, and storage optimization.