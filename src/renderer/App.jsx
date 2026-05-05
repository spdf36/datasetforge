// src/renderer/App.jsx
import React, { useState, useCallback } from 'react';
import DropZone from './components/DropZone';
import WorkspaceLayout from './components/WorkspaceLayout';

// App phases
export const PHASE = {
  DROP:      'DROP',       // Phase 1: landing/drop zone
  WORKSPACE: 'WORKSPACE',  // Phase 2+: three-column view
};

export default function App() {
  const [phase, setPhase] = useState(PHASE.DROP);
  const [rootPath, setRootPath] = useState(null);
  const [fileTree, setFileTree] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  const loadFolder = useCallback(async (folderPath) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await window.electron.scanFolder(folderPath);
      if (result.error) { setScanError(result.error); return; }
      setRootPath(result.rootPath);
      setFileTree(result.tree);
      setAllImages(result.allImages);
      setPhase(PHASE.WORKSPACE);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setPhase(PHASE.DROP);
    setRootPath(null);
    setFileTree(null);
    setAllImages([]);
    setScanError(null);
  }, []);

  // Re-scan after rename operations
  const refreshTree = useCallback(async () => {
    if (!rootPath) return;
    const result = await window.electron.scanFolder(rootPath);
    if (!result.error) {
      setFileTree(result.tree);
      setAllImages(result.allImages);
    }
  }, [rootPath]);

  return (
    <div className="app-root">
      <TitleBar rootPath={rootPath} onReset={handleReset} />
      <div className="app-body">
        {phase === PHASE.DROP ? (
          <DropZone onFolderSelected={loadFolder} isScanning={isScanning} scanError={scanError} />
        ) : (
          <WorkspaceLayout
            rootPath={rootPath}
            fileTree={fileTree}
            allImages={allImages}
            onRefresh={refreshTree}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}

function TitleBar({ rootPath, onReset }) {
  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-content">
        <span className="titlebar-logo">
          <span className="logo-bracket">[</span>
          <span className="logo-name">DatasetForge</span>
          <span className="logo-bracket">]</span>
        </span>
        {rootPath && (
          <span className="titlebar-path mono">
            <span className="path-sep">~/</span>
            {rootPath.split('/').slice(-2).join('/')}
          </span>
        )}
      </div>
      {rootPath && (
        <button className="titlebar-reset" onClick={onReset} title="Close project">
          ✕ close project
        </button>
      )}
    </div>
  );
}
