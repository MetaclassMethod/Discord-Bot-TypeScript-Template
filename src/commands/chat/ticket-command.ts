import {
    ChatInputCommandInteraction,
    ComponentType,
    MessageFlags,
    PermissionsString,
} from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang, TicketRelayService, TicketService } from '../../services/index.js';
import { Command, CommandDeferType } from '../index.js';

export const TICKET_STATE_PAUSED = 'paused';

export class TicketCommand implements Command {
    public names = [
        Lang.getRef('chatCommands.ticket', Language.Default),
        Lang.getRef('chatCommands.ticketStatus', Language.Default),
    ];
    public cooldown = new RateLimiter(3, 10000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        let state = intr.options.getString(Lang.getRef('arguments.state', Language.Default));
        let message = intr.options.getString(Lang.getRef('arguments.message', Language.Default));
        let current = TicketService.status();

        if (state) {
            let paused = state === TICKET_STATE_PAUSED;
            current = {
                paused,
                message:
                    message?.toLowerCase() === 'default' ? undefined : (message ?? current.message),
                changedBy: intr.user.id,
                changedAt: new Date().toISOString(),
            };
            TicketService.setStatus(current);
        } else if (message) {
            current = {
                ...current,
                message: message.toLowerCase() === 'default' ? undefined : message,
            };
            TicketService.setStatus(current);
        }

        let summary = [
            current.paused
                ? `## 🔴 Tickets are currently closed\nNobody can open a new ticket. The queue is currently **disabled**.`
                : `## 🎫 Tickets are open, wohoo!\nAnyone can open a ticket from the support hub.`,
            current.changedBy
                ? `-# Last changed by <@${current.changedBy}> <t:${Math.floor(
                      new Date(current.changedAt).getTime() / 1000
                  )}:R>`
                : undefined,
            `\nWhile paused, people see this:`,
        ]
            .filter(Boolean)
            .join('\n');

        await intr.editReply({
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
            components: [
                { type: ComponentType.TextDisplay, content: summary },
                ...TicketRelayService.pausedNotice(current.message),
            ],
        });
    }
}
