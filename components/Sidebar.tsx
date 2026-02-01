import React from 'react';
import { MidiTrack, MidiOutputDevice, MidiInputDevice, MidiOutputSettings } from '../types';
import { Eye, EyeOff, Volume2, VolumeX, Music, Settings, Upload, Info } from 'lucide-react';

interface SidebarProps {
  tracks: MidiTrack[];
  midiDevices: MidiOutputDevice[];
  inputDevices: MidiInputDevice[];
  settings: MidiOutputSettings;
  selectedInputId: string | null;
  onUpdateSettings: (s: MidiOutputSettings) => void;
  onUpdateInput: (id: string | null) => void;
  onToggleTrackMute: (id: number) => void;
  onToggleTrackHide: (id: number) => void;
  onFileUpload: (file: File) => void;
  onShowInfo: () => void;
  hasMidiData: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  tracks,
  midiDevices,
  inputDevices,
  settings,
  selectedInputId,
  onUpdateSettings,
  onUpdateInput,
  onToggleTrackMute,
  onToggleTrackHide,
  onFileUpload,
  onShowInfo,
  hasMidiData
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-80 h-full bg-surface border-r border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
            <Music size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Lumina
          </h1>
          {hasMidiData && (
            <button 
              onClick={onShowInfo}
              className="ml-auto p-1.5 text-zinc-400 hover:text-primary hover:bg-zinc-800 rounded transition-colors"
              title="File Info"
            >
              <Info size={16} />
            </button>
          )}
        </div>

        <label className="flex items-center justify-center w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 rounded-md cursor-pointer border border-zinc-700 transition-colors">
          <Upload size={16} className="mr-2" />
          Import MIDI
          <input type="file" accept=".mid,.midi" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      {/* Settings */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
          <Settings size={14} />
          <span className="font-semibold tracking-wider uppercase text-[10px]">Settings</span>
        </div>
        
        <div className="space-y-4">
          {/* Output Section */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1 font-medium">MIDI Output</label>
            <select 
              value={settings.deviceId || ''}
              onChange={(e) => onUpdateSettings({ ...settings, deviceId: e.target.value })}
              className="w-full bg-zinc-950 text-zinc-300 text-xs p-2 rounded border border-zinc-800 focus:border-primary outline-none"
            >
              <option value="">-- No Output (Visual Only) --</option>
              {midiDevices.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            
            <div className="flex gap-2 mt-2">
               <div className="flex-1">
                  <label className="block text-[10px] text-zinc-600 mb-1">Channel</label>
                  <select 
                    value={settings.outputChannel}
                    onChange={(e) => onUpdateSettings({ ...settings, outputChannel: e.target.value === 'original' ? 'original' : parseInt(e.target.value) })}
                    className="w-full bg-zinc-950 text-zinc-300 text-xs p-1.5 rounded border border-zinc-800 focus:border-primary outline-none"
                  >
                    <option value="original">Keep Original</option>
                    {[...Array(16)].map((_, i) => (
                      <option key={i} value={i + 1}>Ch {i + 1}</option>
                    ))}
                  </select>
               </div>
               <div className="flex-1">
                  <label className="block text-[10px] text-zinc-600 mb-1">Latency ({settings.latencyCompensation}ms)</label>
                  <input 
                    type="range" min="-100" max="200" step="10"
                    value={settings.latencyCompensation}
                    onChange={(e) => onUpdateSettings({...settings, latencyCompensation: parseInt(e.target.value)})}
                    className="w-full mt-2 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-500"
                  />
               </div>
            </div>
          </div>

          {/* Input Section */}
           <div>
            <label className="block text-xs text-zinc-500 mb-1 font-medium">MIDI Input (Remote Control)</label>
            <select 
              value={selectedInputId || ''}
              onChange={(e) => onUpdateInput(e.target.value || null)}
              className="w-full bg-zinc-950 text-zinc-300 text-xs p-2 rounded border border-zinc-800 focus:border-secondary outline-none"
            >
              <option value="">-- No Input --</option>
              {inputDevices.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
         <div className="px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Tracks ({tracks.length})
         </div>
         {tracks.length === 0 && (
           <div className="text-center p-8 text-zinc-600 text-sm italic">
             No tracks loaded.
           </div>
         )}
         {tracks.map(track => (
           <div key={track.id} className="group flex items-center p-2 rounded hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-800">
             <div 
               className="w-3 h-8 rounded-l mr-3" 
               style={{ backgroundColor: track.isMuted ? '#3f3f46' : track.color }}
             />
             <div className="flex-1 min-w-0">
               <div className="text-xs font-medium text-zinc-200 truncate">{track.name}</div>
               <div className="text-[10px] text-zinc-500 flex gap-2">
                 <span>{track.notes.length} notes</span>
                 <span>Ch {track.channel + 1}</span>
               </div>
             </div>
             
             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => onToggleTrackHide(track.id)}
                 className={`p-1.5 rounded hover:bg-zinc-700 ${track.isHidden ? 'text-zinc-600' : 'text-zinc-400'}`}
                 title="Toggle Visibility"
               >
                 {track.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
               </button>
               <button 
                 onClick={() => onToggleTrackMute(track.id)}
                 className={`p-1.5 rounded hover:bg-zinc-700 ${track.isMuted ? 'text-red-400' : 'text-zinc-400'}`}
                 title="Mute"
               >
                 {track.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
               </button>
             </div>
           </div>
         ))}
      </div>
    </div>
  );
};

export default Sidebar;
