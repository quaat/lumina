
import React, { useMemo } from 'react';
import { AnalysisResult, ChordSlice, PatternSlice } from '../analysis/analysisTypes';

interface AnalysisOverlayProps {
  result: AnalysisResult | null;
  currentTime: number;
  enabled: boolean;
  visible: boolean; // From global view settings (if we want to hide it completely)
}

const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ result, currentTime, enabled, visible }) => {
  if (!result || !enabled || !visible) return null;

  // Binary search or simple find (since N is small-ish for a song, find is okay for now, optimization later)
  const currentChord = result.chords.find(c => currentTime >= c.start && currentTime < c.end);
  const currentPattern = result.patterns.find(p => currentTime >= p.start && currentTime < p.end);

  if (!currentChord && !currentPattern) return null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
      {/* Chord Bubble */}
      {currentChord && (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full shadow-2xl animate-in fade-in zoom-in duration-200">
           <div className="flex items-baseline gap-1">
             <span className="text-3xl font-bold text-white tracking-tight shadow-black drop-shadow-md">
               {currentChord.label}
             </span>
             {/* Confidence dot */}
             <div 
               className={`w-2 h-2 rounded-full ml-2 ${currentChord.confidence > 0.8 ? 'bg-green-500' : 'bg-yellow-500'}`} 
               title={`Confidence: ${(currentChord.confidence * 100).toFixed(0)}%`}
             />
           </div>
        </div>
      )}

      {/* Pattern Bubble */}
      {currentPattern && (
        <div className="bg-black/30 backdrop-blur-sm border border-white/5 px-4 py-1 rounded-full shadow-lg">
          <span className="text-sm font-medium text-zinc-300 uppercase tracking-widest">
            {currentPattern.label}
          </span>
        </div>
      )}
    </div>
  );
};

export default AnalysisOverlay;
