import { Attachment, Message } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { BugReportRequirement } from '../../src/enums/index.js';
import { BugReportService } from '../../src/services/index.js';

const FULL_POST = [
    '**1. Bug description:** The door in the hallway never opens after I pull the lever.',
    'I expected it to open so I could continue.',
    '**2. Platform:** PC',
    '**3. Where?:** Ridgeway',
    '**4. Reproduction:** Pull the lever twice.',
].join('\n');

function starter(content: string, contentTypes: string[] = []): Message {
    return {
        content,
        attachments: new Map(
            contentTypes.map((contentType, i) => [String(i), { contentType } as Attachment])
        ),
    } as unknown as Message;
}

describe('BugReportService', () => {
    describe('missingRequirements', () => {
        it('should return nothing for a post that follows the template', () => {
            const result = BugReportService.missingRequirements(starter(FULL_POST, ['image/png']));
            expect(result).toEqual([]);
        });

        it('should flag a post with no image or video attached', () => {
            const result = BugReportService.missingRequirements(starter(FULL_POST));
            expect(result).toEqual([BugReportRequirement.MEDIA]);
        });

        it('should not count a non-media attachment as a screenshot', () => {
            const result = BugReportService.missingRequirements(starter(FULL_POST, ['text/plain']));
            expect(result).toEqual([BugReportRequirement.MEDIA]);
        });

        it('should accept a linked video in place of an attachment', () => {
            const result = BugReportService.missingRequirements(
                starter(`${FULL_POST}\nhttps://youtu.be/dQw4w9WgXcQ`)
            );
            expect(result).toEqual([]);
        });

        it('should flag a post that never names a platform', () => {
            const content = FULL_POST.replace('**2. Platform:** PC', '**2. Platform:**');
            const result = BugReportService.missingRequirements(starter(content, ['image/png']));
            expect(result).toEqual([BugReportRequirement.PLATFORM]);
        });

        it('should flag every requirement for a low-effort post', () => {
            const result = BugReportService.missingRequirements(starter('game broken pls fix'));
            expect(result).toEqual([
                BugReportRequirement.MEDIA,
                BugReportRequirement.PLATFORM,
                BugReportRequirement.DETAIL,
            ]);
        });

        it('should stay quiet when there is no starter message', () => {
            const result = BugReportService.missingRequirements(undefined);
            expect(result).toEqual([]);
        });

        it('should stay quiet when content and attachments are both blank', () => {
            const result = BugReportService.missingRequirements(starter(''));
            expect(result).toEqual([]);
        });
    });
});
