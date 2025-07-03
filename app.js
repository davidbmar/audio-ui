/**
 * Main Application Controller
 * Orchestrates the audio recorder, storage, and UI components
 */

class AudioRecorderApp {
    constructor() {
        this.recorder = null;
        this.storage = null;
        this.currentRecording = null;
        this.isRecording = false;
        this.recordings = [];
        this.settings = {};
        
        // UI Elements
        this.elements = {
            recordButton: document.getElementById('record-button'),
            timer: document.getElementById('timer'),
            durationSlider: document.getElementById('duration-range'),
            durationDisplay: document.getElementById('duration-display'),
            fileListContent: document.getElementById('file-list-content'),
            fileCount: document.getElementById('file-count'),
            emptyState: document.getElementById('empty-state'),
            networkStatus: document.getElementById('network-status'),
            storageText: document.getElementById('storage-text'),
            storageFill: document.getElementById('storage-fill'),
            warningIcon: document.getElementById('warning-icon'),
            settingsButton: document.getElementById('settings-button'),
            settingsPanel: document.getElementById('settings-panel'),
            closeSettings: document.getElementById('close-settings'),
            // Settings
            overlapDuration: document.getElementById('overlap-duration'),
            skipDeleteConfirm: document.getElementById('skip-delete-confirm'),
            // Modals
            renameModal: document.getElementById('rename-modal'),
            renameInput: document.getElementById('rename-input'),
            confirmRename: document.getElementById('confirm-rename'),
            cancelRename: document.getElementById('cancel-rename'),
            tagsModal: document.getElementById('tags-modal'),
            tagsInput: document.getElementById('tags-input'),
            confirmTags: document.getElementById('confirm-tags'),
            cancelTags: document.getElementById('cancel-tags')
        };
        
        this.currentEditingId = null;
        this.syncStatuses = ['🗂️', '📤', '🔄', '☁️', '⚠️']; // local, queued, syncing, synced, failed
        
        // Audio playback
        this.currentlyPlaying = null;
        this.audioPlayers = new Map(); // Map of recording ID to audio element
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing Audio Recorder App...');
            
            // Check browser support
            if (!SimpleAudioRecorder.isSupported()) {
                this.showError('Your browser does not support audio recording. Please use a modern browser with HTTPS.');
                return;
            }

            // Initialize storage
            this.storage = new StorageManager();
            await this.storage.init();
            console.log('Storage initialized');

            // Initialize audio recorder
            this.recorder = new SimpleAudioRecorder();
            this.setupRecorderCallbacks();

            // Load settings and recordings
            await this.loadSettings();
            await this.loadRecordings();

            // Setup UI event listeners
            this.setupEventListeners();

            // Update UI
            this.updateDurationDisplay();
            this.updateStorageInfo();
            this.updateNetworkStatus();

            // Start periodic updates
            this.startPeriodicUpdates();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    /**
     * Setup audio recorder callbacks
     */
    setupRecorderCallbacks() {
        this.recorder.onChunkComplete = async (chunkData) => {
            await this.saveRecordingChunk(chunkData);
        };

        this.recorder.onRecordingComplete = (summary) => {
            console.log('Recording session completed:', summary);
            this.isRecording = false;
            this.updateRecordButton();
        };

        this.recorder.onTimerUpdate = (elapsed, duration, remaining) => {
            this.updateTimer(elapsed, duration);
        };

        this.recorder.onError = (type, message) => {
            this.handleRecordingError(type, message);
        };
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Record button
        this.elements.recordButton.addEventListener('click', () => {
            this.toggleRecording();
        });

        // Duration slider
        this.elements.durationSlider.addEventListener('input', (e) => {
            const duration = parseInt(e.target.value);
            this.recorder.setChunkDuration(duration);
            this.updateDurationDisplay();
        });

        // Overlap duration setting
        this.elements.overlapDuration.addEventListener('change', (e) => {
            const overlapMs = parseInt(e.target.value);
            this.recorder.setOverlapDuration(overlapMs);
            this.saveOverlapSetting(overlapMs);
        });

        // Skip delete confirmation setting
        this.elements.skipDeleteConfirm.addEventListener('change', (e) => {
            const skipConfirm = e.target.checked;
            this.saveSkipDeleteConfirmSetting(skipConfirm);
        });

        // Settings
        this.elements.settingsButton?.addEventListener('click', () => {
            this.showSettings();
        });

        this.elements.closeSettings?.addEventListener('click', () => {
            this.hideSettings();
        });

        // Modal events
        this.setupModalEvents();

        // Network status
        window.addEventListener('online', () => this.updateNetworkStatus());
        window.addEventListener('offline', () => this.updateNetworkStatus());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isInputFocused()) {
                e.preventDefault();
                this.toggleRecording();
            }
        });
    }

    /**
     * Setup modal event listeners
     */
    setupModalEvents() {
        // Rename modal
        this.elements.cancelRename?.addEventListener('click', () => {
            this.hideModal('rename-modal');
        });

        this.elements.confirmRename?.addEventListener('click', () => {
            this.confirmRename();
        });

        this.elements.renameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.confirmRename();
            if (e.key === 'Escape') this.hideModal('rename-modal');
        });

        // Tags modal
        this.elements.cancelTags?.addEventListener('click', () => {
            this.hideModal('tags-modal');
        });

        this.elements.confirmTags?.addEventListener('click', () => {
            this.confirmTags();
        });

        this.elements.tagsInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.confirmTags();
            if (e.key === 'Escape') this.hideModal('tags-modal');
        });

        // Close modals on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal__backdrop')) {
                this.hideModal(e.target.parentElement.id);
            }
        });
    }

    /**
     * Toggle recording state
     */
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    /**
     * Start recording
     */
    async startRecording() {
        try {
            const chunkDuration = parseInt(this.elements.durationSlider.value);
            const success = await this.recorder.startRecording(chunkDuration);
            
            if (success) {
                this.isRecording = true;
                this.updateRecordButton();
                console.log('Recording started');
            }
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showError('Failed to start recording. Please check microphone permissions.');
        }
    }

    /**
     * Stop recording
     */
    stopRecording() {
        try {
            this.recorder.stopRecording();
            this.isRecording = false;
            this.updateRecordButton();
            console.log('Recording stopped');
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    }

    /**
     * Save recording chunk to storage
     */
    async saveRecordingChunk(chunkData) {
        try {
            const filename = this.generateFilename(chunkData.chunkNumber);
            
            const recordingData = {
                filename: filename,
                originalName: filename,
                blob: chunkData.blob,
                size: chunkData.size,
                duration: chunkData.duration,
                format: chunkData.mimeType,
                chunkSize: this.recorder.currentChunkDuration,
                tags: []
            };

            const recording = await this.storage.createRecording(recordingData);
            
            // Add to sync queue if auto-sync is enabled
            if (this.settings.autoSync) {
                await this.storage.addToSyncQueue(recording.id, 7); // High priority
            }

            // Refresh recordings list
            await this.loadRecordings();
            this.updateStorageInfo();

            console.log('Chunk saved:', recording.id);
        } catch (error) {
            console.error('Failed to save recording chunk:', error);
            this.showError('Failed to save recording. Please check available storage.');
        }
    }

    /**
     * Generate filename for recording
     */
    generateFilename(chunkNumber = 1) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `recording_${date}_${time}_${chunkNumber}.webm`;
    }

    /**
     * Load recordings from storage
     */
    async loadRecordings() {
        try {
            this.recordings = await this.storage.getRecordings();
            this.renderRecordingsList();
        } catch (error) {
            console.error('Failed to load recordings:', error);
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            this.settings = await this.storage.getSettings();
            this.applySettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = this.storage.getDefaultSettings();
        }
    }

    /**
     * Apply settings to UI
     */
    applySettings() {
        if (this.elements.durationSlider) {
            this.elements.durationSlider.value = this.settings.defaultChunkDuration;
        }
        if (this.elements.overlapDuration) {
            this.elements.overlapDuration.value = this.settings.overlapDuration || 500;
        }
        if (this.elements.skipDeleteConfirm) {
            this.elements.skipDeleteConfirm.checked = this.settings.skipDeleteConfirm || false;
        }
        
        // Apply to recorder
        if (this.recorder) {
            this.recorder.setOverlapDuration(this.settings.overlapDuration || 500);
        }
        
        this.updateDurationDisplay();
    }

    /**
     * Save overlap setting to storage
     */
    async saveOverlapSetting(overlapMs) {
        try {
            await this.storage.updateSettings({ overlapDuration: overlapMs });
            console.log('⚙️ SETTINGS: Overlap duration saved to storage:', overlapMs + 'ms');
        } catch (error) {
            console.error('Failed to save overlap setting:', error);
        }
    }

    /**
     * Save skip delete confirmation setting to storage
     */
    async saveSkipDeleteConfirmSetting(skipConfirm) {
        try {
            await this.storage.updateSettings({ skipDeleteConfirm: skipConfirm });
            console.log('⚙️ SETTINGS: Skip delete confirmation saved to storage:', skipConfirm);
        } catch (error) {
            console.error('Failed to save skip delete confirmation setting:', error);
        }
    }

    /**
     * Render recordings list
     */
    renderRecordingsList() {
        if (!this.elements.fileListContent) return;

        if (this.recordings.length === 0) {
            this.elements.emptyState.style.display = 'block';
            this.elements.fileCount.textContent = '(0 files)';
            return;
        }

        this.elements.emptyState.style.display = 'none';
        this.elements.fileCount.textContent = `(${this.recordings.length} files)`;

        const html = this.recordings.map(recording => this.renderRecordingItem(recording)).join('');
        this.elements.fileListContent.innerHTML = html;

        // Add event listeners to action buttons
        this.setupRecordingItemEvents();
        
        // Also set up event delegation for dynamically added buttons
        this.setupEventDelegation();
    }

    /**
     * Render single recording item
     */
    renderRecordingItem(recording) {
        const syncIcon = this.getSyncIcon(recording);
        const tags = recording.tags || [];
        const tagsHtml = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const duration = SimpleAudioRecorder.formatDuration(recording.duration);
        const size = SimpleAudioRecorder.formatFileSize(recording.size);
        const date = new Date(recording.timestamp).toLocaleDateString();

        return `
            <div class="file-item" data-id="${recording.id}">
                <div class="file-item__icon">🎙️</div>
                <div class="file-item__content">
                    <div class="file-item__header">
                        <div class="file-item__name">${recording.filename}</div>
                        <div class="file-item__sync-status">${syncIcon}</div>
                    </div>
                    <div class="file-item__metadata">
                        <span>${size}</span>
                        <span>•</span>
                        <span>${duration}</span>
                        <span>•</span>
                        <span>${date}</span>
                    </div>
                    <div class="file-item__tags">${tagsHtml}</div>
                    <div class="file-item__actions">
                        <button class="action-button action-button--play" data-action="play" data-id="${recording.id}">
                            ▶️ Play
                        </button>
                        <button class="action-button" data-action="rename" data-id="${recording.id}">
                            📝 Rename
                        </button>
                        <button class="action-button" data-action="tags" data-id="${recording.id}">
                            🏷️ Tags
                        </button>
                        <button class="action-button action-button--delete" data-action="delete" data-id="${recording.id}">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup recording item event listeners
     */
    setupRecordingItemEvents() {
        console.log('🔗 EVENTS: Setting up recording item event listeners');
        
        // Remove existing listeners first to avoid duplicates
        const existingButtons = document.querySelectorAll('.action-button');
        existingButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
        
        // Add fresh event listeners
        const actionButtons = document.querySelectorAll('.action-button');
        console.log('🔗 EVENTS: Found', actionButtons.length, 'action buttons');
        
        actionButtons.forEach((button, index) => {
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            console.log('🔗 EVENTS: Setting up button', index, 'action:', action, 'id:', id?.substring(0, 8));
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔗 EVENTS: Button clicked - action:', action, 'id:', id?.substring(0, 8));
                this.handleRecordingAction(action, id);
            });
        });
        
        console.log('✅ EVENTS: Event listeners setup complete');
    }

    /**
     * Setup event delegation for recording items (handles dynamically added content)
     */
    setupEventDelegation() {
        console.log('🔗 DELEGATION: Setting up event delegation');
        
        // Remove existing delegation listener if any
        if (this.delegationHandler) {
            this.elements.fileListContent.removeEventListener('click', this.delegationHandler);
        }
        
        // Create new delegation handler
        this.delegationHandler = (e) => {
            const button = e.target.closest('.action-button');
            if (!button) return;
            
            e.preventDefault();
            const action = button.dataset.action;
            const id = button.dataset.id;
            
            console.log('🔗 DELEGATION: Delegated click - action:', action, 'id:', id?.substring(0, 8));
            this.handleRecordingAction(action, id);
        };
        
        // Add delegation listener to parent container
        this.elements.fileListContent.addEventListener('click', this.delegationHandler);
        console.log('✅ DELEGATION: Event delegation setup complete');
    }

    /**
     * Handle recording item actions
     */
    async handleRecordingAction(action, id) {
        console.log('🎯 ACTION: Handling action:', action, 'for id:', id?.substring(0, 8));
        
        const recording = this.recordings.find(r => r.id === id);
        if (!recording) {
            console.error('❌ ACTION: Recording not found for id:', id);
            return;
        }

        console.log('🎯 ACTION: Found recording:', {
            filename: recording.filename,
            hasBlob: !!recording.blob,
            blobSize: recording.blob?.size,
            blobType: recording.blob?.type
        });

        switch (action) {
            case 'play':
                await this.togglePlayback(recording);
                break;
            case 'rename':
                this.showRenameModal(recording);
                break;
            case 'tags':
                this.showTagsModal(recording);
                break;
            case 'delete':
                await this.deleteRecording(id);
                break;
        }
    }

    /**
     * Toggle audio playback for a recording
     */
    async togglePlayback(recording) {
        console.log('🎵 PLAY: Toggle playback for recording:', recording.filename);
        console.log('🎵 PLAY: Recording object:', {
            id: recording.id,
            filename: recording.filename,
            hasBlob: !!recording.blob,
            blobType: recording.blob?.type,
            blobSize: recording.blob?.size,
            duration: recording.duration
        });
        
        const recordingId = recording.id;
        const playButton = document.querySelector(`[data-action="play"][data-id="${recordingId}"]`);
        
        // Check if recording has valid blob data
        if (!recording.blob) {
            console.error('🎵 PLAY: No blob data found for recording');
            this.showError('No audio data found for this recording.');
            return;
        }
        
        // If this recording is currently playing, stop it
        if (this.currentlyPlaying === recordingId) {
            console.log('🎵 PLAY: Stopping current playback');
            this.stopPlayback(recordingId);
            return;
        }
        
        // Stop any other currently playing audio
        if (this.currentlyPlaying) {
            console.log('🎵 PLAY: Stopping other audio:', this.currentlyPlaying);
            this.stopPlayback(this.currentlyPlaying);
        }
        
        try {
            console.log('🎵 PLAY: Starting playback for:', recording.filename);
            
            // Create audio element if it doesn't exist
            if (!this.audioPlayers.has(recordingId)) {
                console.log('🎵 PLAY: Creating new audio player');
                
                const audioBlob = recording.blob;
                console.log('🎵 PLAY: Blob details:', {
                    type: audioBlob.type,
                    size: audioBlob.size,
                    constructor: audioBlob.constructor.name,
                    isValidBlob: audioBlob instanceof Blob,
                    hasValidSize: audioBlob.size > 0
                });
                
                // Check if blob can be read
                const testReader = new FileReader();
                testReader.onload = () => {
                    console.log('🎵 PLAY: Blob is readable, first 50 bytes:', 
                        new Uint8Array(testReader.result.slice(0, 50)));
                };
                testReader.onerror = (err) => {
                    console.error('🎵 PLAY: Blob read error:', err);
                };
                testReader.readAsArrayBuffer(audioBlob.slice(0, 100));
                
                const audioUrl = URL.createObjectURL(audioBlob);
                console.log('🎵 PLAY: Created blob URL:', audioUrl);
                
                const audio = new Audio(audioUrl);
                audio.preload = 'metadata';
                
                // Set up event listeners
                audio.addEventListener('loadstart', () => {
                    console.log('🎵 PLAY: Audio load started');
                });
                
                audio.addEventListener('loadeddata', () => {
                    console.log('🎵 PLAY: Audio data loaded');
                });
                
                audio.addEventListener('canplay', () => {
                    console.log('🎵 PLAY: Audio can play');
                });
                
                audio.addEventListener('ended', () => {
                    console.log('🎵 PLAY: Audio ended');
                    this.onAudioEnded(recordingId);
                });
                
                audio.addEventListener('error', (e) => {
                    console.error('🎵 PLAY: Audio error:', e);
                    console.error('🎵 PLAY: Audio error details:', {
                        error: audio.error,
                        networkState: audio.networkState,
                        readyState: audio.readyState
                    });
                    this.onAudioError(recordingId, e);
                });
                
                audio.addEventListener('loadedmetadata', () => {
                    console.log('🎵 PLAY: Audio metadata loaded, duration:', audio.duration);
                });
                
                this.audioPlayers.set(recordingId, { audio, url: audioUrl });
            }
            
            const { audio } = this.audioPlayers.get(recordingId);
            
            console.log('🎵 PLAY: Audio element state:', {
                readyState: audio.readyState,
                networkState: audio.networkState,
                currentTime: audio.currentTime,
                duration: audio.duration,
                paused: audio.paused
            });
            
            console.log('🎵 PLAY: Starting audio playback');
            await audio.play();
            
            // Update UI
            this.currentlyPlaying = recordingId;
            this.updatePlayButton(recordingId, true);
            
            console.log('🎵 PLAY: Playback started successfully');
            
        } catch (error) {
            console.error('🎵 PLAY: Error playing audio:', error);
            console.error('🎵 PLAY: Error stack:', error.stack);
            this.showError('Failed to play audio: ' + error.message);
        }
    }

    /**
     * Stop audio playback
     */
    stopPlayback(recordingId) {
        console.log('🎵 STOP: Stopping playback for:', recordingId);
        
        if (this.audioPlayers.has(recordingId)) {
            const { audio } = this.audioPlayers.get(recordingId);
            audio.pause();
            audio.currentTime = 0;
        }
        
        if (this.currentlyPlaying === recordingId) {
            this.currentlyPlaying = null;
        }
        
        this.updatePlayButton(recordingId, false);
    }

    /**
     * Handle audio ended event
     */
    onAudioEnded(recordingId) {
        console.log('🎵 END: Audio playback ended for:', recordingId);
        
        if (this.currentlyPlaying === recordingId) {
            this.currentlyPlaying = null;
        }
        
        this.updatePlayButton(recordingId, false);
    }

    /**
     * Handle audio error event
     */
    onAudioError(recordingId, error) {
        console.error('🎵 ERROR: Audio playback error for:', recordingId, error);
        
        if (this.currentlyPlaying === recordingId) {
            this.currentlyPlaying = null;
        }
        
        this.updatePlayButton(recordingId, false);
        this.showError('Error playing audio file.');
    }

    /**
     * Update play button state
     */
    updatePlayButton(recordingId, isPlaying) {
        const playButton = document.querySelector(`[data-action="play"][data-id="${recordingId}"]`);
        if (!playButton) return;
        
        if (isPlaying) {
            playButton.innerHTML = '⏸️ Stop';
            playButton.classList.add('action-button--playing');
        } else {
            playButton.innerHTML = '▶️ Play';
            playButton.classList.remove('action-button--playing');
        }
    }

    /**
     * Clean up audio resources for a recording
     */
    cleanupAudio(recordingId) {
        if (this.audioPlayers.has(recordingId)) {
            const { audio, url } = this.audioPlayers.get(recordingId);
            audio.pause();
            URL.revokeObjectURL(url);
            this.audioPlayers.delete(recordingId);
            
            if (this.currentlyPlaying === recordingId) {
                this.currentlyPlaying = null;
            }
        }
    }

    /**
     * Show rename modal
     */
    showRenameModal(recording) {
        this.currentEditingId = recording.id;
        this.elements.renameInput.value = recording.filename.replace(/\.[^/.]+$/, ''); // Remove extension
        this.showModal('rename-modal');
        this.elements.renameInput.focus();
        this.elements.renameInput.select();
    }

    /**
     * Show tags modal
     */
    showTagsModal(recording) {
        this.currentEditingId = recording.id;
        this.elements.tagsInput.value = (recording.tags || []).join(' ');
        this.showModal('tags-modal');
        this.elements.tagsInput.focus();
    }

    /**
     * Confirm rename action
     */
    async confirmRename() {
        if (!this.currentEditingId) return;

        const newName = this.elements.renameInput.value.trim();
        if (!newName) return;

        try {
            const recording = this.recordings.find(r => r.id === this.currentEditingId);
            const extension = recording.filename.split('.').pop();
            const filename = `${newName}.${extension}`;

            await this.storage.updateRecording(this.currentEditingId, { filename });
            await this.loadRecordings();
            this.hideModal('rename-modal');
        } catch (error) {
            console.error('Failed to rename recording:', error);
            this.showError('Failed to rename recording.');
        }
    }

    /**
     * Confirm tags action
     */
    async confirmTags() {
        if (!this.currentEditingId) return;

        try {
            const tagsText = this.elements.tagsInput.value.trim();
            const tags = tagsText ? tagsText.split(/\s+/).filter(tag => tag.startsWith('#')) : [];

            await this.storage.updateRecording(this.currentEditingId, { tags });
            await this.loadRecordings();
            this.hideModal('tags-modal');
        } catch (error) {
            console.error('Failed to update tags:', error);
            this.showError('Failed to update tags.');
        }
    }

    /**
     * Delete recording
     */
    async deleteRecording(id) {
        // Check if we should skip the confirmation
        const shouldConfirm = !this.settings.skipDeleteConfirm;
        
        if (shouldConfirm && !confirm('Are you sure you want to delete this recording?')) {
            return;
        }

        try {
            // Clean up any audio resources first
            this.cleanupAudio(id);
            
            await this.storage.deleteRecording(id);
            await this.loadRecordings();
            this.updateStorageInfo();
        } catch (error) {
            console.error('Failed to delete recording:', error);
            this.showError('Failed to delete recording.');
        }
    }

    /**
     * Get sync icon for recording
     */
    getSyncIcon(recording) {
        if (recording.synced) return '☁️';
        return '🗂️'; // Local only for now
    }

    /**
     * Update record button state
     */
    updateRecordButton() {
        console.log('🔄 UI: Updating record button, isRecording =', this.isRecording);
        
        const button = this.elements.recordButton;
        const icon = button.querySelector('.record-icon');
        
        if (this.isRecording) {
            console.log('🔴 UI: Setting button to recording state');
            button.classList.add('record-button--recording');
            button.title = 'Stop Recording';
            icon.textContent = '⏹️';
        } else {
            console.log('⚫ UI: Setting button to stopped state');
            button.classList.remove('record-button--recording');
            button.title = 'Start Recording';
            icon.textContent = '⏺️';
        }
    }

    /**
     * Update timer display
     */
    updateTimer(elapsed, duration) {
        const elapsedFormatted = SimpleAudioRecorder.formatDuration(elapsed);
        const durationFormatted = SimpleAudioRecorder.formatDuration(duration);
        
        this.elements.timer.textContent = `${elapsedFormatted} / ${durationFormatted}`;
        this.elements.timer.classList.toggle('timer--recording', this.isRecording);
    }

    /**
     * Update duration display
     */
    updateDurationDisplay() {
        const seconds = parseInt(this.elements.durationSlider.value);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        let display;
        if (minutes > 0) {
            display = remainingSeconds > 0 ? `${minutes}m${remainingSeconds}s` : `${minutes}min`;
        } else {
            display = `${seconds}s`;
        }
        
        this.elements.durationDisplay.textContent = display;
    }

    /**
     * Update storage information
     */
    async updateStorageInfo() {
        try {
            const info = await this.storage.getStorageInfo();
            const usedMB = Math.round(info.usedByApp / (1024 * 1024));
            const totalMB = Math.round(info.maxAllowed / (1024 * 1024));
            
            this.elements.storageText.textContent = `${usedMB} MB / ${totalMB} MB`;
            this.elements.storageFill.style.width = `${info.percentUsed}%`;
            
            // Update warning state
            if (info.percentUsed >= 75) {
                this.elements.storageFill.className = 'storage-bar__fill storage-bar__fill--warning';
                this.elements.warningIcon.style.display = 'inline';
            } else if (info.percentUsed >= 90) {
                this.elements.storageFill.className = 'storage-bar__fill storage-bar__fill--critical';
                this.elements.warningIcon.style.display = 'inline';
            } else {
                this.elements.storageFill.className = 'storage-bar__fill';
                this.elements.warningIcon.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to update storage info:', error);
        }
    }

    /**
     * Update network status
     */
    updateNetworkStatus() {
        const isOnline = navigator.onLine;
        const status = this.elements.networkStatus;
        const icon = status.querySelector('.network-icon');
        const text = status.querySelector('.network-text');
        
        if (isOnline) {
            status.classList.remove('network-status--offline');
            icon.textContent = '🌐';
            text.textContent = 'Online';
        } else {
            status.classList.add('network-status--offline');
            icon.textContent = '📡';
            text.textContent = 'Offline';
        }
    }

    /**
     * Show/hide settings panel
     */
    showSettings() {
        this.elements.settingsPanel.style.display = 'block';
    }

    hideSettings() {
        this.elements.settingsPanel.style.display = 'none';
    }

    /**
     * Show/hide modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentEditingId = null;
    }

    /**
     * Check if an input is currently focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.contentEditable === 'true'
        );
    }

    /**
     * Handle recording errors
     */
    handleRecordingError(type, message) {
        let errorMessage = 'Recording error occurred.';
        
        switch (type) {
            case 'microphone_access':
                errorMessage = 'Microphone access denied. Please enable microphone permissions.';
                break;
            case 'recording_error':
                errorMessage = 'Recording failed. Please try again.';
                break;
            case 'start_recording':
                errorMessage = 'Could not start recording. Please check your microphone.';
                break;
            case 'stop_recording':
                errorMessage = 'Could not stop recording properly.';
                break;
        }
        
        this.showError(errorMessage);
        
        // Reset recording state
        this.isRecording = false;
        this.updateRecordButton();
    }

    /**
     * Show error message
     */
    showError(message) {
        // Simple alert for now - could be replaced with a toast notification
        alert(message);
        console.error('App Error:', message);
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        // Update storage info every 30 seconds
        setInterval(() => {
            this.updateStorageInfo();
        }, 30000);

        // Update network status every 10 seconds
        setInterval(() => {
            this.updateNetworkStatus();
        }, 10000);
    }

    /**
     * Cleanup when app is closed
     */
    cleanup() {
        if (this.recorder) {
            this.recorder.cleanup();
        }
        
        // Clean up all audio resources
        for (const [recordingId] of this.audioPlayers) {
            this.cleanupAudio(recordingId);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new AudioRecorderApp();
    await window.app.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.cleanup();
    }
});