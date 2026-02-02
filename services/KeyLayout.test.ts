import { KeyLayout, DEFAULT_MIN_KEY, DEFAULT_MAX_KEY } from './KeyLayout';

declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('KeyLayout Aspect Ratio', () => {
    const WIDTH = 1000;
    const HEIGHT = 100;
    
    test('should favor width-driven sizing when keys fit vertically', () => {
        // Full range (52 white keys). 
        // W = 1000 / 52 ~= 19.23
        // H = 19.23 * 4 = 76.9
        // 76.9 <= 100. Should fit.
        const layout = new KeyLayout(WIDTH, HEIGHT, DEFAULT_MIN_KEY, DEFAULT_MAX_KEY);
        
        expect(layout.stats.mode).toBe('width-driven');
        expect(layout.stats.whiteKeyWidth).toBeCloseTo(WIDTH / 52);
        // Should be vertically centered
        expect(layout.stats.offsetY).toBeGreaterThan(0);
        expect(layout.stats.offsetX).toBe(0);
    });

    test('should switch to height-driven sizing when keys are too few (zoomed in)', () => {
        // Zoomed in: 1 octave (7 white keys)
        // Try Width-Driven: W = 1000 / 7 = 142.
        // H = 142 * 4 = 568.
        // 568 > 100. Too tall.
        // Should clamp height to 100.
        const layout = new KeyLayout(WIDTH, HEIGHT, 60, 71); // C4 to B4
        
        expect(layout.stats.mode).toBe('height-driven');
        expect(layout.stats.whiteKeyHeight).toBe(HEIGHT);
        expect(layout.stats.whiteKeyWidth).toBe(HEIGHT / 4.0); // Ratio 4.0
        
        // Should be horizontally centered
        const expectedTotalWidth = (HEIGHT / 4.0) * 7;
        const expectedOffset = (WIDTH - expectedTotalWidth) / 2;
        expect(layout.stats.offsetX).toBeCloseTo(expectedOffset);
        expect(layout.stats.offsetY).toBe(0);
    });

    test('black keys should scale proportionally', () => {
        const layout = new KeyLayout(WIDTH, HEIGHT, 60, 71);
        const rect = layout.getKeyRect(61); // C#4
        
        expect(rect?.isBlack).toBe(true);
        expect(rect?.width).toBeCloseTo(layout.stats.whiteKeyWidth * 0.6); // BLACK_KEY_WIDTH_RATIO
        expect(rect?.height).toBeCloseTo(layout.stats.whiteKeyHeight * 0.65); // BLACK_KEY_HEIGHT_RATIO
    });

    test('getNoteX should return absolute coordinates including offsets', () => {
        const layout = new KeyLayout(WIDTH, HEIGHT, 60, 71);
        // First key is C4 (60).
        // Since height-driven, there is an offsetX.
        const rect = layout.getKeyRect(60);
        const noteX = layout.getNoteX(60);
        
        expect(noteX).toBe(rect?.x);
        expect(noteX).toBeCloseTo(layout.stats.offsetX);
    });
});
