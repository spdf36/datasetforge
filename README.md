# DatasetForge

**Local desktop application for managing and generating metadata for image datasets.**
Built with Electron + React + Node.js. Runs entirely offline.

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- ExifTool (see below)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up ExifTool

ExifTool is used to extract EXIF `DateTimeOriginal` from historical images.

**macOS / Linux** (automated):
```bash
bash scripts/setup-exiftool.sh
```

**Windows** (manual):
1. Download from https://exiftool.org → `exiftool(-k).exe`
2. Rename to `exiftool.exe`
3. Place at `public/exiftool/exiftool.exe`

> If ExifTool is not bundled, the app falls back to the system PATH (i.e. if `exiftool` is globally installed it still works).

### 3. Run in development

```bash
npm start
```

This concurrently starts the React dev server on port 3000 and launches Electron.

### 4. Build for production

```bash
npm run build
```

Outputs a distributable to `dist/`.

---

## Project Structure

```
datasetforge/
├── public/
│   ├── index.html              # React HTML shell
│   └── exiftool/               # Bundled ExifTool binary (gitignored)
│       └── exiftool            # (or exiftool.exe on Windows)
│
├── src/
│   ├── main/
│   │   ├── main.js             # Electron main process (IPC handlers, filesystem, exiftool)
│   │   └── preload.js          # Context bridge – exposes safe API to renderer
│   │
│   └── renderer/
│       ├── index.js            # React entry point
│       ├── App.jsx             # Root component + phase state machine
│       │
│       ├── components/
│       │   ├── DropZone.jsx        # Phase 1: drag-and-drop landing
│       │   ├── WorkspaceLayout.jsx # Phase 2+: three-column coordinator
│       │   ├── FileExplorer.jsx    # Left sidebar: VS Code-style tree
│       │   ├── MainWorkspace.jsx   # Centre: multi-mode main panel
│       │   ├── MetadataPanel.jsx   # Right sidebar: form fields
│       │   └── *.css               # Component-scoped stylesheets
│       │
│       └── styles/
│           ├── globals.css     # CSS variables, resets, scrollbars
│           └── app.css         # App shell and titlebar
│
├── scripts/
│   └── setup-exiftool.sh       # One-time ExifTool setup helper
│
├── package.json
└── README.md
```

---

## Application Phases

### Phase 1 – Drop Zone
- Full-screen landing with animated drop target
- Drag-and-drop a folder OR click "Browse Folder"
- Recursively scans folder via `fs.readdirSync` in the main process
- Builds a typed file tree + flat image list

### Phase 2 – Workspace (Three-Column Layout)
| Left Sidebar | Centre Panel | Right Sidebar |
|---|---|---|
| VS Code-style file tree | Context-sensitive workspace | Metadata form |
| Colour-coded folder/file icons | Image list → Validation → JSON flow | country, DOB, gender, ethnicity, device_os |
| Collapsible folders | Live progress feedback | Live JSON preview |
| Image count badges | Manual date entry UI | |

### Phase 3 – Folder Validation & Renaming
Clicking any folder in the tree triggers validation:

**Required structure:**
```
BatchFolder/
  ├── Historical/
  ├── Present_Neutral/
  └── Pose_Variation_A/   (or Pose_Variation_B/)
```

- Missing folders are shown with ✕ + red highlight
- Each missing entry has an inline **Rename existing →** tool
- Pick the misnamed folder from a dropdown → rename is applied on disk via `fs.renameSync`
- Re-validate button refreshes the tree

### Phase 4 – JSON Creation Workflow

1. **Reference Image** — A random image from `Present_Neutral` is displayed so the user can identify the participant.

2. **ExifTool Date Extraction** — Up to 16 images from `Historical` are scanned:
   - Runs: `exiftool -DateTimeOriginal -CreateDate -json <file>`
   - If date found → stored as `"YYYY-MM-DDT00:00:00"`
   - If missing → added to `missingDateQueue`

3. **Manual Date Fallback** — For each image without EXIF data:
   - The image is displayed full-size in the centre panel
   - User enters an approximate `YYYY-MM-DD` in the right panel
   - Progress bar tracks remaining images

4. **Output** — Saves `metadata.json` directly into the batch folder:

```json
{
  "country": "DE",
  "date_of_birth": "1990-05",
  "gender": "Female",
  "ethnicity": "White – European",
  "device_os": "Android 13",
  "historic_capture_dates": {
    "IMG_001.jpg": "2019-03-14T00:00:00",
    "IMG_002.jpg": "2019-03-14T00:00:00"
  },
  "generated_at": "2024-07-15T10:30:00.000Z",
  "batch_folder": "/Users/.../MyDataset/Batch_001",
  "pose_variant": "Pose_Variation_A"
}
```

---

## IPC API Reference

All filesystem operations run in the main process and are called via the preload bridge (`window.electron`):

| Method | Description |
|---|---|
| `openFolderDialog()` | Opens native folder picker |
| `scanFolder(path)` | Recursive tree scan → `{ tree, allImages, rootPath }` |
| `validateBatchFolder(path)` | Checks for required subfolders → `{ valid, found, missing }` |
| `renameFolder({ oldPath, newName })` | Renames folder on disk |
| `getRandomImage(folderPath)` | Returns path of a random image |
| `readImageAsBase64(filePath)` | Returns `data:image/...;base64,...` string |
| `extractHistoricalDates(path)` | Runs ExifTool on ≤16 images → `{ dates, missingQueue }` |
| `saveMetadata({ batchFolderPath, metadata })` | Writes `metadata.json` |
| `showItemInFolder(filePath)` | Reveals file in Finder/Explorer |

---

## ExifTool Integration

The app resolves the ExifTool binary in order:
1. `public/exiftool/exiftool` (bundled — preferred for distribution)
2. `resources/exiftool/exiftool` (Electron packaged path)
3. System PATH `exiftool` / `exiftool.exe` (fallback for dev)

Command executed per image:
```
exiftool -DateTimeOriginal -CreateDate -json "<filepath>"
```

Date parsing handles ExifTool's native format `2023:07:14 15:30:00` → `2023-07-14T00:00:00`.

---

## Security

- `contextIsolation: true` + `nodeIntegration: false` — renderer has no direct Node access
- All filesystem ops go through typed IPC handlers in `main.js`
- Content Security Policy in `index.html` restricts script/style sources
- No external network calls; app is fully offline

---

## Extending

**Add a new metadata field:**
1. Add to `EMPTY_METADATA` in `WorkspaceLayout.jsx`
2. Add a `<Field>` in `MetadataPanel.jsx`
3. It will automatically appear in the JSON preview and saved output

**Support more image formats:**
Add extensions to `IMAGE_EXTENSIONS` in `main.js`

**Change max Historical images scanned:**
Edit `.slice(0, 16)` in the `exif:extractHistoricalDates` handler in `main.js`
