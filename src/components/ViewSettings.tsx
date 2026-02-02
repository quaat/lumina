
import React from 'react';
import { Settings2, Layers, Palette, Maximize, Keyboard, Monitor, Activity, Eye, Brain } from 'lucide-react';
import { ViewMode, ColorMode, HighwaySettings } from '../types';
import { AnalysisSettings } from '../analysis/analysisTypes';

interface ViewSettingsProps {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  colorMode: ColorMode;
  onColorModeChange: (m: ColorMode) => void;
  highwaySettings: HighwaySettings;
  onUpdateHighwaySettings: (s: HighwaySettings) => void;
  analysisSettings: AnalysisSettings;
  onUpdateAnalysisSettings: (s: AnalysisSettings) => void;
  onToggleFullscreen: () => void;
}

const ViewSettings: React.FC<ViewSettingsProps> = ({
  viewMode,
  onViewModeChange,
  colorMode,
  onColorModeChange,
  highwaySettings,
  onUpdateHighwaySettings,
  analysisSettings,
  onUpdateAnalysisSettings,
  onToggleFullscreen
}) => {
  return (
    <div className="absolute top-4 right-20 z-40 flex items-center gap-2">
      <button 
        onClick={onToggleFullscreen}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface/90 backdrop-blur border border-zinc-800 rounded-lg shadow-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Enter Visualization Only Mode"
      >
        <Maximize size={16} />
      </button>

      <div className="group relative">
        <button 
          className="flex items-center gap-2 px-3 py-1.5 bg-surface/90 backdrop-blur border border-zinc-800 rounded-lg shadow-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          title="View Settings"
        >
          <Settings2 size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">View</span>
        </button>

        {/* Dropdown Menu */}
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right max-h-[80vh] overflow-y-auto custom-scrollbar">
          
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

          {/* Analysis Settings */}
           <div className="mb-4 pt-3 border-t border-zinc-800">
             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
               <Activity size={12} /> Harmonic Analysis
             </label>
             
             <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Show Chords</span>
                  <button 
                    onClick={() => onUpdateAnalysisSettings({...analysisSettings, enabledChord: !analysisSettings.enabledChord})}
                    className={`w-8 h-4 rounded-full transition-colors relative ${analysisSettings.enabledChord ? 'bg-accent' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${analysisSettings.enabledChord ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Show Patterns</span>
                  <button 
                    onClick={() => onUpdateAnalysisSettings({...analysisSettings, enabledPattern: !analysisSettings.enabledPattern})}
                    className={`w-8 h-4 rounded-full transition-colors relative ${analysisSettings.enabledPattern ? 'bg-accent' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${analysisSettings.enabledPattern ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="mt-2">
                   <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-1">
                      <Eye size={10} /> Scope
                   </div>
                   <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                      <button
                        onClick={() => onUpdateAnalysisSettings({...analysisSettings, scope: 'all'})}
                        className={`flex-1 text-[10px] py-1 rounded transition-colors ${analysisSettings.scope === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => onUpdateAnalysisSettings({...analysisSettings, scope: 'visible'})}
                        className={`flex-1 text-[10px] py-1 rounded transition-colors ${analysisSettings.scope === 'visible' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Visible Only
                      </button>
                   </div>
                </div>
             </div>
           </div>

          {/* Highway Specific Settings */}
          {viewMode === 'highway' && (
            <div className="space-y-3 pt-3 border-t border-zinc-800">
               <div className="flex justify-between items-center mb-1">
                 <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Monitor size={12} /> 3D Settings
                 </label>
               </div>
               
               {/* Keyboard Mode Toggle */}
               <div className="mb-2">
                 <label className="text-[10px] text-zinc-400 mb-1 block flex items-center gap-1">
                   <Keyboard size={10} /> Keyboard Style
                 </label>
                 <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                   <button
                     onClick={() => onUpdateHighwaySettings({...highwaySettings, keyboardMode: '3d'})}
                     className={`flex-1 text-[10px] py-1 rounded transition-colors ${highwaySettings.keyboardMode === '3d' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                   >
                     3D (Persp)
                   </button>
                   <button
                     onClick={() => onUpdateHighwaySettings({...highwaySettings, keyboardMode: '2d'})}
                     className={`flex-1 text-[10px] py-1 rounded transition-colors ${highwaySettings.keyboardMode === '2d' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                   >
                     2D (Flat)
                   </button>
                 </div>
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
