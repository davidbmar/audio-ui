# Audio Recorder App - Local Setup

## Quick Start (Mac)

### Option 1: Using Python (Recommended)
```bash
# Navigate to the project folder
cd /Users/dmar/src/audio-ui

# Start a local server (Python 3)
python3 -m http.server 8000

# Or if you have Python 2
python -m SimpleHTTPServer 8000

# Open your browser to:
# http://localhost:8000
```

### Option 2: Using Node.js
```bash
# Install a simple server globally
npm install -g http-server

# Navigate to project folder
cd /Users/dmar/src/audio-ui

# Start server
http-server -p 8000

# Open browser to: http://localhost:8000
```

### Option 3: Using npx (no installation needed)
```bash
# Navigate to project folder
cd /Users/dmar/src/audio-ui

# Start server
npx serve -l 8000

# Open browser to: http://localhost:8000
```

### Option 4: Using PHP (if available)
```bash
# Navigate to project folder
cd /Users/dmar/src/audio-ui

# Start PHP server
php -S localhost:8000

# Open browser to: http://localhost:8000
```

## Why You Need a Local Server

The audio recorder requires:
1. **HTTPS or localhost** for microphone access (browser security)
2. **HTTP server** for proper MIME types and CORS handling
3. **IndexedDB** which works better with proper origins

## Troubleshooting

### If microphone doesn't work:
- Ensure you're using `http://localhost:8000` (not file://)
- Grant microphone permissions when prompted
- Check browser console for errors

### If nothing loads:
- Make sure you're in the right directory
- Check that all files are present:
  - index.html
  - styles.css
  - storage.js
  - recorder.js
  - app.js

### Browser Compatibility:
- Chrome: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ✅ Full support (macOS 11+)
- Edge: ✅ Full support

## File Structure
```
audio-ui/
├── index.html          # Main app
├── styles.css          # All styling
├── storage.js          # IndexedDB manager
├── recorder.js         # Audio recording
├── app.js             # Main controller
├── README.md          # This file
└── [specs]/           # Design documents
    ├── ARCHITECTURE.md
    ├── UI-WIREFRAMES.md
    ├── DATA-MODELS.md
    ├── SYNC-LOGIC.md
    └── UI-COMPONENTS.md
```

## Next Steps
1. Start local server (see options above)
2. Open http://localhost:8000 in browser
3. Grant microphone permissions
4. Test recording functionality
5. Try file management features