import {
    ActionRowBuilder,
    APIMessageTopLevelComponent,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageMentionOptions,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

const TEXT_LIMIT = 4000;
const MAX_BUTTONS = 5;

export interface UpdatePing {
    name: string;
    value: string;
}

export interface UpdateButton {
    id: string;
    label: string;
    url: string;
    emoji?: string;
    default?: boolean;
}

export interface UpdateAlias {
    id: string;
    name: string;
    avatar?: string;
}

export interface UpdateLog {
    title: string;
    blurb?: string;
    ping?: string;
    imageName?: string;
    newContent?: string;
    changes?: string;
    bugFixes?: string;
    buttonIds?: string[];
    extra?: APIMessageTopLevelComponent[];
}

export class UpdateLogService {
    public static pings(): UpdatePing[] {
        return [
            { name: 'No ping', value: 'none' },
            { name: '@everyone', value: 'everyone' },
            { name: '@here', value: 'here' },
            ...(Config.updates?.pings ?? []),
        ];
    }

    public static buttons(): UpdateButton[] {
        return (Config.updates?.buttons ?? []).slice(0, MAX_BUTTONS);
    }

    public static aliases(): UpdateAlias[] {
        let aliases: UpdateAlias[] = Config.updates?.aliases ?? [];
        return aliases.length > 0 ? aliases : [{ id: 'pressure', name: 'Pressure Release Notes' }];
    }

    public static alias(id?: string): UpdateAlias {
        let aliases = this.aliases();
        return aliases.find(alias => alias.id === id) ?? aliases[0];
    }

    public static defaultTitle(date: Date = new Date()): string {
        let day = date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
        return `Update Log - ${day}`;
    }

    public static mention(ping?: string): string | undefined {
        if (!ping || ping === 'none') {
            return undefined;
        }
        if (ping === 'everyone' || ping === 'here') {
            return `@${ping}`;
        }
        return /^\d{17,20}$/.test(ping) ? `<@&${ping}>` : undefined;
    }

    public static allowedMentions(ping?: string): MessageMentionOptions {
        if (ping === 'everyone' || ping === 'here') {
            return { parse: ['everyone'] };
        }
        let mention = this.mention(ping);
        return mention ? { roles: [ping] } : { parse: [] };
    }

    public static bullets(text?: string): string {
        return (text ?? '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => (/^[-*•]\s/.test(line) ? `- ${line.slice(2).trim()}` : `- ${line}`))
            .join('\n');
    }

    public static build(log: UpdateLog): APIMessageTopLevelComponent[] {
        let intro = [
            log.blurb?.trim()
                ? log.blurb
                      .trim()
                      .split(/\r?\n/)
                      .map(line => `> ${line}`)
                      .join('\n')
                : undefined,
            this.mention(log.ping),
        ].filter(Boolean);
        let sections = [
            ['✨ New Content', log.newContent],
            ['⚙️ Changes & Accessibility', log.changes],
            ['🛠️ Bug Fixes', log.bugFixes],
        ]
            .map(([heading, text]) => [heading, this.bullets(text)])
            .filter(([, list]) => list)
            .map(([heading, list]) => `## ${heading}\n${list}`);

        let length =
            [log.title, ...intro, ...sections].join('\n').length + this.textLength(log.extra ?? []);
        if (length > TEXT_LIMIT) {
            throw new Error(
                `The update is ${length} characters, but Discord allows ${TEXT_LIMIT}. Trim it down or split it.`
            );
        }

        let header = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 📋 ${log.title}`)
        );

        if (intro.length > 0) {
            header.addTextDisplayComponents(new TextDisplayBuilder().setContent(intro.join('\n')));
        }

        if (log.imageName) {
            header.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(`attachment://${log.imageName}`)
                )
            );
        }

        let components: APIMessageTopLevelComponent[] = [header.toJSON()];

        if (sections.length > 0) {
            components.push(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
                    .setDivider(true)
                    .toJSON(),
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(sections.join('\n'))
                    )
                    .toJSON()
            );
        }

        components.push(...(log.extra ?? []));

        let chosen = this.buttons().filter(button => log.buttonIds?.includes(button.id));
        if (chosen.length > 0) {
            let row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                chosen.map(button => {
                    let builder = new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel(button.label)
                        .setURL(button.url);
                    return button.emoji ? builder.setEmoji(button.emoji) : builder;
                })
            );
            components.push(row.toJSON());
        }

        return components;
    }

    private static textLength(node: unknown): number {
        if (Array.isArray(node)) {
            return node.reduce((sum, child) => sum + this.textLength(child), 0);
        }
        if (!node || typeof node !== 'object') {
            return 0;
        }
        let own =
            typeof (node as { content?: unknown }).content === 'string'
                ? (node as { content: string }).content.length
                : 0;
        return Object.entries(node)
            .filter(([key]) => key !== 'content')
            .reduce((sum, [, value]) => sum + this.textLength(value), own);
    }
}
