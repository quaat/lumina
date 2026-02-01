import { Midi } from '@tonejs/midi';
import { MidiData, MidiTrack, MidiNote } from '../types';

// Palette for tracks
const TRACK_COLORS = [
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#14b8a6', // teal-500
  '#f43f5e', // rose-500
  '#eab308', // yellow-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#22c55e', // green-500
];

export const parseMidiFile = async (file: File): Promise<MidiData> => {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);
  
  let minNote = 127;
  let maxNote = 0;
  let hasNotes = false;

  const tracks: MidiTrack[] = midi.tracks.map((track, index) => {
    const notes: MidiNote[] = track.notes.map((note) => {
      // Update global pitch range
      if (note.midi < minNote) minNote = note.midi;
      if (note.midi > maxNote) maxNote = note.midi;
      hasNotes = true;

      return {
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        trackId: index,
        name: note.name,
      };
    });

    return {
      id: index,
      name: track.name || `Track ${index + 1}`,
      instrument: track.instrument.name,
      channel: track.channel,
      color: TRACK_COLORS[index % TRACK_COLORS.length],
      notes: notes,
      isHidden: false,
      isMuted: false,
    };
  });

  // Filter out empty tracks
  const validTracks = tracks.filter((t) => t.notes.length > 0);

  // Default range if no notes found (A0 to C8)
  if (!hasNotes) {
    minNote = 21;
    maxNote = 108;
  }

  return {
    header: {
      name: midi.name || file.name,
      tempo: midi.header.tempos[0]?.bpm || 120,
      timeSignatures: midi.header.timeSignatures.map(ts => ({
        ticks: ts.ticks,
        time: ts.time,
        numerator: ts.timeSignature[0],
        denominator: ts.timeSignature[1]
      })),
      tempos: midi.header.tempos.map(t => ({
        ticks: t.ticks,
        bpm: t.bpm,
        time: t.time
      })),
    },
    duration: midi.duration,
    tracks: validTracks,
    pitchRange: {
      min: minNote,
      max: maxNote
    }
  };
};
