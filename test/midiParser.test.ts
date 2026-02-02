import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiFile } from '../services/midiParser';

describe('parseMidiFile', () => {
  it('parses a simple MIDI file and derives pitch range', async () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.name = 'Piano';
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });

    const bytes = new Uint8Array(midi.toArray());
    const file = {
      name: 'test.mid',
      arrayBuffer: async () => bytes.buffer
    } as File;
    const parsed = await parseMidiFile(file);

    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.tracks[0].notes).toHaveLength(1);
    expect(parsed.pitchRange).toEqual({ min: 60, max: 60 });
    expect(parsed.header.name).toBe('test.mid');
  });
});
