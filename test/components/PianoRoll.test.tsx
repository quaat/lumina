import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PianoRoll from '../../components/PianoRoll';
import type { MidiData, HighwaySettings } from '../../types';

describe('PianoRoll', () => {
  it('renders a canvas element for the roll', () => {
    const midiData: MidiData = {
      header: {
        name: 'Test',
        tempo: 120,
        timeSignatures: [],
        tempos: []
      },
      duration: 2,
      tracks: [
        {
          id: 0,
          name: 'Track 1',
          instrument: 'Piano',
          channel: 0,
          color: '#3b82f6',
          notes: [
            {
              midi: 60,
              time: 0,
              duration: 0.5,
              velocity: 0.8,
              trackId: 0,
              name: 'C4'
            }
          ],
          isHidden: false,
          isMuted: false
        }
      ],
      pitchRange: { min: 60, max: 60 }
    };

    const highwaySettings: HighwaySettings = {
      lookahead: 4,
      farScale: 0.25,
      laneShading: true,
      cameraHeight: 0.5,
      laneContrast: 0.5,
      keyboardMode: '3d'
    };

    const html = renderToStaticMarkup(
      <PianoRoll
        midiData={midiData}
        currentTime={0}
        isPlaying={false}
        zoom={150}
        activeNotes={new Set()}
        range={{ min: 60, max: 72 }}
        viewMode="classic"
        colorMode="note"
        highwaySettings={highwaySettings}
      />
    );

    expect(html).toContain('<canvas');
    expect(html).toContain('class="block"');
  });
});
