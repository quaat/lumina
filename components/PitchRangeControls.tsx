import React from 'react';
import { ZoomIn, ZoomOut, Maximize, RefreshCcw, ScanLine } from 'lucide-react';

interface PitchRangeControlsProps {
  range: { min: number; max: number };
  autoFit: boolean;
  onToggleAutoFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullRange: () => void;
  noteToName: (midi: number) => string;
}

const PitchRangeControls: React.FC<PitchRangeControlsProps> = ({
  range,
  autoFit,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onReset,
  onFullRange,
  noteToName
}) => {
  return (
    <div className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-surface/90 backdrop-blur border border-zinc-800 rounded-lg p-1.5 shadow-xl">
      <button
        onClick={onToggleAutoFit}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          autoFit 
            ? 'bg-primary/20 text-primary border border-primary/30' 
            : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700 hover:text-zinc-200'
        }`}
        title="Automatically fit to played notes"
      >
        <ScanLine size={14} />
        Auto-Fit
      </button>

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      <button
        onClick={onZoomOut}
        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
        title="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>

      <button
        onClick={onZoomIn}
        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
        title="Zoom In"
      >
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      <button
        onClick={onReset}
        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
        title="Reset to Content"
      >
        <RefreshCcw size={14} />
      </button>
      
      <button
        onClick={onFullRange}
        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
        title="Full Piano Range (88 keys)"
      >
        <Maximize size={14} />
      </button>

      <div className="ml-2 px-2 py-1 bg-zinc-950 rounded border border-zinc-800 text-[10px] font-mono text-zinc-500 min-w-[120px] text-center">
        {noteToName(range.min)} - {noteToName(range.max)} ({range.max - range.min + 1} keys)
      </div>
    </div>
  );
};

export default PitchRangeControls;
