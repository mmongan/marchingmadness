import { describe, it, expect } from 'vitest';

describe('Basketball Physics Helpers', () => {
    it('math for ball size should roughly match a standard basketball', () => {
        const diameter = 0.24; // Meters
        expect(diameter).toBeGreaterThan(0.2);
        expect(diameter).toBeLessThan(0.3);
    });

    it('gravity is standard', () => {
        const defaultGravity = -9.81;
        expect(defaultGravity).toBe(-9.81);
    });
});