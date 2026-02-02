
import React from 'react';
import { Settings2, Layers, Box, Eye, Palette } from 'lucide-react';
import { ViewMode, ColorMode, HighwaySettings } from '../types';

interface ViewSettingsProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  colorMode: ColorMode;
  onColorModeChange: (m: ColorMode) => void;
  highwaySettings: HighwaySettings;
  onUpdateHighwaySettings: (s: HighwaySettings) => void;
}

const ViewSettings: React.FC<ViewSettingsProps> = ({
  viewMode,
  onViewModeChange,
  colorMode,
  onColorModeChange,
  highwaySettings,
  onUpdateHighwaySettings
}) => {
  return (
    <div className="absolute top-4 right-20 z-40">
      <div className="group relative">
        <button 
          className="flex items-center gap-2 px-3 py-1.5 bg-surface/90 backdrop-blur border border-zinc-800 rounded-lg shadow-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          title="View Settings"
        >
          <Settings2 size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">View</span>
        </button>

        {/* Dropdown Menu */}
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right">
          
          {/* View Mode Toggle */}
          <div className="mb-4">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
              <Layers size={12} /> Projection
            </label>
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              <button
                onClick={() => onViewModeChange('classic')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${viewMode === 'classic' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                2D Scroll
              </button>
              <button
                onClick={() => onViewModeChange('highway')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${viewMode === 'highway' ? 'bg-primary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                3D Highway
              </button>
            </div>
          </div>

          {/* Color Mode Toggle */}
          <div className="mb-4">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
              <Palette size={12} /> Color By
            </label>
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              <button
                onClick={() => onColorModeChange('track')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${colorMode === 'track' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Track
              </button>
              <button
                onClick={() => onColorModeChange('note')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${colorMode === 'note' ? 'bg-secondary text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Note Name
              </button>
            </div>
          </div>

          {/* Highway Specific Settings */}
          {viewMode === 'highway' && (
            <div className="space-y-3 pt-3 border-t border-zinc-800">
               <div className="flex justify-between items-center mb-1">
                 <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">3D Settings</label>
               </div>
               
               <div>
                 <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                   <span>Lookahead</span>
                   <span>{highwaySettings.lookahead.toFixed(1)}s</span>
                 </div>
                 <input 
                   type="range" min="1" max="15" step="0.5"
                   value={highwaySettings.lookahead}
                   onChange={(e) => onUpdateHighwaySettings({...highwaySettings, lookahead: parseFloat(e.target.value)})}
                   className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                 />
               </div>

               <div>
                 <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                   <span>Perspective</span>
                   <span>{(highwaySettings.farScale * 100).toFixed(0)}%</span>
                 </div>
                 <input 
                   type="range" min="0.05" max="0.8" step="0.05"
                   value={highwaySettings.farScale}
                   onChange={(e) => onUpdateHighwaySettings({...highwaySettings, farScale: parseFloat(e.target.value)})}
                   className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                 />
               </div>
               
               <div>
                 <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                   <span>Lane Contrast</span>
                   <span>{((highwaySettings.laneContrast || 0.5) * 100).toFixed(0)}%</span>
                 </div>
                 <input 
                   type="range" min="0" max="1" step="0.1"
                   value={highwaySettings.laneContrast ?? 0.5}
                   onChange={(e) => onUpdateHighwaySettings({...highwaySettings, laneContrast: parseFloat(e.target.value)})}
                   className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                 />
               </div>

               <div className="flex items-center justify-between">
                 <span className="text-xs text-zinc-400">Lane Shading</span>
                 <button 
                   onClick={() => onUpdateHighwaySettings({...highwaySettings, laneShading: !highwaySettings.laneShading})}
                   className={`w-8 h-4 rounded-full transition-colors relative ${highwaySettings.laneShading ? 'bg-primary' : 'bg-zinc-700'}`}
                 >
                   <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${highwaySettings.laneShading ? 'translate-x-4' : 'translate-x-0'}`} />
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewSettings;
