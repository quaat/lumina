
import { MidiData, MidiNote } from '../types';
import { AnalysisSettings, AnalysisResult, ChordSlice, PatternSlice } from './analysisTypes';
import { detectChord } from './chords';
import { detectPattern } from './patterns';

export const analyzeTimeline = (midiData: MidiData, settings: AnalysisSettings): AnalysisResult => {
  const result: AnalysisResult = { chords: [], patterns: [] };
  
  if (!settings.enabledChord && !settings.enabledPattern) return result;

  // 1. Filter Tracks
  // 'scope' logic: if 'visible', filter out hidden tracks.
  const activeTracks = midiData.tracks.filter(t => {
      if (settings.scope === 'visible' && t.isHidden) return false;
      return true;
  });

  const allNotes: MidiNote[] = [];
  activeTracks.forEach(t => allNotes.push(...t.notes));
  
  // Sort notes by time for efficient windowing (though we might just scan for now)
  allNotes.sort((a, b) => a.time - b.time);

  if (allNotes.length === 0) return result;

  // 2. Define Sampling Grid
  // We use the tempo map to step by 1/4 beats (approx)
  // or simple time stepping if tempo map is complex.
  // Let's use 0.25s steps for simplicity and stability, or derive from tempo.
  // Using Tempo Map for beat-synced analysis is better.
  
  const events = midiData.header.tempos;
  const timeSignature = midiData.header.timeSignatures[0] || { numerator: 4, denominator: 4 };
  const ppq = 480; // Assuming standard, but tonejs/midi handles ticks. 
  // We just need time.
  
  // Let's iterate through the song in small fixed time steps for robustness against tempo ramps
  const STEP = 0.125; // 1/8th second roughly
  const duration = midiData.duration;
  
  let currentChordSlice: ChordSlice | null = null;
  let currentPatternSlice: PatternSlice | null = null;

  for (let t = 0; t < duration; t += STEP) {
    const tEnd = t + STEP;
    
    // Window for Chord: What's sounding NOW?
    // Notes that started before tEnd and end after t
    // Also include notes that *just* started slightly before (arpeggio tolerance)
    const soundingNotes = allNotes.filter(n => {
        // Standard overlap: [n.time, n.time+dur] overlaps [t, tEnd]
        const nEnd = n.time + n.duration;
        return n.time < tEnd && nEnd > t;
    });

    // Window for Pattern: Look at LH onsets in the last beat approx (0.5s)
    const lhWindowStart = t - 0.5;
    const lhNotes = allNotes.filter(n => {
        return n.midi < settings.leftHandSplit && 
               n.time >= lhWindowStart && 
               n.time < tEnd; // Catch up to now
    });

    // --- CHORD DETECTION ---
    if (settings.enabledChord) {
        // Collect pitch classes
        const pcs = new Set<number>();
        let lowestMidi: number | null = null;

        soundingNotes.forEach(n => {
            pcs.add(n.midi % 12);
            if (lowestMidi === null || n.midi < lowestMidi) lowestMidi = n.midi;
        });

        // Heuristic: If note count is low, maybe look back a bit for arpeggiated chords
        if (pcs.size < 3) {
             const lookbackNotes = allNotes.filter(n => n.time >= t - 0.3 && n.time < tEnd);
             lookbackNotes.forEach(n => {
                 pcs.add(n.midi % 12);
                 if (lowestMidi === null || n.midi < lowestMidi) lowestMidi = n.midi;
             });
        }

        const detected = detectChord(pcs, lowestMidi);

        if (detected) {
            // Merge with previous if same
            if (currentChordSlice && currentChordSlice.label === detected.label) {
                currentChordSlice.end = tEnd;
            } else {
                if (currentChordSlice) result.chords.push(currentChordSlice);
                currentChordSlice = {
                    start: t,
                    end: tEnd,
                    label: detected.label,
                    root: detected.root,
                    bass: detected.bass,
                    confidence: detected.confidence
                };
            }
        } else {
             // Gap or N.C.
             if (currentChordSlice) {
                 result.chords.push(currentChordSlice);
                 currentChordSlice = null;
             }
        }
    }

    // --- PATTERN DETECTION ---
    if (settings.enabledPattern) {
        const detected = detectPattern(lhNotes);
        if (detected) {
            if (currentPatternSlice && currentPatternSlice.label === detected.label) {
                currentPatternSlice.end = tEnd;
            } else {
                 if (currentPatternSlice) result.patterns.push(currentPatternSlice);
                 currentPatternSlice = {
                     start: t,
                     end: tEnd,
                     label: detected.label,
                     confidence: detected.confidence
                 };
            }
        } else {
            if (currentPatternSlice) {
                 result.patterns.push(currentPatternSlice);
                 currentPatternSlice = null;
            }
        }
    }
  }

  // Push final slices
  if (currentChordSlice) result.chords.push(currentChordSlice);
  if (currentPatternSlice) result.patterns.push(currentPatternSlice);

  return result;
};
