import React, { useState, useEffect, useRef, useCallback } from 'react';
import { parseMidiFile } from './services/midiParser';
import { webMidiService } from './services/webMidiService';
import Sidebar from './components/Sidebar';
import PlaybackControls from './components/PlaybackControls';
import PianoRoll from './components/PianoRoll';
import { MidiData, MidiOutputDevice, MidiOutputSettings, MidiTrack } from './types';
import { Loader2 } from 'lucide-react';

// Scheduler constants
const LOOKAHEAD = 100; // ms to look ahead
const SCHEDULE_INTERVAL = 25; // ms frequency of scheduler

const App: React.FC = () => {
  // --- STATE ---
  const [midiData, setMidiData] = useState<MidiData | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // For UI only
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set()); // trackId:noteNumber

  // MIDI Output State
  const [midiDevices, setMidiDevices] = useState<MidiOutputDevice[]>([]);
  const [outputSettings, setOutputSettings] = useState<MidiOutputSettings>({
    deviceId: null,
    outputChannel: 'original',
    latencyCompensation: 0
  });

  // --- REFS (Mutable state for Audio Scheduler) ---
  const startTimeRef = useRef<number>(0); // When playback *started* relative to AudioContext time
  const pauseTimeRef = useRef<number>(0); // Where we were in the song when paused
  const nextNoteIndexRefs = useRef<number[]>([]); // Per track pointer to next note to schedule
  const schedulerTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeNotesRef = useRef<Map<string, number>>(new Map()); // Key: track:note, Value: NoteOff Time

  // --- INITIALIZATION ---
  useEffect(() => {
    webMidiService.initialize()
      .then(() => {
        setMidiDevices(webMidiService.getOutputs());
      })
      .catch((err) => console.warn("WebMIDI not available:", err));
  }, []);

  // --- SCHEDULER LOGIC ---
  
  // The monotonic clock source
  const getNow = () => performance.now();

  const scheduleNotes = useCallback(() => {
    if (!midiData || !isPlaying) return;

    const now = getNow();
    // Calculate current song time in seconds
    // (Now - StartTimestamp) * Rate
    const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
    
    // Look ahead window end time
    const lookAheadTime = songTime + (LOOKAHEAD / 1000) * playbackRate;

    // Schedule notes for each track
    midiData.tracks.forEach((track, trackIdx) => {
      if (track.isMuted) return;

      let nextIndex = nextNoteIndexRefs.current[trackIdx];
      
      while (nextIndex < track.notes.length) {
        const note = track.notes[nextIndex];
        
        // If note is beyond lookahead window, stop checking this track
        if (note.time > lookAheadTime) break;

        // If note is in the past (handled already or skipped via seek), just increment
        if (note.time + note.duration < songTime) {
           nextIndex++;
           continue;
        }

        // Schedule Note ON
        // Schedule Time = now + (timeUntilNote * rate_adjustment)
        // timeUntilNote = note.time - songTime
        
        // We only schedule if we haven't already passed the start time significantly
        // or if it's within the window.
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
               
               // Schedule Note OFF
               const durationScaled = note.duration / playbackRate;
               const offTime = absoluteScheduleTime + (durationScaled * 1000);
               webMidiService.sendNoteOff(
                 outputSettings.deviceId,
                 outputSettings.outputChannel === 'original' ? track.channel + 1 : outputSettings.outputChannel as number,
                 note.midi,
                 offTime
               );
            }
            
            // Visual feedback scheduling (approximate)
            const id = `${track.id}:${note.midi}`;
            // Set active state for visualizer
            // We use a separate setTimeout for React state updates to not block the scheduler
            const delayMs = Math.max(0, (note.time - songTime) * 1000 / playbackRate);
            const durationMs = (note.duration * 1000) / playbackRate;
            
            // Note On Visual
            setTimeout(() => {
                setActiveNotes(prev => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                });
            }, delayMs);

            // Note Off Visual
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

  // --- LOOPS ---

  // 1. Audio Scheduler Loop (High Priority, pure JS)
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

  // 2. UI Update Loop (RAF, syncs UI slider/time text)
  useEffect(() => {
    if (!isPlaying) return;

    const loop = () => {
      const now = getNow();
      const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
      setCurrentTime(songTime);
      
      // Auto-stop at end
      if (midiData && songTime >= midiData.duration) {
        handleStop();
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
    handleStop(); // Reset everything
    try {
      const parsed = await parseMidiFile(file);
      setMidiData(parsed);
      // Reset pointers
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

    if (isPlaying) {
      // Pause
      setIsPlaying(false);
      // Panic output
      if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
      
      // Save where we are
      const now = getNow();
      const songTime = ((now - startTimeRef.current) / 1000) * playbackRate;
      pauseTimeRef.current = songTime;
      setActiveNotes(new Set()); // Clear visuals

    } else {
      // Play
      // Calculate new Start Time so that (Now - Start) = PauseTime
      // Start = Now - PauseTime
      // We divide pauseTime by rate because startTime is used in the formula: (Now - Start) * Rate
      // So effectively: Start = Now - (PauseTime / Rate * 1000) -- wait, math.
      // Target: songTime = (Now - Start) * Rate / 1000
      // PauseTime = (Now - Start) * Rate / 1000
      // Start = Now - (PauseTime * 1000 / Rate)
      
      const now = getNow();
      startTimeRef.current = now - (pauseTimeRef.current * 1000 / playbackRate);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    setActiveNotes(new Set());
    
    // Reset pointers
    if (midiData) {
      nextNoteIndexRefs.current = new Array(midiData.tracks.length).fill(0);
    }
  };

  const handleSeek = (time: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
        setIsPlaying(false);
        if (outputSettings.deviceId) webMidiService.panic(outputSettings.deviceId, outputSettings.outputChannel);
    }

    pauseTimeRef.current = time;
    setCurrentTime(time);
    setActiveNotes(new Set());

    // Reset pointers based on new time
    if (midiData) {
      nextNoteIndexRefs.current = midiData.tracks.map(t => {
        // Find the first note index where note.time >= time
        const idx = t.notes.findIndex(n => n.time + n.duration >= time);
        return idx === -1 ? t.notes.length : idx;
      });
    }

    if (wasPlaying) {
        // Resume immediately
        const now = getNow();
        startTimeRef.current = now - (time * 1000 / playbackRate);
        setIsPlaying(true);
    }
  };
  
  const handleRateChange = (rate: number) => {
      // If changing rate while playing, we need to adjust startTime so there is no jump
      if (isPlaying) {
          const now = getNow();
          // Current song time should remain constant across the rate change
          const currentSongTime = ((now - startTimeRef.current) / 1000) * playbackRate;
          
          // New Start Time logic:
          // currentSongTime = (now - newStart) * newRate / 1000
          // now - newStart = currentSongTime * 1000 / newRate
          // newStart = now - (currentSongTime * 1000 / newRate)
          
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
        midiDevices={midiDevices}
        settings={outputSettings}
        onUpdateSettings={setOutputSettings}
        onToggleTrackMute={toggleTrackMute}
        onToggleTrackHide={toggleTrackHide}
        onFileUpload={handleFileUpload}
      />

      <div className="flex-1 flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
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
            />
          )}
        </div>

        <PlaybackControls 
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={midiData?.duration || 0}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onSeek={handleSeek}
          playbackRate={playbackRate}
          onRateChange={handleRateChange}
        />
      </div>
    </div>
  );
};

export default App;
