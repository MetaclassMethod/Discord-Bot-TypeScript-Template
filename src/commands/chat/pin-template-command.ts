import {
    ApplicationCommandOptionChoiceData,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    ForumChannel,
    GuildTextBasedChannel,
    MediaChannel,
    Message,
    MessageFlags,
    PermissionsString,
    ThreadChannel,
} from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { DiscordLimits } from '../../constants/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang, Logger, TemplateService } from '../../services/index.js';
import { InteractionUtils, MessageUtils, StringUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class PinTemplateCommand implements Command {
    public names = [Lang.getRef('chatCommands.pin', Language.Default)];
    public cooldown = new RateLimiter(3, 10000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = ['Administrator'];

    public async autocomplete(
        _intr: AutocompleteInteraction,
        option: AutocompleteFocusedOption
    ): Promise<ApplicationCommandOptionChoiceData[]> {
        let search = option.value?.toLowerCase() ?? '';
        return TemplateService.list()
            .filter(name => name.toLowerCase().includes(search))
            .map(name => ({ name, value: name }));
    }

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        let templateName = intr.options.getString(
            Lang.getRef('arguments.template', Language.Default)
        );

        let channel = await this.resolveChannel(intr);
        if (!channel) {
            await InteractionUtils.send(
                intr,
                `Pick a channel, or run this somewhere I can post.`,
                true
            );
            return;
        }

        let payload;
        try {
            payload = TemplateService.build(templateName);
        } catch (error) {
            await InteractionUtils.send(
                intr,
                `Couldn't build that template: ${error.message}`,
                true
            );
            return;
        }

        let isForum = channel instanceof ForumChannel || channel instanceof MediaChannel;
        let title = payload.title ?? templateName;
        if (isForum && title.length > DiscordLimits.THREAD_NAME_LENGTH) {
            title = StringUtils.truncate(title, DiscordLimits.THREAD_NAME_LENGTH);
        }

        let pinTarget: Message | ThreadChannel;
        try {
            pinTarget = isForum
                ? await (channel as ForumChannel | MediaChannel).threads.create({
                      name: title,
                      message: { ...payload, flags: MessageFlags.IsComponentsV2 },
                  })
                : await (channel as GuildTextBasedChannel).send({
                      ...payload,
                      flags: MessageFlags.IsComponentsV2,
                  });
        } catch (error) {
            Logger.error(`Failed to post template '${templateName}' in ${channel.id}.`, error);
            await InteractionUtils.send(
                intr,
                isForum
                    ? `Couldn't create a post in ${channel}. Check that I can create posts there.`
                    : `Couldn't post in ${channel}. Check that I can send messages there.`,
                true
            );
            return;
        }

        let pinned = true;
        try {
            await (pinTarget instanceof ThreadChannel
                ? pinTarget.pin()
                : MessageUtils.pin(pinTarget));
        } catch (error) {
            pinned = false;
            Logger.error(`Failed to pin template '${templateName}' in ${channel.id}.`, error);
        }

        let what = isForum ? `Created and pinned` : `Posted and pinned`;
        await InteractionUtils.send(
            intr,
            pinned
                ? `${what} \`${templateName}\` in ${channel}.`
                : `Posted \`${templateName}\` in ${channel}, but couldn't pin it. Check that I have **${
                      isForum ? 'Manage Threads' : 'Manage Messages'
                  }** there.`,
            true
        );
    }

    private async resolveChannel(
        intr: ChatInputCommandInteraction
    ): Promise<GuildTextBasedChannel | ForumChannel | MediaChannel | undefined> {
        let chosenId = intr.options.getChannel(
            Lang.getRef('arguments.channel', Language.Default)
        )?.id;

        let channel = chosenId
            ? await intr.guild?.channels.fetch(chosenId).catch(() => undefined)
            : intr.channel;

        if (channel instanceof ThreadChannel && !chosenId) {
            let parent = channel.parent;
            if (parent instanceof ForumChannel || parent instanceof MediaChannel) {
                return parent;
            }
        }

        if (
            channel instanceof ForumChannel ||
            channel instanceof MediaChannel ||
            (channel?.isTextBased() && !channel.isDMBased())
        ) {
            return channel as GuildTextBasedChannel | ForumChannel | MediaChannel;
        }

        return undefined;
    }
}
