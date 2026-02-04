
import { MidiTrack } from '../types';

// Distinct colors for 12 pitch classes (C, C#, D...)
const PITCH_COLORS = [
  '#ff3434', // C  (Red)
  '#be185d', // C# (Pink-Magenta)
  '#f97316', // D  (Orange)
  '#8b570f', // D# (Yellow-Brown)
  '#eab308', // E  (Yellow)
  '#22c55e', // F  (Green)
  '#0f766e', // F# (Teal)
  '#3b82f6', // G  (Blue)
  '#4338ca', // G# (Indigo)
  '#a855f7', // A  (Purple)
  '#e860c6', // A# (Rose)
  '#f3c2da', // B  (Pink)
];

export interface NoteStyle {
  base: string;
  outline: string;
  glow: string;
}

export const getPitchClassColor = (midi: number): string => {
  return PITCH_COLORS[midi % 12];
};

export const getNoteStyle = (
  midi: number,
  track: MidiTrack,
  mode: 'track' | 'note'
): NoteStyle => {
  const baseColor = mode === 'track' ? track.color : getPitchClassColor(midi);

  // Simple brightness adjustment for outline/glow could be done with a library like chroma-js,
  // but we'll stick to CSS/Canvas native manipulation or simple hex assumptions for performance.
  // For now, we return the base color and let the renderer handle opacity/blending.

  return {
    base: baseColor,
    outline: '#ffffff',
    glow: baseColor
  };
};

// Helper to check if a note is a sharp/flat (black key)
export const isBlackKey = (midi: number): boolean => {
  const k = midi % 12;
  return k === 1 || k === 3 || k === 6 || k === 8 || k === 10;
};
