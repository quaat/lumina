import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaybackControls from '../../components/PlaybackControls';

describe('PlaybackControls', () => {
  it('renders time, scrubber, and rate options', () => {
    const html = renderToStaticMarkup(
      <PlaybackControls
        isPlaying={false}
        currentTime={10}
        duration={30}
        onPlayPause={() => {}}
        onStop={() => {}}
        onSeek={() => {}}
        playbackRate={1}
        onRateChange={() => {}}
        flowScore={0}
      />
    );

    expect(html).toContain('0:10 / 0:30');
    expect(html).toContain('type="range"');
    expect(html).toContain('0.25x');
    expect(html).toContain('2.0x');
    expect(html).toContain('title="Stop"');
  });
});
