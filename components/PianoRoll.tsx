import React, { useRef, useEffect, useState } from 'react';
import { MidiData, MidiNote } from '../types';

interface PianoRollProps {
  midiData: MidiData;
  currentTime: number;
  isPlaying: boolean;
  zoom: number; // Pixels per second
  activeNotes: Set<string>; // Keys that are currently playing (trackId:noteNumber)
}

const KEYS_COUNT = 88;
const FIRST_KEY = 21; // A0
const WHITE_KEY_WIDTH_PCT = 100 / 52; // 52 white keys
const BLACK_KEY_WIDTH_PCT = WHITE_KEY_WIDTH_PCT * 0.6;

const PianoRoll: React.FC<PianoRollProps> = ({ 
  midiData, 
  currentTime, 
  isPlaying, 
  zoom,
  activeNotes
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { width, height } = dimensions;
    const pixelRatio = window.devicePixelRatio;
    
    // Scale context for DPI
    ctx.resetTransform();
    ctx.scale(pixelRatio, pixelRatio);

    // Helpers for geometry
    const KEYBOARD_HEIGHT = 100;
    const ROLL_HEIGHT = height - KEYBOARD_HEIGHT;
    
    // Key geometry
    const whiteKeys: number[] = [];
    const blackKeys: number[] = [];
    // Populate MIDI note numbers into white/black buckets based on pattern
    const isBlackKey = (midi: number) => {
      const k = midi % 12;
      return k === 1 || k === 3 || k === 6 || k === 8 || k === 10;
    };

    for(let i = FIRST_KEY; i < FIRST_KEY + KEYS_COUNT; i++) {
        if(isBlackKey(i)) blackKeys.push(i);
        else whiteKeys.push(i);
    }

    const whiteKeyWidth = width / 52;
    const blackKeyWidth = whiteKeyWidth * 0.65;

    const getNoteX = (midi: number) => {
        if (midi < FIRST_KEY || midi >= FIRST_KEY + KEYS_COUNT) return -100;
        
        let whiteKeyIndex = 0;
        for(let i=FIRST_KEY; i<midi; i++) {
            if(!isBlackKey(i)) whiteKeyIndex++;
        }
        
        const x = whiteKeyIndex * whiteKeyWidth;
        if(isBlackKey(midi)) {
            return x + (whiteKeyWidth * 0.65); // Offset for black key
        }
        return x;
    };
    
    const getNoteWidth = (midi: number) => isBlackKey(midi) ? blackKeyWidth : whiteKeyWidth - 1;

    // --- DRAW FUNCTION ---
    const draw = () => {
      // 1. Clear Background
      ctx.fillStyle = '#18181b'; // zinc-900 (surface)
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Grid (Lanes)
      ctx.fillStyle = '#27272a'; // zinc-800
      for (let i = 0; i < 52; i++) {
        if (i % 2 === 0) { // Slight subtle striping
             ctx.fillRect(i * whiteKeyWidth, 0, whiteKeyWidth, ROLL_HEIGHT);
        }
      }
      // Vertical line markers for octaves
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<52; i+=7) {
          ctx.moveTo(i * whiteKeyWidth, 0);
          ctx.lineTo(i * whiteKeyWidth, ROLL_HEIGHT);
      }
      ctx.stroke();

      // 3. Draw Notes
      // Culling: Only draw notes that are visible on screen
      // Visible time range: [currentTime, currentTime + (ROLL_HEIGHT / zoom)]
      // Note Y position = ROLL_HEIGHT - (note.time - currentTime) * zoom
      // Notes fall DOWN, so t=0 is at top? No, "falling towards keyboard".
      // Keyboard is at bottom.
      // Note(t = current) should be at ROLL_HEIGHT (hitting the keys).
      // Note(t = current + 1) should be at ROLL_HEIGHT - 1*zoom.
      
      const timeWindow = ROLL_HEIGHT / zoom;
      const viewStart = currentTime;
      const viewEnd = currentTime + timeWindow;

      midiData.tracks.forEach(track => {
        if (track.isHidden || track.isMuted) return;

        ctx.fillStyle = track.color;
        // Optimization: In a real app with 10k notes, use binary search here.
        // For < 5000 notes, linear filter is usually fine on modern JS engines.
        
        for (const note of track.notes) {
            // Check visibility overlap
            if (note.time > viewEnd || (note.time + note.duration) < viewStart) {
                continue;
            }

            const x = getNoteX(note.midi);
            if (x < 0) continue;
            
            const w = getNoteWidth(note.midi);
            
            // Calculate Y. 
            // When note.time == currentTime, bottom of note should be at ROLL_HEIGHT.
            // distance_from_impact = (note.time - currentTime) * zoom
            // y_bottom = ROLL_HEIGHT - distance_from_impact
            // y_top = y_bottom - (note.duration * zoom)
            
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
            ctx.fillRect(x, yTop, w, 2); // Top shine
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = track.color;
        }
      });

      // 4. Draw Keyboard
      const kY = ROLL_HEIGHT;
      
      // Draw White Keys
      whiteKeys.forEach(note => {
          const x = getNoteX(note);
          // Highlight if active
          let isActive = false;
          midiData.tracks.forEach(t => {
              if(!t.isMuted && activeNotes.has(`${t.id}:${note}`)) isActive = true;
          });

          if (isActive) {
              ctx.fillStyle = '#60a5fa'; // Active color
              // Bloom effect
              ctx.shadowColor = '#3b82f6';
              ctx.shadowBlur = 15;
          } else {
              ctx.fillStyle = '#f4f4f5'; // zinc-100
              ctx.shadowBlur = 0;
          }
          
          ctx.fillRect(x + 1, kY, whiteKeyWidth - 2, KEYBOARD_HEIGHT);
          ctx.shadowBlur = 0; // Reset
      });

      // Draw Black Keys (on top)
      blackKeys.forEach(note => {
          const x = getNoteX(note);
           let isActive = false;
          midiData.tracks.forEach(t => {
              if(!t.isMuted && activeNotes.has(`${t.id}:${note}`)) isActive = true;
          });

          if (isActive) {
               ctx.fillStyle = '#60a5fa';
               ctx.shadowColor = '#3b82f6';
               ctx.shadowBlur = 15;
          } else {
              ctx.fillStyle = '#18181b'; // zinc-900
              ctx.shadowBlur = 0;
          }
          
          ctx.fillRect(x, kY, blackKeyWidth, KEYBOARD_HEIGHT * 0.65);
          ctx.shadowBlur = 0;
      });
      
      // Top border of keyboard
      ctx.fillStyle = '#ef4444'; // Red line (The "Now" line)
      ctx.fillRect(0, ROLL_HEIGHT, width, 2);

    };

    draw();
    // We don't need requestAnimationFrame here because the parent component
    // drives the re-renders via the 'currentTime' prop update which triggers this effect.
    // However, for super smooth visuals independent of React render cycle, 
    // we would typically use a ref for currentTime and a RAF loop. 
    // Given the constraints and React structure, let's keep it simple: 
    // The parent updates `currentTime` via state, triggering re-render.
    // OPTIMIZATION: If this lags, move draw() to a RAF loop and use a ref for time.
    
  }, [dimensions, midiData, currentTime, zoom, activeNotes]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background relative overflow-hidden">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default PianoRoll;
