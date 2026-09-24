import { APIMessageTopLevelComponent, AttachmentBuilder } from 'discord.js';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

const ATTACHMENT_PREFIX = 'attachment://';

interface Template {
    title?: string;
    components: APIMessageTopLevelComponent[];
}

export interface TemplatePayload {
    title?: string;
    components: APIMessageTopLevelComponent[];
    files: AttachmentBuilder[];
}

export class TemplateService {
    public static list(): string[] {
        try {
            return fs
                .readdirSync(TEMPLATES_DIR)
                .filter(fileName => fileName.endsWith('.json'))
                .map(fileName => path.basename(fileName, '.json'))
                .sort();
        } catch {
            return [];
        }
    }

    public static build(name: string): TemplatePayload {
        let template = this.load(name);
        let files = this.collectAttachments(template.components);
        return { title: template.title, components: template.components, files };
    }

    private static collectAttachments(components: unknown): AttachmentBuilder[] {
        let fileNames = new Set<string>();

        let walk = (node: unknown): void => {
            if (typeof node === 'string') {
                if (node.startsWith(ATTACHMENT_PREFIX)) {
                    fileNames.add(node.slice(ATTACHMENT_PREFIX.length));
                }
            } else if (Array.isArray(node)) {
                node.forEach(walk);
            } else if (node && typeof node === 'object') {
                Object.values(node).forEach(walk);
            }
        };
        walk(components);

        return [...fileNames].map(fileName => {
            let filePath = this.assetPath(fileName);
            if (!fs.existsSync(filePath)) {
                throw new Error(`\`${fileName}\` isn't in the assets folder.`);
            }
            return new AttachmentBuilder(filePath, { name: fileName });
        });
    }

    private static load(name: string): Template {
        let filePath = this.templatePath(name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`There's no template named \`${name}\`.`);
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            throw new Error(`\`${name}\` isn't valid JSON.`);
        }

        let template: Template = Array.isArray(parsed)
            ? { components: parsed as APIMessageTopLevelComponent[] }
            : (parsed as Template);

        if (!Array.isArray(template?.components) || template.components.length === 0) {
            throw new Error(`\`${name}\` has no components.`);
        }

        let untyped = template.components.findIndex(
            component => typeof (component as { type?: unknown })?.type !== 'number'
        );
        if (untyped !== -1) {
            throw new Error(`Component ${untyped + 1} of \`${name}\` has no \`type\`.`);
        }

        return template;
    }

    private static templatePath(name: string): string {
        return this.resolveWithin(TEMPLATES_DIR, `${name}.json`, 'template name');
    }

    private static assetPath(fileName: string): string {
        return this.resolveWithin(ASSETS_DIR, fileName, 'asset name');
    }

    private static resolveWithin(baseDir: string, fileName: string, label: string): string {
        let filePath = path.resolve(baseDir, fileName);
        if (path.dirname(filePath) !== baseDir) {
            throw new Error(`Invalid ${label}.`);
        }
        return filePath;
    }
}
