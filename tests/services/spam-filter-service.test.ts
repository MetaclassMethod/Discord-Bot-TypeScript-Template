import { describe, expect, it } from 'vitest';

import { SpamFilterService } from '../../src/services/index.js';

const RULES = ['blocked phrase', ['alpha', 'omega']];

describe('SpamFilterService', () => {
    describe('match', () => {
        it('should match a phrase regardless of case and punctuation', () => {
            expect(SpamFilterService.match('Is this the BLOCKED, phrase?', RULES)).toBe(
                'blocked phrase'
            );
        });

        it('should see through leetspeak, accents and stretched letters', () => {
            expect(SpamFilterService.match('bl0cked phrâseeee', RULES)).toBe('blocked phrase');
        });

        it('should see through spaced out letters', () => {
            expect(SpamFilterService.match('b l o c k e d p h r a s e', RULES)).toBe(
                'blocked phrase'
            );
        });

        it('should require every term of a term list', () => {
            expect(SpamFilterService.match('omega then alpha', RULES)).toEqual(['alpha', 'omega']);
            expect(SpamFilterService.match('just alpha', RULES)).toBeUndefined();
        });

        it('should not match terms inside other words', () => {
            expect(SpamFilterService.match('alphabet omegas', RULES)).toBeUndefined();
        });

        it('should ignore normal bug reports', () => {
            expect(
                SpamFilterService.match('The door never opens after I pull the lever.', RULES)
            ).toBeUndefined();
        });

        it('should block the configured names without catching normal words', () => {
            const names = ['zeal', 'ren', 'wil', 'zerum'];
            expect(SpamFilterService.match('what about z3al', names)).toBe('zeal');
            expect(SpamFilterService.match('REN did it', names)).toBe('ren');
            expect(SpamFilterService.match('z e r u m', names)).toBeUndefined();
            expect(SpamFilterService.match('I will render the scene', names)).toBeUndefined();
        });
    });
});
