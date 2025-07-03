/**
 * Enhanced logger that sends logs to both console and server
 * Falls back to console-only if server is unavailable
 */

class Logger {
    constructor() {
        this.serverAvailable = true;
        this.logBuffer = [];
        this.checkServerAvailability();
    }

    async checkServerAvailability() {
        try {
            const response = await fetch('/api/log/recent');
            this.serverAvailable = response.ok;
        } catch (error) {
            this.serverAvailable = false;
        }
    }

    log(component, message, data = {}) {
        // Always log to console
        const consoleMsg = `[${component}] ${message}`;
        if (data && Object.keys(data).length > 0) {
            console.log(consoleMsg, data);
        } else {
            console.log(consoleMsg);
        }

        // DEBUG: Log to console that we're trying to send to server
        console.log(`🌐 LOGGER: Sending to server - available: ${this.serverAvailable}`);

        // Try to send to server
        if (this.serverAvailable) {
            this.sendToServer(component, message, data);
        } else {
            // Buffer logs if server is down
            this.logBuffer.push({ component, message, data, timestamp: Date.now() });
            console.log(`📋 LOGGER: Buffered log (server unavailable)`, { component, message });
        }
    }

    async sendToServer(component, message, data) {
        try {
            await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timestamp: Date.now(),
                    component,
                    message,
                    data
                })
            });
        } catch (error) {
            this.serverAvailable = false;
            console.warn('Logger: Server unavailable, falling back to console only');
        }
    }

    error(component, message, error) {
        const errorData = {
            message: error.message,
            stack: error.stack
        };
        this.log(component, `ERROR: ${message}`, errorData);
    }

    // Convenience methods for common components
    recorder(message, data) {
        this.log('RECORDER', message, data);
    }

    storage(message, data) {
        this.log('STORAGE', message, data);
    }

    audio(message, data) {
        this.log('AUDIO', message, data);
    }

    ui(message, data) {
        this.log('UI', message, data);
    }

    // Clear logs on server
    async clearLogs() {
        try {
            await fetch('/api/log', { method: 'DELETE' });
            console.log('Server logs cleared');
        } catch (error) {
            console.error('Failed to clear server logs:', error);
        }
    }
}

// Create global logger instance
window.Logger = new Logger();