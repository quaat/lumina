
import { getPitchClass, getNoteName } from './pitch';

interface ChordTemplate {
  name: string;
  intervals: number[]; // Relative to root
  priority: number; // For breaking ties
}

const TEMPLATES: ChordTemplate[] = [
  // Triads
  { name: '', intervals: [0, 4, 7], priority: 10 }, // Major
  { name: 'm', intervals: [0, 3, 7], priority: 10 }, // Minor
  { name: 'dim', intervals: [0, 3, 6], priority: 9 },
  { name: 'aug', intervals: [0, 4, 8], priority: 9 },
  { name: 'sus4', intervals: [0, 5, 7], priority: 8 },
  { name: 'sus2', intervals: [0, 2, 7], priority: 8 },
  
  // 7ths
  { name: 'maj7', intervals: [0, 4, 7, 11], priority: 8 },
  { name: 'm7', intervals: [0, 3, 7, 10], priority: 8 },
  { name: '7', intervals: [0, 4, 7, 10], priority: 9 }, // Dominant 7
  { name: 'm7b5', intervals: [0, 3, 6, 10], priority: 7 }, // Half-dim
  { name: 'dim7', intervals: [0, 3, 6, 9], priority: 7 },
  { name: 'mM7', intervals: [0, 3, 7, 11], priority: 6 },
  
  // 6ths
  { name: '6', intervals: [0, 4, 7, 9], priority: 7 },
  { name: 'm6', intervals: [0, 3, 7, 9], priority: 7 },
];

export const detectChord = (
  pitchClasses: Set<number>, 
  bassNoteMidi: number | null
): { label: string; root: string; bass: string; confidence: number } | null => {
  if (pitchClasses.size < 2) return null; // Need at least 2 notes (dyads can imply chords)

  let bestScore = -1;
  let bestRoot = -1;
  let bestTemplate: ChordTemplate | null = null;

  // Try every pitch class present as a potential root
  const candidates = Array.from(pitchClasses);

  for (const root of candidates) {
    for (const template of TEMPLATES) {
      // Score this template for this root
      let matchCount = 0;
      let missCount = 0;
      
      // Check required intervals
      const requiredPCs = new Set(template.intervals.map(i => (root + i) % 12));
      
      for (const req of requiredPCs) {
        if (pitchClasses.has(req)) {
          matchCount++;
        }
      }

      // Penalize extra notes not in template
      for (const pc of pitchClasses) {
        if (!requiredPCs.has(pc)) {
          missCount++;
        }
      }

      // Calculate Score
      // Base score: percentage of template matched
      const coverage = matchCount / requiredPCs.size;
      
      // Penalty for noise
      const noisePenalty = missCount * 0.2;
      
      let score = coverage * 10 - noisePenalty;

      // Boost for bass note matching root (root position)
      if (bassNoteMidi !== null && getPitchClass(bassNoteMidi) === root) {
          score += 2;
      }
      
      // Boost for specific template priority
      score += template.priority * 0.1;

      // Must match at least most of the chord (e.g. 2/3 for triads, 3/4 for 7ths)
      if (coverage > 0.6) {
          if (score > bestScore) {
              bestScore = score;
              bestRoot = root;
              bestTemplate = template;
          }
      }
    }
  }

  if (bestTemplate && bestRoot !== -1) {
    const rootName = getNoteName(bestRoot);
    let label = `${rootName}${bestTemplate.name}`;
    
    // Slash Chord Logic
    let bassName = '';
    if (bassNoteMidi !== null) {
      const bassPC = getPitchClass(bassNoteMidi);
      if (bassPC !== bestRoot) {
        bassName = getNoteName(bassPC);
        label += `/${bassName}`;
      }
    }

    // Normalized confidence 0-1 (approximate mapping from score)
    const confidence = Math.min(Math.max(bestScore / 12, 0), 1);

    return { label, root: rootName, bass: bassName, confidence };
  }

  return null;
};
