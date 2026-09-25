import { Message } from 'discord.js';

import { EventHandler, TriggerHandler } from './index.js';
import { SpamFilterService, TicketRelayService } from '../services/index.js';

export class MessageHandler implements EventHandler {
    constructor(private triggerHandler: TriggerHandler) {}

    public async process(msg: Message): Promise<void> {
        if (msg.system || msg.author.id === msg.client.user?.id) {
            return;
        }

        if (await SpamFilterService.process(msg)) {
            return;
        }

        if (await TicketRelayService.process(msg)) {
            return;
        }

        await this.triggerHandler.process(msg);
    }

    public async processEdit(msg: Message): Promise<void> {
        if (msg.system || msg.author.id === msg.client.user?.id) {
            return;
        }

        await SpamFilterService.process(msg);
    }
}
