# Audio Recorder App - UI Wireframes & Component Structure

## Mobile Layout (320px - 768px)

```
┌─────────────────────────────────────┐
│ 🌐 Online  📊 47MB/100MB     ⚠️     │ ← Status Bar
├─────────────────────────────────────┤
│                                     │
│        ⏺️ RECORD                    │ ← Record Button (large)
│        ⏹️ STOP                      │
│                                     │
│    ⏱️ 00:45 / 01:00                 │ ← Timer
│                                     │
│  [30s ●────────────○ 5min]         │ ← Duration Slider
│                                     │
├─────────────────────────────────────┤
│ 📁 Recordings (3)                   │ ← Section Header
├─────────────────────────────────────┤
│ 🎙️ Meeting_2024.webm    ☁️         │
│    #meeting #work        📝 🗑️     │
├─────────────────────────────────────┤
│ 🎙️ Quick_idea.webm      🔄         │
│    #idea                 📝 🗑️     │
├─────────────────────────────────────┤
│ 🎙️ Notes.webm           🗂️         │
│    #personal             📝 🗑️     │
├─────────────────────────────────────┤
│                                     │
│           ⚙️ Settings               │ ← Settings Button
│                                     │
└─────────────────────────────────────┘
```

## Desktop Layout (768px+)

```
┌─────────────────────────────────────────────────────────────┐
│ 🌐 Online        📊 Storage: 47MB/100MB used        ⚠️     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   RECORDING     │    │        FILE MANAGEMENT         │ │
│  │                 │    │                                 │ │
│  │   ⏺️ RECORD     │    │ 📁 Recordings (3 files)        │ │
│  │   ⏹️ STOP       │    │                                 │ │
│  │                 │    │ 🎙️ Meeting_2024.webm    ☁️    │ │
│  │ ⏱️ 00:45/01:00  │    │    2.1MB • 2:15 • #meeting    │ │
│  │                 │    │    [📝 Rename] [🗑️ Delete]    │ │
│  │[30s●──────○5min]│    │                                 │ │
│  │                 │    │ 🎙️ Quick_idea.webm      🔄    │ │
│  │   Chunk: 1min   │    │    1.8MB • 1:45 • #idea       │ │
│  │                 │    │    [📝 Rename] [🗑️ Delete]    │ │
│  └─────────────────┘    │                                 │ │
│                         │ 🎙️ Notes.webm           🗂️    │ │
│  ┌─────────────────┐    │    3.2MB • 3:20 • #personal   │ │
│  │   SETTINGS      │    │    [📝 Rename] [🗑️ Delete]    │ │
│  │                 │    │                                 │ │
│  │ ⚙️ Configure    │    └─────────────────────────────────┘ │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. StatusBar Component
```jsx
<StatusBar>
  <NetworkStatus online={true} />
  <StorageIndicator used={47} total={100} />
  <WarningIcon show={storageWarning} />
</StatusBar>
```

**Props:**
- `networkStatus: boolean`
- `storageUsed: number`
- `storageTotal: number`
- `showWarning: boolean`

### 2. RecordingControls Component
```jsx
<RecordingControls>
  <RecordButton onClick={handleRecord} recording={isRecording} />
  <Timer currentTime={45} chunkDuration={60} />
  <DurationSlider 
    min={30} 
    max={300} 
    value={chunkDuration}
    onChange={setChunkDuration} 
  />
</RecordingControls>
```

**Props:**
- `isRecording: boolean`
- `currentTime: number`
- `chunkDuration: number`
- `onRecord: () => void`
- `onStop: () => void`
- `onDurationChange: (seconds: number) => void`

### 3. FileList Component
```jsx
<FileList>
  {recordings.map(file => (
    <FileItem 
      key={file.id}
      file={file}
      onRename={handleRename}
      onDelete={handleDelete}
      onTagEdit={handleTagEdit}
    />
  ))}
</FileList>
```

**Props:**
- `recordings: Recording[]`
- `onRename: (id: string, name: string) => void`
- `onDelete: (id: string) => void`
- `onTagEdit: (id: string, tags: string[]) => void`

### 4. FileItem Component
```jsx
<FileItem>
  <FileIcon />
  <FileInfo>
    <FileName editable={editMode} />
    <FileMetadata size={size} duration={duration} />
    <TagList tags={tags} editable={true} />
  </FileInfo>
  <SyncStatus status={syncStatus} />
  <ActionButtons>
    <RenameButton />
    <DeleteButton />
  </ActionButtons>
</FileItem>
```

**Props:**
- `file: Recording`
- `onRename: (name: string) => void`
- `onDelete: () => void`
- `onTagEdit: (tags: string[]) => void`

### 5. SettingsPanel Component
```jsx
<SettingsPanel>
  <S3Configuration 
    bucketName={s3Bucket}
    pathPattern={s3Path}
    onChange={handleS3Config}
  />
  <SyncSettings 
    mobileDataSync={allowMobileSync}
    onChange={handleSyncSettings}
  />
  <StorageSettings 
    maxStorage={maxStorage}
    onChange={handleStorageSettings}
  />
</SettingsPanel>
```

## Responsive Breakpoints

```css
/* Mobile First */
.app {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .app {
    padding: 2rem;
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .app {
    max-width: 1200px;
    margin: 0 auto;
    grid-template-columns: 300px 1fr 300px;
  }
}
```

## Key UX Patterns

### Recording Flow
1. **Start Recording**: Large, prominent record button
2. **Visual Feedback**: Timer shows progress within chunk
3. **Chunk Transition**: Seamless continuation between chunks
4. **Stop Recording**: Clear stop button, immediate file creation

### File Management Flow
1. **Quick Actions**: Rename/delete directly from file list
2. **Tag Management**: Inline tag editing with suggestions
3. **Sync Status**: Clear visual indicators for sync state
4. **Bulk Operations**: Select multiple files for batch actions

### Settings Flow
1. **One-time Setup**: S3 configuration on first launch
2. **Quick Access**: Settings accessible but not prominent
3. **Smart Defaults**: Reasonable defaults for all options
4. **Validation**: Real-time validation of S3 settings

## Accessibility Features
- High contrast sync status icons
- Keyboard navigation support
- Screen reader friendly labels
- Touch targets ≥44px on mobile
- Focus indicators for all interactive elements