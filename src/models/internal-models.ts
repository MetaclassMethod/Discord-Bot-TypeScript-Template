import { Locale } from 'discord.js';

export class EventData {
    constructor(
        public lang: Locale,
        public langGuild: Locale
    ) {}
}
