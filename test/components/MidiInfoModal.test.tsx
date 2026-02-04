import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MidiInfoModal from '../../components/MidiInfoModal';
import type { MidiData } from '../../types';

describe('MidiInfoModal', () => {
  it('renders MIDI metadata and tables', () => {
    const midiData: MidiData = {
      header: {
        name: 'Demo MIDI',
        tempo: 120,
        timeSignatures: [
          { ticks: 0, time: 0, numerator: 4, denominator: 4 }
        ],
        tempos: [
          { ticks: 0, time: 0, bpm: 120 },
          { ticks: 480, time: 1.5, bpm: 90 }
        ]
      },
      duration: 65.5,
      tracks: [],
      pitchRange: { min: 60, max: 72 }
    };

    const html = renderToStaticMarkup(
      <MidiInfoModal midiData={midiData} onClose={() => {}} />
    );

    expect(html).toContain('MIDI Properties');
    expect(html).toContain('Demo MIDI');
    expect(html).toContain('1:05.50');
    expect(html).toContain('4 / 4');
    expect(html).toContain('Tempo Map');
  });
});
