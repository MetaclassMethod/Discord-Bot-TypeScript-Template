import { describe, expect, it } from 'vitest';

import { TemplateService } from '../../src/services/index.js';

describe('TemplateService', () => {
    describe('list', () => {
        it('should list templates without their extension', () => {
            expect(TemplateService.list()).toContain('bug-report-rules');
        });
    });

    describe('build', () => {
        it('should pass raw components through untouched', () => {
            const payload = TemplateService.build('bug-report-rules');
            expect(payload.components.length).toBeGreaterThan(0);
            expect(payload.components.every(component => typeof component.type === 'number')).toBe(
                true
            );
        });

        it('should expose the title used for forum posts', () => {
            const payload = TemplateService.build('bug-report-rules');
            expect(payload.title).toBeTruthy();
        });

        it('should upload assets referenced deep inside the component tree', () => {
            const payload = TemplateService.build('bug-report-rules');
            expect(payload.files.map(file => file.name)).toContain('bug_submitted.png');
        });

        it('should reject a template that does not exist', () => {
            expect(() => TemplateService.build('nope')).toThrow(/no template named/);
        });

        it('should refuse a name that escapes the templates folder', () => {
            expect(() => TemplateService.build('../config/config')).toThrow(
                /Invalid template name/
            );
        });
    });
});
