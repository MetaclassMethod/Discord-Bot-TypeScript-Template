import { Message, MessageReaction, User } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';
import { createRequire } from 'node:module';

import { EventHandler } from './index.js';
import { Reaction } from '../reactions/index.js';
import { EventDataService } from '../services/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export class ReactionHandler implements EventHandler {
    private rateLimiter = new RateLimiter(
        Config.rateLimiting.reactions.amount,
        Config.rateLimiting.reactions.interval * 1000
    );

    constructor(
        private reactions: Reaction[],
        private eventDataService: EventDataService
    ) {}

    public async process(msgReaction: MessageReaction, msg: Message, reactor: User): Promise<void> {
        if (reactor.id === msgReaction.client.user?.id || reactor.bot) {
            return;
        }

        let limited = this.rateLimiter.take(msg.author.id);
        if (limited) {
            return;
        }

        let reaction = this.findReaction(msgReaction.emoji.name);
        if (!reaction) {
            return;
        }

        if (reaction.requireGuild && !msg.guild) {
            return;
        }

        if (reaction.requireSentByClient && msg.author.id !== msg.client.user?.id) {
            return;
        }

        if (reaction.requireEmbedAuthorTag && msg.embeds[0]?.author?.name !== reactor.tag) {
            return;
        }

        let data = await this.eventDataService.create({
            user: reactor,
            channel: msg.channel,
            guild: msg.guild,
        });

        await reaction.execute(msgReaction, msg, reactor, data);
    }

    private findReaction(emoji: string): Reaction {
        return this.reactions.find(reaction => reaction.emoji === emoji);
    }
}
