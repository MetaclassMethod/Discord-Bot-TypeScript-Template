import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    PermissionsString,
} from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang, Logger, TicketRelayService, TicketService } from '../../services/index.js';
import { Command, CommandDeferType } from '../index.js';

const CONFIRM_ID = 'ticket:close-all:confirm';
const CANCEL_ID = 'ticket:close-all:cancel';
const CONFIRM_TIMEOUT_MS = 60 * 1000;

export class TicketCloseCommand implements Command {
    public names = [
        Lang.getRef('chatCommands.ticket', Language.Default),
        Lang.getRef('chatCommands.ticketClose', Language.Default),
    ];
    public cooldown = new RateLimiter(2, 10000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        let note =
            intr.options.getString(Lang.getRef('arguments.note', Language.Default)) ?? undefined;

        if (
            intr.options.getSubcommand() ===
            Lang.getRef('chatCommands.ticketCloseAll', Language.Default)
        ) {
            await this.closeAll(intr, note);
        } else {
            await this.closeCurrent(intr, note);
        }
    }

    private async closeCurrent(intr: ChatInputCommandInteraction, note?: string): Promise<void> {
        let ticket = intr.channel?.isThread() ? TicketService.byThread(intr.channel.id) : undefined;
        if (!ticket || !intr.channel?.isThread()) {
            await intr.editReply(`Run this inside a ticket thread.`);
            return;
        }
        if (!ticket.open) {
            await intr.editReply(`This ticket is already closed.`);
            return;
        }

        await TicketRelayService.close(intr.channel, intr.user, note);
        await intr.editReply(`Closed ${TicketService.title(ticket)}.`);
    }

    private async closeAll(intr: ChatInputCommandInteraction, note?: string): Promise<void> {
        let open = TicketService.openTickets();
        if (open.length === 0) {
            await intr.editReply(`There are no open tickets.`);
            return;
        }

        let reply = await intr.editReply({
            content: `Close **${open.length}** open ticket${open.length === 1 ? '' : 's'}? Every user gets a DM${note ? ' with your note' : ''} and a transcript is posted for each one. This can't be undone.`,
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(CONFIRM_ID)
                        .setStyle(ButtonStyle.Danger)
                        .setLabel(`Close ${open.length}`),
                    new ButtonBuilder()
                        .setCustomId(CANCEL_ID)
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel('Cancel')
                ),
            ],
        });

        let click;
        try {
            click = await reply.awaitMessageComponent({
                componentType: ComponentType.Button,
                time: CONFIRM_TIMEOUT_MS,
                filter: button => button.user.id === intr.user.id,
            });
        } catch {
            await intr.editReply({ content: `Timed out, nothing was closed.`, components: [] });
            return;
        }

        if (click.customId !== CONFIRM_ID) {
            await click.update({ content: `Cancelled, nothing was closed.`, components: [] });
            return;
        }
        await click.update({ content: `Closing ${open.length} tickets…`, components: [] });

        let closed = 0;
        let failed: string[] = [];

        for (let ticket of open) {
            let title = TicketService.title(ticket);
            try {
                let thread = await intr.client.channels.fetch(ticket.threadId).catch(() => null);
                if (thread?.isThread()) {
                    await TicketRelayService.close(thread, intr.user, note);
                } else {
                    // the thread was deleted, so just mark the ticket closed.
                    TicketService.close(ticket.threadId);
                }
                closed++;
            } catch (error) {
                Logger.error(`Failed to close ${title} during close all.`, error);
                failed.push(title);
            }
        }

        await intr.editReply({
            content:
                `Closed ${closed} ticket${closed === 1 ? '' : 's'}.` +
                (failed.length ? `\nCouldn't close: ${failed.join(', ')}` : ''),
            components: [],
        });
    }
}
