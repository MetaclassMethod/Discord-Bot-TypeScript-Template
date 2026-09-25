import {
    ActionRowBuilder,
    APIMessageTopLevelComponent,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ContainerBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

import { Button, ButtonDeferType, ComponentInteraction } from './index.js';
import { EventData } from '../models/internal-models.js';
import {
    CLOSE_TICKET_ID,
    type FaqMatch,
    FaqService,
    Logger,
    REPORT_CATEGORIES,
    TemplateService,
    TICKET_CATEGORIES,
    TicketRelayService,
    TicketService,
} from '../services/index.js';

const TYPE_MENU_ID = 'ticket:type';
const REPORT_ID = 'ticket:report';
const OPEN_PREFIX = 'ticket:open:';

const CONFIRM_PREFIX = 'ticket:confirm:';
const NOTICE_TEMPLATE = 'ticket-notice';

const SOLVED_ID = 'ticket:faq:solved';
const STILL_NEED_HELP_ID = 'ticket:faq:help';
const SUGGESTION_TIMEOUT_MS = 10 * 60 * 1000;
const SUGGESTION_ACCENT = 0xf1c40f;
const MODAL_TIMEOUT_MS = 15 * 60 * 1000;
const DETAILS_FIELD = 'details';
const CLOSE_NOTE_FIELD = 'note';

export class TicketButton implements Button {
    public ids = [
        TYPE_MENU_ID,
        REPORT_ID,
        CLOSE_TICKET_ID,
        ...TICKET_CATEGORIES.map(category => `${OPEN_PREFIX}${category.id}`),
        `${CONFIRM_PREFIX}report`,
        ...TICKET_CATEGORIES.map(category => `${CONFIRM_PREFIX}${category.id}`),
    ];
    public deferType = ButtonDeferType.NONE;
    public requireGuild = true;
    public requireEmbedAuthorTag = false;

    public async execute(intr: ComponentInteraction, _data: EventData): Promise<void> {
        let status = TicketService.status();
        if (status.paused && intr.customId !== CLOSE_TICKET_ID) {
            await intr.reply({
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                components: TicketRelayService.pausedNotice(status.message),
            });
            return;
        }

        if (intr.isStringSelectMenu() && intr.customId === TYPE_MENU_ID) {
            await this.notice(intr, intr.values[0]);
            return;
        }

        let choice = intr.customId;
        if (choice.startsWith(CONFIRM_PREFIX)) {
            let value = choice.slice(CONFIRM_PREFIX.length);
            choice = value === 'report' ? REPORT_ID : `${OPEN_PREFIX}${value}`;
        }

        if (choice === REPORT_ID) {
            await intr.reply({
                flags: MessageFlags.Ephemeral,
                content: `What are you reporting?`,
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        REPORT_CATEGORIES.map(category =>
                            new ButtonBuilder()
                                .setCustomId(`${OPEN_PREFIX}${category.id}`)
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel(category.id === 'player-report' ? 'Other' : category.name)
                                .setEmoji(category.emoji)
                        )
                    ),
                ],
            });
            return;
        }

        if (choice === CLOSE_TICKET_ID) {
            await this.close(intr);
            return;
        }

        await this.open(intr, choice.slice(OPEN_PREFIX.length));
    }

    private async notice(intr: ComponentInteraction, value: string): Promise<void> {
        if (TicketService.openFor(intr.user.id)) {
            await intr.reply({
                flags: MessageFlags.Ephemeral,
                content: `You already have an open ticket. Check your DMs with me to keep talking to staff.`,
            });
            return;
        }

        let notice;
        try {
            notice = TemplateService.build(NOTICE_TEMPLATE);
        } catch (error) {
            Logger.error(`Couldn't load the ${NOTICE_TEMPLATE} template.`, error);
            notice = { components: [], files: [] };
        }

        await intr.reply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            files: notice.files,
            components: [
                ...notice.components,
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`${CONFIRM_PREFIX}${value}`)
                            .setStyle(ButtonStyle.Primary)
                            .setLabel('Open a ticket')
                            .setEmoji('📨')
                    )
                    .toJSON(),
            ],
        });
    }

    private async open(intr: ComponentInteraction, categoryId: string): Promise<void> {
        let category = TicketService.category(categoryId);
        if (!category) {
            return;
        }

        if (TicketService.openFor(intr.user.id)) {
            await intr.reply({
                flags: MessageFlags.Ephemeral,
                content: `You already have an open ticket. Check your DMs with me to keep talking to staff.`,
            });
            return;
        }

        let modalId = `ticket:modal:${intr.id}`;
        await intr.showModal(
            new ModalBuilder()
                .setCustomId(modalId)
                .setTitle(`${category.name}`)
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel('Tell us what happened')
                        .setDescription(
                            'Usernames, dates and links help. You can send images in DMs after.'
                        )
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId(DETAILS_FIELD)
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(2000)
                        )
                )
        );

        let submit;
        try {
            submit = await intr.awaitModalSubmit({
                time: MODAL_TIMEOUT_MS,
                filter: modal => modal.customId === modalId && modal.user.id === intr.user.id,
            });
        } catch {
            return;
        }

        await submit.deferReply({ flags: MessageFlags.Ephemeral });
        let details = submit.fields.getTextInputValue(DETAILS_FIELD);

        let matches = FaqService.match(details, category.id);
        if (matches.length > 0) {
            let reply = await submit.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: this.suggestions(matches),
            });

            let click;
            try {
                click = await reply.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    time: SUGGESTION_TIMEOUT_MS,
                    filter: button =>
                        button.user.id === intr.user.id &&
                        [SOLVED_ID, STILL_NEED_HELP_ID].includes(button.customId),
                });
            } catch {
                await submit
                    .editReply({
                        components: this.text(
                            `This expired. Pick an option in the support hub again if you still need help.`
                        ),
                    })
                    .catch(() => undefined);
                return;
            }

            if (click.customId === SOLVED_ID) {
                Logger.info(
                    `FAQ '${matches[0].entry.id}' answered a ${category.id} ticket for ${intr.user.id}.`
                );
                await click.update({
                    components: this.text(`This interaction has now ended.`),
                });
                return;
            }

            await click.update({ components: this.text(`Opening your ticket…`) });
        }

        let result = await TicketRelayService.open(intr.client, intr.user, category, details);
        let message =
            typeof result === 'string'
                ? result
                : `Your ticket is open! I've sent you a DM. Reply there to talk with staff.`;
        await submit.editReply(matches.length > 0 ? { components: this.text(message) } : message);
    }

    private suggestions(matches: FaqMatch[]): APIMessageTopLevelComponent[] {
        let container = new ContainerBuilder()
            .setAccentColor(SUGGESTION_ACCENT)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## 💡 This might answer your question\nBefore we open a ticket, take a look at ${matches.length > 1 ? 'these' : 'this'}:`
                )
            );
        for (let { entry } of matches) {
            container
                .addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${entry.question}\n${entry.answer}`)
                );
        }

        return [
            container.toJSON(),
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(SOLVED_ID)
                        .setStyle(ButtonStyle.Success)
                        .setLabel('That answered it')
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(STILL_NEED_HELP_ID)
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel('I still need help')
                        .setEmoji('📨')
                )
                .toJSON(),
        ];
    }

    private text(content: string): APIMessageTopLevelComponent[] {
        return [new TextDisplayBuilder().setContent(content).toJSON()];
    }

    private async close(intr: ComponentInteraction): Promise<void> {
        if (!intr.channel?.isThread()) {
            return;
        }

        let ticket = TicketService.byThread(intr.channel.id);
        if (!ticket?.open) {
            await intr.reply({
                flags: MessageFlags.Ephemeral,
                content: `This ticket is already closed.`,
            });
            return;
        }

        let thread = intr.channel;
        let modalId = `ticket:close-modal:${intr.id}`;
        await intr.showModal(
            new ModalBuilder()
                .setCustomId(modalId)
                .setTitle(`Close ${TicketService.title(ticket)}`)
                .addLabelComponents(
                    new LabelBuilder()
                        .setLabel('Note to the user (optional)')
                        .setDescription(
                            'Sent in their DM with the closing message. Leave empty to skip.'
                        )
                        .setTextInputComponent(
                            new TextInputBuilder()
                                .setCustomId(CLOSE_NOTE_FIELD)
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(false)
                                .setMaxLength(1500)
                        )
                )
        );

        let submit;
        try {
            submit = await intr.awaitModalSubmit({
                time: MODAL_TIMEOUT_MS,
                filter: modal => modal.customId === modalId && modal.user.id === intr.user.id,
            });
        } catch {
            return;
        }

        await submit.deferReply({ flags: MessageFlags.Ephemeral });
        let closed = await TicketRelayService.close(
            thread,
            intr.user,
            submit.fields.getTextInputValue(CLOSE_NOTE_FIELD)
        );
        await submit.editReply(
            closed ? `Closed ${TicketService.title(closed)}.` : `This ticket is already closed.`
        );
    }
}
