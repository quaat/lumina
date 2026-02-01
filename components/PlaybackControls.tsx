import React from 'react';
import { Play, Pause, Square, SkipBack, Rewind, FastForward } from 'lucide-react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  playbackRate: number;
  onRateChange: (rate: number) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
  playbackRate,
  onRateChange
}) => {
  return (
    <div className="h-16 bg-surface border-t border-zinc-800 flex items-center px-4 justify-between select-none">
      {/* Time Display */}
      <div className="w-24 text-sm font-mono text-zinc-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      {/* Main Transport */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onStop}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
          title="Stop"
        >
          <Square size={20} fill="currentColor" />
        </button>
        
        <button 
          onClick={() => onSeek(Math.max(0, currentTime - 5))}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Rewind size={20} />
        </button>

        <button 
          onClick={onPlayPause}
          className="p-4 bg-primary rounded-full text-white hover:bg-blue-600 shadow-lg shadow-blue-900/50 transition-all hover:scale-105 active:scale-95"
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </button>

        <button 
          onClick={() => onSeek(Math.min(duration, currentTime + 5))}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <FastForward size={20} />
        </button>
      </div>

      {/* Rate & Scrubber */}
      <div className="flex items-center gap-6 w-1/3">
        <div className="flex flex-col w-full group">
           <input 
            type="range" 
            min="0" 
            max={duration || 1} 
            step="0.1"
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-blue-400"
          />
        </div>
        
        <select 
          value={playbackRate}
          onChange={(e) => onRateChange(parseFloat(e.target.value))}
          className="bg-zinc-800 text-zinc-300 text-xs py-1 px-2 rounded border border-zinc-700 focus:outline-none focus:border-primary"
        >
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1">1.0x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2.0x</option>
        </select>
      </div>
    </div>
  );
};

export default PlaybackControls;
