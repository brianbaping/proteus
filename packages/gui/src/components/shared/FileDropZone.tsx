import React, { useState, useCallback } from "react";

interface FileDropZoneProps {
  onFilePath(path: string): void;
  accept?: string;
  label?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export function FileDropZone({ onFilePath, accept, label, filters }: FileDropZoneProps): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      // Electron provides the full path on the File object
      const filePath = (file as File & { path?: string }).path;
      if (filePath) {
        onFilePath(filePath);
      }
    }
  }, [onFilePath]);

  async function handleClick(): Promise<void> {
    try {
      const path = await window.electronAPI.openFile(filters);
      if (path) onFilePath(path);
    } catch (err) {
      console.error("File picker failed:", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
        dragOver
          ? "border-green bg-green-dark"
          : "border-border-2 hover:border-green/30"
      }`}
    >
      <div className="text-fg-muted text-2xs">
        {label ?? `Drop ${accept ?? ".pdf, .md, or .txt"} files or click to browse`}
      </div>
    </button>
  );
}
