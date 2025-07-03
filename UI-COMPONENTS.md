# Responsive UI Component Specifications

## Design System Foundation

### Color Palette
```css
:root {
  /* Primary Colors */
  --primary-500: #3B82F6;     /* Blue */
  --primary-600: #2563EB;
  --primary-700: #1D4ED8;
  
  /* Success/Sync Colors */
  --success-500: #10B981;     /* Green */
  --success-600: #059669;
  
  /* Warning Colors */
  --warning-500: #F59E0B;     /* Amber */
  --warning-600: #D97706;
  
  /* Error Colors */
  --error-500: #EF4444;       /* Red */
  --error-600: #DC2626;
  
  /* Neutral Colors */
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-200: #E5E7EB;
  --gray-300: #D1D5DB;
  --gray-500: #6B7280;
  --gray-700: #374151;
  --gray-900: #111827;
  
  /* Recording State */
  --recording-color: #DC2626;  /* Red for recording */
  --recording-pulse: #FCA5A5;  /* Light red for pulse */
}
```

### Typography Scale
```css
:root {
  /* Font Families */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Type Scale */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
}
```

### Spacing System
```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

## Component Specifications

### 1. StatusBar Component

#### Mobile Layout
```css
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
  font-size: var(--text-sm);
  font-weight: 500;
}

.status-bar__left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-bar__right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.network-status {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--success-600);
}

.network-status--offline {
  color: var(--gray-500);
}

.storage-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--gray-600);
}

.storage-bar {
  width: 60px;
  height: 4px;
  background: var(--gray-200);
  border-radius: 2px;
  overflow: hidden;
}

.storage-bar__fill {
  height: 100%;
  background: var(--primary-500);
  transition: all 0.3s ease;
}

.storage-bar__fill--warning {
  background: var(--warning-500);
}

.storage-bar__fill--critical {
  background: var(--error-500);
}

.warning-icon {
  color: var(--warning-500);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

#### Desktop Layout
```css
@media (min-width: 768px) {
  .status-bar {
    padding: var(--space-4) var(--space-6);
  }
  
  .storage-indicator {
    font-size: var(--text-sm);
  }
  
  .storage-bar {
    width: 120px;
    height: 6px;
  }
}
```

### 2. RecordingControls Component

#### Mobile Layout
```css
.recording-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-4);
  gap: var(--space-6);
}

.record-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid var(--error-500);
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-2xl);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.record-button:hover {
  transform: scale(1.05);
}

.record-button:active {
  transform: scale(0.95);
}

.record-button--recording {
  background: var(--error-500);
  color: white;
  animation: recording-pulse 1.5s infinite;
}

@keyframes recording-pulse {
  0% { box-shadow: 0 0 0 0 var(--recording-pulse); }
  70% { box-shadow: 0 0 0 10px rgba(252, 165, 165, 0); }
  100% { box-shadow: 0 0 0 0 rgba(252, 165, 165, 0); }
}

.timer {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--gray-700);
  text-align: center;
}

.timer--recording {
  color: var(--error-600);
}

.duration-slider {
  width: 100%;
  max-width: 280px;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--gray-200);
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-500);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-500);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--gray-500);
}
```

#### Desktop Layout
```css
@media (min-width: 768px) {
  .recording-controls {
    padding: var(--space-12);
  }
  
  .record-button {
    width: 100px;
    height: 100px;
    font-size: var(--text-3xl);
  }
  
  .timer {
    font-size: var(--text-2xl);
  }
  
  .duration-slider {
    max-width: 320px;
  }
}
```

### 3. FileList Component

#### Mobile Layout
```css
.file-list {
  padding: var(--space-4);
}

.file-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--gray-200);
}

.file-list__title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--gray-900);
}

.file-list__count {
  font-size: var(--text-sm);
  color: var(--gray-500);
}

.file-item {
  display: flex;
  align-items: flex-start;
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  margin-bottom: var(--space-3);
  background: white;
  transition: all 0.2s ease;
}

.file-item:hover {
  border-color: var(--primary-300);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.file-item__icon {
  font-size: var(--text-xl);
  margin-right: var(--space-3);
  color: var(--primary-500);
}

.file-item__content {
  flex: 1;
  min-width: 0;
}

.file-item__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2);
}

.file-item__name {
  font-weight: 500;
  color: var(--gray-900);
  font-size: var(--text-base);
  line-height: var(--leading-tight);
  word-break: break-word;
}

.file-item__sync-status {
  font-size: var(--text-lg);
  margin-left: var(--space-2);
  flex-shrink: 0;
}

.file-item__metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--gray-500);
  margin-bottom: var(--space-2);
}

.file-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.tag {
  background: var(--primary-100);
  color: var(--primary-700);
  padding: var(--space-1) var(--space-2);
  border-radius: 12px;
  font-size: var(--text-xs);
  font-weight: 500;
}

.file-item__actions {
  display: flex;
  gap: var(--space-2);
}

.action-button {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  background: white;
  color: var(--gray-600);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.action-button:hover {
  border-color: var(--primary-300);
  color: var(--primary-600);
}

.action-button--delete:hover {
  border-color: var(--error-300);
  color: var(--error-600);
}
```

#### Desktop Layout
```css
@media (min-width: 768px) {
  .file-list {
    padding: var(--space-6);
  }
  
  .file-item {
    padding: var(--space-5);
  }
  
  .file-item__actions {
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .file-item:hover .file-item__actions {
    opacity: 1;
  }
  
  .action-button {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
  }
}
```

### 4. SettingsPanel Component

```css
.settings-panel {
  padding: var(--space-6);
  background: white;
  border-radius: 12px;
  border: 1px solid var(--gray-200);
  margin: var(--space-4);
}

.settings-panel__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--gray-200);
}

.settings-panel__title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--gray-900);
}

.settings-section {
  margin-bottom: var(--space-6);
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section__title {
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--gray-800);
  margin-bottom: var(--space-3);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: var(--space-2);
}

.form-input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  font-size: var(--text-base);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-500);
}

.checkbox-label {
  font-size: var(--text-sm);
  color: var(--gray-700);
  cursor: pointer;
}
```

## Responsive Breakpoints

### Breakpoint System
```css
/* Mobile First Approach */
.container {
  padding: var(--space-4);
}

/* Small tablets */
@media (min-width: 640px) {
  .container {
    padding: var(--space-6);
  }
}

/* Tablets */
@media (min-width: 768px) {
  .container {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-8);
    max-width: 1024px;
    margin: 0 auto;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    grid-template-columns: 320px 1fr 320px;
    max-width: 1200px;
    gap: var(--space-12);
  }
}

/* Large desktop */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}
```

## Touch & Interaction

### Touch Targets
```css
/* Ensure minimum 44px touch targets */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Remove tap highlights on mobile */
.no-tap-highlight {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
```

### Focus States
```css
/* Keyboard focus indicators */
.focus-ring:focus {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}

.focus-ring:focus:not(:focus-visible) {
  outline: none;
}

.focus-ring:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}
```

## Dark Mode Support

```css
@media (prefers-color-scheme: dark) {
  :root {
    --gray-50: #1F2937;
    --gray-100: #374151;
    --gray-200: #4B5563;
    --gray-300: #6B7280;
    --gray-500: #9CA3AF;
    --gray-700: #D1D5DB;
    --gray-900: #F9FAFB;
  }
  
  .file-item {
    background: var(--gray-800);
    border-color: var(--gray-700);
  }
  
  .status-bar {
    background: var(--gray-800);
    border-color: var(--gray-700);
  }
}
```

This component system provides a complete, responsive foundation for the audio recorder app with consistent styling, proper touch interactions, and accessibility features.