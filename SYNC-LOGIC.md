# Sync Logic & Queue Management

## Overview
The sync system manages automatic and manual uploading of audio recordings to S3, with robust error handling, retry logic, and network awareness.

## Core Components

### 1. SyncManager
Central coordinator for all sync operations.

```typescript
class SyncManager {
  private syncQueue: SyncQueueStore;
  private recordingStore: RecordingStore;
  private settingsStore: SettingsStore;
  private networkMonitor: NetworkMonitor;
  private isProcessing: boolean = false;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.networkMonitor = new NetworkMonitor();
    this.setupEventListeners();
  }

  // Main sync process
  async processSyncQueue(): Promise<void>;
  
  // Add recording to sync queue
  async queueRecording(recordingId: string, priority: number = 5): Promise<void>;
  
  // Manual sync trigger
  async syncNow(): Promise<void>;
  
  // Retry failed sync
  async retryFailedSync(queueItemId: string): Promise<void>;
}
```

### 2. NetworkMonitor
Monitors network connectivity and data usage preferences.

```typescript
class NetworkMonitor {
  private isOnline: boolean = navigator.onLine;
  private connectionType: string = 'unknown';
  private listeners: Set<Function> = new Set();

  constructor() {
    this.setupNetworkListeners();
    this.detectConnectionType();
  }

  isOnline(): boolean;
  isWifiConnection(): boolean;
  isMobileConnection(): boolean;
  shouldSyncOnCurrentConnection(): boolean;
  
  onNetworkChange(callback: (online: boolean) => void): void;
  removeNetworkListener(callback: Function): void;
}
```

## Sync Queue Processing

### Queue Priority System
```typescript
enum SyncPriority {
  CRITICAL = 10,  // User-initiated sync
  HIGH = 8,       // Recent recordings
  NORMAL = 5,     // Background sync
  LOW = 3,        // Bulk operations
  CLEANUP = 1     // Old synced files
}
```

### Processing Algorithm
```typescript
async processSyncQueue(): Promise<void> {
  if (this.isProcessing) return;
  
  this.isProcessing = true;
  
  try {
    // Check network conditions
    if (!this.networkMonitor.shouldSyncOnCurrentConnection()) {
      console.log('Sync paused: Network conditions not suitable');
      return;
    }

    // Get pending items (sorted by priority)
    const queueItems = await this.syncQueue.getQueuedItems(10);
    
    for (const item of queueItems) {
      try {
        await this.processSyncItem(item);
      } catch (error) {
        await this.handleSyncError(item, error);
      }
    }
  } finally {
    this.isProcessing = false;
  }
}
```

### Individual Item Processing
```typescript
async processSyncItem(item: SyncQueueItem): Promise<void> {
  // Update status to syncing
  await this.syncQueue.updateQueueItem(item.id, {
    status: 'syncing',
    lastAttempt: new Date().toISOString()
  });

  // Get recording data
  const recording = await this.recordingStore.getRecording(item.recordingId);
  if (!recording) {
    await this.syncQueue.removeFromQueue(item.id);
    return;
  }

  // Generate S3 key
  const s3Key = await this.generateS3Key(recording);
  
  // Upload to S3
  await this.uploadToS3(recording, s3Key);
  
  // Update recording as synced
  await this.recordingStore.updateRecording(recording.id, {
    synced: true,
    s3Key: s3Key,
    lastSyncAttempt: new Date().toISOString()
  });
  
  // Remove from queue
  await this.syncQueue.removeFromQueue(item.id);
  
  // Emit sync success event
  this.emit('syncSuccess', { recordingId: recording.id, s3Key });
}
```

## Error Handling & Retry Logic

### Retry Strategy
```typescript
class RetryStrategy {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly BASE_DELAY = 1000; // 1 second
  private static readonly MAX_DELAY = 300000; // 5 minutes

  static calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const delay = Math.min(
      this.BASE_DELAY * Math.pow(2, attempt),
      this.MAX_DELAY
    );
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
  }

  static shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.MAX_ATTEMPTS) return false;
    
    // Don't retry on client errors (4xx)
    if (error.name === 'ClientError') return false;
    
    // Retry on network errors, server errors (5xx), timeouts
    return true;
  }
}
```

### Error Handling
```typescript
async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
  const newAttempts = item.attempts + 1;
  
  if (RetryStrategy.shouldRetry(newAttempts, error)) {
    // Schedule retry
    const retryDelay = RetryStrategy.calculateRetryDelay(newAttempts);
    const retryAt = new Date(Date.now() + retryDelay).toISOString();
    
    await this.syncQueue.updateQueueItem(item.id, {
      status: 'pending',
      attempts: newAttempts,
      error: error.message,
      retryAt
    });
    
    // Set retry timeout
    const timeout = setTimeout(() => {
      this.processSyncQueue();
      this.retryTimeouts.delete(item.id);
    }, retryDelay);
    
    this.retryTimeouts.set(item.id, timeout);
    
  } else {
    // Mark as permanently failed
    await this.syncQueue.updateQueueItem(item.id, {
      status: 'failed',
      attempts: newAttempts,
      error: error.message
    });
    
    // Update recording sync attempts
    await this.recordingStore.updateRecording(item.recordingId, {
      syncAttempts: newAttempts,
      lastSyncAttempt: new Date().toISOString()
    });
    
    // Emit failure event
    this.emit('syncFailure', { recordingId: item.recordingId, error });
  }
}
```

## S3 Upload Implementation

### S3 Client Configuration
```typescript
class S3Uploader {
  private s3Client: S3Client;
  private settings: AppSettings;

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.s3Client = new S3Client({
      region: 'us-east-1', // Configure based on bucket
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }

  async uploadRecording(recording: Recording, s3Key: string): Promise<void> {
    const uploadParams = {
      Bucket: this.settings.s3BucketName,
      Key: s3Key,
      Body: recording.blob,
      ContentType: recording.format,
      Metadata: {
        originalName: recording.originalName,
        duration: recording.duration.toString(),
        size: recording.size.toString(),
        timestamp: recording.timestamp,
        tags: recording.tags.join(',')
      }
    };

    try {
      // Use multipart upload for files > 5MB
      if (recording.size > 5 * 1024 * 1024) {
        await this.multipartUpload(uploadParams);
      } else {
        await this.s3Client.send(new PutObjectCommand(uploadParams));
      }
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  private async multipartUpload(params: any): Promise<void> {
    // Implementation for multipart upload
    // Allows for better progress tracking and resumable uploads
  }
}
```

### S3 Key Generation
```typescript
async generateS3Key(recording: Recording): Promise<string> {
  const settings = await this.settingsStore.getSettings();
  const userId = await this.getUserId(); // Get from auth system
  
  // Replace variables in path pattern
  const s3Key = settings.s3PathPattern
    .replace('{user_id}', userId || 'anonymous')
    .replace('{filename}', recording.filename)
    .replace('{timestamp}', recording.timestamp.split('T')[0]) // YYYY-MM-DD
    .replace('{year}', new Date(recording.timestamp).getFullYear().toString())
    .replace('{month}', (new Date(recording.timestamp).getMonth() + 1).toString().padStart(2, '0'));

  return s3Key;
}
```

## Background Sync with Service Worker

### Service Worker Integration
```typescript
// In main thread
async registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Listen for sync events
      registration.addEventListener('sync', event => {
        if (event.tag === 'audio-sync') {
          this.processSyncQueue();
        }
      });
      
      // Register for background sync
      if ('sync' in registration) {
        await registration.sync.register('audio-sync');
      }
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
}
```

### Service Worker Implementation
```javascript
// sw.js
self.addEventListener('sync', event => {
  if (event.tag === 'audio-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Open IndexedDB and process sync queue
  const db = await openDB();
  const syncManager = new SyncManager(db);
  await syncManager.processSyncQueue();
}
```

## Sync Status UI Integration

### Status Updates
```typescript
class SyncStatusManager {
  private listeners: Map<string, Set<Function>> = new Map();

  // Subscribe to sync status changes for a recording
  onSyncStatusChange(recordingId: string, callback: (status: SyncStatus) => void): void {
    if (!this.listeners.has(recordingId)) {
      this.listeners.set(recordingId, new Set());
    }
    this.listeners.get(recordingId)!.add(callback);
  }

  // Emit status change
  private emitStatusChange(recordingId: string, status: SyncStatus): void {
    const callbacks = this.listeners.get(recordingId);
    if (callbacks) {
      callbacks.forEach(callback => callback(status));
    }
  }

  // Get current sync status for a recording
  async getSyncStatus(recordingId: string): Promise<SyncStatus> {
    const recording = await this.recordingStore.getRecording(recordingId);
    const queueItem = await this.syncQueue.getByRecordingId(recordingId);

    if (recording?.synced) {
      return { status: 'synced', icon: '☁️' };
    }

    if (queueItem) {
      switch (queueItem.status) {
        case 'syncing':
          return { status: 'syncing', icon: '🔄' };
        case 'failed':
          return { status: 'failed', icon: '⚠️', error: queueItem.error };
        case 'pending':
          return { status: 'pending', icon: '📤' };
      }
    }

    return { status: 'local', icon: '🗂️' };
  }
}
```

## Configuration & Settings

### Sync Settings
```typescript
interface SyncSettings {
  autoSync: boolean;              // Auto-sync when online
  syncOnMobileData: boolean;      // Allow sync over mobile data
  syncOnMeteredConnection: boolean; // Sync on metered WiFi
  maxConcurrentUploads: number;   // Max parallel uploads
  chunkSize: number;              // Upload chunk size for large files
  retryAttempts: number;          // Override default retry attempts
  syncInterval: number;           // Background sync interval (ms)
}
```

This sync system provides robust, reliable cloud backup with intelligent retry logic, network awareness, and seamless offline/online transitions.