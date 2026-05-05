// src/renderer/components/FileExplorer.jsx
import React, { useState, useCallback } from 'react';
import './FileExplorer.css';

const FILE_ICONS = {
  '.jpg': { icon: '◼', color: '#f59e0b' },
  '.jpeg': { icon: '◼', color: '#f59e0b' },
  '.png': { icon: '◼', color: '#60a5fa' },
  '.tiff': { icon: '◼', color: '#a78bfa' },
  '.tif': { icon: '◼', color: '#a78bfa' },
  '.heic': { icon: '◼', color: '#34d399' },
  '.heif': { icon: '◼', color: '#34d399' },
  '.raw': { icon: '◼', color: '#f87171' },
  '.cr2': { icon: '◼', color: '#f87171' },
  '.nef': { icon: '◼', color: '#f87171' },
  '.arw': { icon: '◼', color: '#f87171' },
  '.json': { icon: '◻', color: '#00e5a0' },
  default: { icon: '·', color: '#535b6e' },
};

const FOLDER_COLORS = {
  'Historical': '#f59e0b',
  'Present_Neutral': '#60a5fa',
  'Pose_Variation_A': '#a78bfa',
  'Pose_Variation_B': '#f472b6',
};

function getFolderColor(name) {
  return FOLDER_COLORS[name] || '#00d4ff';
}

function getFileIcon(ext) {
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

export default function FileExplorer({ tree, rootPath, selectedPath, onSelectFolder }) {
  const [expandedPaths, setExpandedPaths] = useState(new Set([rootPath]));

  const toggleExpand = useCallback((path) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  if (!tree) return null;

  return (
    <div className="file-explorer">
      <div className="explorer-root-label mono">
        <span className="root-icon">⊞</span>
        <span className="root-name truncate" title={rootPath}>
          {tree.name}
        </span>
      </div>
      <div className="explorer-tree">
        {tree.children?.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            onToggle={toggleExpand}
            selectedPath={selectedPath}
            onSelectFolder={onSelectFolder}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, depth, expandedPaths, onToggle, selectedPath, onSelectFolder }) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedPath;

  const indent = depth * 14 + 10;

  if (node.type === 'folder') {
    const folderColor = getFolderColor(node.name);
    const imageCount = countImages(node);

    return (
      <div className="tree-folder-wrap">
        <div
          className={`tree-node tree-folder ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: indent }}
          onClick={() => {
            onToggle(node.path);
            onSelectFolder(node);
          }}
          title={node.path}
        >
          <span className="tree-toggle">
            {node.children?.length ? (isExpanded ? '▾' : '▸') : '·'}
          </span>
          <span className="tree-folder-icon" style={{ color: folderColor }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="tree-name truncate">{node.name}</span>
          {imageCount > 0 && (
            <span className="tree-badge">{imageCount}</span>
          )}
        </div>
        {isExpanded && node.children?.map(child => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            selectedPath={selectedPath}
            onSelectFolder={onSelectFolder}
          />
        ))}
      </div>
    );
  }

  // File node
  const { icon, color } = getFileIcon(node.ext);
  return (
    <div
      className="tree-node tree-file"
      style={{ paddingLeft: indent + 16 }}
      title={node.path}
    >
      <span className="tree-file-icon" style={{ color }}>{icon}</span>
      <span className="tree-name truncate">{node.name}</span>
      <span className="tree-ext">{node.ext}</span>
    </div>
  );
}

function countImages(node) {
  if (node.type === 'file') return node.isImage ? 1 : 0;
  return (node.children || []).reduce((sum, c) => sum + countImages(c), 0);
}
