/**
 * Gapless Audio Recorder using Web Audio API
 * Continuous capture with ring buffer to eliminate gaps between chunks
 */

class GaplessAudioRecorder {
    constructor() {
        this.audioContext = null;
        this.audioStream = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.analyserNode = null;
        
        // Ring buffer for continuous audio storage
        this.ringBuffer = null;
        this.ringBufferSize = 0;
        this.writeIndex = 0;
        this.sampleRate = 44100;
        this.bufferDuration = 10; // Keep 10 seconds of audio in buffer
        
        // Recording state
        this.isRecording = false;
        this.chunkDuration = 5; // seconds
        this.chunkCount = 0;
        this.recordingStartTime = null;
        this.lastChunkTime = null;
        
        // Chunk extraction timer
        this.chunkTimer = null;
        this.statusTimer = null;
        
        // Event callbacks
        this.onChunkComplete = null;
        this.onRecordingComplete = null;
        this.onTimerUpdate = null;
        this.onError = null;
        
        // Audio format
        this.mimeType = this.getSupportedMimeType();
        
        console.log('🎙️ GAPLESS: GaplessAudioRecorder created with mimeType:', this.mimeType);
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
    
    async init(existingStream = null) {
        try {
            console.log('🎙️ GAPLESS: Initializing Web Audio API...');
            Logger.recorder('Initializing GaplessAudioRecorder');
            
            // Use existing stream if provided, otherwise get microphone access
            if (existingStream) {
                console.log('🎙️ GAPLESS: Using existing audio stream');
                Logger.recorder('Using existing audio stream');
                this.audioStream = existingStream;
            } else {
                console.log('🎙️ GAPLESS: Requesting microphone access...');
                Logger.recorder('Requesting new microphone access');
                this.audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: this.sampleRate
                    }
                });
                Logger.recorder('Microphone access granted');
            }
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            // Get actual sample rate from context
            this.sampleRate = this.audioContext.sampleRate;
            console.log('🎙️ GAPLESS: Audio context sample rate:', this.sampleRate);
            Logger.recorder('Audio context created', { sampleRate: this.sampleRate });
            
            // Initialize ring buffer
            this.ringBufferSize = Math.floor(this.sampleRate * this.bufferDuration);
            this.ringBuffer = new Float32Array(this.ringBufferSize);
            console.log('🎙️ GAPLESS: Ring buffer initialized, size:', this.ringBufferSize, 'samples');
            Logger.recorder('Ring buffer initialized', { size: this.ringBufferSize });
            
            // Create audio nodes
            this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyserNode = this.audioContext.createAnalyser();
            
            // Create script processor for continuous capture
            const bufferSize = 4096; // Process in 4KB chunks
            this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            
            // Set up audio processing
            this.processorNode.onaudioprocess = (event) => {
                this.processAudioData(event.inputBuffer);
            };
            
            // Connect audio nodes
            this.sourceNode.connect(this.analyserNode);
            this.analyserNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);
            
            console.log('✅ GAPLESS: Web Audio API initialized successfully');
            Logger.recorder('Web Audio API initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ GAPLESS: Error initializing Web Audio API:', error);
            Logger.error('GAPLESS', 'Failed to initialize Web Audio API', error);
            if (this.onError) {
                this.onError('web_audio_init', error.message);
            }
            return false;
        }
    }
    
    processAudioData(inputBuffer) {
        if (!this.isRecording || !this.ringBuffer) return;
        
        // Get audio data from the input buffer
        const inputData = inputBuffer.getChannelData(0);
        const inputLength = inputData.length;
        
        // Write to ring buffer
        for (let i = 0; i < inputLength; i++) {
            this.ringBuffer[this.writeIndex] = inputData[i];
            this.writeIndex = (this.writeIndex + 1) % this.ringBufferSize;
        }
    }
    
    async startRecording(chunkDuration = 5) {
        console.log('🎬 GAPLESS: Starting gapless recording...');
        console.log('🎬 GAPLESS: Chunk duration:', chunkDuration, 'seconds');
        Logger.recorder('Starting gapless recording', { chunkDuration });
        
        if (this.isRecording) {
            console.log('❌ GAPLESS: Already recording');
            Logger.recorder('Recording already in progress');
            return false;
        }
        
        if (!this.audioContext) {
            Logger.recorder('Audio context not initialized, initializing now');
            const initialized = await this.init();
            if (!initialized) return false;
        }
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                Logger.recorder('Resuming suspended audio context');
                await this.audioContext.resume();
            }
            
            this.chunkDuration = chunkDuration;
            this.chunkCount = 0;
            this.recordingStartTime = Date.now();
            this.lastChunkTime = Date.now();
            this.writeIndex = 0;
            
            // Clear ring buffer
            this.ringBuffer.fill(0);
            Logger.recorder('Ring buffer cleared for new recording');
            
            this.isRecording = true;
            
            // Start chunk extraction timer
            this.startChunkTimer();
            this.startStatusTimer();
            
            console.log('✅ GAPLESS: Gapless recording started successfully');
            Logger.recorder('Gapless recording started successfully', {
                chunkDuration: this.chunkDuration,
                sampleRate: this.sampleRate,
                bufferSize: this.ringBufferSize
            });
            return true;
            
        } catch (error) {
            console.error('❌ GAPLESS: Error starting gapless recording:', error);
            Logger.error('GAPLESS', 'Failed to start gapless recording', error);
            this.isRecording = false;
            if (this.onError) {
                this.onError('start_recording', error.message);
            }
            return false;
        }
    }
    
    stopRecording() {
        console.log('🛑 GAPLESS: Stop gapless recording requested');
        
        if (!this.isRecording) {
            console.log('❌ GAPLESS: Not currently recording');
            return false;
        }
        
        try {
            this.isRecording = false;
            
            // Stop timers
            this.stopTimers();
            
            // Extract final chunk if there's remaining audio
            this.extractFinalChunk();
            
            // Complete recording
            if (this.onRecordingComplete) {
                this.onRecordingComplete({
                    totalChunks: this.chunkCount,
                    totalDuration: (Date.now() - this.recordingStartTime) / 1000
                });
            }
            
            console.log('✅ GAPLESS: Gapless recording stopped successfully');
            return true;
            
        } catch (error) {
            console.error('❌ GAPLESS: Error stopping gapless recording:', error);
            this.isRecording = false;
            this.stopTimers();
            return false;
        }
    }
    
    startChunkTimer() {
        console.log('⏰ GAPLESS: Starting chunk extraction timer...');
        
        this.chunkTimer = setInterval(() => {
            if (!this.isRecording) {
                this.stopTimers();
                return;
            }
            
            const elapsed = (Date.now() - this.lastChunkTime) / 1000;
            console.log('⏰ GAPLESS: Chunk timer - elapsed:', elapsed.toFixed(1), 'target:', this.chunkDuration);
            
            if (elapsed >= this.chunkDuration) {
                console.log('🚨 GAPLESS: Chunk duration reached! Extracting chunk...');
                this.extractChunk();
            }
        }, 100); // Check every 100ms for precise timing
        
        console.log('✅ GAPLESS: Chunk timer started');
    }
    
    startStatusTimer() {
        this.statusTimer = setInterval(() => {
            if (this.onTimerUpdate && this.isRecording) {
                const elapsed = (Date.now() - this.lastChunkTime) / 1000;
                const remaining = Math.max(0, this.chunkDuration - elapsed);
                this.onTimerUpdate(elapsed, this.chunkDuration, remaining);
            }
        }, 100);
    }
    
    stopTimers() {
        console.log('⏸️ GAPLESS: Stopping timers...');
        
        if (this.chunkTimer) {
            clearInterval(this.chunkTimer);
            this.chunkTimer = null;
        }
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
        
        console.log('✅ GAPLESS: Timers stopped');
    }
    
    async extractChunk() {
        console.log('📦 GAPLESS: Extracting chunk from ring buffer...');
        Logger.recorder('Extracting chunk from ring buffer');
        
        if (!this.ringBuffer || !this.isRecording) {
            console.log('❌ GAPLESS: No ring buffer or not recording');
            Logger.recorder('Cannot extract chunk - no ring buffer or not recording', {
                hasRingBuffer: !!this.ringBuffer,
                isRecording: this.isRecording
            });
            return;
        }
        
        try {
            // Calculate how many samples we need for this chunk
            const chunkSamples = Math.floor(this.sampleRate * this.chunkDuration);
            console.log('📦 GAPLESS: Extracting', chunkSamples, 'samples from ring buffer');
            Logger.recorder('Calculating chunk samples', {
                chunkSamples,
                chunkDuration: this.chunkDuration,
                sampleRate: this.sampleRate,
                writeIndex: this.writeIndex
            });
            
            // Extract audio data from ring buffer
            const chunkData = new Float32Array(chunkSamples);
            let readIndex = (this.writeIndex - chunkSamples + this.ringBufferSize) % this.ringBufferSize;
            
            for (let i = 0; i < chunkSamples; i++) {
                chunkData[i] = this.ringBuffer[readIndex];
                readIndex = (readIndex + 1) % this.ringBufferSize;
            }
            
            Logger.recorder('Extracted audio data from ring buffer', {
                dataLength: chunkData.length,
                readStartIndex: (this.writeIndex - chunkSamples + this.ringBufferSize) % this.ringBufferSize
            });
            
            // Convert to AudioBuffer for MediaRecorder
            const audioBuffer = this.audioContext.createBuffer(1, chunkSamples, this.sampleRate);
            audioBuffer.copyToChannel(chunkData, 0);
            
            Logger.recorder('Created audio buffer', {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                length: audioBuffer.length
            });
            
            // Create blob with proper WebM headers
            const blob = await this.createWebMBlob(audioBuffer);
            
            this.chunkCount++;
            const actualDuration = (Date.now() - this.lastChunkTime) / 1000;
            
            const chunkInfo = {
                blob: blob,
                duration: actualDuration,
                chunkNumber: this.chunkCount,
                timestamp: new Date().toISOString(),
                size: blob.size,
                mimeType: this.mimeType,
                samples: chunkSamples,
                sampleRate: this.sampleRate
            };
            
            console.log('📦 GAPLESS: Created chunk:', {
                number: chunkInfo.chunkNumber,
                duration: chunkInfo.duration.toFixed(2),
                size: chunkInfo.size,
                samples: chunkInfo.samples
            });
            
            Logger.recorder('Created chunk successfully', {
                chunkNumber: chunkInfo.chunkNumber,
                duration: chunkInfo.duration,
                size: chunkInfo.size,
                samples: chunkInfo.samples
            });
            
            // Save chunk
            if (this.onChunkComplete) {
                try {
                    await this.onChunkComplete(chunkInfo);
                    console.log('✅ GAPLESS: Chunk saved successfully');
                    Logger.recorder('Chunk saved successfully', { chunkNumber: chunkInfo.chunkNumber });
                } catch (error) {
                    console.error('❌ GAPLESS: Error saving chunk:', error);
                    Logger.error('GAPLESS', 'Failed to save chunk', error);
                }
            } else {
                Logger.recorder('No onChunkComplete callback set');
            }
            
            // Reset timing for next chunk
            this.lastChunkTime = Date.now();
            
        } catch (error) {
            console.error('❌ GAPLESS: Error extracting chunk:', error);
            Logger.error('GAPLESS', 'Error extracting chunk', error);
        }
    }
    
    async extractFinalChunk() {
        console.log('📦 GAPLESS: Extracting final chunk...');
        
        const elapsed = (Date.now() - this.lastChunkTime) / 1000;
        if (elapsed < 1) {
            console.log('📦 GAPLESS: Final chunk too short, skipping');
            return;
        }
        
        // Extract whatever audio we have left
        await this.extractChunk();
    }
    
    async createWebMBlob(audioBuffer) {
        console.log('🎵 GAPLESS: Creating WebM blob with headers...');
        Logger.audio('Creating WebM blob from audio buffer', { 
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            length: audioBuffer.length 
        });
        
        return new Promise((resolve, reject) => {
            try {
                // Create a MediaStreamDestination to get a proper MediaStream
                const destination = this.audioContext.createMediaStreamDestination();
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(destination);
                
                // Use just the audio stream
                const audioStream = destination.stream;
                
                const recorder = new MediaRecorder(audioStream, {
                    mimeType: this.mimeType,
                    audioBitsPerSecond: 128000
                });
                
                const chunks = [];
                
                recorder.ondataavailable = (event) => {
                    console.log('🎵 GAPLESS: Received data chunk, size:', event.data.size);
                    if (event.data && event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: this.mimeType });
                    console.log('🎵 GAPLESS: WebM blob created, size:', blob.size);
                    Logger.audio('WebM blob created successfully', { size: blob.size });
                    resolve(blob);
                };
                
                recorder.onerror = (error) => {
                    console.error('❌ GAPLESS: Error creating WebM blob:', error);
                    Logger.error('GAPLESS', 'Failed to create WebM blob', error);
                    reject(error);
                };
                
                // Start recording and play our audio
                console.log('🎵 GAPLESS: Starting temporary recorder...');
                recorder.start();
                source.start();
                
                // Stop after audio finishes
                source.onended = () => {
                    console.log('🎵 GAPLESS: Audio playback ended, stopping recorder...');
                    setTimeout(() => {
                        if (recorder.state === 'recording') {
                            recorder.stop();
                        }
                    }, 100);
                };
                
            } catch (error) {
                console.error('❌ GAPLESS: Error in createWebMBlob:', error);
                Logger.error('GAPLESS', 'Error in createWebMBlob', error);
                reject(error);
            }
        });
    }
    
    setChunkDuration(seconds) {
        this.chunkDuration = Math.max(5, Math.min(60, seconds));
        console.log('⚙️ GAPLESS: Chunk duration set to', this.chunkDuration, 'seconds');
    }
    
    getState() {
        return {
            isRecording: this.isRecording,
            chunkCount: this.chunkCount,
            chunkDuration: this.chunkDuration,
            mimeType: this.mimeType,
            sampleRate: this.sampleRate,
            bufferSize: this.ringBufferSize
        };
    }
    
    cleanup() {
        console.log('🧹 GAPLESS: Cleaning up gapless recorder...');
        
        this.stopTimers();
        this.isRecording = false;
        
        // Disconnect audio nodes
        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }
        if (this.analyserNode) {
            this.analyserNode.disconnect();
            this.analyserNode = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Stop audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        // Clear ring buffer
        this.ringBuffer = null;
        
        console.log('✅ GAPLESS: Cleanup completed');
    }
    
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.AudioContext || window.webkitAudioContext);
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
window.GaplessAudioRecorder = GaplessAudioRecorder;