import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_KEY, DEFAULT_MIN_KEY, KeyLayout } from '../services/KeyLayout';

describe('KeyLayout', () => {
  it('uses width-driven sizing when the height allows it', () => {
    const layout = new KeyLayout(520, 100, DEFAULT_MIN_KEY, DEFAULT_MAX_KEY);

    expect(layout.stats.mode).toBe('width-driven');
    expect(layout.stats.visibleWhiteKeys).toBe(52);
    expect(layout.stats.whiteKeyWidth).toBeCloseTo(10);
    expect(layout.stats.whiteKeyHeight).toBeCloseTo(40);
    expect(layout.stats.offsetY).toBeCloseTo(30);
  });

  it('uses height-driven sizing when the height is constrained', () => {
    const layout = new KeyLayout(300, 10, DEFAULT_MIN_KEY, DEFAULT_MAX_KEY);

    expect(layout.stats.mode).toBe('height-driven');
    expect(layout.stats.whiteKeyHeight).toBeCloseTo(10);
    expect(layout.stats.whiteKeyWidth).toBeCloseTo(2.5);
    expect(layout.stats.offsetX).toBeCloseTo(85);
  });

  it('places a black key between its neighboring white keys', () => {
    const layout = new KeyLayout(520, 100, 21, 23);
    const a0 = layout.getKeyRect(21);
    const aSharp0 = layout.getKeyRect(22);
    const b0 = layout.getKeyRect(23);

    expect(a0?.isBlack).toBe(false);
    expect(b0?.isBlack).toBe(false);
    expect(aSharp0?.isBlack).toBe(true);

    const boundary = (a0?.x ?? 0) + (a0?.width ?? 0);
    expect(aSharp0?.centerX).toBeCloseTo(boundary);
  });

  it('returns sentinel values for out-of-range notes', () => {
    const layout = new KeyLayout(520, 100, 60, 61);

    expect(layout.getNoteX(10)).toBe(-1000);
    expect(layout.getNoteWidth(10)).toBe(0);
  });
});
