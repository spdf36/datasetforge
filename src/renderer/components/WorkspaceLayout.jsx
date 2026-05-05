// src/renderer/components/WorkspaceLayout.jsx
import React, { useState, useCallback } from 'react';
import FileExplorer from './FileExplorer';
import MainWorkspace from './MainWorkspace';
import MetadataPanel from './MetadataPanel';
import './WorkspaceLayout.css';

export const WORKSPACE_MODE = {
  IMAGE_LIST:        'IMAGE_LIST',
  VALIDATION_ERROR:  'VALIDATION_ERROR',
  JSON_CREATION:     'JSON_CREATION',
  MANUAL_DATE:       'MANUAL_DATE',
  COMPLETE:          'COMPLETE',
};

const EMPTY_METADATA = {
  country: '',
  date_of_birth: '',
  gender: '',
  ethnicity: '',
  device_os: '',
};

export default function WorkspaceLayout({ rootPath, fileTree, allImages, onRefresh, onReset }) {
  const [mode, setMode] = useState(WORKSPACE_MODE.IMAGE_LIST);
  const [selectedBatchPath, setSelectedBatchPath] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [metadata, setMetadata] = useState(EMPTY_METADATA);

  // JSON creation state
  const [referenceImageSrc, setReferenceImageSrc] = useState(null);
  const [historicalDates, setHistoricalDates] = useState({});
  const [missingDateQueue, setMissingDateQueue] = useState([]);
  const [currentMissingIdx, setCurrentMissingIdx] = useState(0);
  const [currentMissingImageSrc, setCurrentMissingImageSrc] = useState(null);
  const [manualDate, setManualDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputPath, setOutputPath] = useState(null);
  const [poseVariantFound, setPoseVariantFound] = useState(null);

  // ── Select batch folder from tree ────────────────────────────
  const handleSelectBatch = useCallback(async (node) => {
    setSelectedBatchPath(node.path);
    setMode(WORKSPACE_MODE.IMAGE_LIST);
    setValidationResult(null);
    setOutputPath(null);

    const result = await window.electron.validateBatchFolder(node.path);
    setValidationResult(result);
    setPoseVariantFound(result.poseVariantFound);

    if (!result.valid) setMode(WORKSPACE_MODE.VALIDATION_ERROR);
  }, []);

  // ── Start JSON Creation ──────────────────────────────────────
  const handleStartJsonCreation = useCallback(async () => {
    if (!selectedBatchPath || !validationResult?.valid) return;
    setIsProcessing(true);
    setMode(WORKSPACE_MODE.JSON_CREATION);

    try {
      // Load reference image from Present_Neutral
      const neutralPath = `${selectedBatchPath}/Present_Neutral`;
      const imgPath = await window.electron.getRandomImage(neutralPath);
      if (imgPath) {
        const b64 = await window.electron.readImageAsBase64(imgPath);
        setReferenceImageSrc(b64);
      }

      // Extract dates from Historical — populate grid
      const historicalPath = `${selectedBatchPath}/Historical`;
      const { dates, missingQueue } = await window.electron.extractHistoricalDates(historicalPath);
      setHistoricalDates(dates);
      setMissingDateQueue(missingQueue);
      setCurrentMissingIdx(0);
      // No longer auto-switching to MANUAL_DATE — user edits inline in grid
    } finally {
      setIsProcessing(false);
    }
  }, [selectedBatchPath, validationResult]);

  // ── Inline date update from grid ─────────────────────────────
  const handleUpdateDate = useCallback((filename, dateValue) => {
    setHistoricalDates(prev => ({ ...prev, [filename]: `${dateValue}T00:00:00` }));
    setMissingDateQueue(prev => prev.filter(item => item.name !== filename));
  }, []);

  // ── Save ─────────────────────────────────────────────────────
  const handleSaveDirectly = useCallback(async () => {
    await saveMetadata(historicalDates);
  }, [historicalDates, metadata]);

  const saveMetadata = async (dates) => {
    const finalMetadata = {
      ...metadata,
      historic_capture_dates: dates,
    };
    const folderName = selectedBatchPath.split(/[\\/]/).filter(Boolean).pop();
    const result = await window.electron.saveMetadata({
      batchFolderPath: selectedBatchPath,
      filename: `${folderName}.json`,
      metadata: finalMetadata,
    });
    if (result.success) {
      setOutputPath(result.outputPath);
      setMode(WORKSPACE_MODE.COMPLETE);
    }
  };

  // ── Rename folder callback ───────────────────────────────────
  const handleRenameFolder = useCallback(async (folderPath, newName) => {
    const result = await window.electron.renameFolder({ oldPath: folderPath, newName });
    if (result.success) {
      await onRefresh();
      // Re-select if renamed folder was our batch
      if (folderPath === selectedBatchPath) setSelectedBatchPath(result.newPath);
    }
    return result;
  }, [onRefresh, selectedBatchPath]);

  return (
    <div className="workspace-layout">
      {/* Left: File Explorer */}
      <aside className="panel panel-left">
        <PanelHeader label="EXPLORER" icon="⬡" />
        <div className="panel-body">
          <FileExplorer
            tree={fileTree}
            rootPath={rootPath}
            selectedPath={selectedBatchPath}
            onSelectFolder={handleSelectBatch}
          />
        </div>
      </aside>

      {/* Middle: Main Workspace */}
      <main className="panel panel-main">
        <MainWorkspace
          mode={mode}
          allImages={allImages}
          rootPath={rootPath}
          selectedBatchPath={selectedBatchPath}
          validationResult={validationResult}
          referenceImageSrc={referenceImageSrc}
          historicalDates={historicalDates}
          missingDateQueue={missingDateQueue}
          onUpdateDate={handleUpdateDate}
          onStartJsonCreation={handleStartJsonCreation}
          onSaveDirectly={handleSaveDirectly}
          onRenameFolder={handleRenameFolder}
          isProcessing={isProcessing}
          outputPath={outputPath}
          onRefresh={onRefresh}
        />
      </main>

      {/* Right: Metadata Panel */}
      <aside className="panel panel-right">
        <PanelHeader label="METADATA" icon="◈" />
        <div className="panel-body">
          <MetadataPanel
            metadata={metadata}
            onChange={setMetadata}
            disabled={mode === WORKSPACE_MODE.COMPLETE}
          />
        </div>
      </aside>
    </div>
  );
}

function PanelHeader({ label, icon }) {
  return (
    <div className="panel-header">
      <span className="panel-header-icon">{icon}</span>
      <span className="panel-header-label mono">{label}</span>
    </div>
  );
}