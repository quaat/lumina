import React, { useRef, useEffect, useState, useMemo } from 'react';
import { MidiData } from '../types';
import { KeyLayout, FIRST_KEY, KEYS_COUNT } from '../services/KeyLayout';

interface PianoRollProps {
  midiData: MidiData;
  currentTime: number;
  isPlaying: boolean;
  zoom: number; // Pixels per second
  activeNotes: Set<string>; // Keys that are currently playing (trackId:noteNumber)
  debugMode?: boolean;
}

const PianoRoll: React.FC<PianoRollProps> = ({ 
  midiData, 
  currentTime, 
  isPlaying, 
  zoom,
  activeNotes,
  debugMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Instantiate layout engine when width changes
  const layout = useMemo(() => {
    if (dimensions.width === 0) return null;
    return new KeyLayout(dimensions.width);
  }, [dimensions.width]);

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

    const KEYBOARD_HEIGHT = 100;
    const ROLL_HEIGHT = height - KEYBOARD_HEIGHT;

    // --- DRAW FUNCTION ---
    const draw = () => {
      // 1. Clear Background
      ctx.fillStyle = '#18181b'; // zinc-900 (surface)
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Grid (Lanes - based on White Keys)
      ctx.fillStyle = '#27272a'; // zinc-800
      
      // We iterate the layout to draw grid lines
      for (let i = FIRST_KEY; i < FIRST_KEY + KEYS_COUNT; i++) {
        const rect = layout.getKeyRect(i);
        if (!rect) continue;

        if (!rect.isBlack) {
            // Draw lane background/striping
            // Check if it's an even white key index for striping?
            // Simple logic: just draw borders
        }
      }

      // Vertical line markers for octaves
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Find C's
      for (let i = FIRST_KEY; i < FIRST_KEY + KEYS_COUNT; i++) {
         if (i % 12 === 0) { // C
            const rect = layout.getKeyRect(i);
            if (rect) {
                ctx.moveTo(rect.x, 0);
                ctx.lineTo(rect.x, ROLL_HEIGHT);
            }
         }
      }
      ctx.stroke();

      // 3. Draw Notes
      const timeWindow = ROLL_HEIGHT / zoom;
      const viewStart = currentTime;
      const viewEnd = currentTime + timeWindow;

      midiData.tracks.forEach(track => {
        if (track.isHidden || track.isMuted) return;

        ctx.fillStyle = track.color;
        
        for (const note of track.notes) {
            if (note.time > viewEnd || (note.time + note.duration) < viewStart) {
                continue;
            }

            const x = layout.getNoteX(note.midi);
            const w = layout.getNoteWidth(note.midi);
            
            if (x < 0) continue;
            
            const distFromImpact = (note.time - currentTime) * zoom;
            const yBottom = ROLL_HEIGHT - distFromImpact;
            const barHeight = note.duration * zoom;
            const yTop = yBottom - barHeight;

            // Simple gradient
            ctx.globalAlpha = 0.8;
            ctx.fillRect(x, yTop, w, barHeight);
            
            // Note internal highlight
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.3;
            ctx.fillRect(x, yTop, w, 2); 
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = track.color;

            // --- DEBUG OVERLAY (Note Level) ---
            if (debugMode) {
                const rect = layout.getKeyRect(note.midi);
                if (rect) {
                    ctx.save();
                    // Draw connection line to key center
                    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x + w/2, yBottom);
                    ctx.lineTo(rect.centerX, ROLL_HEIGHT);
                    ctx.stroke();
                    
                    // Draw text info on the note
                    if (barHeight > 10) {
                        ctx.fillStyle = 'white';
                        ctx.font = '10px monospace';
                        ctx.fillText(`${note.midi}`, x, yBottom - 2);
                    }
                    ctx.restore();
                }
            }
        }
      });

      // 4. Draw Keyboard
      const kY = ROLL_HEIGHT;
      
      // Draw Keys using Layout
      // Two passes: White then Black
      
      // Pass 1: White
      for (let i = FIRST_KEY; i < FIRST_KEY + KEYS_COUNT; i++) {
        const rect = layout.getKeyRect(i);
        if (!rect || rect.isBlack) continue;

        let isActive = false;
        midiData.tracks.forEach(t => {
            if(!t.isMuted && activeNotes.has(`${t.id}:${i}`)) isActive = true;
        });
        if (activeNotes.has(`input:${i}`)) isActive = true;

        if (isActive) {
            ctx.fillStyle = '#60a5fa';
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = '#f4f4f5';
            ctx.shadowBlur = 0;
        }
        
        ctx.fillRect(rect.x + 1, kY, rect.width - 2, KEYBOARD_HEIGHT);
        ctx.shadowBlur = 0;

        // Debug Key Label
        if (debugMode) {
             ctx.fillStyle = '#999';
             ctx.font = '9px monospace';
             ctx.fillText(`${i}`, rect.x + 2, kY + KEYBOARD_HEIGHT - 5);
        }
      }

      // Pass 2: Black
      for (let i = FIRST_KEY; i < FIRST_KEY + KEYS_COUNT; i++) {
        const rect = layout.getKeyRect(i);
        if (!rect || !rect.isBlack) continue;

        let isActive = false;
        midiData.tracks.forEach(t => {
            if(!t.isMuted && activeNotes.has(`${t.id}:${i}`)) isActive = true;
        });
        if (activeNotes.has(`input:${i}`)) isActive = true;

        if (isActive) {
             ctx.fillStyle = '#60a5fa';
             ctx.shadowColor = '#3b82f6';
             ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = '#18181b';
            ctx.shadowBlur = 0;
        }
        
        ctx.fillRect(rect.x, kY, rect.width, KEYBOARD_HEIGHT * 0.65);
        ctx.shadowBlur = 0;

        if (debugMode) {
             ctx.fillStyle = '#555'; // Darker text on black key (which is actually black) - wait, key is black. Text should be white-ish.
             ctx.fillStyle = '#ccc';
             ctx.font = '9px monospace';
             ctx.fillText(`${i}`, rect.x + 1, kY + 10);
        }
      }
      
      // Top border of keyboard
      ctx.fillStyle = '#ef4444'; 
      ctx.fillRect(0, ROLL_HEIGHT, width, 2);

      // Debug: Draw vertical alignment lines for all keys
      if (debugMode) {
          ctx.globalAlpha = 0.2;
          ctx.strokeStyle = 'cyan';
          for (let i = FIRST_KEY; i < FIRST_KEY + KEYS_COUNT; i++) {
              const rect = layout.getKeyRect(i);
              if (rect) {
                  ctx.beginPath();
                  ctx.moveTo(rect.centerX, 0);
                  ctx.lineTo(rect.centerX, height);
                  ctx.stroke();
              }
          }
          ctx.globalAlpha = 1.0;
      }
    };

    draw();
  }, [dimensions, midiData, currentTime, zoom, activeNotes, layout, debugMode]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background relative overflow-hidden">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default PianoRoll;
