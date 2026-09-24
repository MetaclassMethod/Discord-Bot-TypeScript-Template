import {
    APIApplicationCommandBasicOption,
    ApplicationCommandOptionType,
    ChannelType,
} from 'discord.js';

import { BlockBugOption, CloseBugOption } from '../enums/index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

export class Args {
    public static readonly CLOSE_BUG_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.interaction', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('arguments.interaction'),
        description: Lang.getRef('argDescs.closeBugOption', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('argDescs.closeBugOption'),
        type: ApplicationCommandOptionType.String,
        choices: [
            {
                name: Lang.getRef('closeBugOptions.willFix', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('closeBugOptions.willFix'),
                value: CloseBugOption.WILL_FIX,
            },
            {
                name: Lang.getRef('closeBugOptions.wontFix', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('closeBugOptions.wontFix'),
                value: CloseBugOption.WONT_FIX,
            },
            {
                name: Lang.getRef('closeBugOptions.notEnoughInfo', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('closeBugOptions.notEnoughInfo'),
                value: CloseBugOption.NOT_ENOUGH_INFO,
            },
            {
                name: Lang.getRef('closeBugOptions.spam', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('closeBugOptions.spam'),
                value: CloseBugOption.SPAM,
            },
            {
                name: Lang.getRef('closeBugOptions.spamAndBlock', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('closeBugOptions.spamAndBlock'),
                value: CloseBugOption.SPAM_AND_BLOCK,
            },
        ],
    };
    public static readonly CLOSE_BUG_NOTE: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.note', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('arguments.note'),
        description: Lang.getRef('argDescs.closeBugNote', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('argDescs.closeBugNote'),
        type: ApplicationCommandOptionType.String,
        max_length: 500,
    };
    public static readonly PIN_CHANNEL: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.channel', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('arguments.channel'),
        description: Lang.getRef('argDescs.pinChannel', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('argDescs.pinChannel'),
        type: ApplicationCommandOptionType.Channel,
        channel_types: [
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
            ChannelType.GuildMedia,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
            ChannelType.AnnouncementThread,
        ],
    };
    public static readonly PIN_TEMPLATE: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.template', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('arguments.template'),
        description: Lang.getRef('argDescs.pinTemplate', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('argDescs.pinTemplate'),
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
    };
    public static readonly BLOCK_BUG_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.interaction', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('arguments.interaction'),
        description: Lang.getRef('argDescs.blockBugOption', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('argDescs.blockBugOption'),
        type: ApplicationCommandOptionType.String,
        choices: [
            {
                name: Lang.getRef('blockBugOptions.block', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('blockBugOptions.block'),
                value: BlockBugOption.BLOCK,
            },
            {
                name: Lang.getRef('blockBugOptions.blockAndKick', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('blockBugOptions.blockAndKick'),
                value: BlockBugOption.BLOCK_AND_KICK,
            },
            {
                name: Lang.getRef('blockBugOptions.blockAndBan', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('blockBugOptions.blockAndBan'),
                value: BlockBugOption.BLOCK_AND_BAN,
            },
        ],
    };
}
