
export interface AnalysisSettings {
  enabledChord: boolean;
  enabledPattern: boolean;
  scope: 'all' | 'visible';
  complexity: 'basic' | 'extended';
  leftHandSplit: number; // MIDI note number, default 60 (Middle C)
}

export interface ChordSlice {
  start: number; // Seconds
  end: number;   // Seconds
  label: string; // Display label (e.g. "Cmaj7/E")
  root: string;
  bass: string;
  confidence: number; // 0.0 - 1.0
}

export interface PatternSlice {
  start: number;
  end: number;
  label: string; // e.g. "Arpeggio (up)"
  confidence: number;
}

export interface AnalysisResult {
  chords: ChordSlice[];
  patterns: PatternSlice[];
}
