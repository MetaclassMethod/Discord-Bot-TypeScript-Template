import { ComponentType } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { UpdateLogService } from '../../src/services/index.js';

function texts(components: unknown): string[] {
    let found: string[] = [];
    let walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            node.forEach(walk);
        } else if (node && typeof node === 'object') {
            let content = (node as { content?: unknown }).content;
            if (typeof content === 'string') {
                found.push(content);
            }
            Object.values(node).forEach(walk);
        }
    };
    walk(components);
    return found;
}

describe('UpdateLogService', () => {
    describe('bullets', () => {
        it('should turn lines into a list and skip blank ones', () => {
            expect(UpdateLogService.bullets('Fixed doors\n\n- Fixed lights\n* Fixed vents')).toBe(
                '- Fixed doors\n- Fixed lights\n- Fixed vents'
            );
        });
    });

    describe('mention', () => {
        it('should format everyone, here and role pings', () => {
            expect(UpdateLogService.mention('everyone')).toBe('@everyone');
            expect(UpdateLogService.mention('here')).toBe('@here');
            expect(UpdateLogService.mention('123456789012345678')).toBe('<@&123456789012345678>');
            expect(UpdateLogService.mention('none')).toBeUndefined();
            expect(UpdateLogService.mention('garbage')).toBeUndefined();
        });

        it('should only allow the chosen ping to notify anyone', () => {
            expect(UpdateLogService.allowedMentions('here')).toEqual({ parse: ['everyone'] });
            expect(UpdateLogService.allowedMentions('123456789012345678')).toEqual({
                roles: ['123456789012345678'],
            });
            expect(UpdateLogService.allowedMentions(undefined)).toEqual({ parse: [] });
        });
    });

    describe('alias', () => {
        it('should fall back to the first alias for an unknown id', () => {
            const first = UpdateLogService.aliases()[0];
            expect(UpdateLogService.alias('nope')).toEqual(first);
            expect(UpdateLogService.alias(undefined)).toEqual(first);
            expect(first.name).not.toMatch(/nordlys/i);
        });
    });

    describe('build', () => {
        it('should lay out the header, sections and buttons', () => {
            const components = UpdateLogService.build({
                title: 'Update Log - September 25, 2026',
                blurb: 'Pure Pandemonium has returned!',
                ping: 'everyone',
                imageName: 'update-banner.png',
                newContent: 'New 4-Star Modifier: Endless',
                bugFixes: 'Fixed True Ending cutscene',
                buttonIds: ['play'],
            });

            expect(components.map(component => component.type)).toEqual([
                ComponentType.Container,
                ComponentType.Separator,
                ComponentType.Container,
                ComponentType.ActionRow,
            ]);

            const all = texts(components).join('\n');
            expect(all).toContain('# 📋 Update Log - September 25, 2026');
            expect(all).toContain('> Pure Pandemonium has returned!');
            expect(all).toContain('@everyone');
            expect(all).toContain('## ✨ New Content\n- New 4-Star Modifier: Endless');
            expect(all).toContain('## 🛠️ Bug Fixes\n- Fixed True Ending cutscene');
            expect(all).not.toContain('Changes & Accessibility');
            expect(JSON.stringify(components)).toContain('attachment://update-banner.png');
        });

        it('should leave out the second container when every section is empty', () => {
            const components = UpdateLogService.build({ title: 'Quiet update' });
            expect(components.map(component => component.type)).toEqual([ComponentType.Container]);
        });

        it('should add an extra template after the sections', () => {
            const extra = [{ type: ComponentType.TextDisplay, content: 'Extra bit' }];
            const components = UpdateLogService.build({
                title: 'With extra',
                changes: 'Something',
                extra: extra as never,
            });
            expect(components.at(-1)).toEqual(extra[0]);
        });

        it('should refuse an update longer than Discord allows', () => {
            expect(() =>
                UpdateLogService.build({ title: 'Too long', bugFixes: 'x'.repeat(4001) })
            ).toThrow(/characters/);
        });
    });
});
