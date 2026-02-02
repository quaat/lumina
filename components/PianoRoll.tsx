
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { MidiData, ViewMode, ColorMode, HighwaySettings } from '../types';
import { KeyLayout } from '../services/KeyLayout';
import { getPitchClassColor } from '../services/NoteTheme';

interface PianoRollProps {
  midiData: MidiData;
  currentTime: number;
  isPlaying: boolean;
  zoom: number; // Pixels per second (Classic Mode)
  activeNotes: Set<string>; // Keys that are currently playing (trackId:noteNumber)
  debugMode?: boolean;
  range: { min: number; max: number };
  viewMode: ViewMode;
  colorMode: ColorMode;
  highwaySettings: HighwaySettings;
}

const PianoRoll: React.FC<PianoRollProps> = ({ 
  midiData, 
  currentTime, 
  isPlaying, 
  zoom,
  activeNotes,
  debugMode = false,
  range,
  viewMode,
  colorMode,
  highwaySettings
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Fixed keyboard container height
  const KEYBOARD_HEIGHT = 100;

  // Instantiate layout engine when width or range changes
  const layout = useMemo(() => {
    if (dimensions.width === 0) return null;
    return new KeyLayout(dimensions.width, KEYBOARD_HEIGHT, range.min, range.max);
  }, [dimensions.width, range.min, range.max, KEYBOARD_HEIGHT]);

  // Handle Resize
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
        if (canvasRef.current) {
          canvasRef.current.width = width * window.devicePixelRatio;
          canvasRef.current.height = height * window.devicePixelRatio;
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Precompute Lane Geometry to avoid heavy per-frame logic
  const laneGeometry = useMemo(() => {
    if (!layout || dimensions.width === 0) return null;
    const { width, height } = dimensions;
    const ROLL_HEIGHT = height - KEYBOARD_HEIGHT;
    const impactY = ROLL_HEIGHT;
    const horizonY = 0;
    const vanishX = width / 2;
    const farScale = Math.min(Math.max(highwaySettings.farScale, 0.01), 0.99);

    const { min, max } = layout.getRange();

    const whiteLanes: Path2D[] = [];
    const blackLanes: Path2D[] = [];
    
    const debugLanes: { key: number, path: Path2D, isBlack: boolean }[] = [];

    for (let i = min; i <= max; i++) {
        const rect = layout.getKeyRect(i);
        if (!rect) continue;

        const nearL = rect.x;
        const nearR = rect.x + rect.width;
        const farL = vanishX + (nearL - vanishX) * farScale;
        const farR = vanishX + (nearR - vanishX) * farScale;

        const path = new Path2D();
        path.moveTo(nearL, impactY);
        path.lineTo(nearR, impactY);
        path.lineTo(farR, horizonY);
        path.lineTo(farL, horizonY);
        path.closePath();

        if (rect.isBlack) {
            blackLanes.push(path);
        } else {
            whiteLanes.push(path);
        }
        
        // Store for debug (every 12th note)
        if (debugMode && i % 12 === 0) {
            debugLanes.push({ key: i, path, isBlack: rect.isBlack });
        }
    }

    return { whiteLanes, blackLanes, debugLanes, impactY, horizonY, vanishX, farScale };
  }, [layout, dimensions, highwaySettings.farScale, KEYBOARD_HEIGHT, debugMode]);


  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { width, height } = dimensions;
    const pixelRatio = window.devicePixelRatio;
    
    // Scale context for DPI
    ctx.resetTransform();
    ctx.scale(pixelRatio, pixelRatio);

    const ROLL_HEIGHT = height - KEYBOARD_HEIGHT;
    const { min, max } = layout.getRange();

    // -- Helpers --

    const getNoteColor = (midi: number, trackColor: string) => {
        return colorMode === 'note' ? getPitchClassColor(midi) : trackColor;
    };

    const getActiveColors = (key: number) => {
        const colors: string[] = [];
        // Input notes (always blue-ish or distinct)
        if (activeNotes.has(`input:${key}`)) {
            colors.push(colorMode === 'note' ? getPitchClassColor(key) : '#60a5fa');
        }
        
        // Track notes
        midiData.tracks.forEach(t => {
            if (t.isHidden) return; // Strict check: hidden tracks don't highlight
            if (activeNotes.has(`${t.id}:${key}`)) {
                colors.push(getNoteColor(key, t.color));
            }
        });
        return colors;
    };

    // --- RENDERERS ---

    const drawClassic = () => {
        // 1. Grid
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, width, height);

        // Lanes
        for (let i = min; i <= max; i++) {
            const rect = layout.getKeyRect(i);
            if (!rect) continue;
            if (!rect.isBlack) {
                // Subtle alternating lane color
                ctx.fillStyle = (i % 2 === 0) ? '#1f1f22' : '#18181b';
                ctx.fillRect(rect.x, 0, rect.width, ROLL_HEIGHT);
                
                // Borders
                ctx.strokeStyle = '#27272a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(rect.x, 0);
                ctx.lineTo(rect.x, ROLL_HEIGHT);
                ctx.stroke();
            }
        }
        // Octave lines
        ctx.strokeStyle = '#3f3f46';
        for (let i = min; i <= max; i++) {
            if (i % 12 === 0) {
                const rect = layout.getKeyRect(i);
                if (rect) {
                    ctx.beginPath();
                    ctx.moveTo(rect.x, 0);
                    ctx.lineTo(rect.x, ROLL_HEIGHT);
                    ctx.stroke();
                }
            }
        }

        // 2. Notes
        const timeWindow = ROLL_HEIGHT / zoom;
        const viewStart = currentTime;
        const viewEnd = currentTime + timeWindow;

        midiData.tracks.forEach(track => {
            if (track.isHidden) return;

            for (const note of track.notes) {
                if (note.time > viewEnd || (note.time + note.duration) < viewStart) continue;
                if (note.midi < min || note.midi > max) continue;

                const x = layout.getNoteX(note.midi);
                const w = layout.getNoteWidth(note.midi);
                if (x + w < 0 || x > width) continue;

                const distFromImpact = (note.time - currentTime) * zoom;
                const yBottom = ROLL_HEIGHT - distFromImpact;
                const barHeight = note.duration * zoom;
                const yTop = yBottom - barHeight;

                const color = getNoteColor(note.midi, track.color);
                
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.8;
                ctx.fillRect(x, yTop, w - 1, barHeight);
                
                // Inner "shine"
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.3;
                ctx.fillRect(x, yTop, w - 1, 2); 
                ctx.globalAlpha = 1.0;
            }
        });
    };

    const drawHighway = () => {
        // --- 1. PROJECTION MATH ---
        const impactY = ROLL_HEIGHT;
        const horizonY = 0; 
        const vanishX = width / 2;
        const lookahead = highwaySettings.lookahead;
        // Clamp farScale to avoid division by zero
        const farScale = Math.min(Math.max(highwaySettings.farScale, 0.01), 0.99);

        // Z Coordinate System:
        // Z=0 is the "Near Plane" (Hit Line)
        // Z=Z_RANGE is the "Far Plane" (Horizon)
        const Z_RANGE = 100; // Arbitrary world units
        
        // Calculate Focal Length (F) required to achieve 'farScale' at Z_RANGE
        const focalLength = (farScale * Z_RANGE) / (1 - farScale);

        // Derive Y-Projection constants to match geometry
        const yK = (impactY - horizonY) / (1 - farScale);
        const yVanish = impactY - yK;

        /**
         * Projects a time offset (seconds) into Screen Space (Y, Scale)
         * using constant Z velocity.
         */
        const project = (timeOffset: number) => {
            // Normalized depth fraction (0 = hit line, 1 = horizon)
            const fraction = timeOffset / lookahead;
            
            // Linear Z mapping: Distance is proportional to time
            // This ensures constant speed in world space
            const z = fraction * Z_RANGE;
            
            // Perspective Divide
            // Z can be negative (passed camera), scale becomes > 1
            // Use epsilon to prevent singularity explosion
            if (focalLength + z < 0.5) return null; // Behind camera or too close
            
            const scale = focalLength / (focalLength + z);
            
            // Map to Screen Y using derived constants
            const y = yVanish + yK * scale;

            return { y, scale, z };
        };

        // --- DRAWING ---

        // 1. Background / Sky
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);
        
        // Horizon Glow
        const grad = ctx.createLinearGradient(0, 0, 0, height/2);
        grad.addColorStop(0, '#18181b');
        grad.addColorStop(1, '#09090b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Lanes (Key-type shading)
        if (highwaySettings.laneShading && laneGeometry) {
            const contrast = highwaySettings.laneContrast ?? 0.5;
            
            // Pass 1: White Key Lanes (Base)
            // Increased opacity for visibility without outlines
            const whiteAlpha = 0.06 + (contrast * 0.15); 
            ctx.fillStyle = `rgba(255, 255, 255, ${whiteAlpha})`;
            
            for (const path of laneGeometry.whiteLanes) {
                ctx.fill(path);
            }
            
            // Pass 2: Black Key Lanes (Overlay)
            const blackAlpha = 0.2 + (contrast * 0.4); 
            ctx.fillStyle = `rgba(0, 0, 0, ${blackAlpha})`;
            
            for (const path of laneGeometry.blackLanes) {
                ctx.fill(path);
            }
            
            // Outlines and separators intentionally removed for cleaner look
        }

        // 3. Grid Lines (Horizontal beats)
        const beatInterval = 60 / midiData.header.tempo;
        const firstBeat = Math.ceil(currentTime / beatInterval) * beatInterval;
        
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Render lines up to slightly past lookahead to ensure smooth fade-in
        let t = firstBeat;
        const maxTime = currentTime + lookahead;

        while (t < maxTime) {
            const proj = project(t - currentTime);
            if (proj && proj.scale <= 1.0) { // Don't draw grid lines behind impact
                const minRect = layout.getKeyRect(min);
                const maxRect = layout.getKeyRect(max);
                if (minRect && maxRect) {
                    const nearLeft = minRect.x;
                    const nearRight = maxRect.x + maxRect.width;
                    
                    const xL = vanishX + (nearLeft - vanishX) * proj.scale;
                    const xR = vanishX + (nearRight - vanishX) * proj.scale;
                    
                    ctx.moveTo(xL, proj.y);
                    ctx.lineTo(xR, proj.y);
                }
            }
            t += beatInterval;
        }
        ctx.stroke();


        // 4. Notes (3D Quads)
        midiData.tracks.forEach(track => {
            if (track.isHidden) return;

            for (const note of track.notes) {
                // Culling: check simple time bounds first
                if (note.time > currentTime + lookahead) break; // Optimization: sorted notes
                if (note.time + note.duration < currentTime) continue;
                if (note.midi < min || note.midi > max) continue;

                const relativeStart = note.time - currentTime;
                const relativeEnd = note.time + note.duration - currentTime;

                // Project endpoints using constant Z velocity
                let pStart = project(relativeStart); 
                const projEnd = project(relativeEnd);     

                if (!projEnd) continue;
                
                // If start is behind camera, handle fallback with consistent geometry
                if (!pStart) {
                     // Extend to "off screen" bottom, but using consistent projection logic
                     // so the trapezoid widens correctly instead of flaring out infinitely.
                     const targetY = height + 100; // A bit below visible area
                     // Inverse projection: y = yVanish + yK * scale  ->  scale = (y - yVanish) / yK
                     const targetScale = (targetY - yVanish) / yK;
                     
                     pStart = {
                         y: targetY,
                         scale: targetScale,
                         z: -100 // dummy
                     };
                }
                
                // Don't render if both are behind camera logic (though culling handles most)
                if (projEnd.scale > 50) continue; 

                const rect = layout.getKeyRect(note.midi);
                if (!rect) continue;

                const noteWidth = layout.getNoteWidth(note.midi);
                const nearCenterX = rect.x + noteWidth / 2;

                // X projection is linear with scale
                const halfWStart = (noteWidth / 2) * pStart.scale;
                const halfWEnd = (noteWidth / 2) * projEnd.scale;

                const cxStart = vanishX + (nearCenterX - vanishX) * pStart.scale;
                const cxEnd = vanishX + (nearCenterX - vanishX) * projEnd.scale;

                const xBL = cxStart - halfWStart;
                const xBR = cxStart + halfWStart;
                const yB = pStart.y;

                const xTL = cxEnd - halfWEnd;
                const xTR = cxEnd + halfWEnd;
                const yT = projEnd.y;

                const color = getNoteColor(note.midi, track.color);
                
                ctx.beginPath();
                ctx.moveTo(xBL, yB);
                ctx.lineTo(xBR, yB);
                ctx.lineTo(xTR, yT);
                ctx.lineTo(xTL, yT);
                ctx.closePath();

                const grad = ctx.createLinearGradient(0, Math.min(yB, height), 0, Math.max(yT, 0));
                grad.addColorStop(0, color);
                grad.addColorStop(1, `${color}88`);
                
                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.9;
                ctx.fill();

                ctx.strokeStyle = '#ffffffaa';
                ctx.lineWidth = 1.5 * pStart.scale; 
                ctx.stroke();

                // Impact Flash
                // Check if note overlaps Z=0 (time=0)
                if (relativeStart <= 0 && relativeEnd >= 0) {
                     ctx.shadowColor = color;
                     ctx.shadowBlur = 20;
                     ctx.fillStyle = '#ffffff';
                     // Fade out flash as note progresses
                     const flashIntensity = Math.max(0, 1 + (relativeStart * 2)); // relativeStart is negative
                     ctx.globalAlpha = 0.5 * flashIntensity;
                     ctx.fill();
                     ctx.shadowBlur = 0;
                }
                ctx.globalAlpha = 1.0;
            }
        });
        
        // Debug Overlay
        if (debugMode) {
            // Physics / Projection Stats
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, impactY); ctx.lineTo(width, impactY); ctx.stroke();
            ctx.strokeStyle = 'magenta';
            ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(width, horizonY); ctx.stroke();
            ctx.fillStyle = 'cyan';
            ctx.font = '10px monospace';
            ctx.fillText(`Focal: ${focalLength.toFixed(1)} Z-Range: ${Z_RANGE}`, 10, impactY - 20);
            
            // Debug Lanes
            if (laneGeometry) {
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 1;
                for (const d of laneGeometry.debugLanes) {
                    ctx.stroke(d.path);
                    // Label
                    const rect = layout.getKeyRect(d.key);
                    if (rect) {
                        ctx.fillStyle = 'white';
                        ctx.fillText(`${d.key}${d.isBlack ? 'B' : 'W'}`, rect.x, impactY - 5);
                    }
                }
            }
        }
    };


    // 5. Draw Keyboard (Shared)
    const drawKeyboard = () => {
        const keyboardOriginY = ROLL_HEIGHT;
      
        // Pass 1: White
        for (let i = min; i <= max; i++) {
            const rect = layout.getKeyRect(i);
            if (!rect || rect.isBlack) continue;

            const colors = getActiveColors(i);
            const finalY = keyboardOriginY + rect.y;
            
            if (colors.length > 0) {
                // Active
                if (colors.length === 1) {
                    ctx.fillStyle = colors[0];
                } else {
                    const gradient = ctx.createLinearGradient(rect.x, finalY, rect.x + rect.width, finalY);
                    colors.forEach((c, idx) => {
                        gradient.addColorStop(idx / (colors.length - 1), c);
                    });
                    ctx.fillStyle = gradient;
                }
                
                // Enhanced Pressed Look
                ctx.shadowColor = colors[0];
                ctx.shadowBlur = 20;
                ctx.fillRect(rect.x + 1, finalY, rect.width - 2, rect.height);
                ctx.shadowBlur = 0;
                
                // Glossy highlight
                const grad = ctx.createLinearGradient(0, finalY, 0, finalY + rect.height);
                grad.addColorStop(0, 'rgba(255,255,255,0.4)');
                grad.addColorStop(1, 'rgba(255,255,255,0.0)');
                ctx.fillStyle = grad;
                ctx.fillRect(rect.x + 1, finalY, rect.width - 2, rect.height);

            } else {
                // Inactive
                ctx.fillStyle = '#f4f4f5';
                ctx.fillRect(rect.x + 1, finalY, rect.width - 2, rect.height);
                // Simple bevel
                ctx.fillStyle = '#e4e4e7';
                ctx.fillRect(rect.x + 1, finalY + rect.height - 5, rect.width - 2, 5);
            }
        }

        // Pass 2: Black
        for (let i = min; i <= max; i++) {
            const rect = layout.getKeyRect(i);
            if (!rect || !rect.isBlack) continue;

            const colors = getActiveColors(i);
            const finalY = keyboardOriginY + rect.y;

            if (colors.length > 0) {
                 if (colors.length === 1) {
                    ctx.fillStyle = colors[0];
                } else {
                    const gradient = ctx.createLinearGradient(rect.x, finalY, rect.x + rect.width, finalY);
                    colors.forEach((c, idx) => {
                        gradient.addColorStop(idx / (colors.length - 1), c);
                    });
                    ctx.fillStyle = gradient;
                }
                ctx.shadowColor = colors[0];
                ctx.shadowBlur = 20;
            } else {
                // Stylish black key (gradient)
                const grad = ctx.createLinearGradient(rect.x, finalY, rect.x + rect.width, finalY + rect.height);
                grad.addColorStop(0, '#27272a');
                grad.addColorStop(1, '#09090b');
                ctx.fillStyle = grad;
                ctx.shadowBlur = 0;
            }
            
            ctx.fillRect(rect.x, finalY, rect.width, rect.height);
            ctx.shadowBlur = 0;

            // Highlight Reflection on black keys
            if (colors.length === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(rect.x + 2, finalY + 2, rect.width - 4, rect.height * 0.8);
            }
        }
        
        // Separator Line
        ctx.fillStyle = '#ef4444'; 
        ctx.fillRect(0, ROLL_HEIGHT, width, 2);
    };

    const draw = () => {
        if (viewMode === 'classic') {
            drawClassic();
        } else {
            drawHighway();
        }
        drawKeyboard();
    };

    draw();
  }, [dimensions, midiData, currentTime, zoom, activeNotes, layout, debugMode, viewMode, colorMode, highwaySettings, laneGeometry]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background relative overflow-hidden">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default PianoRoll;
