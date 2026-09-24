import {
    AttachmentBuilder,
    ContainerBuilder,
    Guild,
    GuildMember,
    Locale,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextChannel,
    TextDisplayBuilder,
    ThreadChannel,
    User,
} from 'discord.js';
import { createRequire } from 'node:module';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Lang } from './lang.js';
import { Logger } from './logger.js';
import { BlockBugOption, BugReportRequirement, CloseBugOption } from '../enums/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Logs = require('../../lang/logs.json');

const ORIGINAL_POST_MAX_LENGTH = 2000;
const ATTACHMENTS_MAX = 10;
const BLOCK_ACCENT = 0x670000;

const CLOSE_ACCENTS: { [option in CloseBugOption]: number } = {
    [CloseBugOption.WILL_FIX]: 0x006716,
    [CloseBugOption.WONT_FIX]: 0x670000,
    [CloseBugOption.NOT_ENOUGH_INFO]: 0x674a00,
    [CloseBugOption.SPAM]: 0x670000,
    [CloseBugOption.SPAM_AND_BLOCK]: 0x670000,
};

const CLOSE_BANNERS: { [option in CloseBugOption]: string } = {
    [CloseBugOption.WILL_FIX]: 'bug_accepted.png',
    [CloseBugOption.WONT_FIX]: 'bug_denied.png',
    [CloseBugOption.NOT_ENOUGH_INFO]: 'bug_not_enough_info.png',
    [CloseBugOption.SPAM]: 'bug_denied.png',
    [CloseBugOption.SPAM_AND_BLOCK]: 'bug_blocked.png',
};

const BLOCK_BANNER = 'bug_blocked.png';
const ASSETS_DIR = path.resolve(dirname(fileURLToPath(import.meta.url)), '../../assets');

const MIN_DETAIL_LENGTH = 100;

const PLATFORM_PATTERN =
    /\b(pc|console|mobile|tablet|laptop|desktop|computer|windows|mac|linux|xbox|playstation|ps4|ps5|switch|android|ios|iphone|ipad|phone)\b/i;

const MEDIA_LINK_PATTERN =
    /(https?:\/\/\S+\.(png|jpe?g|gif|webp|mp4|mov|webm)\b|https?:\/\/(\S*\.)?(youtu\.be|youtube\.com|streamable\.com|medal\.tv|imgur\.com|gyazo\.com)\/\S+)/i;

const REQUIREMENT_REF_SUFFIX: { [requirement in BugReportRequirement]: string } = {
    [BugReportRequirement.MEDIA]: 'Media',
    [BugReportRequirement.PLATFORM]: 'Platform',
    [BugReportRequirement.DETAIL]: 'Detail',
};

const CLOSE_REF_SUFFIX: { [option in CloseBugOption]: string } = {
    [CloseBugOption.WILL_FIX]: 'WillFix',
    [CloseBugOption.WONT_FIX]: 'WontFix',
    [CloseBugOption.NOT_ENOUGH_INFO]: 'NotEnoughInfo',
    [CloseBugOption.SPAM]: 'Spam',
    [CloseBugOption.SPAM_AND_BLOCK]: 'SpamAndBlock',
};

export type MessageComponents = (ContainerBuilder | SeparatorBuilder)[];

export interface MessagePayload {
    components: MessageComponents;
    files: AttachmentBuilder[];
}

export interface BugReportContext {
    thread: ThreadChannel;
    starter?: Message;
    reporterId?: string;
}

export interface PunishmentResult {
    blocked: boolean;
    kicked: boolean;
    banned: boolean;
    failures: string[];
}

export class BugReportService {
    public static isManager(member: GuildMember): boolean {
        let roleIds: string[] = Config.bugReports?.managerRoleIds ?? [];
        return roleIds.some(roleId => member.roles.cache.has(roleId));
    }

    public static async getContext(channel: unknown): Promise<BugReportContext | undefined> {
        if (!(channel instanceof ThreadChannel)) {
            return;
        }

        let forumChannelId: string = Config.bugReports?.forumChannelId;
        if (!forumChannelId || channel.parentId !== forumChannelId) {
            return;
        }

        let starter: Message;
        try {
            starter = await channel.fetchStarterMessage();
        } catch {}

        return {
            thread: channel,
            starter,
            reporterId: channel.ownerId ?? starter?.author?.id,
        };
    }

    public static missingRequirements(starter?: Message): BugReportRequirement[] {
        let content = starter?.content?.trim() ?? '';
        let attachments = [...(starter?.attachments?.values() ?? [])];

        if (!content && attachments.length === 0) {
            return [];
        }

        let missing: BugReportRequirement[] = [];

        let hasMediaAttachment = attachments.some(attachment =>
            /^(image|video)\//.test(attachment.contentType ?? '')
        );
        if (!hasMediaAttachment && !MEDIA_LINK_PATTERN.test(content)) {
            missing.push(BugReportRequirement.MEDIA);
        }

        if (!PLATFORM_PATTERN.test(content)) {
            missing.push(BugReportRequirement.PLATFORM);
        }

        if (content.length < MIN_DETAIL_LENGTH) {
            missing.push(BugReportRequirement.DETAIL);
        }

        return missing;
    }

    public static requirementText(requirement: BugReportRequirement, langCode: Locale): string {
        return Lang.getRef(`bugReports.missing${REQUIREMENT_REF_SUFFIX[requirement]}`, langCode);
    }

    public static forumUrl(guild: Guild): string {
        return `https://discord.com/channels/${guild.id}/${Config.bugReports?.forumChannelId}`;
    }

    public static resolutionText(option: CloseBugOption, langCode: Locale): string {
        return Lang.getRef(`bugReports.resolution${CLOSE_REF_SUFFIX[option]}`, langCode);
    }

    public static noteText(option: CloseBugOption, note: string, langCode: Locale): string {
        return (
            note?.trim() ||
            Lang.getRef(`bugReports.dmDefaultNote${CLOSE_REF_SUFFIX[option]}`, langCode)
        );
    }

    public static buildLogContainer(
        ctx: BugReportContext,
        option: CloseBugOption,
        moderator: User,
        note: string,
        langCode: Locale
    ): ContainerBuilder {
        let { thread, starter, reporterId } = ctx;
        let container = new ContainerBuilder().setAccentColor(CLOSE_ACCENTS[option]);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${Lang.getRef('bugReports.logTitle', langCode)}\n### ${this.escape(thread.name)}`
            )
        );
        container.addSeparatorComponents(this.divider());

        let details = [
            `**Reporter:** ${reporterId ? `<@${reporterId}> \`${reporterId}\`` : 'Unknown'}`,
            `**Resolution:** ${this.resolutionText(option, langCode)}`,
            `**Closed by:** <@${moderator.id}> \`${moderator.id}\``,
            `**Opened:** ${thread.createdTimestamp ? `<t:${Math.floor(thread.createdTimestamp / 1000)}:F>` : 'Unknown'}`,
            `**Developer Note:** ${this.code(this.noteText(option, note, langCode))}`,
        ];
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(details.join('\n')));

        let body = starter?.content?.trim();
        if (body) {
            container.addSeparatorComponents(this.divider());
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Original Post**\n${this.truncate(body, ORIGINAL_POST_MAX_LENGTH)}`
                )
            );
        }

        let attachments = this.attachmentLines(starter);
        if (attachments) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Attachments**\n${attachments}`)
            );
        }

        return container;
    }

    public static buildCloseDm(
        ctx: BugReportContext,
        option: CloseBugOption,
        note: string,
        forumUrl: string,
        langCode: Locale
    ): MessagePayload {
        let suffix = CLOSE_REF_SUFFIX[option];

        let header = new ContainerBuilder()
            .setAccentColor(CLOSE_ACCENTS[option])
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    Lang.getRef(`bugReports.dmHeader${suffix}`, langCode)
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    Lang.getRef(`bugReports.dmIntro${suffix}`, langCode)
                )
            )
            .addMediaGalleryComponents(this.banner(CLOSE_BANNERS[option]));

        let outro = Lang.getRef(`bugReports.dmOutro${suffix}`, langCode, {
            FORUM_URL: forumUrl,
        });

        let info = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    [
                        Lang.getRef('bugReports.dmInfoTitle', langCode),
                        '',
                        `**${Lang.getRef('bugReports.dmLabelTitle', langCode)}**`,
                        this.code(ctx.thread.name),
                        '',
                        `**${Lang.getRef('bugReports.dmLabelReviewedAt', langCode)}**`,
                        `<t:${Math.floor(Date.now() / 1000)}:f>`,
                    ].join('\n')
                )
            )
            .addSeparatorComponents(this.divider())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    [
                        `**${Lang.getRef('bugReports.dmLabelNote', langCode)}**`,
                        `> ${this.code(this.noteText(option, note, langCode))}`,
                        `**${Lang.getRef('bugReports.dmLabelStatus', langCode)}**`,
                        `> ${Lang.getRef(`bugReports.dmStatus${suffix}`, langCode)}`,
                        '',
                        outro,
                    ].join('\n')
                )
            );

        return {
            components: [header, this.divider(), info],
            files: [this.bannerFile(CLOSE_BANNERS[option])],
        };
    }
    public static buildBlockDm(
        option: BlockBugOption,
        guildName: string,
        langCode: Locale
    ): MessagePayload {
        let messageRef =
            option === BlockBugOption.BLOCK_AND_KICK
                ? 'bugReports.dmKicked'
                : option === BlockBugOption.BLOCK_AND_BAN
                  ? 'bugReports.dmBanned'
                  : 'bugReports.dmBlocked';

        return {
            components: [
                new ContainerBuilder()
                    .setAccentColor(BLOCK_ACCENT)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# 🚫 ${Lang.getRef('bugReports.dmBlockedTitle', langCode)}`
                        )
                    )
                    .addSeparatorComponents(this.divider())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(Lang.getRef(messageRef, langCode))
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# ${this.escape(guildName)}`)
                    )
                    .addMediaGalleryComponents(this.banner(BLOCK_BANNER)),
            ],
            files: [this.bannerFile(BLOCK_BANNER)],
        };
    }

    public static buildBlockLogContainer(
        target: User,
        option: BlockBugOption,
        moderator: User,
        result: PunishmentResult,
        thread: ThreadChannel,
        langCode: Locale
    ): ContainerBuilder {
        let actions = [
            result.blocked ? 'Blocked role applied' : undefined,
            result.kicked ? 'Kicked' : undefined,
            result.banned ? 'Banned' : undefined,
        ].filter(Boolean);

        let details = [
            `**User:** <@${target.id}> \`${target.id}\``,
            `**Action:** ${option}`,
            `**Applied:** ${actions.length > 0 ? actions.join(', ') : 'None'}`,
            `**Moderator:** <@${moderator.id}> \`${moderator.id}\``,
            `**Thread:** ${this.escape(thread.name)} \`${thread.id}\``,
        ];
        if (result.failures.length > 0) {
            details.push(`**Failed:** ${result.failures.join(', ')}`);
        }

        return new ContainerBuilder()
            .setAccentColor(BLOCK_ACCENT)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${Lang.getRef('bugReports.blockLogTitle', langCode)}`
                )
            )
            .addSeparatorComponents(this.divider())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(details.join('\n')));
    }

    public static async postLog(guild: Guild, components: MessageComponents): Promise<boolean> {
        let logChannelId: string = Config.bugReports?.logChannelId;
        try {
            let channel = await guild.channels.fetch(logChannelId);
            if (!(channel instanceof TextChannel)) {
                Logger.error(Logs.error.bugLogChannelNotFound);
                return false;
            }
            await channel.send({ components, flags: MessageFlags.IsComponentsV2 });
            return true;
        } catch (error) {
            Logger.error(Logs.error.bugLogSendFailed, error);
            return false;
        }
    }

    public static async sendDm(user: User, payload: MessagePayload): Promise<boolean> {
        try {
            await user.send({ ...payload, flags: MessageFlags.IsComponentsV2 });
            return true;
        } catch {
            return false;
        }
    }

    public static async applyPunishment(
        guild: Guild,
        userId: string,
        option: BlockBugOption | CloseBugOption,
        reason: string
    ): Promise<PunishmentResult> {
        let result: PunishmentResult = {
            blocked: false,
            kicked: false,
            banned: false,
            failures: [],
        };

        let shouldKick = option === BlockBugOption.BLOCK_AND_KICK;
        let shouldBan = option === BlockBugOption.BLOCK_AND_BAN;

        let blockedRoleId: string = Config.bugReports?.blockedRoleId;
        let member: GuildMember;
        try {
            member = await guild.members.fetch(userId);
        } catch {
            result.failures.push('user not in server');
        }

        if (member && blockedRoleId) {
            try {
                await member.roles.add(blockedRoleId, reason);
                result.blocked = true;
            } catch (error) {
                result.failures.push('blocked role');
                Logger.error(Logs.error.bugBlockRoleFailed, error);
            }
        } else if (!blockedRoleId) {
            result.failures.push('blocked role not exist');
        }

        if (shouldKick && member) {
            try {
                await member.kick(reason);
                result.kicked = true;
            } catch (error) {
                result.failures.push('kick');
                Logger.error(Logs.error.bugKickFailed, error);
            }
        }

        if (shouldBan) {
            try {
                await guild.members.ban(userId, {
                    reason,
                    deleteMessageSeconds: Config.bugReports?.banDeleteMessageSeconds ?? 0,
                });
                result.banned = true;
            } catch (error) {
                result.failures.push('ban');
                Logger.error(Logs.error.bugBanFailed, error);
            }
        }

        return result;
    }

    private static banner(fileName: string): MediaGalleryBuilder {
        return new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`)
        );
    }

    private static bannerFile(fileName: string): AttachmentBuilder {
        return new AttachmentBuilder(path.join(ASSETS_DIR, fileName), { name: fileName });
    }

    private static divider(): SeparatorBuilder {
        return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
    }

    private static attachmentLines(starter?: Message): string | undefined {
        let attachments = [...(starter?.attachments?.values() ?? [])];
        if (attachments.length === 0) {
            return;
        }

        let lines = attachments
            .slice(0, ATTACHMENTS_MAX)
            .map(attachment => `- [${this.escape(attachment.name)}](${attachment.url})`);
        if (attachments.length > ATTACHMENTS_MAX) {
            lines.push(`- ...and ${attachments.length - ATTACHMENTS_MAX} more`);
        }
        return lines.join('\n');
    }

    private static truncate(text: string, max: number): string {
        return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    private static escape(text: string): string {
        return text.replaceAll(/([*_`~\\|])/g, '\\$1');
    }

    private static code(text: string): string {
        return `\`${text.replaceAll('`', '')}\``;
    }
}
