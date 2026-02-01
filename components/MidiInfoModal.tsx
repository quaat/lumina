import React from 'react';
import { MidiData } from '../types';
import { X, Clock, Music, List, Activity } from 'lucide-react';

interface MidiInfoModalProps {
  midiData: MidiData;
  onClose: () => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const MidiInfoModal: React.FC<MidiInfoModalProps> = ({ midiData, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="text-primary" />
              MIDI Properties
            </h2>
            <p className="text-zinc-400 text-sm mt-1">{midiData.header.name || "Untitled MIDI"}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
              <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock size={12} /> Duration
              </div>
              <div className="text-2xl font-mono text-zinc-200">{formatTime(midiData.duration)}</div>
            </div>
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
               <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Music size={12} /> Tracks
              </div>
              <div className="text-2xl font-mono text-zinc-200">{midiData.tracks.length}</div>
            </div>
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
               <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Activity size={12} /> Initial BPM
              </div>
              <div className="text-2xl font-mono text-zinc-200">{Math.round(midiData.header.tempo)}</div>
            </div>
          </div>

          {/* Time Signatures */}
          {midiData.header.timeSignatures.length > 0 && (
             <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                  <List size={16} /> Time Signatures
                </h3>
                <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 bg-zinc-950 uppercase">
                      <tr>
                         <th className="px-4 py-2">Time</th>
                         <th className="px-4 py-2">Signature</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {midiData.header.timeSignatures.map((ts, i) => (
                        <tr key={i} className="hover:bg-zinc-800/30">
                          <td className="px-4 py-2 font-mono text-zinc-400">{formatTime(ts.time)}</td>
                          <td className="px-4 py-2 text-zinc-200">{ts.numerator} / {ts.denominator}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

          {/* Tempo Map */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Activity size={16} /> Tempo Map ({midiData.header.tempos.length} changes)
            </h3>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 bg-zinc-950 uppercase sticky top-0">
                    <tr>
                       <th className="px-4 py-2">Time</th>
                       <th className="px-4 py-2">BPM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {midiData.header.tempos.map((t, i) => (
                      <tr key={i} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-2 font-mono text-zinc-400">{formatTime(t.time)}</td>
                        <td className="px-4 py-2 text-secondary font-medium">{Math.round(t.bpm * 10) / 10}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>

        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MidiInfoModal;
