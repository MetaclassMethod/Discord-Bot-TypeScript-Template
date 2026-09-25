import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
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
    TICKET: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.ticket', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.ticket'),
        description: Lang.getRef('commandDescs.ticket', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.ticket'),
        dm_permission: false,
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageMessages,
        ]).toString(),
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: Lang.getRef('chatCommands.ticketStatus', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('chatCommands.ticketStatus'),
                description: Lang.getRef('commandDescs.ticketStatus', Language.Default),
                description_localizations: Lang.getRefLocalizationMap('commandDescs.ticketStatus'),
                options: [
                    { ...Args.TICKET_STATE, required: false },
                    { ...Args.TICKET_MESSAGE, required: false },
                ],
            },
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: Lang.getRef('chatCommands.ticketClose', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('chatCommands.ticketClose'),
                description: Lang.getRef('commandDescs.ticketClose', Language.Default),
                description_localizations: Lang.getRefLocalizationMap('commandDescs.ticketClose'),
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: Lang.getRef('chatCommands.ticketCloseCurrent', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'chatCommands.ticketCloseCurrent'
                        ),
                        description: Lang.getRef(
                            'commandDescs.ticketCloseCurrent',
                            Language.Default
                        ),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commandDescs.ticketCloseCurrent'
                        ),
                        options: [{ ...Args.TICKET_CLOSE_NOTE, required: false }],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: Lang.getRef('chatCommands.ticketCloseAll', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'chatCommands.ticketCloseAll'
                        ),
                        description: Lang.getRef('commandDescs.ticketCloseAll', Language.Default),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commandDescs.ticketCloseAll'
                        ),
                        options: [{ ...Args.TICKET_CLOSE_NOTE, required: false }],
                    },
                ],
            },
        ],
    },
    POST: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.post', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.post'),
        description: Lang.getRef('commandDescs.post', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.post'),
        dm_permission: false,
        integration_types: [ApplicationIntegrationType.GuildInstall],
        contexts: [InteractionContextType.Guild],
        default_member_permissions: PermissionsBitField.resolve([
            PermissionFlagsBits.ManageMessages,
        ]).toString(),
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: Lang.getRef('chatCommands.postUpdate', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('chatCommands.postUpdate'),
                description: Lang.getRef('commandDescs.postUpdate', Language.Default),
                description_localizations: Lang.getRefLocalizationMap('commandDescs.postUpdate'),
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: Lang.getRef('chatCommands.postUpdateLog', Language.Default),
                        name_localizations: Lang.getRefLocalizationMap(
                            'chatCommands.postUpdateLog'
                        ),
                        description: Lang.getRef('commandDescs.postUpdateLog', Language.Default),
                        description_localizations: Lang.getRefLocalizationMap(
                            'commandDescs.postUpdateLog'
                        ),
                        options: [
                            { ...Args.UPDATE_TITLE, required: false },
                            { ...Args.UPDATE_PING, required: false },
                            { ...Args.UPDATE_IMAGE, required: false },
                            { ...Args.UPDATE_EXTRA, required: false },
                            { ...Args.UPDATE_AS, required: false },
                        ],
                    },
                ],
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
