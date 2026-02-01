export interface MidiNote {
  midi: number;
  time: number; // Start time in seconds
  duration: number; // Duration in seconds
  velocity: number;
  trackId: number;
  name: string;
}

export interface MidiTrack {
  id: number;
  name: string;
  instrument: string;
  channel: number; // 0-15
  color: string;
  notes: MidiNote[];
  isHidden: boolean;
  isMuted: boolean;
}

export interface TempoEvent {
  ticks: number;
  bpm: number;
  time: number;
}

export interface TimeSignatureEvent {
  ticks: number;
  time: number;
  numerator: number;
  denominator: number;
}

export interface MidiData {
  header: {
    name: string;
    tempo: number;
    timeSignatures: TimeSignatureEvent[];
    tempos: TempoEvent[];
  };
  duration: number;
  tracks: MidiTrack[];
  pitchRange: {
    min: number;
    max: number;
  };
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // In seconds
  duration: number; // Total duration in seconds
  playbackRate: number;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;
}

export interface MidiOutputDevice {
  id: string;
  name: string;
  manufacturer?: string;
}

export interface MidiInputDevice {
  id: string;
  name: string;
  manufacturer?: string;
}

export interface MidiOutputSettings {
  deviceId: string | null;
  outputChannel: number | 'original'; // 'original' or 1-16
  latencyCompensation: number; // ms
}
