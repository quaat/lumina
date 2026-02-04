import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ViewSettings from '../../components/ViewSettings';
import type { HighwaySettings, ViewMode, ColorMode } from '../../types';
import type { AnalysisSettings } from '../../analysis/analysisTypes';

describe('ViewSettings', () => {
  it('renders view, color, analysis, and highway controls', () => {
    const highwaySettings: HighwaySettings = {
      lookahead: 4,
      farScale: 0.25,
      laneShading: true,
      cameraHeight: 0.5,
      laneContrast: 0.5,
      keyboardMode: '3d'
    };

    const analysisSettings: AnalysisSettings = {
      enabledChord: true,
      enabledPattern: true,
      scope: 'all',
      complexity: 'basic',
      leftHandSplit: 60
    };

    const html = renderToStaticMarkup(
      <ViewSettings
        viewMode={'highway' as ViewMode}
        onViewModeChange={() => {}}
        colorMode={'note' as ColorMode}
        onColorModeChange={() => {}}
        highwaySettings={highwaySettings}
        onUpdateHighwaySettings={() => {}}
        analysisSettings={analysisSettings}
        onUpdateAnalysisSettings={() => {}}
        onToggleFullscreen={() => {}}
      />
    );

    expect(html).toContain('Projection');
    expect(html).toContain('2D Scroll');
    expect(html).toContain('3D Highway');
    expect(html).toContain('Color By');
    expect(html).toContain('Track');
    expect(html).toContain('Note Name');
    expect(html).toContain('Harmonic Analysis');
    expect(html).toContain('Show Chords');
    expect(html).toContain('Show Patterns');
    expect(html).toContain('Keyboard Style');
    expect(html).toContain('Lane Shading');
  });
});
