/**
 * Audio Recorder Class
 * Handles audio recording using MediaRecorder API with chunking support
 */

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isPaused = false;
        this.currentChunkDuration = 10; // seconds - for testing
        this.recordingStartTime = null;
        this.chunkStartTime = null;
        this.chunkCount = 0;
        this.totalDuration = 0;
        
        // Timer intervals
        this.timerInterval = null;
        this.chunkInterval = null;
        
        // Event callbacks
        this.onChunkComplete = null;
        this.onRecordingComplete = null;
        this.onTimerUpdate = null;
        this.onError = null;
        
        // Audio format preferences
        this.mimeType = this.getSupportedMimeType();
    }

    /**
     * Get the best supported MIME type for recording
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        
        return 'audio/webm'; // Fallback
    }

    /**
     * Initialize audio recording
     */
    async init() {
        try {
            // Request microphone permission
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            console.log('Microphone access granted');
            return true;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            if (this.onError) {
                this.onError('microphone_access', error.message);
            }
            return false;
        }
    }

    /**
     * Start recording
     */
    async startRecording(chunkDuration = 10) {
        console.log('🎬 START: Starting recording with chunk duration =', chunkDuration, 'seconds');
        console.log('🎬 START: Current state - isRecording =', this.isRecording);
        
        if (this.isRecording) {
            console.warn('❌ START: Recording already in progress');
            return false;
        }

        if (!this.audioStream) {
            console.log('🎬 START: No audio stream, initializing...');
            const initialized = await this.init();
            if (!initialized) {
                console.log('❌ START: Failed to initialize audio stream');
                return false;
            }
        }

        try {
            console.log('🎬 START: Setting up recording parameters');
            this.currentChunkDuration = chunkDuration;
            this.audioChunks = [];
            this.chunkCount = 0;
            this.totalDuration = 0;
            
            console.log('🎬 START: Creating MediaRecorder instance');
            // Create MediaRecorder instance
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: this.mimeType,
                audioBitsPerSecond: 128000 // 128 kbps
            });

            console.log('🎬 START: Setting up event handlers');
            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('📊 DATA: Received audio data, size =', event.data.size, 'total chunks =', this.audioChunks.length);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('⏹️ STOP: MediaRecorder stopped');
                this.handleRecordingStop();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ ERROR: MediaRecorder error:', event.error);
                if (this.onError) {
                    this.onError('recording_error', event.error.message);
                }
            };

            console.log('🎬 START: Starting MediaRecorder');
            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.chunkStartTime = Date.now();

            console.log('🎬 START: Starting timers');
            // Start timers
            this.startTimers();

            console.log('✅ START: Recording started successfully');
            console.log('✅ START: MediaRecorder state =', this.mediaRecorder.state);
            console.log('✅ START: Chunk duration =', this.currentChunkDuration, 'seconds');
            return true;
        } catch (error) {
            console.error('❌ START: Error starting recording:', error);
            if (this.onError) {
                this.onError('start_recording', error.message);
            }
            return false;
        }
    }

    /**
     * Stop recording
     */
    stopRecording() {
        console.log('🛑 STOP: User requested stop recording');
        console.log('🛑 STOP: Current state - isRecording =', this.isRecording);
        console.log('🛑 STOP: MediaRecorder state =', this.mediaRecorder?.state);
        
        if (!this.isRecording) {
            console.warn('❌ STOP: No recording in progress');
            return false;
        }

        try {
            console.log('🛑 STOP: Setting isRecording to false');
            this.isRecording = false;
            
            console.log('🛑 STOP: Stopping timers');
            this.stopTimers();
            
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                console.log('🛑 STOP: Stopping MediaRecorder');
                this.mediaRecorder.stop();
            } else {
                console.log('🛑 STOP: MediaRecorder already inactive');
            }
            
            console.log('✅ STOP: Recording stopped successfully');
            return true;
        } catch (error) {
            console.error('❌ STOP: Error stopping recording:', error);
            if (this.onError) {
                this.onError('stop_recording', error.message);
            }
            return false;
        }
    }

    /**
     * Pause recording
     */
    pauseRecording() {
        if (!this.isRecording || this.isPaused) {
            return false;
        }

        try {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.stopTimers();
            console.log('Recording paused');
            return true;
        } catch (error) {
            console.error('Error pausing recording:', error);
            return false;
        }
    }

    /**
     * Resume recording
     */
    resumeRecording() {
        if (!this.isRecording || !this.isPaused) {
            return false;
        }

        try {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.startTimers();
            console.log('Recording resumed');
            return true;
        } catch (error) {
            console.error('Error resuming recording:', error);
            return false;
        }
    }

    /**
     * Start timer intervals
     */
    startTimers() {
        console.log('⏰ TIMER: Starting timer intervals');
        
        // Update timer display every 100ms
        this.timerInterval = setInterval(() => {
            if (this.onTimerUpdate) {
                const elapsed = (Date.now() - this.chunkStartTime) / 1000;
                const remaining = Math.max(0, this.currentChunkDuration - elapsed);
                this.onTimerUpdate(elapsed, this.currentChunkDuration, remaining);
            }
        }, 100);

        // Check for chunk completion every second
        this.chunkInterval = setInterval(() => {
            const elapsed = (Date.now() - this.chunkStartTime) / 1000;
            console.log('⏰ TIMER: Checking chunk completion - elapsed =', elapsed.toFixed(1), 'target =', this.currentChunkDuration);
            
            if (elapsed >= this.currentChunkDuration) {
                console.log('🚨 TIMER: Chunk duration reached, triggering completion');
                this.completeCurrentChunk();
            }
        }, 1000);
        
        console.log('✅ TIMER: Timers started successfully');
    }

    /**
     * Stop timer intervals
     */
    stopTimers() {
        console.log('⏸️ TIMER: Stopping timer intervals');
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log('⏸️ TIMER: Timer interval cleared');
        }
        if (this.chunkInterval) {
            clearInterval(this.chunkInterval);
            this.chunkInterval = null;
            console.log('⏸️ TIMER: Chunk interval cleared');
        }
        
        console.log('✅ TIMER: All timers stopped');
    }

    /**
     * Complete current chunk and start new one
     */
    async completeCurrentChunk() {
        console.log('🔄 CHUNK: Starting chunk completion process');
        console.log('🔄 CHUNK: isRecording =', this.isRecording);
        console.log('🔄 CHUNK: MediaRecorder state =', this.mediaRecorder?.state);
        
        if (!this.isRecording) {
            console.log('❌ CHUNK: Not recording, aborting chunk completion');
            return;
        }

        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
            console.log('❌ CHUNK: MediaRecorder inactive, aborting chunk completion');
            return;
        }

        try {
            console.log('⏹️ CHUNK: Stopping MediaRecorder for chunk');
            
            // Create a promise that resolves when the chunk is processed
            const chunkPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('⏰ CHUNK: Timeout waiting for chunk data');
                    reject(new Error('Chunk timeout'));
                }, 5000);

                const originalOnStop = this.mediaRecorder.onstop;
                this.mediaRecorder.onstop = async (event) => {
                    console.log('✅ CHUNK: MediaRecorder stopped, processing chunk');
                    clearTimeout(timeout);
                    
                    try {
                        await this.handleChunkComplete();
                        originalOnStop?.call(this, event);
                        resolve();
                    } catch (error) {
                        console.error('❌ CHUNK: Error in handleChunkComplete:', error);
                        reject(error);
                    }
                };
            });

            // Stop the current recording
            this.mediaRecorder.stop();
            
            // Wait for chunk to be processed
            await chunkPromise;
            
            console.log('🔄 CHUNK: Chunk processed, checking if should continue recording');
            
            // Start new chunk if still recording
            if (this.isRecording) {
                console.log('▶️ CHUNK: Starting new chunk');
                this.startNewChunk();
            } else {
                console.log('⏹️ CHUNK: Recording stopped, not starting new chunk');
            }
            
        } catch (error) {
            console.error('❌ CHUNK: Error completing chunk:', error);
            this.isRecording = false; // Stop recording on error
            this.stopTimers();
            if (this.onError) {
                this.onError('chunk_error', error.message);
            }
        }
    }

    /**
     * Handle chunk completion
     */
    async handleChunkComplete() {
        console.log('📦 PROCESS: Starting chunk data processing');
        console.log('📦 PROCESS: audioChunks.length =', this.audioChunks.length);
        
        if (this.audioChunks.length === 0) {
            console.log('❌ PROCESS: No audio chunks to process');
            return;
        }

        const chunkBlob = new Blob(this.audioChunks, { type: this.mimeType });
        const chunkDuration = (Date.now() - this.chunkStartTime) / 1000;
        
        console.log('📦 PROCESS: Created blob, size =', chunkBlob.size, 'bytes');
        console.log('📦 PROCESS: Chunk duration =', chunkDuration.toFixed(2), 'seconds');
        
        this.chunkCount++;
        this.totalDuration += chunkDuration;

        const chunkData = {
            blob: chunkBlob,
            duration: chunkDuration,
            chunkNumber: this.chunkCount,
            totalDuration: this.totalDuration,
            timestamp: new Date().toISOString(),
            size: chunkBlob.size,
            mimeType: this.mimeType
        };

        console.log('📦 PROCESS: Chunk data prepared:', {
            chunkNumber: chunkData.chunkNumber,
            duration: chunkData.duration.toFixed(2),
            size: chunkData.size,
            totalDuration: chunkData.totalDuration.toFixed(2)
        });

        // Callback for chunk completion
        if (this.onChunkComplete) {
            console.log('📤 PROCESS: Calling onChunkComplete callback');
            try {
                await this.onChunkComplete(chunkData);
                console.log('✅ PROCESS: Chunk callback completed successfully');
            } catch (error) {
                console.error('❌ PROCESS: Error in chunk callback:', error);
                throw error;
            }
        }

        console.log(`✅ Chunk ${this.chunkCount} completed: ${chunkDuration.toFixed(1)}s, ${(chunkBlob.size / 1024).toFixed(1)}KB`);
    }

    /**
     * Start new recording chunk
     */
    startNewChunk() {
        console.log('🆕 NEW CHUNK: Starting new recording chunk');
        console.log('🆕 NEW CHUNK: Clearing audioChunks array');
        
        this.audioChunks = [];
        this.chunkStartTime = Date.now();
        
        console.log('🆕 NEW CHUNK: Creating new MediaRecorder instance');
        
        // Create new MediaRecorder for the next chunk
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: 128000
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
                console.log('📊 DATA: Received audio data, chunk size =', event.data.size, 'total chunks =', this.audioChunks.length);
            }
        };

        this.mediaRecorder.onstop = () => {
            console.log('⏹️ STOP: MediaRecorder stopped in new chunk');
            this.handleRecordingStop();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('❌ ERROR: MediaRecorder error in new chunk:', event.error);
        };

        console.log('▶️ NEW CHUNK: Starting MediaRecorder');
        this.mediaRecorder.start(1000);
        console.log('✅ NEW CHUNK: MediaRecorder started, state =', this.mediaRecorder.state);
    }

    /**
     * Handle recording stop (final chunk)
     */
    async handleRecordingStop() {
        if (this.audioChunks.length > 0) {
            await this.handleChunkComplete();
        }
        
        if (this.onRecordingComplete) {
            this.onRecordingComplete({
                totalChunks: this.chunkCount,
                totalDuration: this.totalDuration,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`Recording completed: ${this.chunkCount} chunks, ${this.totalDuration.toFixed(1)}s total`);
    }

    /**
     * Get recording state
     */
    getState() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            chunkCount: this.chunkCount,
            totalDuration: this.totalDuration,
            currentChunkDuration: this.currentChunkDuration,
            mimeType: this.mimeType
        };
    }

    /**
     * Set chunk duration
     */
    setChunkDuration(seconds) {
        this.currentChunkDuration = Math.max(30, Math.min(300, seconds)); // 30s to 5min
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopTimers();
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        this.isRecording = false;
        this.isPaused = false;
        this.audioChunks = [];
    }

    /**
     * Check if MediaRecorder is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.MediaRecorder);
    }

    /**
     * Get microphone permission status
     */
    static async getPermissionStatus() {
        try {
            if (navigator.permissions) {
                const permission = await navigator.permissions.query({ name: 'microphone' });
                return permission.state;
            }
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Format duration for display
     */
    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

// Export for use in other modules
window.AudioRecorder = AudioRecorder;