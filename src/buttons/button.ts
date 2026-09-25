import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';

export type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction;

import { EventData } from '../models/internal-models.js';

export interface Button {
    ids: string[];
    deferType: ButtonDeferType;
    requireGuild: boolean;
    requireEmbedAuthorTag: boolean;
    execute(intr: ComponentInteraction, data: EventData): Promise<void>;
}

export enum ButtonDeferType {
    REPLY = 'REPLY',
    UPDATE = 'UPDATE',
    NONE = 'NONE',
}
