import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PitchRangeControls from '../../components/PitchRangeControls';

describe('PitchRangeControls', () => {
  it('renders range info and button titles', () => {
    const html = renderToStaticMarkup(
      <PitchRangeControls
        range={{ min: 60, max: 72 }}
        autoFit
        onToggleAutoFit={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onReset={() => {}}
        onFullRange={() => {}}
        noteToName={(midi) => `N${midi}`}
      />
    );

    expect(html).toContain('N60 - N72 (13 keys)');
    expect(html).toContain('title="Zoom In"');
    expect(html).toContain('title="Zoom Out"');
    expect(html).toContain('title="Reset to Content"');
    expect(html).toContain('title="Full Piano Range (88 keys)"');
  });
});
