import { ButtonInteraction } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';
import { createRequire } from 'node:module';

import { EventHandler } from './index.js';
import { Button, ButtonDeferType } from '../buttons/index.js';
import { EventDataService } from '../services/index.js';
import { InteractionUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export class ButtonHandler implements EventHandler {
    private rateLimiter = new RateLimiter(
        Config.rateLimiting.buttons.amount,
        Config.rateLimiting.buttons.interval * 1000
    );

    constructor(
        private buttons: Button[],
        private eventDataService: EventDataService
    ) {}

    public async process(intr: ButtonInteraction): Promise<void> {
        if (intr.user.id === intr.client.user?.id || intr.user.bot) {
            return;
        }

        let limited = this.rateLimiter.take(intr.user.id);
        if (limited) {
            return;
        }

        let button = this.findButton(intr.customId);
        if (!button) {
            return;
        }

        if (button.requireGuild && !intr.guild) {
            return;
        }

        if (
            button.requireEmbedAuthorTag &&
            intr.message.embeds[0]?.author?.name !== intr.user.tag
        ) {
            return;
        }

        switch (button.deferType) {
            case ButtonDeferType.REPLY: {
                await InteractionUtils.deferReply(intr);
                break;
            }
            case ButtonDeferType.UPDATE: {
                await InteractionUtils.deferUpdate(intr);
                break;
            }
        }

        if (button.deferType !== ButtonDeferType.NONE && !intr.deferred) {
            return;
        }

        let data = await this.eventDataService.create({
            user: intr.user,
            channel: intr.channel,
            guild: intr.guild,
        });

        await button.execute(intr, data);
    }

    private findButton(id: string): Button {
        return this.buttons.find(button => button.ids.includes(id));
    }
}
