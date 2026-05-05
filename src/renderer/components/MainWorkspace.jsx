// src/renderer/components/MainWorkspace.jsx
import React, { useState, useCallback } from 'react';
import { WORKSPACE_MODE } from './WorkspaceLayout';
import './MainWorkspace.css';

export default function MainWorkspace({
  mode, allImages, rootPath, selectedBatchPath,
  validationResult, referenceImageSrc,
  historicalDates, missingDateQueue,
  onUpdateDate, onStartJsonCreation, onSaveDirectly,
  onRenameFolder, isProcessing, outputPath, onRefresh,
}) {
  return (
    <div className="main-workspace">
      {mode === WORKSPACE_MODE.IMAGE_LIST && (
        <ImageListView
          allImages={allImages}
          rootPath={rootPath}
          selectedBatchPath={selectedBatchPath}
          validationResult={validationResult}
          onStartJsonCreation={onStartJsonCreation}
          isProcessing={isProcessing}
        />
      )}
      {mode === WORKSPACE_MODE.VALIDATION_ERROR && (
        <ValidationErrorView
          validationResult={validationResult}
          selectedBatchPath={selectedBatchPath}
          onRenameFolder={onRenameFolder}
          onRefresh={onRefresh}
        />
      )}
      {mode === WORKSPACE_MODE.JSON_CREATION && (
        <JsonCreationView
          referenceImageSrc={referenceImageSrc}
          historicalDates={historicalDates}
          missingDateQueue={missingDateQueue}
          selectedBatchPath={selectedBatchPath}
          isProcessing={isProcessing}
          onUpdateDate={onUpdateDate}
          onSaveDirectly={onSaveDirectly}
        />
      )}
      {mode === WORKSPACE_MODE.COMPLETE && (
        <CompleteView outputPath={outputPath} />
      )}
    </div>
  );
}

// ── Image List View ──────────────────────────────────────────────
function ImageListView({ allImages, rootPath, selectedBatchPath, validationResult, onStartJsonCreation, isProcessing }) {
  const canStart = selectedBatchPath && validationResult?.valid;

  return (
    <div className="ws-view">
      <div className="ws-toolbar">
        <div className="ws-toolbar-left">
          <span className="ws-title">Dataset Images</span>
          <span className="ws-badge">{allImages.length} files</span>
        </div>
        <div className="ws-toolbar-right">
          {canStart && (
            <button
              className="btn btn-primary"
              onClick={onStartJsonCreation}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <><span className="btn-spinner" /> Processing...</>
              ) : (
                <><span>⊕</span> Start JSON Creation</>
              )}
            </button>
          )}
          {selectedBatchPath && !validationResult?.valid && (
            <div className="inline-warning">
              <span>⚠</span> Select a valid batch folder to continue
            </div>
          )}
        </div>
      </div>

      {!selectedBatchPath && (
        <div className="ws-empty-hint">
          <div className="empty-icon">◈</div>
          <p>Select a batch folder from the file explorer to begin.</p>
          <p className="hint-sub">A valid batch must contain <code>Historical</code>, <code>Present_Neutral</code>, and a <code>Pose_Variation</code> subfolder.</p>
        </div>
      )}

      {allImages.length > 0 && (
        <div className="image-list-wrap">
          <table className="image-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Filename</th>
                <th>Relative Path</th>
                <th>Extension</th>
              </tr>
            </thead>
            <tbody>
              {allImages.map((img, i) => (
                <tr key={img.path} className={img.path.startsWith(selectedBatchPath || '__') ? 'row-highlighted' : ''}>
                  <td className="col-idx mono">{String(i + 1).padStart(3, '0')}</td>
                  <td className="col-name">
                    <span className="file-dot" style={{ color: extColor(img.ext) }}>◼</span>
                    {img.name}
                  </td>
                  <td className="col-path mono">{img.relativePath}</td>
                  <td className="col-ext mono">{img.ext}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function extColor(ext) {
  const map = { '.jpg': '#f59e0b', '.jpeg': '#f59e0b', '.png': '#60a5fa', '.tiff': '#a78bfa', '.tif': '#a78bfa', '.heic': '#34d399', '.raw': '#f87171', '.cr2': '#f87171' };
  return map[ext] || '#535b6e';
}

// ── Validation Error View ────────────────────────────────────────
function ValidationErrorView({ validationResult, selectedBatchPath, onRenameFolder, onRefresh }) {
  const [renameTarget, setRenameTarget] = useState(null);

  const handleRenameClick = (missingName) => {
    // Find a candidate folder (with wrong name) to rename
    setRenameTarget({
      suggestedPath: `${selectedBatchPath}/${missingName}_WRONG`,
      targetName: missingName,
      batchPath: selectedBatchPath,
    });
  };

  return (
    <div className="ws-view">
      <div className="ws-toolbar">
        <span className="ws-title">Folder Validation</span>
        <span className="status-pill status-error">Invalid Structure</span>
      </div>

      <div className="validation-panel">
        <div className="validation-header">
          <span className="val-icon error">✕</span>
          <div>
            <h2>Batch folder structure is invalid</h2>
            <p className="val-path mono">{selectedBatchPath}</p>
          </div>
        </div>

        <div className="validation-grid">
          {/* Required folders status */}
          {['Historical', 'Present_Neutral'].map(name => {
            const found = validationResult?.found?.includes(name);
            return (
              <FolderStatusRow
                key={name}
                name={name}
                required
                found={found}
                batchPath={selectedBatchPath}
                onRename={onRenameFolder}
                foundFolders={validationResult?.found || []}
              />
            );
          })}

          {/* Pose variant */}
          <PoseVariantRow
            found={validationResult?.found || []}
            batchPath={selectedBatchPath}
            onRename={onRenameFolder}
          />
        </div>

        <div className="validation-hint">
          <span className="hint-icon">ℹ</span>
          Use the <strong>Rename</strong> button to fix a misnamed folder in-place. Changes reflect immediately on disk.
        </div>

        <button className="btn btn-secondary" onClick={onRefresh} style={{ marginTop: 12 }}>
          ↻ Re-validate
        </button>
      </div>
    </div>
  );
}

function FolderStatusRow({ name, found, batchPath, onRename, foundFolders }) {
  const [renaming, setRenaming] = useState(false);
  const [selectedSource, setSelectedSource] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Candidates: found folders not matching required names
  const REQUIRED = new Set(['Historical', 'Present_Neutral', 'Pose_Variation_A', 'Pose_Variation_B']);
  const candidates = foundFolders.filter(f => !REQUIRED.has(f));

  const doRename = async () => {
    if (!selectedSource) return;
    const oldPath = `${batchPath}/${selectedSource}`;
    const result = await onRename(oldPath, name);
    if (result.success) {
      setFeedback({ ok: true, msg: 'Renamed successfully' });
      setRenaming(false);
    } else {
      setFeedback({ ok: false, msg: result.error });
    }
  };

  return (
    <div className={`val-row ${found ? 'val-ok' : 'val-missing'}`}>
      <div className="val-row-main">
        <span className={`val-status ${found ? 'ok' : 'err'}`}>{found ? '✓' : '✕'}</span>
        <span className="val-folder-name mono">{name}</span>
        <span className={`val-label ${found ? 'found' : 'missing'}`}>{found ? 'found' : 'missing'}</span>
        {!found && !renaming && (
          <button className="btn-inline" onClick={() => setRenaming(true)}>Rename existing →</button>
        )}
      </div>

      {renaming && (
        <div className="rename-inline">
          <span className="rename-label">Rename which folder to <strong>{name}</strong>?</span>
          <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}>
            <option value="">— pick a folder —</option>
            {candidates.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="rename-actions">
            <button className="btn btn-sm btn-primary" onClick={doRename} disabled={!selectedSource}>Apply</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setRenaming(false)}>Cancel</button>
          </div>
          {feedback && (
            <span className={`rename-feedback ${feedback.ok ? 'ok' : 'err'}`}>{feedback.msg}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PoseVariantRow({ found, batchPath, onRename }) {
  const hasA = found.includes('Pose_Variation_A');
  const hasB = found.includes('Pose_Variation_B');
  const hasPose = hasA || hasB;
  const [renaming, setRenaming] = useState(false);
  const [targetVariant, setTargetVariant] = useState('Pose_Variation_A');
  const [selectedSource, setSelectedSource] = useState('');
  const [feedback, setFeedback] = useState(null);

  const REQUIRED = new Set(['Historical', 'Present_Neutral', 'Pose_Variation_A', 'Pose_Variation_B']);
  const candidates = found.filter(f => !REQUIRED.has(f));

  const doRename = async () => {
    if (!selectedSource) return;
    const oldPath = `${batchPath}/${selectedSource}`;
    const result = await onRename(oldPath, targetVariant);
    if (result.success) setFeedback({ ok: true, msg: 'Renamed' });
    else setFeedback({ ok: false, msg: result.error });
    setRenaming(false);
  };

  return (
    <div className={`val-row ${hasPose ? 'val-ok' : 'val-missing'}`}>
      <div className="val-row-main">
        <span className={`val-status ${hasPose ? 'ok' : 'err'}`}>{hasPose ? '✓' : '✕'}</span>
        <span className="val-folder-name mono">Pose_Variation_A / B</span>
        <span className={`val-label ${hasPose ? 'found' : 'missing'}`}>
          {hasPose ? (hasA ? 'Pose_Variation_A found' : 'Pose_Variation_B found') : 'missing'}
        </span>
        {!hasPose && !renaming && (
          <button className="btn-inline" onClick={() => setRenaming(true)}>Rename existing →</button>
        )}
      </div>

      {renaming && (
        <div className="rename-inline">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="rename-label">Rename to:</span>
            <select value={targetVariant} onChange={e => setTargetVariant(e.target.value)} style={{ width: 'auto' }}>
              <option value="Pose_Variation_A">Pose_Variation_A</option>
              <option value="Pose_Variation_B">Pose_Variation_B</option>
            </select>
          </div>
          <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}>
            <option value="">— pick source folder —</option>
            {candidates.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="rename-actions">
            <button className="btn btn-sm btn-primary" onClick={doRename} disabled={!selectedSource}>Apply</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setRenaming(false)}>Cancel</button>
          </div>
          {feedback && <span className={`rename-feedback ${feedback.ok ? 'ok' : 'err'}`}>{feedback.msg}</span>}
        </div>
      )}
    </div>
  );
}

// ── JSON Creation View — Interactive Image Grid ──────────────────
function JsonCreationView({
  referenceImageSrc, historicalDates, missingDateQueue,
  selectedBatchPath, isProcessing, onUpdateDate, onSaveDirectly,
}) {
  const [selectedImage, setSelectedImage] = useState(null); // { name, path, src }
  const [allHistoricalImages, setAllHistoricalImages] = useState([]);
  const [loadedSrcs, setLoadedSrcs] = useState({}); // name → base64
  const [editingDate, setEditingDate] = useState('');
  const [loadingImages, setLoadingImages] = useState(true);

  // Load all historical image thumbnails once
  React.useEffect(() => {
    if (!selectedBatchPath) return;
    let cancelled = false;
    (async () => {
      setLoadingImages(true);
      const historicalPath = `${selectedBatchPath}/Historical`;
      const images = await window.electron.getImagesInFolder(historicalPath);
      if (cancelled) return;
      setAllHistoricalImages(images);

      // Load all thumbnails
      const srcs = {};
      for (const img of images) {
        const b64 = await window.electron.readImageAsBase64(img.path);
        if (cancelled) return;
        srcs[img.name] = b64;
        setLoadedSrcs(prev => ({ ...prev, [img.name]: b64 }));
      }
      setLoadingImages(false);
    })();
    return () => { cancelled = true; };
  }, [selectedBatchPath]);

  const handleSelectImage = (img) => {
    setSelectedImage(img);
    // Pre-fill date input if already has a date
    const existing = historicalDates[img.name];
    if (existing) {
      // strip T00:00:00 to get YYYY-MM-DD
      setEditingDate(existing.slice(0, 10));
    } else {
      setEditingDate('');
    }
  };

  const handleConfirmDate = () => {
    if (!editingDate || !selectedImage) return;
    onUpdateDate(selectedImage.name, editingDate);
    // Advance to next missing image automatically
    const missingNames = missingDateQueue.map(m => m.name).filter(n => n !== selectedImage.name);
    const nextMissing = allHistoricalImages.find(img => missingNames.includes(img.name));
    if (nextMissing) {
      setSelectedImage(nextMissing);
      setEditingDate('');
    } else {
      setSelectedImage(null);
      setEditingDate('');
    }
  };

  const missingCount = missingDateQueue.length;
  const totalCount = allHistoricalImages.length;
  const resolvedCount = totalCount - missingCount;
  const allResolved = missingCount === 0 && totalCount > 0;

  return (
    <div className="ws-view">
      <div className="ws-toolbar">
        <div className="ws-toolbar-left">
          <span className="ws-title">Historical Images — Capture Dates</span>
          <span className="ws-badge">{resolvedCount}/{totalCount} dated</span>
          {missingCount > 0 && (
            <span className="ws-badge badge-warn">{missingCount} missing</span>
          )}
        </div>
        <div className="ws-toolbar-right">
          {allResolved && (
            <button className="btn btn-primary" onClick={onSaveDirectly}>
              ⊕ Save metadata.json
            </button>
          )}
        </div>
      </div>

      {isProcessing ? (
        <div className="ws-processing">
          <div className="proc-spinner" />
          <p className="mono">Extracting EXIF metadata via ExifTool...</p>
        </div>
      ) : (
        <div className="grid-layout">

          {/* Left: image grid */}
          <div className="hist-grid-wrap">
            {/* Reference image strip */}
            {referenceImageSrc && (
              <div className="ref-strip">
                <span className="ref-strip-label mono">PRESENT_NEUTRAL reference</span>
                <img src={referenceImageSrc} alt="Reference" className="ref-strip-img" />
              </div>
            )}

            <div className="hist-grid">
              {loadingImages && allHistoricalImages.length === 0 && (
                <div className="grid-loading mono">Loading images...</div>
              )}
              {allHistoricalImages.map(img => {
                const hasMeta = !!historicalDates[img.name];
                const isMissing = missingDateQueue.some(m => m.name === img.name);
                const isSelected = selectedImage?.name === img.name;
                return (
                  <div
                    key={img.name}
                    className={`grid-cell ${isSelected ? 'grid-cell-selected' : ''} ${isMissing ? 'grid-cell-missing' : 'grid-cell-ok'}`}
                    onClick={() => handleSelectImage(img)}
                    title={img.name}
                  >
                    {loadedSrcs[img.name] ? (
                      <img src={loadedSrcs[img.name]} alt={img.name} className="grid-thumb" />
                    ) : (
                      <div className="grid-thumb-placeholder">…</div>
                    )}
                    <div className="grid-cell-footer">
                      <span className="grid-cell-name truncate">{img.name}</span>
                      <span className={`grid-cell-badge ${hasMeta ? 'badge-ok' : 'badge-missing'}`}>
                        {hasMeta ? '✓' : '?'}
                      </span>
                    </div>
                    {hasMeta && (
                      <div className="grid-cell-date mono">
                        {historicalDates[img.name].slice(0, 10)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: date editor for selected image */}
          <div className="date-editor-panel">
            {selectedImage ? (
              <>
                <div className="date-editor-header">
                  <span className="section-label mono">
                    <span className="accent-dot" /> SELECTED IMAGE
                  </span>
                  <span className="date-editor-filename mono truncate">{selectedImage.name}</span>
                </div>

                <div className="date-editor-preview">
                  {loadedSrcs[selectedImage.name] ? (
                    <img src={loadedSrcs[selectedImage.name]} alt={selectedImage.name} className="date-editor-img" />
                  ) : (
                    <div className="date-editor-img-placeholder">Loading...</div>
                  )}
                </div>

                <div className="date-editor-status">
                  {historicalDates[selectedImage.name] ? (
                    <div className="date-found">
                      <span className="status-ok-dot">✓</span>
                      <div>
                        <div className="date-found-label">EXIF date found</div>
                        <div className="date-found-value mono">{historicalDates[selectedImage.name]}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="date-missing-tag">
                      <span>⚠</span> No EXIF date — enter manually
                    </div>
                  )}
                </div>

                <div className="date-editor-input-wrap">
                  <label className="field-label mono">Capture date</label>
                  <input
                    type="date"
                    value={editingDate}
                    onChange={e => setEditingDate(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConfirmDate()}
                    autoFocus
                  />
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 10, width: '100%' }}
                    onClick={handleConfirmDate}
                    disabled={!editingDate}
                  >
                    ✓ {historicalDates[selectedImage.name] ? 'Update Date' : 'Set Date'}
                  </button>
                </div>
              </>
            ) : (
              <div className="date-editor-empty">
                <span className="empty-icon">◈</span>
                <p>Click any image to view or edit its capture date.</p>
                {missingCount > 0 && (
                  <p className="hint-sub">
                    <span style={{ color: 'var(--accent-amber)' }}>⚠ {missingCount}</span> image{missingCount !== 1 ? 's' : ''} still need a date.
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Complete View ────────────────────────────────────────────────
function CompleteView({ outputPath }) {
  return (
    <div className="ws-view ws-complete">
      <div className="complete-inner">
        <div className="complete-icon">✓</div>
        <h2>metadata.json saved</h2>
        <p className="complete-path mono" title={outputPath}>{outputPath}</p>
        <button
          className="btn btn-secondary"
          onClick={() => window.electron.showItemInFolder(outputPath)}
        >
          ⊞ Reveal in Finder
        </button>
      </div>
    </div>
  );
}
