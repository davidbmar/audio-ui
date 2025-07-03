/**
 * Simplified Audio Recorder - Fix for stopping issues
 * Single MediaRecorder instance, proper state management
 */

class SimpleAudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.chunkDuration = 5; // seconds
        this.overlapDuration = 0.5; // 500ms overlap to prevent audio loss (configurable)
        this.recordingStartTime = null;
        this.lastChunkTime = null;
        this.chunkCount = 0;
        
        // Dual recorder approach for seamless recording
        this.primaryRecorder = null;
        this.secondaryRecorder = null;
        this.useSecondary = false;
        
        // Timer intervals
        this.timerInterval = null;
        this.chunkCheckInterval = null;
        
        // Event callbacks
        this.onChunkComplete = null;
        this.onRecordingComplete = null;
        this.onTimerUpdate = null;
        this.onError = null;
        
        // Audio format
        this.mimeType = this.getSupportedMimeType();
        
        console.log('🎙️ INIT: SimpleAudioRecorder created with mimeType:', this.mimeType);
    }

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
        return 'audio/webm';
    }

    async init() {
        try {
            console.log('🎙️ INIT: Requesting microphone access...');
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            console.log('✅ INIT: Microphone access granted');
            return true;
        } catch (error) {
            console.error('❌ INIT: Error accessing microphone:', error);
            if (this.onError) {
                this.onError('microphone_access', error.message);
            }
            return false;
        }
    }

    async startRecording(chunkDuration = 5) {
        console.log('🎬 START: Starting recording...');
        console.log('🎬 START: Chunk duration:', chunkDuration, 'seconds');
        
        if (this.isRecording) {
            console.log('❌ START: Already recording');
            return false;
        }

        if (!this.audioStream) {
            const initialized = await this.init();
            if (!initialized) return false;
        }

        try {
            this.chunkDuration = chunkDuration;
            this.audioChunks = [];
            this.chunkCount = 0;
            this.recordingStartTime = Date.now();
            this.lastChunkTime = Date.now();
            
            console.log('🎬 START: Creating MediaRecorder...');
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: this.mimeType,
                audioBitsPerSecond: 128000
            });

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('📊 DATA: Received chunk, size:', event.data.size);
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('⏹️ STOP: MediaRecorder stopped');
                this.handleStop();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ ERROR: MediaRecorder error:', event.error);
                this.isRecording = false;
                this.stopTimers();
            };

            // Start recording with timeslice
            console.log('🎬 START: Starting MediaRecorder with 1000ms timeslice...');
            this.mediaRecorder.start(1000);
            this.isRecording = true;
            
            // Start timers
            this.startTimers();
            
            console.log('✅ START: Recording started successfully');
            console.log('✅ START: MediaRecorder state:', this.mediaRecorder.state);
            return true;
            
        } catch (error) {
            console.error('❌ START: Error starting recording:', error);
            this.isRecording = false;
            if (this.onError) {
                this.onError('start_recording', error.message);
            }
            return false;
        }
    }

    stopRecording() {
        console.log('🛑 STOP: Stop recording requested');
        console.log('🛑 STOP: Current state - isRecording:', this.isRecording);
        console.log('🛑 STOP: MediaRecorder state:', this.mediaRecorder?.state);
        
        if (!this.isRecording) {
            console.log('❌ STOP: Not currently recording');
            return false;
        }

        try {
            // Set flag first to prevent new chunks
            this.isRecording = false;
            console.log('🛑 STOP: Set isRecording to false');
            
            // Stop timers
            this.stopTimers();
            console.log('🛑 STOP: Timers stopped');
            
            // Stop MediaRecorder if active
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                console.log('🛑 STOP: Stopping MediaRecorder...');
                this.mediaRecorder.stop();
            } else {
                console.log('🛑 STOP: MediaRecorder not recording, calling handleStop directly');
                this.handleStop();
            }
            
            return true;
        } catch (error) {
            console.error('❌ STOP: Error stopping recording:', error);
            this.isRecording = false;
            this.stopTimers();
            return false;
        }
    }

    startTimers() {
        console.log('⏰ TIMER: Starting timers...');
        
        // Update timer display every 100ms
        this.timerInterval = setInterval(() => {
            if (this.onTimerUpdate && this.isRecording) {
                const elapsed = (Date.now() - this.lastChunkTime) / 1000;
                const remaining = Math.max(0, this.chunkDuration - elapsed);
                this.onTimerUpdate(elapsed, this.chunkDuration, remaining);
            }
        }, 100);

        // Check for chunk completion every 500ms
        this.chunkCheckInterval = setInterval(() => {
            if (!this.isRecording) {
                console.log('⏰ TIMER: Not recording, clearing chunk check timer');
                this.stopTimers();
                return;
            }
            
            const elapsed = (Date.now() - this.lastChunkTime) / 1000;
            console.log('⏰ TIMER: Chunk check - elapsed:', elapsed.toFixed(1), 'target:', this.chunkDuration);
            
            if (elapsed >= this.chunkDuration) {
                console.log('🚨 TIMER: Chunk duration reached! Calling processChunkWithOverlap()');
                this.processChunkWithOverlap();
            }
        }, 500);
        
        console.log('✅ TIMER: Timers started');
    }

    stopTimers() {
        console.log('⏸️ TIMER: Stopping timers...');
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.chunkCheckInterval) {
            clearInterval(this.chunkCheckInterval);
            this.chunkCheckInterval = null;
        }
        
        console.log('✅ TIMER: Timers stopped');
    }

    async processChunkWithOverlap() {
        console.log('📦 CHUNK: Processing chunk with fast restart...');
        console.log('📦 CHUNK: Audio chunks count:', this.audioChunks.length);
        console.log('📦 CHUNK: Audio chunk sizes:', this.audioChunks.map(chunk => chunk.size));
        
        if (this.audioChunks.length === 0) {
            console.log('❌ CHUNK: No audio data to process');
            return;
        }

        // Create blob from current chunks
        const chunkBlob = new Blob(this.audioChunks, { type: this.mimeType });
        const actualDuration = (Date.now() - this.lastChunkTime) / 1000;
        
        this.chunkCount++;
        
        const chunkData = {
            blob: chunkBlob,
            duration: actualDuration,
            chunkNumber: this.chunkCount,
            timestamp: new Date().toISOString(),
            size: chunkBlob.size,
            mimeType: this.mimeType
        };

        console.log('📦 CHUNK: Created chunk:', {
            number: chunkData.chunkNumber,
            duration: chunkData.duration.toFixed(2),
            size: chunkData.size,
            mimeType: chunkData.mimeType
        });

        // Save chunk
        if (this.onChunkComplete) {
            try {
                await this.onChunkComplete(chunkData);
                console.log('✅ CHUNK: Chunk saved successfully');
            } catch (error) {
                console.error('❌ CHUNK: Error saving chunk:', error);
            }
        }

        // Reset for next chunk if still recording - ULTRA-FAST RESTART
        if (this.isRecording) {
            console.log('🔄 RESTART: Ultra-fast restart for next chunk...');
            
            // Pre-create new recorder BEFORE stopping old one for minimal gap
            const newRecorder = new MediaRecorder(this.audioStream, {
                mimeType: this.mimeType,
                audioBitsPerSecond: 128000
            });
            
            // Set up handlers for new recorder
            newRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            newRecorder.onstop = () => this.handleStop();
            newRecorder.onerror = (event) => {
                console.error('❌ ERROR: MediaRecorder error:', event.error);
                this.isRecording = false;
                this.stopTimers();
            };
            
            // Stop old recorder
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.ondataavailable = null;
                this.mediaRecorder.onstop = null;
                this.mediaRecorder.onerror = null;
                this.mediaRecorder.stop();
            }
            
            // Start new recorder IMMEDIATELY (no delay)
            this.mediaRecorder = newRecorder;
            this.mediaRecorder.start(500);
            
            // Reset chunk tracking
            this.audioChunks = [];
            this.lastChunkTime = Date.now();
            
            console.log('🔄 RESTART: Ultra-fast restart complete');
        }
    }

    async processChunk() {
        // ONLY used for final chunk when recording stops
        console.log('📦 FINAL CHUNK: Processing final chunk (recording stopped)...');
        console.log('📦 FINAL CHUNK: Audio chunks count:', this.audioChunks.length);
        
        if (this.audioChunks.length === 0) {
            console.log('❌ CHUNK: No audio data to process');
            return;
        }

        // Create blob from current chunks
        const chunkBlob = new Blob(this.audioChunks, { type: this.mimeType });
        const actualDuration = (Date.now() - this.lastChunkTime) / 1000;
        
        this.chunkCount++;
        
        const chunkData = {
            blob: chunkBlob,
            duration: actualDuration,
            chunkNumber: this.chunkCount,
            timestamp: new Date().toISOString(),
            size: chunkBlob.size,
            mimeType: this.mimeType
        };

        console.log('📦 FINAL CHUNK: Created final chunk:', {
            number: chunkData.chunkNumber,
            duration: chunkData.duration.toFixed(2),
            size: chunkData.size
        });

        // Save chunk
        if (this.onChunkComplete) {
            try {
                await this.onChunkComplete(chunkData);
                console.log('✅ FINAL CHUNK: Final chunk saved successfully');
            } catch (error) {
                console.error('❌ FINAL CHUNK: Error saving final chunk:', error);
            }
        }
    }

    async handleStop() {
        console.log('🏁 FINAL: Handling final stop...');
        
        // Process any remaining audio data
        if (this.audioChunks.length > 0) {
            console.log('🏁 FINAL: Processing final chunk...');
            await this.processChunk();
        }
        
        // Ensure everything is stopped
        this.isRecording = false;
        this.stopTimers();
        
        if (this.onRecordingComplete) {
            this.onRecordingComplete({
                totalChunks: this.chunkCount,
                totalDuration: (Date.now() - this.recordingStartTime) / 1000
            });
        }
        
        console.log('✅ FINAL: Recording session completed');
    }

    async restartMediaRecorderQuickly() {
        console.log('🔄 QUICK: Ultra-fast restart for headers...');
        const oldRecorder = this.mediaRecorder;
        
        // Create new recorder
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: 128000
        });

        // Set up handlers
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.handleStop();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('❌ ERROR: MediaRecorder error:', event.error);
            this.isRecording = false;
            this.stopTimers();
        };

        // Quick swap
        if (oldRecorder) {
            oldRecorder.onstop = null;
            oldRecorder.stop();
        }
        this.mediaRecorder.start(1000);
        
        console.log('🔄 QUICK: Restart complete');
    }

    async restartMediaRecorderSafely() {
        console.log('🔄 OVERLAP-RESTART: Starting overlapped MediaRecorder restart...');
        
        const startTime = performance.now();
        
        // Store reference to old recorder
        const oldRecorder = this.mediaRecorder;
        
        // Create and START new recorder BEFORE stopping old one
        console.log('🔄 OVERLAP-RESTART: Creating new MediaRecorder with overlap...');
        const newRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: 128000
        });

        // Set up event handlers
        newRecorder.ondataavailable = (event) => {
            console.log('📊 DATA: Received chunk, size:', event.data.size);
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        newRecorder.onstop = () => {
            console.log('⏹️ STOP: MediaRecorder stopped');
            this.handleStop();
        };

        newRecorder.onerror = (event) => {
            console.error('❌ ERROR: MediaRecorder error:', event.error);
            this.isRecording = false;
            this.stopTimers();
        };

        // Start new recorder FIRST
        newRecorder.start(1000);
        this.mediaRecorder = newRecorder;
        console.log('🔄 OVERLAP-RESTART: New recorder started');
        
        // THEN stop old recorder after configured overlap duration
        if (oldRecorder && oldRecorder.state !== 'inactive') {
            setTimeout(() => {
                // Remove handlers to prevent interference
                oldRecorder.onstop = null;
                oldRecorder.onerror = null; 
                oldRecorder.ondataavailable = null;
                
                oldRecorder.stop();
                console.log('🔄 OVERLAP-RESTART: Old recorder stopped after overlap');
            }, this.overlapDuration * 1000); // Use the configured overlap duration
        }
        
        const endTime = performance.now();
        console.log(`🔄 OVERLAP-RESTART: Restart initiated in ${(endTime - startTime).toFixed(1)}ms with ${this.overlapDuration * 1000}ms overlap`);
    }

    async createFreshMediaRecorderWithOverlap() {
        console.log('🔄 OVERLAP FRESH: Creating overlapping MediaRecorder instance');
        console.log('🔄 OVERLAP FRESH: Using mimeType:', this.mimeType);
        
        console.log('🔄 OVERLAP FRESH: Creating new MediaRecorder instance');
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: 128000
        });
        
        console.log('🔄 OVERLAP FRESH: MediaRecorder created with settings:', {
            mimeType: this.mediaRecorder.mimeType,
            state: this.mediaRecorder.state
        });

        // Set up event handlers
        this.mediaRecorder.ondataavailable = (event) => {
            console.log('📊 OVERLAP DATA: Received chunk, size:', event.data.size);
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            console.log('⏹️ OVERLAP STOP: Overlapping MediaRecorder stopped');
            this.handleStop();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('❌ OVERLAP ERROR: Overlapping MediaRecorder error:', event.error);
            this.isRecording = false;
            this.stopTimers();
        };

        // Start the fresh recorder immediately for overlap
        console.log('▶️ OVERLAP FRESH: Starting overlapping MediaRecorder immediately');
        this.mediaRecorder.start(1000);
        console.log('✅ OVERLAP FRESH: Overlapping MediaRecorder started, state:', this.mediaRecorder.state);
        
        // Small delay to ensure MediaRecorder is fully initialized
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    async createFreshMediaRecorder() {
        console.log('🔄 FRESH: Creating fresh MediaRecorder instance with minimal delay');
        
        // Clean up old MediaRecorder with MINIMAL delay
        if (this.mediaRecorder) {
            console.log('🔄 FRESH: Cleaning up old MediaRecorder, state:', this.mediaRecorder.state);
            try {
                // Remove event listeners
                this.mediaRecorder.ondataavailable = null;
                this.mediaRecorder.onstop = null;
                this.mediaRecorder.onerror = null;
                
                // Stop if active
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            } catch (error) {
                console.log('🔄 FRESH: Error cleaning MediaRecorder:', error);
            }
        }
        
        // MINIMAL wait - reduce from 50ms to 10ms
        await new Promise(resolve => setTimeout(resolve, 10));
        
        console.log('🔄 FRESH: Creating new MediaRecorder instance');
        this.mediaRecorder = new MediaRecorder(this.audioStream, {
            mimeType: this.mimeType,
            audioBitsPerSecond: 128000
        });

        // Set up event handlers
        this.mediaRecorder.ondataavailable = (event) => {
            console.log('📊 FRESH DATA: Received chunk, size:', event.data.size);
            if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            console.log('⏹️ FRESH STOP: Fresh MediaRecorder stopped');
            this.handleStop();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('❌ FRESH ERROR: Fresh MediaRecorder error:', event.error);
            this.isRecording = false;
            this.stopTimers();
        };

        // Start the fresh recorder IMMEDIATELY
        console.log('▶️ FRESH: Starting fresh MediaRecorder immediately');
        this.mediaRecorder.start(500); // Smaller timeslice for more responsive data
        console.log('✅ FRESH: Fresh MediaRecorder started, state:', this.mediaRecorder.state);
    }

    setChunkDuration(seconds) {
        this.chunkDuration = Math.max(5, Math.min(60, seconds));
        console.log('⚙️ SETTINGS: Chunk duration set to', this.chunkDuration, 'seconds');
    }

    setOverlapDuration(milliseconds) {
        this.overlapDuration = Math.max(0, Math.min(2000, milliseconds)) / 1000; // Convert to seconds, max 2s
        console.log('⚙️ SETTINGS: Overlap duration set to', this.overlapDuration * 1000, 'milliseconds');
    }

    getState() {
        return {
            isRecording: this.isRecording,
            chunkCount: this.chunkCount,
            chunkDuration: this.chunkDuration,
            mimeType: this.mimeType
        };
    }

    cleanup() {
        console.log('🧹 CLEANUP: Cleaning up recorder...');
        this.stopTimers();
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        this.isRecording = false;
        this.audioChunks = [];
        console.log('✅ CLEANUP: Cleanup completed');
    }

    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.MediaRecorder);
    }

    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

// Export for use in other modules
window.SimpleAudioRecorder = SimpleAudioRecorder;