import { describe, expect, it } from 'vitest';

import { TranscriptMessage, TranscriptService } from '../../src/services/transcript-service.js';

const info = {
    ticket: {
        threadId: '1',
        userId: '123',
        categoryId: 'exploiter',
        number: 7,
        open: false,
        openedAt: '2026-09-25T10:00:00.000Z',
    },
    userTag: 'eviltag',
    closedBy: 'kaden',
    closedAt: new Date('2026-09-25T11:30:00.000Z'),
    note: 'Wawa',
};

function message(role: TranscriptMessage['role'], author: string, text: string): TranscriptMessage {
    return { role, author, text, sentAt: new Date('2026-09-25T10:05:00.000Z'), attachments: [] };
}

describe('TranscriptService', () => {
    it('should include the ticket details, closing note and every message', () => {
        const html = TranscriptService.html(info, [
            message('user', 'YourFriendRobotEvil', 'Someone is flying in the lobby'),
        ]);

        expect(html).toContain('Exploiter 007');
        expect(html).toContain('diver42');
        expect(html).toContain('Closing note: banend haha');
        expect(html).toContain('class="msg user"');
        expect(html).toContain('class="msg staff"');
        expect(html).toContain('class="msg note"');
    });

    it('should escape anything users typed', () => {
        const html = TranscriptService.html(info, [
            message('user', '<img src=x>', '<script>alert(1)</script> **bold**'),
        ]);

        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;img src=x&gt;');
        expect(html).toContain('<b>bold</b>');
    });
});
