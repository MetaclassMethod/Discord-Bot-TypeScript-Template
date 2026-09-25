import { describe, expect, it } from 'vitest';

import { FaqService } from '../../src/services/faq-service.js';

function top(text: string, categoryId?: string): string | undefined {
    return FaqService.match(text, categoryId)[0]?.entry.id;
}

describe('FaqService', () => {
    it('should ignore filler words and trim endings', () => {
        expect(FaqService.words('Hi, I\'m LOADING my purchases please')).toEqual([
            'load',
            'purchas',
        ]);
    });

    it('should match common data and purchase problems', () => {
        expect(top('i joined today and all my progress is gone', 'data-issue')).toBe(
            'lost-progress'
        );
        expect(top('My data got wiped after the update??', 'data-issue')).toBe('lost-progress');
        expect(top('I bought the gamepass with robux but didnt get it', 'data-issue')).toBe(
            'purchase-missing'
        );
    });

    it('should match questions', () => {
        expect(top('when is the next update coming out', 'question')).toBe('next-update');
        expect(top('the game keeps crashing, is it a bug?', 'question')).toBe('bug-report');
    });

    it('should only use entries meant for the category', () => {
        expect(top('the game keeps crashing, is it a bug?', 'data-issue')).toBeUndefined();
    });

    it('should not suggest anything for unrelated text', () => {
        expect(top('can I become a moderator for the server', 'question')).toBeUndefined();
        expect(top('ok', 'question')).toBeUndefined();
    });
});
