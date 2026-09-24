import {
    ApplicationCommandType,
    PermissionFlagsBits,
    PermissionsBitField,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';

import { Args } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

export const ChatCommandMetadata: {
    [command: string]: RESTPostAPIChatInputApplicationCommandsJSONBody;
} = {
    BB: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.bb', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.bb'),
        description: Lang.getRef('commandDescs.bb', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.bb'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageMessages,
        ]).toString(),
        options: [
            {
                ...Args.BLOCK_BUG_OPTION,
                required: true,
            },
        ],
    },
    CB: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.cb', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.cb'),
        description: Lang.getRef('commandDescs.cb', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.cb'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageMessages,
        ]).toString(),
        options: [
            {
                ...Args.CLOSE_BUG_OPTION,
                required: true,
            },
            {
                ...Args.CLOSE_BUG_NOTE,
                required: false,
            },
        ],
    },
    PIN: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.pin', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.pin'),
        description: Lang.getRef('commandDescs.pin', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.pin'),
        dm_permission: false,
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageMessages,
        ]).toString(),
        options: [
            {
                ...Args.PIN_TEMPLATE,
                required: true,
            },
            {
                ...Args.PIN_CHANNEL,
                required: false,
            },
        ],
    },
};

export const MessageCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {};

export const UserCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {};
