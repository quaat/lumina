
import { MidiNote } from '../types';

export const detectPattern = (notes: MidiNote[]): { label: string; confidence: number } | null => {
  if (notes.length < 3) return null;

  // Ensure sorted by time
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  
  // Extract pitches
  const pitches = sorted.map(n => n.midi);
  
  // 1. Check for Arpeggios (Strict direction)
  let isUp = true;
  let isDown = true;
  
  for (let i = 1; i < pitches.length; i++) {
    if (pitches[i] <= pitches[i-1]) isUp = false;
    if (pitches[i] >= pitches[i-1]) isDown = false;
  }
  
  if (isUp) return { label: 'Arpeggio (Up)', confidence: 0.9 };
  if (isDown) return { label: 'Arpeggio (Down)', confidence: 0.9 };

  // 2. Check for Arpeggio (Up-Down or Down-Up)
  // Simple heuristic: check if peaks are in the middle
  let directions = 0; // count direction changes
  let lastDir = 0; // 1 up, -1 down
  
  for (let i = 1; i < pitches.length; i++) {
     const diff = pitches[i] - pitches[i-1];
     if (diff === 0) continue;
     const dir = diff > 0 ? 1 : -1;
     if (lastDir !== 0 && dir !== lastDir) {
         directions++;
     }
     lastDir = dir;
  }
  
  if (directions > 0 && directions <= 2) {
      return { label: 'Broken Chord', confidence: 0.8 };
  }

  // 3. Octaves (Alternating bass)
  // Check if notes oscillate between same pitch class with > 10 semitone diff
  if (pitches.length >= 3) {
      let isOctave = true;
      for (let i = 2; i < pitches.length; i++) {
          // Check if n matches n-2 (alternating)
          if (pitches[i] % 12 !== pitches[i-2] % 12) isOctave = false;
      }
      if (isOctave) {
          // Check span
          const minP = Math.min(...pitches);
          const maxP = Math.max(...pitches);
          if (maxP - minP >= 12) return { label: 'Octave Bass', confidence: 0.85 };
      }
  }
  
  // 4. Alberti Bass-ish (Lowest, Highest, Middle, Highest)
  // 1-5-3-5 pattern approx
  if (pitches.length >= 4) {
      const slice = pitches.slice(0, 4);
      const min = Math.min(...slice);
      const max = Math.max(...slice);
      
      // First note is lowest?
      if (slice[0] === min && slice[0] !== max) {
          // Check for oscillation
          // Often Low - High - Mid - High
          if (slice[1] === max || slice[3] === max) {
             return { label: 'Alberti Bass', confidence: 0.7 };
          }
      }
  }

  return null;
};
