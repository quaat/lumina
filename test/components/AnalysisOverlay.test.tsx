import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AnalysisOverlay from '../../components/AnalysisOverlay';
import type { AnalysisResult } from '../../analysis/analysisTypes';

describe('AnalysisOverlay', () => {
  it('renders nothing when disabled', () => {
    const result: AnalysisResult = { chords: [], patterns: [] };
    const html = renderToStaticMarkup(
      <AnalysisOverlay result={result} currentTime={0} enabled={false} visible />
    );

    expect(html).toBe('');
  });

  it('renders chord and pattern when active', () => {
    const result: AnalysisResult = {
      chords: [
        { start: 0, end: 2, label: 'Cmaj7', root: 'C', bass: 'C', confidence: 0.9 }
      ],
      patterns: [
        { start: 0.5, end: 3, label: 'Arpeggio (Up)', confidence: 0.8 }
      ]
    };

    const html = renderToStaticMarkup(
      <AnalysisOverlay result={result} currentTime={1} enabled visible />
    );

    expect(html).toContain('Cmaj7');
    expect(html).toContain('Arpeggio (Up)');
  });
});
