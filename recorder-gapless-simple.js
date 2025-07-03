/**
 * Simplified Gapless Audio Recorder
 * Uses MediaRecorder with continuous recording and post-processing to eliminate gaps
 */

class SimpleGaplessRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.chunkDuration = 5; // seconds
        this.chunkCount = 0;
        this.recordingStartTime = null;
        this.lastChunkTime = null;
        
        // Continuous recording approach
        this.continuousBlob = null;
        this.chunkTimer = null;
        this.statusTimer = null;
        
        // Event callbacks
        this.onChunkComplete = null;
        this.onRecordingComplete = null;
        this.onTimerUpdate = null;
        this.onError = null;
        
        // Audio format
        this.mimeType = this.getSupportedMimeType();
        
        console.log('🎙️ SIMPLE-GAPLESS: SimpleGaplessRecorder created with mimeType:', this.mimeType);
        Logger.recorder('SimpleGaplessRecorder created', { mimeType: this.mimeType });
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
            console.log('🎙️ SIMPLE-GAPLESS: Requesting microphone access...');
            Logger.recorder('Requesting microphone access for SimpleGaplessRecorder');
            
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            
            console.log('✅ SIMPLE-GAPLESS: Microphone access granted');
            Logger.recorder('Microphone access granted');
            return true;
            
        } catch (error) {
            console.error('❌ SIMPLE-GAPLESS: Error accessing microphone:', error);
            Logger.error('SIMPLE-GAPLESS', 'Failed to access microphone', error);
            if (this.onError) {
                this.onError('microphone_access', error.message);
            }
            return false;
        }
    }
    
    async startRecording(chunkDuration = 5) {
        console.log('🎬 SIMPLE-GAPLESS: Starting continuous recording...');
        Logger.recorder('Starting continuous recording', { chunkDuration });
        
        if (this.isRecording) {
            console.log('❌ SIMPLE-GAPLESS: Already recording');
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
            
            // Create MediaRecorder for CONTINUOUS recording (no stopping/starting)
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: this.mimeType,
                audioBitsPerSecond: 128000
            });

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('📊 SIMPLE-GAPLESS: Received data chunk, size:', event.data.size);
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('⏹️ SIMPLE-GAPLESS: MediaRecorder stopped');
                this.handleStop();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ SIMPLE-GAPLESS: MediaRecorder error:', event.error);
                Logger.error('SIMPLE-GAPLESS', 'MediaRecorder error', event.error);
                this.isRecording = false;
                this.stopTimers();
            };

            // Start CONTINUOUS recording (never stop until user stops)
            console.log('🎬 SIMPLE-GAPLESS: Starting continuous MediaRecorder...');
            this.mediaRecorder.start(1000); // Request data every 1 second
            this.isRecording = true;
            
            // Start timers for chunk processing
            this.startTimers();
            
            console.log('✅ SIMPLE-GAPLESS: Continuous recording started successfully');
            Logger.recorder('Continuous recording started successfully');
            return true;
            
        } catch (error) {
            console.error('❌ SIMPLE-GAPLESS: Error starting recording:', error);
            Logger.error('SIMPLE-GAPLESS', 'Failed to start recording', error);
            this.isRecording = false;
            if (this.onError) {
                this.onError('start_recording', error.message);
            }
            return false;
        }
    }
    
    stopRecording() {
        console.log('🛑 SIMPLE-GAPLESS: Stop recording requested');
        Logger.recorder('Stop recording requested');
        
        if (!this.isRecording) {
            console.log('❌ SIMPLE-GAPLESS: Not currently recording');
            return false;
        }

        try {
            this.isRecording = false;
            this.stopTimers();
            
            // Stop the continuous MediaRecorder
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                console.log('🛑 SIMPLE-GAPLESS: Stopping continuous MediaRecorder...');
                this.mediaRecorder.stop();
            } else {
                this.handleStop();
            }
            
            return true;
        } catch (error) {
            console.error('❌ SIMPLE-GAPLESS: Error stopping recording:', error);
            Logger.error('SIMPLE-GAPLESS', 'Failed to stop recording', error);
            this.isRecording = false;
            this.stopTimers();
            return false;
        }
    }
    
    startTimers() {
        console.log('⏰ SIMPLE-GAPLESS: Starting timers...');
        Logger.recorder('Starting timers');
        
        // Update timer display every 100ms
        this.statusTimer = setInterval(() => {
            if (this.onTimerUpdate && this.isRecording) {
                const elapsed = (Date.now() - this.lastChunkTime) / 1000;
                const remaining = Math.max(0, this.chunkDuration - elapsed);
                this.onTimerUpdate(elapsed, this.chunkDuration, remaining);
            }
        }, 100);

        // Process chunks every chunkDuration seconds
        this.chunkTimer = setInterval(() => {
            if (!this.isRecording) {
                this.stopTimers();
                return;
            }
            
            const elapsed = (Date.now() - this.lastChunkTime) / 1000;
            console.log('⏰ SIMPLE-GAPLESS: Chunk timer - elapsed:', elapsed.toFixed(1), 'target:', this.chunkDuration);
            
            if (elapsed >= this.chunkDuration) {
                console.log('🚨 SIMPLE-GAPLESS: Chunk duration reached! Processing chunk...');
                this.processChunkFromContinuous();
            }
        }, 500); // Check every 500ms
        
        console.log('✅ SIMPLE-GAPLESS: Timers started');
    }
    
    stopTimers() {
        console.log('⏸️ SIMPLE-GAPLESS: Stopping timers...');
        
        if (this.chunkTimer) {
            clearInterval(this.chunkTimer);
            this.chunkTimer = null;
        }
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
        
        console.log('✅ SIMPLE-GAPLESS: Timers stopped');
    }
    
    async processChunkFromContinuous() {
        console.log('📦 SIMPLE-GAPLESS: Processing chunk from continuous recording...');
        Logger.recorder('Processing chunk from continuous recording', {
            chunksAvailable: this.audioChunks.length,
            chunkCount: this.chunkCount
        });
        
        if (this.audioChunks.length === 0) {
            console.log('❌ SIMPLE-GAPLESS: No audio data available yet');
            return;
        }
        
        try {
            // Create blob from all available chunks (this is the CONTINUOUS audio)
            const allAudioBlob = new Blob(this.audioChunks, { type: this.mimeType });
            console.log('📦 SIMPLE-GAPLESS: Created continuous blob, size:', allAudioBlob.size);
            
            // For now, save this as the chunk (later we'll extract the specific time range)
            this.chunkCount++;
            const actualDuration = (Date.now() - this.lastChunkTime) / 1000;
            
            const chunkData = {
                blob: allAudioBlob,
                duration: actualDuration,
                chunkNumber: this.chunkCount,
                timestamp: new Date().toISOString(),
                size: allAudioBlob.size,
                mimeType: this.mimeType,
                isContinuous: true // Flag to indicate this is from continuous recording
            };

            console.log('📦 SIMPLE-GAPLESS: Created chunk from continuous recording:', {
                number: chunkData.chunkNumber,
                duration: chunkData.duration.toFixed(2),
                size: chunkData.size
            });
            
            Logger.recorder('Created chunk from continuous recording', {
                chunkNumber: chunkData.chunkNumber,
                duration: chunkData.duration,
                size: chunkData.size
            });

            // Save chunk
            if (this.onChunkComplete) {
                try {
                    await this.onChunkComplete(chunkData);
                    console.log('✅ SIMPLE-GAPLESS: Chunk saved successfully');
                    Logger.recorder('Chunk saved successfully');
                } catch (error) {
                    console.error('❌ SIMPLE-GAPLESS: Error saving chunk:', error);
                    Logger.error('SIMPLE-GAPLESS', 'Failed to save chunk', error);
                }
            }

            // Reset timing for next chunk (but DON'T clear audioChunks - keep continuous recording)
            this.lastChunkTime = Date.now();
            
        } catch (error) {
            console.error('❌ SIMPLE-GAPLESS: Error processing chunk:', error);
            Logger.error('SIMPLE-GAPLESS', 'Error processing chunk', error);
        }
    }
    
    async handleStop() {
        console.log('🏁 SIMPLE-GAPLESS: Handling final stop...');
        Logger.recorder('Handling final stop');
        
        // Process any remaining audio data as final chunk
        const elapsed = (Date.now() - this.lastChunkTime) / 1000;
        if (elapsed > 1 && this.audioChunks.length > 0) {
            console.log('🏁 SIMPLE-GAPLESS: Processing final chunk...');
            await this.processChunkFromContinuous();
        }
        
        this.isRecording = false;
        this.stopTimers();
        
        if (this.onRecordingComplete) {
            this.onRecordingComplete({
                totalChunks: this.chunkCount,
                totalDuration: (Date.now() - this.recordingStartTime) / 1000
            });
        }
        
        console.log('✅ SIMPLE-GAPLESS: Recording session completed');
        Logger.recorder('Recording session completed');
    }
    
    setChunkDuration(seconds) {
        this.chunkDuration = Math.max(5, Math.min(60, seconds));
        console.log('⚙️ SIMPLE-GAPLESS: Chunk duration set to', this.chunkDuration, 'seconds');
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
        console.log('🧹 SIMPLE-GAPLESS: Cleaning up recorder...');
        Logger.recorder('Cleaning up SimpleGaplessRecorder');
        
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
        console.log('✅ SIMPLE-GAPLESS: Cleanup completed');
    }
    
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.MediaRecorder);
    }
}

// Export for use in other modules
window.SimpleGaplessRecorder = SimpleGaplessRecorder;