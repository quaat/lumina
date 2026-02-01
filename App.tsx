import React, { useState, useEffect, useRef, useCallback } from 'react';
import { parseMidiFile } from './services/midiParser';
import { webMidiService } from './services/webMidiService';
import Sidebar from './components/Sidebar';
import PlaybackControls from './components/PlaybackControls';
import PianoRoll from './components/PianoRoll';
import MidiInfoModal from './components/MidiInfoModal';
import { MidiData, MidiOutputDevice, MidiInputDevice, MidiOutputSettings } from './types';
import { Loader2, Bug, TestTube } from 'lucide-react';
import { FIRST_KEY, KEYS_COUNT } from './services/KeyLayout';

// Scheduler constants
const LOOKAHEAD = 100; // ms to look ahead
const SCHEDULE_INTERVAL = 25; // ms frequency of scheduler

// Undo/Redo State shape
interface PlaybackHistoryState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
}

const App: React.FC = () => {
  // --- STATE ---
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // For UI only
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set()); // trackId:noteNumber
  
  // History State
  const [history, setHistory] = useState<PlaybackHistoryState[]>([]);
  const [future, setFuture] = useState<PlaybackHistoryState[]>([]);

  // MIDI Devices State
  const [midiOutputs, setMidiOutputs] = useState<MidiOutputDevice[]>([]);
  const [midiInputs, setMidiInputs] = useState<MidiInputDevice[]>([]);
  
  const [outputSettings, setOutputSettings] = useState<MidiOutputSettings>({
    deviceId: null,
    outputChannel: 'original',
    latencyCompensation: 0
  });
  const [inputId, setInputId] = useState<string | null>(null);

  // --- REFS (Mutable state for Audio Scheduler) ---
  const startTimeRef = useRef<number>(0); 
  const pauseTimeRef = useRef<number>(0); 
  const nextNoteIndexRefs = useRef<number[]>([]); 
  const schedulerTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // --- DEBUG / TEST ---
  const loadTestPattern = () => {
    handleStop(false);
    
    const notes = [];
    // Chromatic run from FIRST_KEY to end
    for (let i = 0; i < KEYS_COUNT; i++) {
        notes.push({
            midi: FIRST_KEY + i,
            time: i * 0.2,
            duration: 0.15,
            velocity: 0.8,
            trackId: 0,
            name: `Note ${FIRST_KEY + i}`
        });
    }

    const testMidi: MidiData = {
        header: {
            name: "Alignment Test Pattern",
            tempo: 120,
            timeSignatures: [],
            tempos: []
        },
        duration: KEYS_COUNT * 0.2 + 1,
        tracks: [{
            id: 0,
            name: "Chromatic Scale",
            instrument: "Test",
            channel: 0,
            color: "#3b82f6",
            notes: notes,
            isHidden: false,
            isMuted: false
        }]
    };
    
    setMidiData(testMidi);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
    nextNoteIndexRefs.current = [0];
  };

  // --- UNDO/REDO HELPERS ---
  const pushToHistory = useCallback(() => {
    const currentState: PlaybackHistoryState = {
      isPlaying,
      currentTime: pauseTimeRef.current || currentTime, // Use exact time
      playbackRate
    };
    setHistory(prev => [...prev.slice(-19), currentState]); // Keep last 20
    setFuture([]);
  }, [isPlaying, currentTime, playbackRate]);

  const performUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current: PlaybackHistoryState = { isPlaying, currentTime, playbackRate };
    
    setFuture(prev => [current, ...prev]);
    setHistory(prev => prev.slice(0, -1));

    // Apply State
    setPlaybackRate(previous.playbackRate);
    
    // Seek logic
    if (isPlaying) {
        setIsPlaying(false);
        if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    }
    pauseTimeRef.current = previous.currentTime;
    setCurrentTime(previous.currentTime);
    resetPointers(previous.currentTime);

    if (previous.isPlaying) {
        // Resume
        setTimeout(() => {
            const now = performance.now();
            startTimeRef.current = now - (previous.currentTime * 1000 / previous.playbackRate);
            setIsPlaying(true);
        }, 10);
    } else {
        setIsPlaying(false);
    }
  }, [history, isPlaying, currentTime, playbackRate, outputSettings, midiData]);

  const performRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const current: PlaybackHistoryState = { isPlaying, currentTime, playbackRate };
    
    setHistory(prev => [...prev, current]);
    setFuture(prev => prev.slice(1));

    // Apply State
    setPlaybackRate(next.playbackRate);
    
    if (isPlaying) {
        setIsPlaying(false);
        if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    }
    pauseTimeRef.current = next.currentTime;
    setCurrentTime(next.currentTime);
    resetPointers(next.currentTime);

    if (next.isPlaying) {
        setTimeout(() => {
            const now = performance.now();
            startTimeRef.current = now - (next.currentTime * 1000 / next.playbackRate);
            setIsPlaying(true);
        }, 10);
    } else {
        setIsPlaying(false);
    }
  }, [future, isPlaying, currentTime, playbackRate, outputSettings, midiData]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        performRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo]);


  // --- INITIALIZATION ---
  useEffect(() => {
    webMidiService.initialize()
      .then(() => {
        setMidiOutputs(webMidiService.getOutputs());
        setMidiInputs(webMidiService.getInputs());
      })
      .catch((err) => console.warn("WebMIDI not available:", err));
  }, []);

  // --- MIDI INPUT HANDLING ---
  useEffect(() => {
    webMidiService.setInput(inputId);

    const handleMidiMessage = (e: MIDIMessageEvent) => {
      if (!e.data) return;
      const [status, data1, data2] = e.data;
      const command = status & 0xF0;
      // const channel = status & 0x0F;

      // Transport Control (Realtime messages)
      if (status === 0xFA || status === 0xFB) { // Start or Continue
        if (!isPlaying) handlePlayPause();
      } else if (status === 0xFC) { // Stop
        handleStop();
      } 
      // Note On
      else if (command === 0x90 && data2 > 0) {
        const noteId = `input:${data1}`;
        setActiveNotes(prev => new Set(prev).add(noteId));
        
        // Thru to output?
        if (outputSettings.deviceId) {
           webMidiService.sendNoteOn(outputSettings.deviceId, outputSettings.outputChannel === 'original' ? 1 : outputSettings.outputChannel as number, data1, data2);
        }
      } 
      // Note Off (0x80 or 0x90 with vel 0)
      else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
        const noteId = `input:${data1}`;
        setActiveNotes(prev => {
            const next = new Set(prev);
            next.delete(noteId);
            return next;
        });
        
         if (outputSettings.deviceId) {
           webMidiService.sendNoteOff(outputSettings.deviceId, outputSettings.outputChannel === 'original' ? 1 : outputSettings.outputChannel as number, data1);
        }
      }
    };

    webMidiService.addMessageListener(handleMidiMessage);
    return () => webMidiService.removeMessageListener(handleMidiMessage);
  }, [inputId, isPlaying, outputSettings]); 

  // --- SCHEDULER ---
  const getNow = () => performance.now();

  const resetPointers = (time: number) => {
     if (midiData) {
      nextNoteIndexRefs.current = midiData.tracks.map(t => {
        const idx = t.notes.findIndex(n => n.time + n.duration >= time);
        return idx === -1 ? t.notes.length : idx;
      });
    }
  };

  const scheduleNotes = useCallback(() => {
    if (!midiData || !isPlaying) return;

    const now = getNow();
    const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
    const lookAheadTime = songTime + (LOOKAHEAD / 1000) * playbackRate;

    midiData.tracks.forEach((track, trackIdx) => {
      if (track.isMuted) return;

      let nextIndex = nextNoteIndexRefs.current[trackIdx];
      
      while (nextIndex < track.notes.length) {
        const note = track.notes[nextIndex];
        if (note.time > lookAheadTime) break;
        if (note.time + note.duration < songTime) {
           nextIndex++;
           continue;
        }

        if (note.time >= songTime - 0.1) {
            const timeUntilNote = (note.time - songTime) / playbackRate;
            const absoluteScheduleTime = now + (timeUntilNote * 1000) + outputSettings.latencyCompensation;
            
            if (outputSettings.deviceId) {
               webMidiService.sendNoteOn(
                 outputSettings.deviceId, 
                 outputSettings.outputChannel === 'original' ? track.channel + 1 : outputSettings.outputChannel as number,
                 note.midi, 
                 note.velocity,
                 absoluteScheduleTime
               );
               const durationScaled = note.duration / playbackRate;
               const offTime = absoluteScheduleTime + (durationScaled * 1000);
               webMidiService.sendNoteOff(
                 outputSettings.deviceId,
                 outputSettings.outputChannel === 'original' ? track.channel + 1 : outputSettings.outputChannel as number,
                 note.midi,
                 offTime
               );
            }
            
            const id = `${track.id}:${note.midi}`;
            const delayMs = Math.max(0, (note.time - songTime) * 1000 / playbackRate);
            const durationMs = (note.duration * 1000) / playbackRate;
            
            setTimeout(() => {
                setActiveNotes(prev => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                });
            }, delayMs);

            setTimeout(() => {
                setActiveNotes(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, delayMs + durationMs);
        }
        nextIndex++;
      }
      nextNoteIndexRefs.current[trackIdx] = nextIndex;
    });

  }, [midiData, isPlaying, playbackRate, outputSettings]);

  useEffect(() => {
    if (isPlaying) {
      schedulerTimerRef.current = window.setInterval(scheduleNotes, SCHEDULE_INTERVAL);
    } else {
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
    }
    return () => {
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
    };
  }, [isPlaying, scheduleNotes]);

  useEffect(() => {
    if (!isPlaying) return;
    const loop = () => {
      const now = getNow();
      const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
      setCurrentTime(songTime);
      if (midiData && songTime >= midiData.duration) {
        handleStop(false); // don't save history on auto-stop
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, midiData, playbackRate]);


  // --- HANDLERS ---

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    handleStop(false);
    // Clear history on new file
    setHistory([]);
    setFuture([]);
    
    try {
      const parsed = await parseMidiFile(file);
      setMidiData(parsed);
      nextNoteIndexRefs.current = new Array(parsed.tracks.length).fill(0);
      setCurrentTime(0);
      pauseTimeRef.current = 0;
    } catch (e) {
      alert("Failed to parse MIDI file.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!midiData) return;
    
    pushToHistory(); // Record state before toggle

    if (isPlaying) {
      setIsPlaying(false);
      if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
      const now = getNow();
      const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
      pauseTimeRef.current = songTime;
      setActiveNotes(prev => {
          // Keep input notes active, remove track notes
          const next = new Set<string>();
          prev.forEach(n => { if(n.startsWith('input:')) next.add(n); });
          return next;
      });
    } else {
      const now = getNow();
      startTimeRef.current = now - (pauseTimeRef.current * 1000 / playbackRate);
      setIsPlaying(true);
    }
  };

  const handleStop = (recordHistory = true) => {
    if (recordHistory) pushToHistory();
    
    setIsPlaying(false);
    if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    setActiveNotes(prev => {
          // Keep input notes active
          const next = new Set<string>();
          prev.forEach(n => { if(n.startsWith('input:')) next.add(n); });
          return next;
      });
    
    if (midiData) {
      nextNoteIndexRefs.current = new Array(midiData.tracks.length).fill(0);
    }
  };

  const handleSeek = (time: number) => {
    pushToHistory();

    const wasPlaying = isPlaying;
    if (wasPlaying) {
        setIsPlaying(false);
        if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    }

    pauseTimeRef.current = time;
    setCurrentTime(time);
    setActiveNotes(prev => {
          const next = new Set<string>();
          prev.forEach(n => { if(n.startsWith('input:')) next.add(n); });
          return next;
      });

    resetPointers(time);

    if (wasPlaying) {
        const now = getNow();
        startTimeRef.current = now - (time * 1000 / playbackRate);
        setIsPlaying(true);
    }
  };
  
  const handleRateChange = (rate: number) => {
      pushToHistory();

      if (isPlaying) {
          const now = getNow();
          const currentSongTime = ((now - startTimeRef.current) / 1000) * playbackRate;
          startTimeRef.current = now - (currentSongTime * 1000 / rate);
      }
      setPlaybackRate(rate);
  };

  const toggleTrackMute = (id: number) => {
    if (!midiData) return;
    const newTracks = [...midiData.tracks];
    const track = newTracks.find(t => t.id === id);
    if (track) track.isMuted = !track.isMuted;
    setMidiData({ ...midiData, tracks: newTracks });
  };

  const toggleTrackHide = (id: number) => {
    if (!midiData) return;
    const newTracks = [...midiData.tracks];
    const track = newTracks.find(t => t.id === id);
    if (track) track.isHidden = !track.isHidden;
    setMidiData({ ...midiData, tracks: newTracks });
  };

  return (
    <div className="flex h-screen w-screen bg-background text-zinc-100 overflow-hidden font-sans">
      <Sidebar 
        tracks={midiData?.tracks || []}
        midiDevices={midiOutputs}
        inputDevices={midiInputs}
        settings={outputSettings}
        selectedInputId={inputId}
        onUpdateSettings={setOutputSettings}
        onUpdateInput={setInputId}
        onToggleTrackMute={toggleTrackMute}
        onToggleTrackHide={toggleTrackHide}
        onFileUpload={handleFileUpload}
        onShowInfo={() => setShowInfoModal(true)}
        hasMidiData={!!midiData}
      />
      
      {/* Debug Controls - Floating */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
         <button 
           onClick={() => setDebugMode(!debugMode)}
           className={`p-2 rounded shadow-lg transition-colors ${debugMode ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
           title="Toggle Debug Overlay"
         >
           <Bug size={18} />
         </button>
         <button 
           onClick={loadTestPattern}
           className="p-2 bg-zinc-800 text-zinc-400 rounded shadow-lg hover:text-primary transition-colors"
           title="Load Alignment Test"
         >
           <TestTube size={18} />
         </button>
      </div>

      <div className="flex-1 flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        )}

        {showInfoModal && midiData && (
          <MidiInfoModal midiData={midiData} onClose={() => setShowInfoModal(false)} />
        )}

        <div className="flex-1 relative bg-zinc-950">
          {!midiData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 m-8 rounded-2xl">
              <h2 className="text-2xl font-light mb-2 text-zinc-300">Welcome to Lumina</h2>
              <p>Upload a MIDI file in the sidebar to begin visualizing.</p>
            </div>
          ) : (
            <PianoRoll 
              midiData={midiData}
              currentTime={currentTime}
              isPlaying={isPlaying}
              zoom={150} // Pixels per second
              activeNotes={activeNotes}
              debugMode={debugMode}
            />
          )}
        </div>

        <PlaybackControls 
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={midiData?.duration || 0}
          onPlayPause={handlePlayPause}
          onStop={() => handleStop(true)}
          onSeek={handleSeek}
          playbackRate={playbackRate}
          onRateChange={handleRateChange}
        />
      </div>
    </div>
  );
};

export default App;
