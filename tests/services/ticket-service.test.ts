import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { TicketService } from '../../src/services/ticket-service.js';

describe('TicketService', () => {
    beforeEach(() => {
        let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickets-'));
        TicketService.useStore(path.join(dir, 'tickets.json'));
    });

    it('should name tickets by category with a padded number', () => {
        expect(TicketService.title({ categoryId: 'exploiter', number: 1 })).toBe('Exploiter 001');
        expect(TicketService.title({ categoryId: 'player-report', number: 5 })).toBe(
            'Player Report 005'
        );
    });

    it('should count each category separately', () => {
        expect(TicketService.nextNumber('exploiter')).toBe(1);
        expect(TicketService.nextNumber('exploiter')).toBe(2);
        expect(TicketService.nextNumber('question')).toBe(1);
    });

    it('should start open and remember when tickets are paused', () => {
        expect(TicketService.status()).toEqual({ paused: false });
        TicketService.setStatus({ paused: true, message: 'Back soon' });
        expect(TicketService.status()).toEqual({ paused: true, message: 'Back soon' });
    });

    it('should track open tickets by user and thread', () => {
        TicketService.add({
            threadId: 't1',
            userId: 'u1',
            categoryId: 'question',
            number: 1,
            open: true,
            openedAt: '',
        });
        expect(TicketService.openFor('u1')?.threadId).toBe('t1');
        expect(TicketService.byThread('t1')?.userId).toBe('u1');

        TicketService.close('t1');
        expect(TicketService.openFor('u1')).toBeUndefined();
        expect(TicketService.byThread('t1')?.open).toBe(false);
    });
});
