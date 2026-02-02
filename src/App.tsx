
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { parseMidiFile } from './services/midiParser';
import { webMidiService } from './services/webMidiService';
import Sidebar from './components/Sidebar';
import PlaybackControls from './components/PlaybackControls';
import PianoRoll from './components/PianoRoll';
import MidiInfoModal from './components/MidiInfoModal';
import PitchRangeControls from './components/PitchRangeControls';
import ViewSettings from './components/ViewSettings';
import AnalysisOverlay from './components/AnalysisOverlay';
import { MidiData, MidiOutputDevice, MidiInputDevice, MidiOutputSettings, ViewMode, ColorMode, HighwaySettings } from './types';
import { AnalysisSettings, AnalysisResult } from './analysis/analysisTypes';
import { analyzeTimeline } from './analysis/analyzeTimeline';
import { Loader2, Bug, TestTube, Minimize, Play, Pause } from 'lucide-react';
import { DEFAULT_MIN_KEY, DEFAULT_MAX_KEY } from './services/KeyLayout';

// Scheduler constants
const LOOKAHEAD = 100; // ms to look ahead
const SCHEDULE_INTERVAL = 25; // ms frequency of scheduler

// Constants for Zoom
const MIN_SPAN = 12; // Minimum 1 octave
const PADDING = 4; // Semitones padding for auto-fit

// Undo/Redo State shape
interface PlaybackHistoryState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiToNoteName = (midi: number) => {
  const note = noteNames[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
};

const App: React.FC = () => {
  // --- STATE ---
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Viewport / Zoom State
  const [displayRange, setDisplayRange] = useState({ min: DEFAULT_MIN_KEY, max: DEFAULT_MAX_KEY });
  const [autoFit, setAutoFit] = useState(true);

  // Visualization Modes
  const [viewMode, setViewMode] = useState<ViewMode>('highway');
  const [colorMode, setColorMode] = useState<ColorMode>('note');
  const [highwaySettings, setHighwaySettings] = useState<HighwaySettings>({
      lookahead: 4.0,
      farScale: 0.25,
      laneShading: true,
      cameraHeight: 0.5,
      laneContrast: 0.5,
      keyboardMode: '3d'
  });
  
  // Analysis State
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings>({
    enabledChord: true,
    enabledPattern: true,
    scope: 'all', // default to analyze all tracks
    complexity: 'basic',
    leftHandSplit: 60
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Fullscreen State
  const [isVizFullscreen, setIsVizFullscreen] = useState(false);
  const vizContainerRef = useRef<HTMLDivElement>(null);

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

  // --- REFS ---
  const startTimeRef = useRef<number>(0); 
  const pauseTimeRef = useRef<number>(0); 
  const nextNoteIndexRefs = useRef<number[]>([]); 
  const schedulerTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // --- ANALYSIS TRIGGER ---
  useEffect(() => {
    if (midiData) {
      // Re-run analysis when data or settings (that affect logic) change
      // Note: toggleTrackHide updates midiData, so this effect runs automatically
      const result = analyzeTimeline(midiData, analysisSettings);
      setAnalysisResult(result);
    } else {
      setAnalysisResult(null);
    }
  }, [midiData, analysisSettings]);

  // --- FULLSCREEN LOGIC ---
  const toggleFullscreen = () => {
    const doc = document as any;
    const el = vizContainerRef.current as any;
    
    const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!isFullscreen) {
        if (el) {
            const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
            if (req) {
                req.call(el).catch((err: any) => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            }
        }
    } else {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exit) {
            exit.call(doc);
        }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
        const doc = document as any;
        const isFullscreen = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
        setIsVizFullscreen(isFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // --- ZOOM / AUTO-FIT LOGIC ---

  const computeAutoFitRange = useCallback((data: MidiData) => {
    let min = data.pitchRange.min - PADDING;
    let max = data.pitchRange.max + PADDING;

    // Ensure minimum span
    if (max - min < MIN_SPAN) {
        const center = (min + max) / 2;
        min = Math.floor(center - MIN_SPAN / 2);
        max = Math.ceil(center + MIN_SPAN / 2);
    }

    // Clamp to valid MIDI (0-127)
    min = Math.max(0, min);
    max = Math.min(127, max);
    
    return { min, max };
  }, []);

  const handleZoom = (direction: 'in' | 'out') => {
    // If auto-fit is on, disable it when user manually zooms
    if (autoFit) setAutoFit(false);

    const currentSpan = displayRange.max - displayRange.min;
    const center = (displayRange.min + displayRange.max) / 2;
    
    let newSpan = direction === 'in' ? currentSpan * 0.8 : currentSpan * 1.25;
    
    // Limits
    if (newSpan < MIN_SPAN) newSpan = MIN_SPAN;
    if (newSpan > 128) newSpan = 128;

    let newMin = Math.floor(center - newSpan / 2);
    let newMax = Math.ceil(center + newSpan / 2);

    // Clamp
    if (newMin < 0) {
        newMin = 0;
        newMax = Math.min(127, newMin + newSpan);
    }
    if (newMax > 127) {
        newMax = 127;
        newMin = Math.max(0, newMax - newSpan);
    }

    setDisplayRange({ min: newMin, max: newMax });
  };

  const handleResetFit = () => {
    if (midiData) {
        setDisplayRange(computeAutoFitRange(midiData));
        setAutoFit(true);
    } else {
        setDisplayRange({ min: DEFAULT_MIN_KEY, max: DEFAULT_MAX_KEY });
    }
  };

  const handleFullRange = () => {
      setAutoFit(false);
      setDisplayRange({ min: DEFAULT_MIN_KEY, max: DEFAULT_MAX_KEY });
  };

  // --- DEBUG / TEST ---
  const loadTestPattern = () => {
    handleStop(false);
    
    const MIN_TEST = 48;
    const MAX_TEST = 72;

    const notes = [];
    for (let i = MIN_TEST; i <= MAX_TEST; i++) {
        notes.push({
            midi: i,
            time: (i - MIN_TEST) * 0.2,
            duration: 0.15,
            velocity: 0.8,
            trackId: 0,
            name: `Note ${i}`
        });
    }

    const testMidi: MidiData = {
        header: {
            name: "Mid-Range Test Pattern",
            tempo: 120,
            timeSignatures: [],
            tempos: []
        },
        duration: (MAX_TEST - MIN_TEST) * 0.2 + 1,
        tracks: [{
            id: 0,
            name: "Mid Range Scale",
            instrument: "Test",
            channel: 0,
            color: "#3b82f6",
            notes: notes,
            isHidden: false,
            isMuted: false
        }],
        pitchRange: { min: MIN_TEST, max: MAX_TEST }
    };
    
    setMidiData(testMidi);
    
    // Auto-fit immediately for test pattern
    const fit = computeAutoFitRange(testMidi);
    setDisplayRange(fit);
    setAutoFit(true);

    setCurrentTime(0);
    pauseTimeRef.current = 0;
    nextNoteIndexRefs.current = [0];
  };

  // --- UNDO/REDO HELPERS ---
  const pushToHistory = useCallback(() => {
    const currentState: PlaybackHistoryState = {
      isPlaying,
      currentTime: pauseTimeRef.current || currentTime,
      playbackRate
    };
    setHistory(prev => [...prev.slice(-19), currentState]); 
    setFuture([]);
  }, [isPlaying, currentTime, playbackRate]);

  const performUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current: PlaybackHistoryState = { isPlaying, currentTime, playbackRate };
    
    setFuture(prev => [current, ...prev]);
    setHistory(prev => prev.slice(0, -1));

    setPlaybackRate(previous.playbackRate);
    
    if (isPlaying) {
        setIsPlaying(false);
        if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    }
    pauseTimeRef.current = previous.currentTime;
    setCurrentTime(previous.currentTime);
    resetPointers(previous.currentTime);

    if (previous.isPlaying) {
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
        
        if (outputSettings.deviceId) {
           webMidiService.sendNoteOn(outputSettings.deviceId, outputSettings.outputChannel === 'original' ? 1 : outputSettings.outputChannel as number, data1, data2);
        }
      } 
      // Note Off
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
      if (track.isHidden) return;
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
            
            if (!track.isMuted && outputSettings.deviceId) {
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
        handleStop(false); 
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
    setHistory([]);
    setFuture([]);
    try {
      const parsed = await parseMidiFile(file);
      setMidiData(parsed);
      nextNoteIndexRefs.current = new Array(parsed.tracks.length).fill(0);
      setCurrentTime(0);
      pauseTimeRef.current = 0;
      const fit = computeAutoFitRange(parsed);
      setDisplayRange(fit);
      setAutoFit(true);
    } catch (e) {
      alert("Failed to parse MIDI file.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!midiData) return;
    pushToHistory(); 
    if (isPlaying) {
      setIsPlaying(false);
      if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
      const now = getNow();
      const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
      pauseTimeRef.current = songTime;
      setActiveNotes(prev => {
          const next = new Set<string>();
          for (const n of prev) {
            if (n.startsWith('input:')) next.add(n);
          }
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
          const next = new Set<string>();
          for (const n of prev) {
            if (n.startsWith('input:')) next.add(n);
          }
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
          for (const n of prev) {
            if (n.startsWith('input:')) next.add(n);
          }
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
    if (outputSettings.deviceId && isPlaying) {
        webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    }
    const newTracks = [...midiData.tracks];
    const track = newTracks.find(t => t.id === id);
    if (track) track.isMuted = !track.isMuted;
    setMidiData({ ...midiData, tracks: newTracks });
  };

  const toggleTrackHide = (id: number) => {
    if (!midiData) return;
    const newTracks = [...midiData.tracks];
    const track = newTracks.find(t => t.id === id);
    if (track) {
        track.isHidden = !track.isHidden;
        if (track.isHidden) {
            setActiveNotes(prev => {
                const next = new Set(prev);
                Array.from(next).forEach((noteKey: string) => {
                    if (noteKey.startsWith(`${id}:`)) {
                        next.delete(noteKey);
                    }
                });
                return next;
            });
             if (outputSettings.deviceId && isPlaying) {
                webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
            }
        }
    }
    setMidiData({ ...midiData, tracks: newTracks });
  };

  return (
    <div className="flex h-screen w-screen bg-background text-zinc-100 overflow-hidden font-sans">
      {!isVizFullscreen && (
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
      )}
      
      {/* Debug Controls - Floating Right */}
      {!isVizFullscreen && (
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
      )}
      
      {/* View Settings Control */}
      {!isVizFullscreen && (
        <ViewSettings 
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          highwaySettings={highwaySettings}
          onUpdateHighwaySettings={setHighwaySettings}
          analysisSettings={analysisSettings}
          onUpdateAnalysisSettings={setAnalysisSettings}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      <div className="flex-1 flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        )}

        {showInfoModal && midiData && (
          <MidiInfoModal midiData={midiData} onClose={() => setShowInfoModal(false)} />
        )}

        {/* Visualization Container - Targeted for Fullscreen */}
        <div ref={vizContainerRef} className="flex-1 relative bg-zinc-950 flex flex-col">
          {!midiData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 m-8 rounded-2xl">
              <h2 className="text-2xl font-light mb-2 text-zinc-300">Welcome to Lumina</h2>
              <p>Upload a MIDI file in the sidebar to begin visualizing.</p>
            </div>
          ) : (
            <>
                <AnalysisOverlay 
                  result={analysisResult} 
                  currentTime={currentTime} 
                  enabled={analysisSettings.enabledChord || analysisSettings.enabledPattern}
                  visible={true} 
                />

                {!isVizFullscreen && (
                  <PitchRangeControls 
                      range={displayRange}
                      autoFit={autoFit}
                      onToggleAutoFit={() => {
                          if (!autoFit && midiData) setDisplayRange(computeAutoFitRange(midiData));
                          setAutoFit(!autoFit);
                      }}
                      onZoomIn={() => handleZoom('in')}
                      onZoomOut={() => handleZoom('out')}
                      onReset={handleResetFit}
                      onFullRange={handleFullRange}
                      noteToName={midiToNoteName}
                  />
                )}
                
                {isVizFullscreen && (
                  <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    <button
                      onClick={handlePlayPause}
                      className="p-3 bg-primary/90 hover:bg-primary text-white rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                    </button>
                    
                    <button
                      onClick={toggleFullscreen}
                      className="p-3 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full backdrop-blur-sm transition-all"
                      title="Exit Fullscreen (Esc)"
                    >
                      <Minimize size={20} />
                    </button>
                  </div>
                )}

                <PianoRoll 
                  midiData={midiData}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  zoom={150} // Pixels per second
                  activeNotes={activeNotes}
                  debugMode={debugMode}
                  range={displayRange}
                  viewMode={viewMode}
                  colorMode={colorMode}
                  highwaySettings={highwaySettings}
                  isFullscreen={isVizFullscreen}
                />
            </>
          )}
        </div>

        {!isVizFullscreen && (
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
        )}
      </div>
    </div>
  );
};

export default App;
