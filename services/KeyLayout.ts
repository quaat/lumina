export const FIRST_KEY = 21; // A0
export const KEYS_COUNT = 88;
export const LAST_KEY = FIRST_KEY + KEYS_COUNT - 1; // C8

export interface KeyGeometry {
  x: number;
  width: number;
  isBlack: boolean;
  centerX: number;
}

export class KeyLayout {
  private whiteKeyWidth: number;
  private blackKeyWidth: number;
  private whiteKeyCount: number;
  
  // Cache geometry to avoid recalculating per frame per note
  private keyCache: Map<number, KeyGeometry> = new Map();

  constructor(width: number) {
    // Calculate total white keys in standard 88-key range (A0 to C8)
    // A0, B0, ... C8
    this.whiteKeyCount = 52; 
    this.whiteKeyWidth = width / this.whiteKeyCount;
    this.blackKeyWidth = this.whiteKeyWidth * 0.65;

    this.precompute();
  }

  private isBlack(midi: number): boolean {
    const k = midi % 12;
    return k === 1 || k === 3 || k === 6 || k === 8 || k === 10;
  }

  private precompute() {
    let currentWhiteIndex = 0;

    for (let i = FIRST_KEY; i <= LAST_KEY; i++) {
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
        // The 'currentWhiteIndex' here actually points to the *next* white key 
        // because we haven't incremented it for this black key.
        // Example: A0 (white, idx 0). A#0 (black). 
        // Boundary is at x = 1 * whiteKeyWidth.
        
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
    if (!rect) return -100;
    
    // For visualizer bars, we usually want them centered on the key, 
    // or filling the key width.
    if (rect.isBlack) {
      return rect.x;
    } else {
      // For white keys, we might want to shrink the note bar slightly 
      // so it doesn't overlap the black keys visually if using full width, 
      // but 'x' is strictly correct for the slot.
      return rect.x;
    }
  }

  public getNoteWidth(midi: number): number {
    const rect = this.keyCache.get(midi);
    if (!rect) return 0;
    
    // Optional: make white notes slightly narrower to see grid lines?
    // Using full key width for now.
    return rect.isBlack ? rect.width : rect.width - 1;
  }
}
