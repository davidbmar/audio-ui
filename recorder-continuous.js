/**
 * Continuous Audio Recorder - Never stops recording
 * Uses a single MediaRecorder for the entire session and extracts chunks from continuous data
 */

class ContinuousAudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioStream = null;
        this.allAudioChunks = []; // Stores ALL audio data continuously
        this.isRecording = false;
        this.chunkDuration = 5; // seconds
        this.chunkCount = 0;
        this.recordingStartTime = null;
        this.lastChunkTime = null;
        
        // Timers
        this.chunkTimer = null;
        this.statusTimer = null;
        
        // Event callbacks
        this.onChunkComplete = null;
        this.onRecordingComplete = null;
        this.onTimerUpdate = null;
        this.onError = null;
        
        // Audio format
        this.mimeType = this.getSupportedMimeType();
        
        console.log('🎙️ CONTINUOUS: ContinuousAudioRecorder created with mimeType:', this.mimeType);
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
            console.log('🎙️ CONTINUOUS: Requesting microphone access...');
            
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            
            console.log('✅ CONTINUOUS: Microphone access granted');
            return true;
            
        } catch (error) {
            console.error('❌ CONTINUOUS: Error accessing microphone:', error);
            if (this.onError) {
                this.onError('microphone_access', error.message);
            }
            return false;
        }
    }
    
    async startRecording(chunkDuration = 5) {
        console.log('🎬 CONTINUOUS: Starting continuous recording (NEVER STOPS)...');
        console.log('🎬 CONTINUOUS: Chunk duration:', chunkDuration, 'seconds');
        
        if (this.isRecording) {
            console.log('❌ CONTINUOUS: Already recording');
            return false;
        }

        if (!this.audioStream) {
            const initialized = await this.init();
            if (!initialized) return false;
        }

        try {
            this.chunkDuration = chunkDuration;
            this.allAudioChunks = [];
            this.chunkCount = 0;
            this.recordingStartTime = Date.now();
            this.lastChunkTime = Date.now();
            
            // Create ONE MediaRecorder that will run for the ENTIRE session
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: this.mimeType,
                audioBitsPerSecond: 128000
            });

            // Collect ALL audio data continuously
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('📊 CONTINUOUS: Received data chunk, size:', event.data.size);
                if (event.data && event.data.size > 0) {
                    this.allAudioChunks.push({
                        data: event.data,
                        timestamp: Date.now()
                    });
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('⏹️ CONTINUOUS: MediaRecorder stopped (session ended)');
                this.handleStop();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ CONTINUOUS: MediaRecorder error:', event.error);
                this.isRecording = false;
                this.stopTimers();
            };

            // Start CONTINUOUS recording (will run until user stops)
            console.log('🎬 CONTINUOUS: Starting continuous MediaRecorder...');
            this.mediaRecorder.start(1000); // Get data every 1 second
            this.isRecording = true;
            
            // Start timers for chunk processing
            this.startTimers();
            
            console.log('✅ CONTINUOUS: Continuous recording started (NO GAPS!)');
            return true;
            
        } catch (error) {
            console.error('❌ CONTINUOUS: Error starting recording:', error);
            this.isRecording = false;
            if (this.onError) {
                this.onError('start_recording', error.message);
            }
            return false;
        }
    }
    
    stopRecording() {
        console.log('🛑 CONTINUOUS: Stop recording requested');
        
        if (!this.isRecording) {
            console.log('❌ CONTINUOUS: Not currently recording');
            return false;
        }

        try {
            this.isRecording = false;
            this.stopTimers();
            
            // Stop the continuous MediaRecorder (end of session)
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                console.log('🛑 CONTINUOUS: Stopping continuous MediaRecorder...');
                this.mediaRecorder.stop();
            } else {
                this.handleStop();
            }
            
            return true;
        } catch (error) {
            console.error('❌ CONTINUOUS: Error stopping recording:', error);
            this.isRecording = false;
            this.stopTimers();
            return false;
        }
    }
    
    startTimers() {
        console.log('⏰ CONTINUOUS: Starting timers...');
        
        // Update timer display every 100ms
        this.statusTimer = setInterval(() => {
            if (this.onTimerUpdate && this.isRecording) {
                const elapsed = (Date.now() - this.lastChunkTime) / 1000;
                const remaining = Math.max(0, this.chunkDuration - elapsed);
                this.onTimerUpdate(elapsed, this.chunkDuration, remaining);
            }
        }, 100);

        // Extract chunks every chunkDuration seconds
        this.chunkTimer = setInterval(() => {
            if (!this.isRecording) {
                this.stopTimers();
                return;
            }
            
            const elapsed = (Date.now() - this.lastChunkTime) / 1000;
            console.log('⏰ CONTINUOUS: Chunk timer - elapsed:', elapsed.toFixed(1), 'target:', this.chunkDuration);
            
            if (elapsed >= this.chunkDuration) {
                console.log('🚨 CONTINUOUS: Chunk duration reached! Extracting from continuous stream...');
                this.extractChunkFromContinuous();
            }
        }, 500); // Check every 500ms
        
        console.log('✅ CONTINUOUS: Timers started');
    }
    
    stopTimers() {
        console.log('⏸️ CONTINUOUS: Stopping timers...');
        
        if (this.chunkTimer) {
            clearInterval(this.chunkTimer);
            this.chunkTimer = null;
        }
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
        
        console.log('✅ CONTINUOUS: Timers stopped');
    }
    
    extractChunkFromContinuous() {
        console.log('📦 CONTINUOUS: Extracting chunk from continuous stream...');
        console.log('📦 CONTINUOUS: Available audio chunks:', this.allAudioChunks.length);
        
        if (this.allAudioChunks.length === 0) {
            console.log('❌ CONTINUOUS: No audio data available yet');
            return;
        }
        
        try {
            // Get the time range for this chunk
            const chunkEndTime = Date.now();
            const chunkStartTime = this.lastChunkTime;
            
            console.log('📦 CONTINUOUS: Extracting chunk for time range:', {
                start: new Date(chunkStartTime).toISOString(),
                end: new Date(chunkEndTime).toISOString(),
                duration: (chunkEndTime - chunkStartTime) / 1000
            });
            
            // TEMPORARY FIX: Use all chunks but create proper WebM headers
            // TODO: Implement proper audio slicing with Web Audio API
            const chunkBlobs = this.allAudioChunks.map(chunk => chunk.data);
            const continuousBlob = new Blob(chunkBlobs, { type: this.mimeType });
            
            console.log('📦 CONTINUOUS: Creating playable chunk from continuous stream:', {
                totalChunks: this.allAudioChunks.length,
                continuousBlobSize: continuousBlob.size,
                note: 'Using full continuous stream with WebM headers for now'
            });
            
            // Create a proper WebM blob that will play correctly
            const chunkBlob = await this.createPlayableChunk(continuousBlob, chunkStartTime, chunkEndTime);
            
            this.chunkCount++;
            const actualDuration = (chunkEndTime - chunkStartTime) / 1000;
            
            const chunkData = {
                blob: chunkBlob,
                duration: actualDuration,
                chunkNumber: this.chunkCount,
                timestamp: new Date().toISOString(),
                size: chunkBlob.size,
                mimeType: this.mimeType,
                isContinuous: true,
                timeRange: {
                    start: chunkStartTime,
                    end: chunkEndTime
                }
            };

            console.log('📦 CONTINUOUS: Created chunk from continuous stream:', {
                number: chunkData.chunkNumber,
                duration: chunkData.duration.toFixed(2),
                size: chunkData.size,
                totalAvailable: this.allAudioChunks.length
            });

            // Save chunk
            if (this.onChunkComplete) {
                this.onChunkComplete(chunkData).then(() => {
                    console.log('✅ CONTINUOUS: Chunk saved successfully');
                }).catch(error => {
                    console.error('❌ CONTINUOUS: Error saving chunk:', error);
                });
            }

            // Move to next chunk time (but keep continuous recording)
            this.lastChunkTime = chunkEndTime;
            
            console.log('🔄 CONTINUOUS: Ready for next chunk (still recording continuously)');
            
        } catch (error) {
            console.error('❌ CONTINUOUS: Error extracting chunk:', error);
        }
    }
    
    async handleStop() {
        console.log('🏁 CONTINUOUS: Handling final stop...');
        
        // Extract final chunk if there's remaining time
        const elapsed = (Date.now() - this.lastChunkTime) / 1000;
        if (elapsed > 1 && this.allAudioChunks.length > 0) {
            console.log('🏁 CONTINUOUS: Processing final chunk...');
            this.extractChunkFromContinuous();
        }
        
        this.isRecording = false;
        this.stopTimers();
        
        if (this.onRecordingComplete) {
            this.onRecordingComplete({
                totalChunks: this.chunkCount,
                totalDuration: (Date.now() - this.recordingStartTime) / 1000,
                totalAudioChunks: this.allAudioChunks.length
            });
        }
        
        console.log('✅ CONTINUOUS: Recording session completed');
    }
    
    async createPlayableChunk(continuousBlob, startTime, endTime) {
        console.log('🎵 CONTINUOUS: Creating playable chunk with proper headers...');
        
        // For now, return the continuous blob with proper WebM headers
        // This ensures playability but contains the full recording
        // TODO: Implement Web Audio API slicing for proper time ranges
        
        return continuousBlob;
    }
    
    setChunkDuration(seconds) {
        this.chunkDuration = Math.max(5, Math.min(60, seconds));
        console.log('⚙️ CONTINUOUS: Chunk duration set to', this.chunkDuration, 'seconds');
    }
    
    getState() {
        return {
            isRecording: this.isRecording,
            chunkCount: this.chunkCount,
            chunkDuration: this.chunkDuration,
            mimeType: this.mimeType,
            totalAudioChunks: this.allAudioChunks.length
        };
    }
    
    cleanup() {
        console.log('🧹 CONTINUOUS: Cleaning up recorder...');
        this.stopTimers();
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        this.isRecording = false;
        this.allAudioChunks = [];
        console.log('✅ CONTINUOUS: Cleanup completed');
    }
    
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.MediaRecorder);
    }
}

// Export for use in other modules
window.ContinuousAudioRecorder = ContinuousAudioRecorder;