import { afterEach, describe, expect, it, vi } from 'vitest';

import { RandomUtils } from '../../src/utils/index.js';

vi.mock('../../config/config.json', () => ({}));
vi.mock('../../config/debug.json', () => ({}));
vi.mock('../../lang/logs.json', () => ({}));

describe('RandomUtils', () => {
    const originalRandom = Math.random;

    afterEach(() => {
        Math.random = originalRandom;
    });

    describe('intFromInterval', () => {
        it('should return a number within the specified range', () => {
            for (let i = 0; i < 100; i++) {
                const min = 5;
                const max = 10;
                const result = RandomUtils.intFromInterval(min, max);

                expect(result).toBeGreaterThanOrEqual(min);
                expect(result).toBeLessThanOrEqual(max);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('should use Math.random correctly', () => {
            Math.random = vi.fn().mockReturnValue(0.5);

            const result = RandomUtils.intFromInterval(1, 10);

            expect(result).toBe(6);
            expect(Math.random).toHaveBeenCalled();
        });

        it('should handle min equal to max', () => {
            const result = RandomUtils.intFromInterval(5, 5);
            expect(result).toBe(5);
        });

        it('should handle negative ranges', () => {
            Math.random = vi.fn().mockReturnValue(0.5);

            const result = RandomUtils.intFromInterval(-10, -5);

            expect(result).toBe(-7);
        });
    });

    describe('shuffle', () => {
        it('should maintain the same elements after shuffling', () => {
            const original = [1, 2, 3, 4, 5];
            const shuffled = RandomUtils.shuffle([...original]);

            expect(shuffled.length).toBe(original.length);
            original.forEach(item => {
                expect(shuffled).toContain(item);
            });
        });

        it('should shuffle elements based on Math.random', () => {
            const randomValues = [0.5, 0.1, 0.9, 0.3];
            let callCount = 0;
            Math.random = vi.fn().mockImplementation(() => {
                return randomValues[callCount++ % randomValues.length];
            });

            const original = [1, 2, 3, 4];
            const shuffled = RandomUtils.shuffle([...original]);

            expect(shuffled).not.toEqual(original);
            expect(Math.random).toHaveBeenCalled();
        });

        it('should handle empty arrays', () => {
            const result = RandomUtils.shuffle([]);
            expect(result).toEqual([]);
        });

        it('should handle single-element arrays', () => {
            const result = RandomUtils.shuffle([1]);
            expect(result).toEqual([1]);
        });

        it('should return the input array reference', () => {
            const input = [1, 2, 3];
            const result = RandomUtils.shuffle(input);
            expect(result).toBe(input);
        });
    });
});
