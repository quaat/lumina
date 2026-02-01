export const DEFAULT_MIN_KEY = 21; // A0
export const DEFAULT_MAX_KEY = 108; // C8

export interface KeyGeometry {
  x: number;
  width: number;
  isBlack: boolean;
  centerX: number;
}

export class KeyLayout {
  private whiteKeyWidth: number;
  private blackKeyWidth: number;
  private minKey: number;
  private maxKey: number;
  
  // Cache geometry to avoid recalculating per frame per note
  private keyCache: Map<number, KeyGeometry> = new Map();

  constructor(width: number, minKey: number = DEFAULT_MIN_KEY, maxKey: number = DEFAULT_MAX_KEY) {
    this.minKey = minKey;
    this.maxKey = maxKey;

    // Calculate total white keys in the visible range
    let whiteKeyCount = 0;
    for (let i = minKey; i <= maxKey; i++) {
        if (!this.isBlack(i)) whiteKeyCount++;
    }
    
    // Fallback to prevent divide by zero if range is weird (e.g. only black keys)
    if (whiteKeyCount === 0) whiteKeyCount = 1;

    this.whiteKeyWidth = width / whiteKeyCount;
    this.blackKeyWidth = this.whiteKeyWidth * 0.65;

    this.precompute();
  }

  private isBlack(midi: number): boolean {
    const k = midi % 12;
    return k === 1 || k === 3 || k === 6 || k === 8 || k === 10;
  }

  private precompute() {
    let currentWhiteIndex = 0;

    // If the view starts with black keys, we need to handle the offset logic carefully.
    // However, the standard logic: "Black key is offset from the *next* white key" 
    // usually works if we start currentWhiteIndex at 0.
    // Example: MinKey is 22 (A#0).
    // Loop 22 (Black): x = (0 * w) - (bW/2). Draws half off-screen to left. Correct.
    // Loop 23 (B0 - White): x = 0 * w. Draws at 0. Correct.
    
    for (let i = this.minKey; i <= this.maxKey; i++) {
      const black = this.isBlack(i);
      
      let rect: KeyGeometry;

      if (!black) {
        // White key
        const x = currentWhiteIndex * this.whiteKeyWidth;
        rect = {
          x: x,
          width: this.whiteKeyWidth,
          isBlack: false,
          centerX: x + (this.whiteKeyWidth / 2)
        };
        currentWhiteIndex++;
      } else {
        // Black key
        // Sits on the boundary between the previous white key and the next.
        const boundaryX = currentWhiteIndex * this.whiteKeyWidth;
        const x = boundaryX - (this.blackKeyWidth / 2);
        
        rect = {
          x: x,
          width: this.blackKeyWidth,
          isBlack: true,
          centerX: x + (this.blackKeyWidth / 2)
        };
      }
      
      this.keyCache.set(i, rect);
    }
  }

  public getKeyRect(midi: number): KeyGeometry | undefined {
    return this.keyCache.get(midi);
  }

  // Returns X coordinate for the visual center of the note (falling bar)
  public getNoteX(midi: number): number {
    const rect = this.keyCache.get(midi);
    if (!rect) return -1000; // Return far off-screen
    return rect.x;
  }

  public getNoteWidth(midi: number): number {
    const rect = this.keyCache.get(midi);
    if (!rect) return 0;
    return rect.isBlack ? rect.width : rect.width - 1;
  }
  
  public getRange() {
      return { min: this.minKey, max: this.maxKey };
  }
}
