import {
    ApplicationCommandOptionChoiceData,
    AttachmentBuilder,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    CheckboxGroupBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionsString,
    SendableChannels,
    TextInputBuilder,
    TextInputStyle,
    Webhook,
} from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang, Logger, TemplateService, UpdateLogService } from '../../services/index.js';
import { Command, CommandDeferType } from '../index.js';

const WEBHOOK_NAME = 'Release Notes';
const MODAL_TIMEOUT_MS = 15 * 60 * 1000;
const FIELDS = {
    blurb: 'blurb',
    newContent: 'newContent',
    changes: 'changes',
    bugFixes: 'bugFixes',
    buttons: 'buttons',
};

export class UpdateCommand implements Command {
    public names = [
        Lang.getRef('chatCommands.post', Language.Default),
        Lang.getRef('chatCommands.postUpdate', Language.Default),
        Lang.getRef('chatCommands.postUpdateLog', Language.Default),
    ];
    public cooldown = new RateLimiter(3, 10000);
    public deferType = CommandDeferType.NONE;
    public requireClientPerms: PermissionsString[] = [
        'ViewChannel',
        'SendMessages',
        'AttachFiles',
        'ManageWebhooks',
    ];

    public async autocomplete(
        _intr: AutocompleteInteraction,
        option: AutocompleteFocusedOption
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        let search = option.value?.toLowerCase() ?? '';
        let choices =
            option.name === Lang.getRef('arguments.ping', Language.Default)
                ? UpdateLogService.pings()
                : option.name === Lang.getRef('arguments.as', Language.Default)
                  ? UpdateLogService.aliases().map(alias => ({ name: alias.name, value: alias.id }))
                  : TemplateService.list().map(name => ({ name, value: name }));
        return choices.filter(choice => choice.name.toLowerCase().includes(search)).slice(0, 25);
    }

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        let title =
            intr.options.getString(Lang.getRef('arguments.title', Language.Default))?.trim() ||
            UpdateLogService.defaultTitle();
        let ping = intr.options.getString(Lang.getRef('arguments.ping', Language.Default));
        let image = intr.options.getAttachment(Lang.getRef('arguments.image', Language.Default));
        let extraName = intr.options.getString(Lang.getRef('arguments.extra', Language.Default));
        let alias = UpdateLogService.alias(
            intr.options.getString(Lang.getRef('arguments.as', Language.Default)) ?? undefined
        );

        if (image && !image.contentType?.startsWith('image/')) {
            await intr.reply({
                content: `The image has to be an image file.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        let extra;
        if (extraName) {
            try {
                extra = TemplateService.build(extraName);
            } catch (error) {
                await intr.reply({
                    content: `Couldn't load the extra template: ${error.message}`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        let modalId = `update:${intr.id}`;
        await intr.showModal(this.modal(modalId));

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

        let imageName = image ? `update-banner.${image.name.split('.').pop() ?? 'png'}` : undefined;
        let components;
        try {
            components = UpdateLogService.build({
                title,
                ping,
                imageName,
                blurb: submit.fields.getTextInputValue(FIELDS.blurb),
                newContent: submit.fields.getTextInputValue(FIELDS.newContent),
                changes: submit.fields.getTextInputValue(FIELDS.changes),
                bugFixes: submit.fields.getTextInputValue(FIELDS.bugFixes),
                buttonIds: UpdateLogService.buttons().length
                    ? [...submit.fields.getCheckboxGroup(FIELDS.buttons)]
                    : [],
                extra: extra?.components,
            });
        } catch (error) {
            await submit.editReply(error.message);
            return;
        }

        let channel =
            intr.channel ?? (await intr.client.channels.fetch(intr.channelId).catch(() => null));
        if (!channel?.isSendable()) {
            await submit.editReply(`I can't post in this channel.`);
            return;
        }

        try {
            let webhook = await this.webhook(channel);
            if (!webhook) {
                await submit.editReply(`I can't post webhook messages in this channel.`);
                return;
            }
            await webhook.send({
                username: alias.name,
                avatarURL: alias.avatar || undefined,
                threadId: channel.isThread() ? channel.id : undefined,
                withComponents: true,
                components,
                files: [
                    ...(image ? [new AttachmentBuilder(image.url, { name: imageName })] : []),
                    ...(extra?.files ?? []),
                ],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: UpdateLogService.allowedMentions(ping),
            });
        } catch (error) {
            Logger.error(`Failed to post update log in ${intr.channelId}.`, error);
            await submit.editReply(
                `Couldn't post the update. Check that I can send messages and files here.`
            );
            return;
        }

        await submit.editReply(`Update posted.`);
    }

    private async webhook(channel: SendableChannels): Promise<Webhook | undefined> {
        let target = channel.isThread() ? channel.parent : channel;
        if (!target || !('fetchWebhooks' in target)) {
            return undefined;
        }
        let webhooks = await target.fetchWebhooks();
        let existing = webhooks.find(
            webhook => webhook.applicationId === channel.client.application.id && webhook.token
        );
        return existing ?? (await target.createWebhook({ name: WEBHOOK_NAME }));
    }

    private modal(customId: string): ModalBuilder {
        let paragraph = (id: string, label: string, placeholder: string): LabelBuilder =>
            new LabelBuilder()
                .setLabel(label)
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId(id)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(placeholder)
                        .setRequired(false)
                        .setMaxLength(4000)
                );

        let modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('Post update log')
            .addLabelComponents(
                paragraph(FIELDS.blurb, 'Blurb', 'A short summary shown under the title.'),
                paragraph(FIELDS.newContent, 'New Content', 'One item per line.'),
                paragraph(FIELDS.changes, 'Changes & Accessibility', 'One item per line.'),
                paragraph(FIELDS.bugFixes, 'Bug Fixes', 'One item per line.')
            );

        let buttons = UpdateLogService.buttons();
        if (buttons.length > 0) {
            modal.addLabelComponents(
                new LabelBuilder()
                    .setLabel('Buttons')
                    .setDescription('Link buttons shown under the update.')
                    .setCheckboxGroupComponent(
                        new CheckboxGroupBuilder()
                            .setCustomId(FIELDS.buttons)
                            .setRequired(false)
                            .setMinValues(0)
                            .setMaxValues(buttons.length)
                            .addOptions(
                                buttons.map(button => ({
                                    label: button.label,
                                    value: button.id,
                                    default: button.default ?? false,
                                }))
                            )
                    )
            );
        }

        return modal;
    }
}
