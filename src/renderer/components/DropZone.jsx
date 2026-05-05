// src/renderer/components/DropZone.jsx
import React, { useState, useRef, useCallback } from 'react';
import './DropZone.css';

export default function DropZone({ onFolderSelected, isScanning, scanError }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const items = e.dataTransfer.items;
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // In Electron, we can get the full path from files
          const file = item.getAsFile();
          if (file?.path) { onFolderSelected(file.path); return; }
        }
      }
    }
    // Fallback: get path from files
    const files = Array.from(e.dataTransfer.files);
    if (files.length && files[0].path) {
      const folderPath = files[0].path;
      // If it's a file, get parent directory
      onFolderSelected(folderPath);
    }
  }, [onFolderSelected]);

  const handleBrowse = useCallback(async () => {
    const folderPath = await window.electron.openFolderDialog();
    if (folderPath) onFolderSelected(folderPath);
  }, [onFolderSelected]);

  return (
    <div className="dropzone-root">
      <div className="dropzone-bg">
        <GridPattern />
      </div>

      <div
        className={`dropzone-container ${isDragging ? 'dragging' : ''} ${isScanning ? 'scanning' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="dropzone-inner">
          {isScanning ? (
            <ScanningState />
          ) : (
            <IdleState isDragging={isDragging} onBrowse={handleBrowse} scanError={scanError} />
          )}
        </div>
      </div>

      <div className="dropzone-footer">
        <span className="mono">DatasetForge v1.0</span>
        <span>·</span>
        <span>Local metadata generation for image datasets</span>
      </div>
    </div>
  );
}

function IdleState({ isDragging, onBrowse, scanError }) {
  return (
    <>
      <div className="dz-icon-wrap">
        <div className={`dz-icon ${isDragging ? 'active' : ''}`}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect x="4" y="14" width="44" height="34" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 22h44" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14 8l-6 6M38 8l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4 8h44" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M26 30v10M21 35l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="dz-ring" />
        <div className="dz-ring dz-ring-2" />
      </div>

      <h1 className="dz-title">
        {isDragging ? 'Release to load folder' : 'Drop a dataset folder'}
      </h1>
      <p className="dz-subtitle">
        Drag and drop any folder containing your image batches,<br />
        or browse to select one manually.
      </p>

      <div className="dz-divider"><span>or</span></div>

      <button className="dz-browse-btn" onClick={onBrowse}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4.5A1.5 1.5 0 013.5 3h3L8 5h4.5A1.5 1.5 0 0114 6.5v6A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-8z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Browse Folder
      </button>

      {scanError && (
        <div className="dz-error">
          <span>⚠</span> {scanError}
        </div>
      )}

      <div className="dz-hints">
        <span className="dz-hint">
          <span className="hint-key">JPG</span>
          <span className="hint-key">PNG</span>
          <span className="hint-key">TIFF</span>
          <span className="hint-key">HEIC</span>
          <span className="hint-key">RAW</span>
          supported
        </span>
      </div>
    </>
  );
}

function ScanningState() {
  return (
    <div className="scanning-state">
      <div className="scan-spinner">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="scan-dot" style={{ '--i': i }} />
        ))}
      </div>
      <p className="scan-label mono">scanning filesystem...</p>
    </div>
  );
}

function GridPattern() {
  return (
    <svg className="grid-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}
