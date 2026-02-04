import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Sidebar from '../../components/Sidebar';
import type { MidiTrack, MidiOutputSettings, MidiOutputDevice, MidiInputDevice } from '../../types';

const buildTrack = (): MidiTrack => ({
  id: 1,
  name: 'Piano',
  instrument: 'Acoustic Grand',
  channel: 0,
  color: '#ff0000',
  notes: [
    {
      midi: 60,
      time: 0,
      duration: 0.5,
      velocity: 0.8,
      trackId: 1,
      name: 'C4'
    }
  ],
  isHidden: false,
  isMuted: false
});

const baseSettings: MidiOutputSettings = {
  deviceId: null,
  outputChannel: 'original',
  latencyCompensation: 0
};

const midiDevices: MidiOutputDevice[] = [{ id: 'dev-1', name: 'Synth' }];
const inputDevices: MidiInputDevice[] = [{ id: 'in-1', name: 'Keyboard' }];

describe('Sidebar', () => {
  it('renders track list, inputs, and info button when MIDI is loaded', () => {
    const html = renderToStaticMarkup(
      <Sidebar
        tracks={[buildTrack()]}
        midiDevices={midiDevices}
        inputDevices={inputDevices}
        settings={baseSettings}
        selectedInputId={null}
        onUpdateSettings={() => {}}
        onUpdateInput={() => {}}
        onToggleTrackMute={() => {}}
        onToggleTrackHide={() => {}}
        onFileUpload={() => {}}
        onShowInfo={() => {}}
        hasMidiData
      />
    );

    expect(html).toContain('Lumina');
    expect(html).toContain('Tracks (1)');
    expect(html).toContain('Piano');
    expect(html).toContain('Import MIDI');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".mid,.midi"');
    expect(html).toContain('title="File Info"');
  });

  it('hides the info button when no MIDI is loaded', () => {
    const html = renderToStaticMarkup(
      <Sidebar
        tracks={[]}
        midiDevices={midiDevices}
        inputDevices={inputDevices}
        settings={baseSettings}
        selectedInputId={null}
        onUpdateSettings={() => {}}
        onUpdateInput={() => {}}
        onToggleTrackMute={() => {}}
        onToggleTrackHide={() => {}}
        onFileUpload={() => {}}
        onShowInfo={() => {}}
        hasMidiData={false}
      />
    );

    expect(html).not.toContain('title="File Info"');
    expect(html).toContain('No tracks loaded.');
  });
});
