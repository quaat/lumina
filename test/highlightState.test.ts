import { describe, expect, it } from 'vitest';
import { applyHighlightEvents, buildActiveNotesSet, createHighlightState } from '../services/highlightState';

describe('highlightState', () => {
  it('handles quick retrigger with off between hits', () => {
    let state = createHighlightState();

    state = applyHighlightEvents(state, [{ type: 'on', noteNumber: 60, sourceKey: '0', timeMs: 100 }]);
    expect(state.totalsByNote[60]).toBe(1);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(true);

    state = applyHighlightEvents(state, [{ type: 'off', noteNumber: 60, sourceKey: '0', timeMs: 120 }]);
    expect(state.totalsByNote[60]).toBe(0);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(false);

    state = applyHighlightEvents(state, [{ type: 'on', noteNumber: 60, sourceKey: '0', timeMs: 160 }]);
    expect(state.totalsByNote[60]).toBe(1);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(true);

    state = applyHighlightEvents(state, [{ type: 'off', noteNumber: 60, sourceKey: '0', timeMs: 180 }]);
    expect(state.totalsByNote[60]).toBe(0);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(false);
  });

  it('keeps the highlight active for overlapping retriggers', () => {
    let state = createHighlightState();

    state = applyHighlightEvents(state, [{ type: 'on', noteNumber: 60, sourceKey: '0', timeMs: 100 }]);
    state = applyHighlightEvents(state, [{ type: 'on', noteNumber: 60, sourceKey: '0', timeMs: 140 }]);
    expect(state.totalsByNote[60]).toBe(2);

    state = applyHighlightEvents(state, [{ type: 'off', noteNumber: 60, sourceKey: '0', timeMs: 180 }]);
    expect(state.totalsByNote[60]).toBe(1);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(true);

    state = applyHighlightEvents(state, [{ type: 'off', noteNumber: 60, sourceKey: '0', timeMs: 220 }]);
    expect(state.totalsByNote[60]).toBe(0);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(false);
  });

  it('prefers same-timestamp off then on ordering', () => {
    let state = createHighlightState();

    state = applyHighlightEvents(state, [
      { type: 'off', noteNumber: 60, sourceKey: '0', timeMs: 100 },
      { type: 'on', noteNumber: 60, sourceKey: '0', timeMs: 100 }
    ]);

    expect(state.totalsByNote[60]).toBe(1);
    expect(buildActiveNotesSet(state).has('0:60')).toBe(true);
  });
});
