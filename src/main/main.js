// src/main/main.js — Electron Main Process
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── Window ────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // allow local file:// image loads via base64 IPC
    },
  });

  const url = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../../build/index.html')}`;
  mainWindow.loadURL(url);

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Utilities ─────────────────────────────────────────────────────────────
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp', '.heic', '.heif', '.raw', '.cr2', '.nef', '.arw']);

function isImage(filename) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/** Recursively scan a directory and build a tree node */
function scanDirectory(dirPath, rootPath) {
  const name = path.basename(dirPath);
  const relativePath = path.relative(rootPath, dirPath);
  const node = { name, path: dirPath, relativePath: relativePath || '.', type: 'folder', children: [] };

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return node;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      node.children.push(scanDirectory(fullPath, rootPath));
    } else if (entry.isFile()) {
      node.children.push({
        name: entry.name,
        path: fullPath,
        relativePath: path.relative(rootPath, fullPath),
        type: 'file',
        ext: path.extname(entry.name).toLowerCase(),
        isImage: isImage(entry.name),
      });
    }
  }

  // Sort: folders first, then files
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return node;
}

/** Flatten tree to collect all image paths */
function collectImages(node, results = []) {
  if (node.type === 'file' && node.isImage) { results.push(node); return results; }
  if (node.children) node.children.forEach(c => collectImages(c, results));
  return results;
}

// ─── ExifTool Resolver ─────────────────────────────────────────────────────
function getExifToolPath() {
  // 1. Check bundled binary next to app
  const bundledPaths = [
    path.join(app.getAppPath(), 'public', 'exiftool', process.platform === 'win32' ? 'exiftool.exe' : 'exiftool'),
    path.join(process.resourcesPath || '', 'exiftool', process.platform === 'win32' ? 'exiftool.exe' : 'exiftool'),
  ];
  for (const p of bundledPaths) {
    if (fs.existsSync(p)) return p;
  }
  // 2. Fall back to system PATH
  return process.platform === 'win32' ? 'exiftool.exe' : 'exiftool';
}

/** Run exiftool on a single file and extract date fields */
function extractDateWithExiftool(filePath) {
  return new Promise((resolve) => {
    const exifBin = getExifToolPath();
    // On Windows paths can contain spaces — double-quote everything
    const safeFile = filePath.replace(/"/g, '\\"');
    const cmd = process.platform === 'win32'
      ? `"${exifBin}" -DateTimeOriginal -CreateDate -json "${safeFile}"`
      : `"${exifBin}" -DateTimeOriginal -CreateDate -json "${safeFile}"`;

    exec(cmd, { timeout: 15000 }, (err, stdout) => {
      if (err || !stdout) { resolve(null); return; }
      try {
        const data = JSON.parse(stdout);
        const raw = data[0]?.DateTimeOriginal || data[0]?.CreateDate;
        if (!raw) { resolve(null); return; }

        // ExifTool format: "2023:07:14 15:30:00" → "2023-07-14T00:00:00"
        const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
        if (match) {
          resolve(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────

// Open folder via system dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Dataset Root Folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

// Scan folder and return tree
ipcMain.handle('fs:scanFolder', async (_, folderPath) => {
  if (!fs.existsSync(folderPath)) return { error: 'Path does not exist' };
  const tree = scanDirectory(folderPath, folderPath);
  const allImages = collectImages(tree);
  return { tree, allImages, rootPath: folderPath };
});

// Validate batch folder structure
ipcMain.handle('fs:validateBatchFolder', async (_, folderPath) => {
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch {
    return { valid: false, error: 'Cannot read folder' };
  }

  const subfolderNames = entries.filter(e => e.isDirectory()).map(e => e.name);
  const required = ['Historical', 'Present_Neutral'];
  const poseVariants = ['Pose_Variation_A', 'Pose_Variation_B'];

  const missing = [];
  required.forEach(r => { if (!subfolderNames.includes(r)) missing.push(r); });

  const hasPose = poseVariants.some(p => subfolderNames.includes(p));
  if (!hasPose) missing.push('Pose_Variation_A or Pose_Variation_B');

  return {
    valid: missing.length === 0,
    found: subfolderNames,
    missing,
    poseVariantFound: poseVariants.find(p => subfolderNames.includes(p)) || null,
  };
});

// Rename a folder on disk
ipcMain.handle('fs:renameFolder', async (_, { oldPath, newName }) => {
  const parentDir = path.dirname(oldPath);
  const newPath = path.join(parentDir, newName);
  try {
    fs.renameSync(oldPath, newPath);
    return { success: true, newPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Get images in a specific subfolder (for Present_Neutral preview, Historical scan)
ipcMain.handle('fs:getImagesInFolder', async (_, folderPath) => {
  if (!fs.existsSync(folderPath)) return [];
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && isImage(e.name))
    .map(e => ({ name: e.name, path: path.join(folderPath, e.name) }));
});

// Get a random image from Present_Neutral for reference display
ipcMain.handle('fs:getRandomImage', async (_, folderPath) => {
  if (!fs.existsSync(folderPath)) return null;
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const images = entries.filter(e => e.isFile() && isImage(e.name));
  if (!images.length) return null;
  const picked = images[Math.floor(Math.random() * images.length)];
  return path.join(folderPath, picked.name);
});

// Extract dates from Historical folder (up to 16 images)
ipcMain.handle('exif:extractHistoricalDates', async (_, historicalFolderPath) => {
  if (!fs.existsSync(historicalFolderPath)) return { dates: {}, missingQueue: [] };

  const entries = fs.readdirSync(historicalFolderPath, { withFileTypes: true });
  const images = entries
    .filter(e => e.isFile() && isImage(e.name))
    .slice(0, 16)
    .map(e => ({ name: e.name, path: path.join(historicalFolderPath, e.name) }));

  const dates = {};
  const missingQueue = [];

  for (const img of images) {
    const date = await extractDateWithExiftool(img.path);
    if (date) {
      dates[img.name] = date;
    } else {
      missingQueue.push({ name: img.name, path: img.path });
    }
  }

  return { dates, missingQueue };
});

// Read image as base64 for display in renderer
ipcMain.handle('fs:readImageAsBase64', async (_, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
});

// Save final metadata.json
ipcMain.handle('fs:saveMetadata', async (_, { batchFolderPath, metadata }) => {
  const outputPath = path.join(batchFolderPath, 'metadata.json');
  try {
    fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2), 'utf-8');
    return { success: true, outputPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Reveal file in Finder/Explorer
ipcMain.handle('shell:showItemInFolder', async (_, filePath) => {
  shell.showItemInFolder(filePath);
});
