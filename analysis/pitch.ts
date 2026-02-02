
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const getPitchClass = (midi: number): number => midi % 12;

export const getNoteName = (pc: number): string => {
  return NOTE_NAMES[pc % 12];
};

export const getMidiNoteName = (midi: number): string => {
  const pc = getPitchClass(midi);
  return NOTE_NAMES[pc]; // Just the name, no octave for chords usually
};
