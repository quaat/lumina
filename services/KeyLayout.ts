export const DEFAULT_MIN_KEY = 21; // A0
export const DEFAULT_MAX_KEY = 108; // C8

// Intrinsic Geometry Constants
const WHITE_KEY_HEIGHT_TO_WIDTH_RATIO = 4.0; // Height is 4x Width
const BLACK_KEY_WIDTH_RATIO = 0.6; // Black key width relative to white key width
const BLACK_KEY_HEIGHT_RATIO = 0.65; // Black key height relative to white key height

export interface KeyGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  isBlack: boolean;
  centerX: number;
}

export interface LayoutStats {
    mode: 'width-driven' | 'height-driven';
    whiteKeyWidth: number;
    whiteKeyHeight: number;
    visibleWhiteKeys: number;
    keyboardWidth: number;
    keyboardHeight: number;
    offsetX: number;
    offsetY: number;
}

export class KeyLayout {
  private minKey: number;
  private maxKey: number;
  
  // Computed geometry
  private whiteKeyWidth: number = 0;
  private whiteKeyHeight: number = 0;
  private blackKeyWidth: number = 0;
  private blackKeyHeight: number = 0;
  
  // Container positioning
  private offsetX: number = 0;
  private offsetY: number = 0;
  
  // Stats for debug
  public stats: LayoutStats;

  // Cache
  private keyCache: Map<number, KeyGeometry> = new Map();

  constructor(
      containerWidth: number, 
      containerHeight: number, 
      minKey: number = DEFAULT_MIN_KEY, 
      maxKey: number = DEFAULT_MAX_KEY
    ) {
    this.minKey = minKey;
    this.maxKey = maxKey;

    // 1. Calculate visible white key count
    let visibleWhiteKeyCount = 0;
    for (let i = minKey; i <= maxKey; i++) {
        if (!this.isBlack(i)) visibleWhiteKeyCount++;
    }
    // Safety fallback
    if (visibleWhiteKeyCount === 0) visibleWhiteKeyCount = 1;

    // 2. Aspect-Ratio Preserving Sizing Algorithm
    
    // Step A: Attempt Width-Driven Sizing
    const widthByWidth = containerWidth / visibleWhiteKeyCount;
    const heightFromWidth = widthByWidth * WHITE_KEY_HEIGHT_TO_WIDTH_RATIO;

    let mode: 'width-driven' | 'height-driven';

    if (heightFromWidth <= containerHeight) {
        // Fits vertically! Use width-driven sizing.
        mode = 'width-driven';
        this.whiteKeyWidth = widthByWidth;
        this.whiteKeyHeight = heightFromWidth;
        
        // Center Vertically (Letterbox Top/Bottom)
        this.offsetX = 0;
        this.offsetY = (containerHeight - this.whiteKeyHeight) / 2;
    } else {
        // Too tall! Use height-driven sizing.
        mode = 'height-driven';
        this.whiteKeyHeight = containerHeight;
        this.whiteKeyWidth = this.whiteKeyHeight / WHITE_KEY_HEIGHT_TO_WIDTH_RATIO;
        
        // Center Horizontally (Letterbox Left/Right)
        const totalWidth = this.whiteKeyWidth * visibleWhiteKeyCount;
        this.offsetX = (containerWidth - totalWidth) / 2;
        this.offsetY = 0;
    }

    // Derived Black Key Geometry
    this.blackKeyWidth = this.whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    this.blackKeyHeight = this.whiteKeyHeight * BLACK_KEY_HEIGHT_RATIO;

    this.stats = {
        mode,
        whiteKeyWidth: this.whiteKeyWidth,
        whiteKeyHeight: this.whiteKeyHeight,
        visibleWhiteKeys: visibleWhiteKeyCount,
        keyboardWidth: this.whiteKeyWidth * visibleWhiteKeyCount,
        keyboardHeight: this.whiteKeyHeight,
        offsetX: this.offsetX,
        offsetY: this.offsetY
    };

    this.precompute();
  }

  private isBlack(midi: number): boolean {
    const k = midi % 12;
    return k === 1 || k === 3 || k === 6 || k === 8 || k === 10;
  }

  private precompute() {
    let currentWhiteIndex = 0;

    for (let i = this.minKey; i <= this.maxKey; i++) {
      const black = this.isBlack(i);
      
      let rect: KeyGeometry;

      if (!black) {
        // White key
        const x = this.offsetX + (currentWhiteIndex * this.whiteKeyWidth);
        rect = {
          x: x,
          y: this.offsetY,
          width: this.whiteKeyWidth,
          height: this.whiteKeyHeight,
          isBlack: false,
          centerX: x + (this.whiteKeyWidth / 2)
        };
        currentWhiteIndex++;
      } else {
        // Black key
        // Sits on the boundary between the PREVIOUS white key and the NEXT.
        // x = (end of prev white) - (half black width)
        // Since we are iterating:
        // If current note is black, it's visually "after" the white key at currentWhiteIndex-1?
        // Actually, MIDI order: A0(21-White), A#0(22-Black), B0(23-White).
        // 21: idx 0. x = 0.
        // 22: idx 1 (for white keys, it hasn't incremented yet). 
        //     It should be at the boundary of 21 and 23.
        //     Boundary X = this.offsetX + (currentWhiteIndex * width)
        //     (Because currentWhiteIndex is 1, pointing to where B0 WILL be).
        
        const boundaryX = this.offsetX + (currentWhiteIndex * this.whiteKeyWidth);
        const x = boundaryX - (this.blackKeyWidth / 2);
        
        rect = {
          x: x,
          y: this.offsetY,
          width: this.blackKeyWidth,
          height: this.blackKeyHeight,
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
  // This must align with the keys, so it includes offsets.
  public getNoteX(midi: number): number {
    const rect = this.keyCache.get(midi);
    if (!rect) return -1000; 
    // Usually notes align with the left edge for standard piano rolls, 
    // or center? Existing implementation returned rect.x.
    // Let's stick to rect.x (left aligned bars) which is standard.
    return rect.x;
  }

  public getNoteWidth(midi: number): number {
    const rect = this.keyCache.get(midi);
    if (!rect) return 0;
    // For falling notes, usually we want them to look 'connected'
    // White keys: full width. Black keys: their width.
    return rect.isBlack ? rect.width : rect.width; 
    // Note: Previously we did (width - 1) for gap. Can do that in renderer.
  }
  
  public getRange() {
      return { min: this.minKey, max: this.maxKey };
  }
}
