import {
    ActionRowBuilder,
    APIMessageTopLevelComponent,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    ContainerBuilder,
    FileBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThreadAutoArchiveDuration,
    ThreadChannel,
    ThumbnailBuilder,
    User,
} from 'discord.js';
import { createRequire } from 'node:module';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger } from './logger.js';
import { Ticket, TicketCategory, TicketService } from './ticket-service.js';
import { TranscriptService } from './transcript-service.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export const CLOSE_TICKET_ID = 'ticket:close';
export const INTERNAL_NOTE_PREFIX = '-';

const NO_TICKET_IMAGE = path.resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../assets/ticket_report.png'
);

export const DEFAULT_PAUSED_MESSAGE =
    'Sorry, our support ticket system is at capacity, we are unable to accept more tickets at this time.\n\nPlease try again later.';

const TEXT_LIMIT = 3900;
const DM_TEXT_LIMIT = 2000;
const PAUSED_ACCENT = 0xe23030;
const USER_ACCENT = 0x5865f2;
const STAFF_ACCENT = 0x57f287;

interface RelayPayload {
    components: APIMessageTopLevelComponent[];
    files: AttachmentBuilder[];
}

export class TicketRelayService {
    public static async open(
        client: Client,
        user: User,
        category: TicketCategory,
        details: string
    ): Promise<Ticket | string> {
        if (TicketService.openFor(user.id)) {
            return `You already have an open ticket. Check your DMs with me to keep talking to staff.`;
        }

        let staffChannel = await client.channels
            .fetch(Config.tickets?.staffChannelId ?? '')
            .catch(() => null);
        if (!staffChannel?.isTextBased() || staffChannel.isDMBased() || staffChannel.isThread()) {
            Logger.error(`tickets.staffChannelId is missing or isn't a text channel.`);
            return `Tickets aren't available. Your response was not recorded.`;
        }

        let dm;
        try {
            dm = await user.createDM();
            await dm.send({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    new ContainerBuilder()
                        .setAccentColor(STAFF_ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                [
                                    `## ${category.emoji} Ticket opened`,
                                    `Thanks for reaching out! A staff member will reply here soon.`,
                                    `Anything you send in this DM gets directly forwarded, including images and videos.`,
                                    `Due to the high number of tickets we recieve, we cannot provide specific updates for each ticket.`
                                ].join('\n')
                            )
                        )
                        .toJSON(),
                ],
            });
        } catch {
            return `I couldn't DM you. Turn on **Direct Messages** for this server (Server menu -> Privacy Settings), then try again.`;
        }

        let number = TicketService.nextNumber(category.id);
        let ticket: Ticket = {
            threadId: '',
            userId: user.id,
            categoryId: category.id,
            number,
            open: true,
            openedAt: new Date().toISOString(),
        };

        let thread: ThreadChannel;
        try {
            thread = (await staffChannel.threads.create({
                name: TicketService.title(ticket),
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                reason: `Ticket opened by ${user.tag}`,
            })) as ThreadChannel;
            ticket.threadId = thread.id;
            TicketService.add(ticket);

            let pingRoleId: string | undefined = Config.tickets?.pingRoleId || undefined;
            await thread.send({
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { roles: pingRoleId ? [pingRoleId] : [] },
                components: this.header(ticket, category, user, details, pingRoleId),
            });
        } catch (error) {
            Logger.error(`Failed to create a ticket thread for ${user.id}.`, error);
            if (ticket.threadId) {
                TicketService.close(ticket.threadId);
            }
            await dm
                .send(`Sorry, something went wrong opening your ticket. Please try again later.`)
                .catch(() => undefined);
            return `Something went wrong opening your ticket. Please try again later.`;
        }

        return ticket;
    }

    public static pausedNotice(message?: string): APIMessageTopLevelComponent[] {
        let selfService: string[] = Config.tickets?.selfServiceChannelIds ?? [];
        let container = new ContainerBuilder()
            .setAccentColor(PAUSED_ACCENT)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ❌ Try again later\n${message?.trim() || DEFAULT_PAUSED_MESSAGE}`
                )
            );
        if (selfService.length > 0) {
            let channels = selfService.map(id => `<#${id}>`);
            let list =
                channels.length > 1
                    ? `${channels.slice(0, -1).join(', ')} and ${channels[channels.length - 1]}`
                    : channels[0];
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Try our self-service options**\nCheck out ${list}`
                )
            );
        }
        return [container.toJSON()];
    }

    public static async process(msg: Message): Promise<boolean> {
        if (msg.author.bot || msg.system) {
            return false;
        }

        if (msg.channel.isDMBased()) {
            return await this.fromUser(msg);
        }

        if (msg.channel.isThread()) {
            return await this.fromStaff(msg);
        }

        return false;
    }

    public static async close(
        thread: ThreadChannel,
        closedBy: User,
        note?: string
    ): Promise<Ticket | undefined> {
        let ticket = TicketService.close(thread.id);
        if (!ticket) {
            return undefined;
        }
        note = note?.trim() || undefined;

        let user = await thread.client.users.fetch(ticket.userId).catch(() => null);
        let closed = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## 🔒 Ticket closed\nYour ticket was closed by our team. If you need anything else, open a new ticket from the support channel.`
            )
        );
        if (note) {
            closed
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Note from staff**\n${note
                            .slice(0, TEXT_LIMIT)
                            .split(/\r?\n/)
                            .map(line => `> ${line}`)
                            .join('\n')}`
                    )
                );
        }
        let notified = await user
            ?.send({ flags: MessageFlags.IsComponentsV2, components: [closed.toJSON()] })
            .then(() => true)
            .catch(() => false);

        await thread
            .send({
                content: [
                    `🔒 Closed by ${closedBy}.`,
                    note ? `**Note sent to the user:**\n>>> ${note}` : undefined,
                    notified ? undefined : `⚠️ Couldn't DM the user that their ticket was closed.`,
                ]
                    .filter(Boolean)
                    .join('\n')
                    .slice(0, 2000),
                allowedMentions: { parse: [] },
            })
            .catch(() => undefined);

        await this.postTranscript(thread, ticket, user, closedBy, note);

        await thread.edit({ locked: true, archived: true }).catch(error => {
            Logger.error(`Failed to archive ticket thread ${thread.id}.`, error);
        });
        return ticket;
    }

    private static async postTranscript(
        thread: ThreadChannel,
        ticket: Ticket,
        user: User | null,
        closedBy: User,
        note?: string
    ): Promise<void> {
        let channelId: string = Config.tickets?.transcriptChannelId;
        if (!channelId) {
            return;
        }

        try {
            let channel = await thread.client.channels.fetch(channelId);
            if (!channel?.isSendable()) {
                throw new Error(`Transcript channel ${channelId} isn't a channel I can send in :(`);
            }

            let userName = user?.username ?? ticket.userId;
            let messages = TranscriptService.convert(
                await TranscriptService.fetchAll(thread),
                userName,
                INTERNAL_NOTE_PREFIX,
                user?.displayAvatarURL({ size: 64 })
            );
            let title = TicketService.title(ticket);
            let html = TranscriptService.html(
                {
                    ticket,
                    userTag: userName,
                    closedBy: closedBy.username,
                    closedAt: new Date(),
                    note,
                },
                messages
            );
            let fileName = `${title.toLowerCase().replaceAll(' ', '-')}-transcript.html`;
            let category = TicketService.category(ticket.categoryId);
            let count = (role: string): number => messages.filter(m => m.role === role).length;

            await channel.send({
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
                files: [new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: fileName })],
                components: [
                    new ContainerBuilder()
                        .setAccentColor(USER_ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                [
                                    `## ${category?.emoji ?? '🎫'} ${title}`,
                                    `**User:** <@${ticket.userId}> (\`${userName}\`)`,
                                    `**Opened:** <t:${Math.floor(new Date(ticket.openedAt).getTime() / 1000)}:f>`,
                                    `**Closed by:** ${closedBy} <t:${Math.floor(Date.now() / 1000)}:R>`,
                                    `**Messages:** ${count('user')} from user, ${count('staff')} from staff`,
                                    `**Thread:** ${thread}`,
                                    note
                                        ? `**Closing note:**\n>>> ${note.slice(0, 1500)}`
                                        : undefined,
                                ]
                                    .filter(Boolean)
                                    .join('\n')
                            )
                        )
                        .addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`))
                        .toJSON(),
                ],
            });
        } catch (error) {
            Logger.error(`Failed to post the transcript for ticket thread ${thread.id}.`, error);
            await thread
                .send(`⚠️ Couldn't post the transcript. The thread is still here for reference.`)
                .catch(() => undefined);
        }
    }

    private static async fromUser(msg: Message): Promise<boolean> {
        let ticket = TicketService.openFor(msg.author.id);
        if (!ticket) {
            let hub = Config.tickets?.hubChannelId;
            await msg
                .reply({
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                    files: [new AttachmentBuilder(NO_TICKET_IMAGE, { name: 'ticket_report.png' })],
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xe23030)
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            [
                                                `## Were you trying to open a support ticket?`,
                                                `You don't have an open ticket right now, so this message wasn't sent to staff.`,
                                                hub
                                                    ? `Open one from the support hub in <#${hub}>.`
                                                    : `Open one from the support hub.`,
                                            ].join('\n')
                                        )
                                    )
                                    .setThumbnailAccessory(
                                        new ThumbnailBuilder().setURL(
                                            'attachment://ticket_report.png'
                                        )
                                    )
                            )
                            .toJSON(),
                    ],
                })
                .catch(() => undefined);
            return true;
        }

        let thread = await msg.client.channels.fetch(ticket.threadId).catch(() => null);
        if (!thread?.isThread()) {
            await msg.react('❌').catch(() => undefined);
            return true;
        }

        if (thread.archived) {
            await thread.setArchived(false).catch(() => undefined);
        }

        let sent = await this.relay(msg, `**${msg.author.username}**`, USER_ACCENT, payload =>
            thread.send({
                ...payload,
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            })
        );
        await msg.react(sent ? '✅' : '❌').catch(() => undefined);
        return true;
    }

    private static async fromStaff(msg: Message): Promise<boolean> {
        let ticket = TicketService.byThread(msg.channelId);
        if (!ticket || !ticket.open || msg.content.startsWith(INTERNAL_NOTE_PREFIX)) {
            return false;
        }

        let user = await msg.client.users.fetch(ticket.userId).catch(() => null);
        let sent = !!user && (await this.plainReply(msg, user));
        await msg.react(sent ? '✅' : '❌').catch(() => undefined);
        if (!sent) {
            await msg
                .reply(`Couldn't DM the user.`)
                .catch(() => undefined);
        }
        return true;
    }

    private static async plainReply(msg: Message, user: User): Promise<boolean> {
        let content = msg.content.trim().slice(0, DM_TEXT_LIMIT);
        let files = [...msg.attachments.values()].map(
            attachment => new AttachmentBuilder(attachment.url, { name: attachment.name })
        );
        if (!content && files.length === 0) {
            return false;
        }

        try {
            await user.send({
                content: content || undefined,
                files,
                allowedMentions: { parse: [] },
            });
            return true;
        } catch (error) {
            if (files.length === 0) {
                Logger.error(`Failed to relay ticket message ${msg.id}.`, error);
                return false;
            }
        }

        let links = [...msg.attachments.values()].map(attachment => attachment.url).join('\n');
        try {
            await user.send({
                content: [content, links].filter(Boolean).join('\n').slice(0, 2000),
                allowedMentions: { parse: [] },
            });
            return true;
        } catch (error) {
            Logger.error(`Failed to relay ticket message ${msg.id}.`, error);
            return false;
        }
    }

    private static async relay(
        msg: Message,
        author: string,
        accent: number,
        send: (payload: RelayPayload) => Promise<unknown>
    ): Promise<boolean> {
        try {
            await send(this.payload(msg, author, accent, true));
            return true;
        } catch (error) {
            if (msg.attachments.size === 0) {
                Logger.error(`Failed to relay ticket message ${msg.id}.`, error);
                return false;
            }
        }

        try {
            await send(this.payload(msg, author, accent, false));
            return true;
        } catch (error) {
            Logger.error(`Failed to relay ticket message ${msg.id}.`, error);
            return false;
        }
    }

    public static payload(
        msg: Pick<Message, 'content' | 'attachments'>,
        author: string,
        accent: number,
        upload: boolean
    ): RelayPayload {
        let text = msg.content.trim();
        if (text.length > TEXT_LIMIT) {
            text = `${text.slice(0, TEXT_LIMIT)}…`;
        }

        let container = new ContainerBuilder()
            .setAccentColor(accent)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text ? `${author}\n${text}` : author)
            );

        let attachments = [...msg.attachments.values()];
        let files: AttachmentBuilder[] = [];

        if (upload) {
            let named = attachments.map((attachment, index) => ({
                attachment,
                name: `${index}-${attachment.name}`,
            }));
            files = named.map(
                ({ attachment, name }) => new AttachmentBuilder(attachment.url, { name })
            );

            let media = named.filter(({ attachment }) =>
                /^(image|video)\//.test(attachment.contentType ?? '')
            );
            if (media.length > 0) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        media
                            .slice(0, 10)
                            .map(({ name }) =>
                                new MediaGalleryItemBuilder().setURL(`attachment://${name}`)
                            )
                    )
                );
            }
            for (let { name } of named.filter(item => !media.includes(item))) {
                container.addFileComponents(new FileBuilder().setURL(`attachment://${name}`));
            }
        } else if (attachments.length > 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    attachments
                        .map(attachment => `📎 [${attachment.name}](${attachment.url})`)
                        .join('\n')
                )
            );
        }

        return { components: [container.toJSON()], files };
    }

    private static header(
        ticket: Ticket,
        category: TicketCategory,
        user: User,
        details: string,
        pingRoleId?: string
    ): APIMessageTopLevelComponent[] {
        let info = [
            `## ${category.emoji} ${TicketService.title(ticket)}`,
            `**User:** ${user} (\`${user.username}\` · \`${user.id}\`)`,
            `**Type:** ${category.name}`,
            pingRoleId ? `<@&${pingRoleId}>` : undefined,
        ].filter(Boolean);

        let container = new ContainerBuilder()
            .setAccentColor(USER_ACCENT)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(info.join('\n')));

        if (details.trim()) {
            container
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        details
                            .trim()
                            .slice(0, TEXT_LIMIT)
                            .split(/\r?\n/)
                            .map(line => `> ${line}`)
                            .join('\n')
                    )
                );
        }

        container
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# Messages here are sent to the user. Start a message with \`${INTERNAL_NOTE_PREFIX}\` for privacy.`
                )
            );

        return [
            container.toJSON(),
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(CLOSE_TICKET_ID)
                        .setStyle(ButtonStyle.Danger)
                        .setLabel('Close ticket')
                        .setEmoji('🔒')
                )
                .toJSON(),
        ];
    }
}
