import { describe, it, expect } from 'vitest';
import { generateShapes, ORB_SHAPES } from '../src/orb.js';

describe('orb shapes', () => {
  it('generates bounded, deterministic positions for every shape', () => {
    const a = generateShapes(2000, 3);
    const b = generateShapes(2000, 3);
    for (const s of ORB_SHAPES) {
      expect(a.shapes[s]).toHaveLength(6000);
      expect(a.shapes[s]).toEqual(b.shapes[s]);
      const max = Math.max(...Array.from(a.shapes[s], Math.abs));
      expect(max).toBeLessThan(1.6);
      expect(Array.from(a.shapes[s]).every(Number.isFinite)).toBe(true);
    }
    expect(a.rand).toHaveLength(8000);
  });
});
