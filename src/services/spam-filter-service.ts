import { EmbedBuilder, GuildMember, Locale, Message, PermissionFlagsBits } from 'discord.js';
import { createRequire } from 'node:module';

import { Lang } from './lang.js';
import { Logger } from './logger.js';
import { Language } from '../models/enum-helpers/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

export type SpamRule = string | string[];

const MIN_SQUASHED_LENGTH = 6;

const LEET: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '@': 'a',
    $: 's',
    '!': 'i',
    '|': 'i',
};

interface Normalized {
    spaced: string;
    squashed: string;
}

export class SpamFilterService {
    public static normalize(text: string): Normalized {
        let spaced = text
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[0-9@$!|]/g, char => LEET[char] ?? char)
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/(.)\1{2,}/g, '$1$1')
            .trim();
        return { spaced, squashed: spaced.replaceAll(' ', '') };
    }

    public static match(text: string, rules: SpamRule[]): SpamRule | undefined {
        if (!text) {
            return undefined;
        }

        let content = this.normalize(text);
        return rules.find(rule =>
            (Array.isArray(rule) ? rule : [rule]).every(term => this.containsTerm(content, term))
        );
    }

    public static async process(msg: Message): Promise<boolean> {
        let settings = Config.spamFilter;
        if (!settings?.enabled || !msg.inGuild() || msg.author.bot) {
            return false;
        }

        let forumChannelId: string = Config.bugReports?.forumChannelId;
        if (!forumChannelId) {
            return false;
        }

        let thread = msg.channel;
        if (!thread.isThread() || !thread.parentId) {
            let fetched = await msg.client.channels.fetch(msg.channelId).catch(() => null);
            if (!fetched?.isThread()) {
                return false;
            }
            thread = fetched;
        }
        if (thread.parentId !== forumChannelId) {
            return false;
        }

        let member = msg.member;
        if (member && this.isExempt(member)) {
            return false;
        }

        let isStarter = msg.id === thread.id;
        let text = isStarter ? `${thread.name}\n${msg.content}` : msg.content;
        let rule = this.match(text, settings.rules ?? []);
        if (!rule) {
            return false;
        }

        try {
            await (isStarter ? thread.delete() : msg.delete());
        } catch (error) {
            Logger.error(Logs.error.spamFilterDelete, error);
            return false;
        }

        let langCode = msg.guild.preferredLocale ?? Language.Default;
        let timeoutSeconds: number = settings.timeoutSeconds ?? 0;

        if (timeoutSeconds > 0 && member?.moderatable) {
            try {
                await member.timeout(
                    timeoutSeconds * 1000,
                    Lang.getRef('spamFilter.auditReason', langCode)
                );
            } catch (error) {
                Logger.error(Logs.error.spamFilterTimeout, error);
            }
        }

        if (!isStarter) {
            await this.sendNotice(msg, langCode, settings.noticeSeconds ?? 8);
        }
        await this.sendLog(msg, text, rule, settings.logChannelId);
        return true;
    }

    private static containsTerm(content: Normalized, term: string): boolean {
        let normalized = this.normalize(term);
        if (!normalized.spaced) {
            return false;
        }

        if (` ${content.spaced} `.includes(` ${normalized.spaced} `)) {
            return true;
        }

        return (
            normalized.squashed.length >= MIN_SQUASHED_LENGTH &&
            content.squashed.includes(normalized.squashed)
        );
    }

    private static isExempt(member: GuildMember): boolean {
        if (Config.spamFilter.exemptionsEnabled === false) {
            return false;
        }

        if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return true;
        }

        let exemptRoleIds: string[] = Config.spamFilter.exemptRoleIds ?? [];
        return exemptRoleIds.some(roleId => member.roles.cache.has(roleId));
    }

    private static async sendNotice(
        msg: Message<true>,
        langCode: Locale,
        seconds: number
    ): Promise<void> {
        if (seconds <= 0 || !msg.channel.isSendable()) {
            return;
        }

        try {
            let notice = await msg.channel.send({
                content: Lang.getRef('spamFilter.notice', langCode).replaceAll(
                    '{USER}',
                    `<@${msg.author.id}>`
                ),
                allowedMentions: { users: [msg.author.id] },
            });
            setTimeout(() => notice.delete().catch(() => undefined), seconds * 1000);
        } catch (error) {
            Logger.error(Logs.error.spamFilterNotice, error);
        }
    }

    private static async sendLog(
        msg: Message<true>,
        text: string,
        rule: SpamRule,
        logChannelId: string
    ): Promise<void> {
        if (!logChannelId) {
            return;
        }

        try {
            let channel = await msg.client.channels.fetch(logChannelId);
            if (!channel?.isSendable()) {
                return;
            }

            let embed = new EmbedBuilder()
                .setTitle('Message blocked by spam filter')
                .setColor(0xed4245)
                .addFields(
                    { name: 'User', value: `<@${msg.author.id}> (${msg.author.id})`, inline: true },
                    { name: 'Channel', value: `<#${msg.channelId}>`, inline: true },
                    {
                        name: 'Matched',
                        value: Array.isArray(rule) ? rule.join(' + ') : rule,
                    },
                    { name: 'Content', value: text.slice(0, 1024) || '*(empty)*' }
                )
                .setTimestamp();

            await channel.send({
                embeds: [embed],
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            Logger.error(Logs.error.spamFilterLog, error);
        }
    }
}
