export type HighlightSourceKey = string;
export type HighlightEventType = 'on' | 'off';

export interface HighlightEvent {
  type: HighlightEventType;
  noteNumber: number;
  sourceKey: HighlightSourceKey;
  timeMs: number;
}

export interface HighlightState {
  countsByActiveKey: Map<string, number>; // `${sourceKey}:${noteNumber}` -> count
  totalsByNote: number[]; // total active count per noteNumber
  sourcesByNote: Array<Map<HighlightSourceKey, number>>; // noteNumber -> source counts
  lastNoteOnTimeMs: Array<number | null>;
  lastNoteOffTimeMs: Array<number | null>;
  lastSourceKey: Array<HighlightSourceKey | null>;
  lastPulseTimeMs: Array<number | null>;
}

const NOTE_COUNT = 128;

const createNumberArray = (value: number) => Array.from({ length: NOTE_COUNT }, () => value);
const createNullableNumberArray = () => Array.from({ length: NOTE_COUNT }, () => null as number | null);
const createNullableSourceArray = () => Array.from({ length: NOTE_COUNT }, () => null as HighlightSourceKey | null);

export const createHighlightState = (): HighlightState => ({
  countsByActiveKey: new Map(),
  totalsByNote: createNumberArray(0),
  sourcesByNote: Array.from({ length: NOTE_COUNT }, () => new Map<HighlightSourceKey, number>()),
  lastNoteOnTimeMs: createNullableNumberArray(),
  lastNoteOffTimeMs: createNullableNumberArray(),
  lastSourceKey: createNullableSourceArray(),
  lastPulseTimeMs: createNullableNumberArray()
});

const cloneHighlightState = (state: HighlightState): HighlightState => ({
  countsByActiveKey: new Map(state.countsByActiveKey),
  totalsByNote: state.totalsByNote.slice(),
  sourcesByNote: state.sourcesByNote.map((sourceMap) => new Map(sourceMap)),
  lastNoteOnTimeMs: state.lastNoteOnTimeMs.slice(),
  lastNoteOffTimeMs: state.lastNoteOffTimeMs.slice(),
  lastSourceKey: state.lastSourceKey.slice(),
  lastPulseTimeMs: state.lastPulseTimeMs.slice()
});

const clampNoteNumber = (noteNumber: number) => {
  if (!Number.isFinite(noteNumber)) return null;
  if (noteNumber < 0 || noteNumber >= NOTE_COUNT) return null;
  return noteNumber;
};

const applyHighlightEventInPlace = (state: HighlightState, event: HighlightEvent) => {
  const noteNumber = clampNoteNumber(event.noteNumber);
  if (noteNumber === null) return;

  const activeKey = `${event.sourceKey}:${noteNumber}`;
  const sourceCounts = state.sourcesByNote[noteNumber];

  // Root cause: boolean/set-based highlights cannot represent overlapping or retriggered notes.
  // A note-off from the first hit would clear the key even if a retrigger was already on.
  // Use per-key reference counts and only clear when the count reaches zero.
  if (event.type === 'on') {
    const currentCount = state.countsByActiveKey.get(activeKey) ?? 0;
    state.countsByActiveKey.set(activeKey, currentCount + 1);

    const sourceCount = sourceCounts.get(event.sourceKey) ?? 0;
    sourceCounts.set(event.sourceKey, sourceCount + 1);

    state.totalsByNote[noteNumber] = state.totalsByNote[noteNumber] + 1;
    state.lastNoteOnTimeMs[noteNumber] = event.timeMs;
    state.lastPulseTimeMs[noteNumber] = event.timeMs;
    state.lastSourceKey[noteNumber] = event.sourceKey;
  } else {
    const currentCount = state.countsByActiveKey.get(activeKey) ?? 0;
    const nextCount = Math.max(0, currentCount - 1);
    if (nextCount === 0) {
      state.countsByActiveKey.delete(activeKey);
    } else {
      state.countsByActiveKey.set(activeKey, nextCount);
    }

    const sourceCount = sourceCounts.get(event.sourceKey) ?? 0;
    const nextSourceCount = Math.max(0, sourceCount - 1);
    if (nextSourceCount === 0) {
      sourceCounts.delete(event.sourceKey);
    } else {
      sourceCounts.set(event.sourceKey, nextSourceCount);
    }

    state.totalsByNote[noteNumber] = Math.max(0, state.totalsByNote[noteNumber] - 1);
    state.lastNoteOffTimeMs[noteNumber] = event.timeMs;
    if (state.totalsByNote[noteNumber] === 0) {
      state.lastSourceKey[noteNumber] = null;
    }
  }
};

export const applyHighlightEvents = (state: HighlightState, events: HighlightEvent[]): HighlightState => {
  if (events.length === 0) return state;
  const next = cloneHighlightState(state);
  events.forEach((event) => applyHighlightEventInPlace(next, event));
  return next;
};

const clearHighlightsByPredicate = (
  state: HighlightState,
  predicate: (sourceKey: HighlightSourceKey) => boolean
): HighlightState => {
  if (state.countsByActiveKey.size === 0) return state;
  const next = cloneHighlightState(state);

  for (const [activeKey, count] of state.countsByActiveKey.entries()) {
    const splitIndex = activeKey.indexOf(':');
    if (splitIndex === -1) continue;
    const sourceKey = activeKey.slice(0, splitIndex);
    if (!predicate(sourceKey)) continue;

    const noteNumber = Number(activeKey.slice(splitIndex + 1));
    if (!Number.isFinite(noteNumber)) continue;

    next.countsByActiveKey.delete(activeKey);
    next.totalsByNote[noteNumber] = Math.max(0, next.totalsByNote[noteNumber] - count);

    const sourceCounts = next.sourcesByNote[noteNumber];
    const prevSourceCount = sourceCounts.get(sourceKey) ?? 0;
    const nextSourceCount = Math.max(0, prevSourceCount - count);
    if (nextSourceCount === 0) {
      sourceCounts.delete(sourceKey);
    } else {
      sourceCounts.set(sourceKey, nextSourceCount);
    }

    if (next.totalsByNote[noteNumber] === 0) {
      next.lastSourceKey[noteNumber] = null;
    }
  }

  return next;
};

export const clearHighlightsForSource = (state: HighlightState, sourceKey: HighlightSourceKey): HighlightState => {
  return clearHighlightsByPredicate(state, (candidate) => candidate === sourceKey);
};

export const clearHighlightsExceptInput = (state: HighlightState): HighlightState => {
  return clearHighlightsByPredicate(state, (candidate) => candidate !== 'input');
};

export const buildActiveNotesSet = (state: HighlightState): Set<string> => {
  return new Set(state.countsByActiveKey.keys());
};
