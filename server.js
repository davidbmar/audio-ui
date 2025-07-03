const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Ensure log file exists
const logFile = path.join(__dirname, 'debug.log');

// Log endpoint
app.post('/api/log', (req, res) => {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${JSON.stringify(req.body)}\n`;
    
    // Append to log file
    fs.appendFileSync(logFile, logEntry);
    
    // Also log to server console for immediate visibility
    console.log(`[CLIENT LOG] ${req.body.component}: ${req.body.message}`);
    
    res.json({ success: true });
});

// Clear logs endpoint
app.delete('/api/log', (req, res) => {
    fs.writeFileSync(logFile, '');
    console.log('[SERVER] Logs cleared');
    res.json({ success: true });
});

// Get recent logs endpoint
app.get('/api/log/recent', (req, res) => {
    try {
        const logs = fs.readFileSync(logFile, 'utf8');
        const lines = logs.split('\n').filter(line => line.trim());
        const recentLogs = lines.slice(-100); // Last 100 entries
        res.json({ logs: recentLogs });
    } catch (error) {
        res.json({ logs: [] });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Dev server running on http://localhost:${PORT}`);
    console.log(`Logs will be written to: ${logFile}`);
    console.log('\nNOTE: If you were using port 8000, please navigate to http://localhost:8080 instead');
});