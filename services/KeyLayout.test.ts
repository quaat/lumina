import { KeyLayout, DEFAULT_MIN_KEY, DEFAULT_MAX_KEY } from './KeyLayout';

// Add type definitions for test globals to satisfy the compiler
declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

// Mock context for environment without Jest/Vitest globals if needed, 
// but assuming standard test runner environment.

describe('KeyLayout', () => {
    const WIDTH = 1000;
    const layout = new KeyLayout(WIDTH);
    const whiteKeyWidth = WIDTH / 52; // 52 white keys in 88 key range

    test('should place A0 (first key) at 0', () => {
        const rect = layout.getKeyRect(DEFAULT_MIN_KEY); // A0
        expect(rect).toBeDefined();
        expect(rect?.x).toBeCloseTo(0);
        expect(rect?.isBlack).toBe(false);
    });

    test('should place C8 (last key) correctly', () => {
        const lastKey = DEFAULT_MAX_KEY; // C8
        const rect = layout.getKeyRect(lastKey);
        expect(rect).toBeDefined();
        // C8 is the 52nd white key (index 51)
        expect(rect?.x).toBeCloseTo(51 * whiteKeyWidth);
    });

    test('black keys should be centered on boundaries', () => {
        // A#0 (22) is between A0 (white 0) and B0 (white 1)
        // Boundary is 1 * whiteKeyWidth
        const aSharp = layout.getKeyRect(22);
        const boundary = 1 * whiteKeyWidth;
        
        expect(aSharp?.isBlack).toBe(true);
        expect(aSharp?.centerX).toBeCloseTo(boundary);
    });

    test('monotonic ordering of keys', () => {
        let prevX = -1;
        for (let i = DEFAULT_MIN_KEY; i <= DEFAULT_MAX_KEY; i++) {
            const rect = layout.getKeyRect(i);
            if(!rect) continue;
            // Center X should be strictly increasing
            expect(rect.centerX).toBeGreaterThan(prevX);
            prevX = rect.centerX;
        }
    });

    test('note X matches key X (or center)', () => {
        for (let i = DEFAULT_MIN_KEY; i <= DEFAULT_MAX_KEY; i++) {
            const noteX = layout.getNoteX(i);
            const keyRect = layout.getKeyRect(i);
            // In our implementation, noteX is the left edge of the note bar.
            expect(noteX).toBe(keyRect?.x);
        }
    });
});