
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
  isFullscreen?: boolean;
  impactBursts?: Array<{ id: number; midi: number; intensity: number }>;
}

interface Point { x: number; y: number; }
interface KeyboardKeyGeometry {
  midi: number;
  isBlack: boolean;
  topPoly: Point[];
  frontPoly: Point[];
  shadowPoly?: Point[];
}


interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

class ParticleSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];

  private obtainParticle(): Particle {
    const reused = this.pool.pop();
    if (reused) {
      reused.active = true;
      return reused;
    }
    return {
      active: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      radius: 1,
      color: '#ffffff'
    };
  }

  private recycleParticle(particle: Particle) {
    particle.active = false;
    this.pool.push(particle);
  }

  addBurst(x: number, y: number, intensity: number) {
    const count = Math.floor(18 + intensity * 22);
    const palette = ['#31f3ff', '#ff42e6', '#b7ff37', '#7c83ff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180 * intensity;
      const particle = this.obtainParticle();
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - (20 + Math.random() * 40);
      particle.life = 0;
      particle.maxLife = 0.25 + Math.random() * 0.45;
      particle.radius = 1 + Math.random() * 3;
      particle.color = palette[i % palette.length];
      this.particles.push(particle);
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        this.recycleParticle(p);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.particles.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = `${p.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (0.8 + alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
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
  highwaySettings,
  isFullscreen = false,
  impactBursts = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const particlesRef = useRef(new ParticleSystem());
  const lastFrameRef = useRef(performance.now());
  const keyPressRef = useRef(new Map<number, number>());
  const keyGlintRef = useRef(new Map<number, number>());

  // Fixed keyboard height - always visible
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



  useEffect(() => {
    if (!layout || impactBursts.length === 0) return;
    for (const burst of impactBursts) {
      const keyRect = layout.getKeyRect(burst.midi);
      if (!keyRect) continue;
      const x = keyRect.x + keyRect.width / 2;
      const y = dimensions.height - KEYBOARD_HEIGHT + 6;
      particlesRef.current.addBurst(x, y, burst.intensity);
    }
  }, [impactBursts, layout, dimensions.height]);

  // Precompute Lane & Keyboard Geometry
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
    const keyboardKeys: KeyboardKeyGeometry[] = [];

    // Projection Constants for Keyboard
    // Inverse projection: scale = (y - yVanish) / yK
    const yK = (impactY - horizonY) / (1 - farScale);
    const yVanish = impactY - yK;
    const getScaleAtY = (y: number) => (y - yVanish) / yK;

    // Keyboard 3D settings
    const KEY_THICKNESS = 15;
    const BLACK_KEY_LIFT = 6;
    const BLACK_KEY_LENGTH_MOD = 0.65;

    // Y-Planes (only relevant if keyboard is visible)
    const yKeyBack = impactY;
    const yKeyFront = height - KEY_THICKNESS;
    const scaleFront = getScaleAtY(yKeyFront);

    for (let i = min; i <= max; i++) {
        const rect = layout.getKeyRect(i);
        if (!rect) continue;

        // --- LANE GEOMETRY (Background) ---
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

        if (debugMode && i % 12 === 0) {
            debugLanes.push({ key: i, path, isBlack: rect.isBlack });
        }

        // --- KEYBOARD GEOMETRY (3D Keys) ---
        if (highwaySettings.keyboardMode === '3d') {
            if (!rect.isBlack) {
                // White Key
                const xBL = nearL;
                const xBR = nearR;
                const xFL = vanishX + (nearL - vanishX) * scaleFront;
                const xFR = vanishX + (nearR - vanishX) * scaleFront;

                keyboardKeys.push({
                    midi: i,
                    isBlack: false,
                    topPoly: [
                        { x: xBL, y: yKeyBack },
                        { x: xBR, y: yKeyBack },
                        { x: xFR, y: yKeyFront },
                        { x: xFL, y: yKeyFront }
                    ],
                    frontPoly: [
                        { x: xFL, y: yKeyFront },
                        { x: xFR, y: yKeyFront },
                        { x: xFR, y: height },
                        { x: xFL, y: height }
                    ]
                });
            } else {
                // Black Key
                const yBlackFrontRaw = yKeyBack + (yKeyFront - yKeyBack) * BLACK_KEY_LENGTH_MOD;
                const scaleBlackFront = getScaleAtY(yBlackFrontRaw);

                const yB = yKeyBack - BLACK_KEY_LIFT;
                const yF = yBlackFrontRaw - BLACK_KEY_LIFT;

                const xBL = nearL;
                const xBR = nearR;
                const xFL = vanishX + (nearL - vanishX) * scaleBlackFront;
                const xFR = vanishX + (nearR - vanishX) * scaleBlackFront;

                const shadowPoly = [
                     { x: xBL + 2, y: yKeyBack },
                     { x: xBR + 2, y: yKeyBack },
                     { x: xFR + 6, y: yBlackFrontRaw },
                     { x: xFL + 6, y: yBlackFrontRaw }
                ];

                keyboardKeys.push({
                    midi: i,
                    isBlack: true,
                    topPoly: [
                        { x: xBL, y: yB },
                        { x: xBR, y: yB },
                        { x: xFR, y: yF },
                        { x: xFL, y: yF }
                    ],
                    frontPoly: [
                        { x: xFL, y: yF },
                        { x: xFR, y: yF },
                        { x: xFR, y: yF + 8 },
                        { x: xFL, y: yF + 8 }
                    ],
                    shadowPoly
                });
            }
        }
    }

    return { whiteLanes, blackLanes, debugLanes, keyboardKeys, impactY, horizonY, vanishX, farScale };
  }, [layout, dimensions, highwaySettings.farScale, KEYBOARD_HEIGHT, debugMode, highwaySettings.keyboardMode]);


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
        ctx.fillStyle = '#0b0a16';
        ctx.fillRect(0, 0, width, height);

        // Lanes
        for (let i = min; i <= max; i++) {
            const rect = layout.getKeyRect(i);
            if (!rect) continue;
            if (!rect.isBlack) {
                // Subtle alternating lane color
                ctx.fillStyle = (i % 2 === 0) ? 'rgba(49,243,255,0.06)' : 'rgba(255,66,230,0.05)';
                ctx.fillRect(rect.x, 0, rect.width, ROLL_HEIGHT);

                // Borders
                ctx.strokeStyle = 'rgba(126, 106, 182, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(rect.x, 0);
                ctx.lineTo(rect.x, ROLL_HEIGHT);
                ctx.stroke();
            }
        }
        // Octave lines
        ctx.strokeStyle = 'rgba(183,255,55,0.35)';
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
                const noteWidth = w - 1;
                const sheenCycle = (performance.now() * 0.0018 + note.midi * 0.12) % 1;
                const sheenY = yTop + sheenCycle * barHeight;

                // Keep original base color fill
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.82;
                ctx.fillRect(x, yTop, noteWidth, barHeight);

                // Additive neon bloom (visual-only)
                ctx.globalAlpha = 0.38;
                ctx.shadowColor = color;
                ctx.shadowBlur = 14;
                ctx.fillRect(x, yTop, noteWidth, barHeight);
                ctx.shadowBlur = 0;

                // Edge lighting
                ctx.globalAlpha = 0.8;
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, yTop + 0.5, Math.max(0, noteWidth - 1), Math.max(0, barHeight - 1));

                // Glass overlay + subtle moving sheen
                ctx.fillStyle = 'rgba(255,255,255,0.11)';
                ctx.fillRect(x + 1, yTop + 1, Math.max(0, noteWidth - 2), Math.min(4, barHeight * 0.15));
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(x + 1, sheenY, Math.max(0, noteWidth - 2), 2);

                // Faint comet trail behind falling note
                const trailHeight = Math.min(16, barHeight * 0.4);
                ctx.fillStyle = `${color}44`;
                ctx.fillRect(x + noteWidth * 0.2, yTop - trailHeight, noteWidth * 0.6, trailHeight);

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
        ctx.fillStyle = '#070511';
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
                     const targetY = height + 100; // A bit below visible area
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

                // Keep original base color fill
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.82;
                ctx.fill();

                // Neon bloom
                ctx.globalAlpha = 0.33;
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Edge lighting
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = Math.max(1, 1.25 * pStart.scale);
                ctx.stroke();

                // Impact Flash
                if (relativeStart <= 0 && relativeEnd >= 0) {
                     ctx.shadowColor = color;
                     ctx.shadowBlur = 20;
                     ctx.fillStyle = '#ffffff';
                     const flashIntensity = Math.max(0, 1 + (relativeStart * 2));
                     ctx.globalAlpha = 0.5 * flashIntensity;
                     ctx.fill();
                     ctx.shadowBlur = 0;
                }
                ctx.globalAlpha = 1.0;
            }
        });
    };

    const drawPoly = (points: Point[], color: string | CanvasGradient) => {
        if (points.length < 3) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
    };

    const draw3DKeyboard = () => {
        if (!laneGeometry) return;
        const { keyboardKeys } = laneGeometry;
        const now = performance.now() * 0.001;

        const createPolyPath = (points: Point[]) => {
            const path = new Path2D();
            path.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
            path.closePath();
            return path;
        };

        const drawPolyOverlay = (points: Point[], painter: () => void) => {
            const path = createPolyPath(points);
            ctx.save();
            ctx.clip(path);
            painter();
            ctx.restore();
        };

        // Gradients
        const gradWhite = ctx.createLinearGradient(0, laneGeometry.impactY, 0, height);
        gradWhite.addColorStop(0, '#d9dce1');
        gradWhite.addColorStop(0.38, '#f4f5f0');
        gradWhite.addColorStop(0.75, '#fffdfa');
        gradWhite.addColorStop(1, '#e2e5e9');

        const gradBlack = ctx.createLinearGradient(0, laneGeometry.impactY - 8, 0, height);
        gradBlack.addColorStop(0, '#474b51');
        gradBlack.addColorStop(0.4, '#1f232a');
        gradBlack.addColorStop(1, '#090b10');

        // Draw White Keys first
        keyboardKeys.filter(k => !k.isBlack).forEach(key => {
            const activeColors = getActiveColors(key.midi);
            const pressAmount = keyPressRef.current.get(key.midi) ?? 0;
            const shimmer = 0.5 + 0.5 * Math.sin(now * 0.75 + key.midi * 0.33);
            const glint = keyGlintRef.current.get(key.midi) ?? 0;

            // Top Surface
            if (activeColors.length > 0) {
                 drawPoly(key.topPoly, activeColors[0]);

                 // Glow
                 ctx.shadowColor = activeColors[0];
                 ctx.shadowBlur = 15 + glint * 12;
                 drawPoly(key.topPoly, `rgba(255,255,255,0.4)`);
                 ctx.shadowBlur = 0;
            } else {
                 drawPoly(key.topPoly, gradWhite);
            }

            drawPolyOverlay(key.topPoly, () => {
                const yMin = Math.min(...key.topPoly.map(p => p.y));
                const yMax = Math.max(...key.topPoly.map(p => p.y));
                const xMin = Math.min(...key.topPoly.map(p => p.x));
                const xMax = Math.max(...key.topPoly.map(p => p.x));

                const lacquer = ctx.createLinearGradient(0, yMin, 0, yMax);
                lacquer.addColorStop(0, `rgba(255,255,255,${0.3 + shimmer * 0.08 - pressAmount * 0.1})`);
                lacquer.addColorStop(0.22, 'rgba(255,255,255,0.16)');
                lacquer.addColorStop(0.72, 'rgba(255,255,255,0.04)');
                lacquer.addColorStop(1, 'rgba(120,126,136,0.12)');
                ctx.fillStyle = lacquer;
                ctx.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);

                const streakX = xMin + (xMax - xMin) * ((now * 0.03 + key.midi * 0.07) % 1);
                const streak = ctx.createLinearGradient(streakX - 28, yMin, streakX + 28, yMax);
                streak.addColorStop(0, 'rgba(255,255,255,0)');
                streak.addColorStop(0.5, `rgba(255,255,255,${0.14 + glint * 0.22})`);
                streak.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = streak;
                ctx.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);
            });

            // Front Face (Thickness)
            const frontGrad = ctx.createLinearGradient(0, key.frontPoly[0].y, 0, key.frontPoly[2].y);
            frontGrad.addColorStop(0, '#c7ccd4');
            frontGrad.addColorStop(1, '#8d95a0');
            drawPoly(key.frontPoly, frontGrad);
        });

        // Draw Black Keys on top
        keyboardKeys.filter(k => k.isBlack).forEach(key => {
            const activeColors = getActiveColors(key.midi);
            const glint = keyGlintRef.current.get(key.midi) ?? 0;
            const pressAmount = keyPressRef.current.get(key.midi) ?? 0;
            const shimmer = 0.5 + 0.5 * Math.sin(now * 0.95 + key.midi * 0.41);

            // Shadow
            if (key.shadowPoly) {
                drawPoly(key.shadowPoly, 'rgba(0,0,0,0.34)');
            }

            // Top Surface
            if (activeColors.length > 0) {
                 ctx.fillStyle = activeColors[0];
                 drawPoly(key.topPoly, activeColors[0]);

                 ctx.shadowColor = activeColors[0];
                 ctx.shadowBlur = 15 + glint * 10;
                 drawPoly(key.topPoly, `rgba(255,255,255,0.2)`);
                 ctx.shadowBlur = 0;
            } else {
                 drawPoly(key.topPoly, gradBlack);
            }

            drawPolyOverlay(key.topPoly, () => {
                const yMin = Math.min(...key.topPoly.map(p => p.y));
                const yMax = Math.max(...key.topPoly.map(p => p.y));
                const xMin = Math.min(...key.topPoly.map(p => p.x));
                const xMax = Math.max(...key.topPoly.map(p => p.x));

                const gloss = ctx.createLinearGradient(0, yMin, xMax, yMax);
                gloss.addColorStop(0, `rgba(255,255,255,${0.22 + shimmer * 0.06})`);
                gloss.addColorStop(0.28, 'rgba(255,255,255,0.08)');
                gloss.addColorStop(0.6, 'rgba(255,255,255,0.01)');
                gloss.addColorStop(1, 'rgba(0,0,0,0.18)');
                ctx.fillStyle = gloss;
                ctx.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);

                const edgeLight = ctx.createLinearGradient(xMin, yMin, xMin + (xMax - xMin) * 0.6, yMin);
                edgeLight.addColorStop(0, `rgba(255,255,255,${0.16 + glint * 0.24 - pressAmount * 0.08})`);
                edgeLight.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = edgeLight;
                ctx.fillRect(xMin, yMin, xMax - xMin, (yMax - yMin) * 0.6);
            });

            // Front Face
            const blackFront = ctx.createLinearGradient(0, key.frontPoly[0].y, 0, key.frontPoly[2].y);
            blackFront.addColorStop(0, '#181a20');
            blackFront.addColorStop(1, '#05070b');
            drawPoly(key.frontPoly, blackFront);
        });
    };

    let frameDt = 0.016;

    const draw2DKeyboard = () => {
        const keyboardOriginY = ROLL_HEIGHT;

        const updatePressAmount = (midi: number, isActive: boolean) => {
            const current = keyPressRef.current.get(midi) ?? 0;
            const target = isActive ? 1 : 0;
            const attack = 0.11;
            const release = 0.16;
            const factor = Math.min(1, frameDt / (isActive ? attack : release));
            const next = current + (target - current) * factor;
            keyPressRef.current.set(midi, next);
            return next;
        };

        const getScaledRect = (x: number, y: number, w: number, h: number, scale: number) => {
            const nw = w * scale;
            const nh = h * scale;
            return {
                x: x + (w - nw) / 2,
                y: y + (h - nh) / 2,
                w: nw,
                h: nh
            };
        };

        const now = performance.now() * 0.001;

        // Pass 1: White
        for (let i = min; i <= max; i++) {
            const rect = layout.getKeyRect(i);
            if (!rect || rect.isBlack) continue;

            const colors = getActiveColors(i);
            const finalY = keyboardOriginY + rect.y;

            const pressAmount = updatePressAmount(i, colors.length > 0);
            const pressScale = 1 - 0.018 * pressAmount;
            const scaledRect = getScaledRect(rect.x + 1, finalY, rect.width - 2, rect.height, pressScale);
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
                ctx.shadowBlur = 16 + pressAmount * 12;
                ctx.fillRect(scaledRect.x, scaledRect.y, scaledRect.w, scaledRect.h);
                ctx.shadowBlur = 0;

                keyGlintRef.current.set(i, Math.min(1, (keyGlintRef.current.get(i) ?? 0) + 0.22));

                const grad = ctx.createLinearGradient(0, finalY, 0, finalY + rect.height);
                grad.addColorStop(0, 'rgba(255,255,255,0.4)');
                grad.addColorStop(1, 'rgba(255,255,255,0.0)');
                ctx.fillStyle = grad;
                ctx.fillRect(scaledRect.x, scaledRect.y, scaledRect.w, scaledRect.h);

            } else {
                const ivory = ctx.createLinearGradient(0, finalY, 0, finalY + rect.height);
                ivory.addColorStop(0, '#fdfdf8');
                ivory.addColorStop(0.38, '#f5f3eb');
                ivory.addColorStop(0.82, '#ece9de');
                ivory.addColorStop(1, '#d8d5cc');
                ctx.fillStyle = ivory;
                ctx.fillRect(rect.x + 1, finalY, rect.width - 2, rect.height);
            }

            const shimmer = 0.5 + 0.5 * Math.sin(now * 0.8 + i * 0.27);
            const glint = keyGlintRef.current.get(i) ?? 0;
            const sheen = ctx.createLinearGradient(rect.x, finalY, rect.x + rect.width, finalY + rect.height * 0.5);
            sheen.addColorStop(0, 'rgba(255,255,255,0)');
            sheen.addColorStop(0.45, `rgba(255,255,255,${0.08 + shimmer * 0.05 + glint * 0.18})`);
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen;
            ctx.fillRect(scaledRect.x, scaledRect.y, scaledRect.w, scaledRect.h * 0.75);

            const topStrip = ctx.createLinearGradient(0, finalY, 0, finalY + rect.height * 0.2);
            topStrip.addColorStop(0, `rgba(255,255,255,${0.38 - pressAmount * 0.15})`);
            topStrip.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = topStrip;
            ctx.fillRect(scaledRect.x, scaledRect.y, scaledRect.w, scaledRect.h * 0.2);

            ctx.strokeStyle = 'rgba(120,120,135,0.28)';
            ctx.lineWidth = 1;
            ctx.strokeRect(scaledRect.x + 0.5, scaledRect.y + 0.5, scaledRect.w - 1, scaledRect.h - 1);

            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(scaledRect.x, scaledRect.y + scaledRect.h - 3, scaledRect.w, 3);

            const pressOffset = 1 + pressAmount * 2;
            ctx.fillStyle = `rgba(0,0,0,${0.07 + pressAmount * 0.1})`;
            ctx.fillRect(scaledRect.x + 1, scaledRect.y + scaledRect.h + pressOffset, scaledRect.w - 2, 2);
        }

        // Pass 2: Black
        for (let i = min; i <= max; i++) {
            const rect = layout.getKeyRect(i);
            if (!rect || !rect.isBlack) continue;

            const colors = getActiveColors(i);
            const finalY = keyboardOriginY + rect.y;

            const pressAmount = updatePressAmount(i, colors.length > 0);
            const pressScale = 1 - 0.02 * pressAmount;
            const scaledRect = getScaledRect(rect.x, finalY, rect.width, rect.height, pressScale);
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
                ctx.shadowBlur = 16 + pressAmount * 12;
                keyGlintRef.current.set(i, Math.min(1, (keyGlintRef.current.get(i) ?? 0) + 0.25));
            } else {
                const grad = ctx.createLinearGradient(rect.x, finalY, rect.x + rect.width, finalY + rect.height);
                grad.addColorStop(0, '#4a4f57');
                grad.addColorStop(0.5, '#1a1e26');
                grad.addColorStop(1, '#07090d');
                ctx.fillStyle = grad;
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(scaledRect.x, scaledRect.y, scaledRect.w, scaledRect.h);
            ctx.shadowBlur = 0;

            if (colors.length === 0) {
                const glint = keyGlintRef.current.get(i) ?? 0;
                const shimmer = 0.5 + 0.5 * Math.sin(now * 0.9 + i * 0.31);
                const gloss = ctx.createLinearGradient(rect.x + 1, finalY + 2, rect.x + rect.width, finalY + rect.height * 0.8);
                gloss.addColorStop(0, `rgba(255,255,255,${0.22 + shimmer * 0.08 + glint * 0.2})`);
                gloss.addColorStop(0.45, 'rgba(255,255,255,0.06)');
                gloss.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gloss;
                ctx.fillRect(rect.x + 1, finalY + 2, rect.width - 2, rect.height * 0.78);

                const rim = ctx.createLinearGradient(rect.x, finalY, rect.x + rect.width * 0.6, finalY);
                rim.addColorStop(0, 'rgba(255,255,255,0.12)');
                rim.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = rim;
                ctx.fillRect(rect.x, finalY, rect.width, 2);
            }

            ctx.fillStyle = `rgba(0,0,0,${0.18 + pressAmount * 0.18})`;
            ctx.fillRect(scaledRect.x + 1, scaledRect.y + scaledRect.h + 1, scaledRect.w - 2, 2);
        }

        for (const [midi, amount] of keyGlintRef.current.entries()) {
            const next = Math.max(0, amount - frameDt * 2.2);
            if (next <= 0.001) keyGlintRef.current.delete(midi);
            else keyGlintRef.current.set(midi, next);
        }

        const strikeLine = ctx.createLinearGradient(0, ROLL_HEIGHT, width, ROLL_HEIGHT + 2);
        strikeLine.addColorStop(0, '#f97316');
        strikeLine.addColorStop(0.5, '#ef4444');
        strikeLine.addColorStop(1, '#f97316');
        ctx.fillStyle = strikeLine;
        ctx.fillRect(0, ROLL_HEIGHT, width, 2);
    };

    const draw = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
        frameDt = dt;
        lastFrameRef.current = now;

        if (viewMode === 'classic') {
            drawClassic();
        } else {
            drawHighway();
        }

        if (viewMode === 'highway' && highwaySettings.keyboardMode === '3d') {
            draw3DKeyboard();
        } else {
            draw2DKeyboard();
        }
        particlesRef.current.update(dt);
        particlesRef.current.draw(ctx);
    };

    draw();
  }, [dimensions, midiData, currentTime, zoom, activeNotes, layout, debugMode, viewMode, colorMode, highwaySettings, laneGeometry, isFullscreen]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background/20 relative overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default PianoRoll;
