import { ActivityType } from 'discord.js';
import { createRequire } from 'node:module';

import { PresenceAssets } from '../extensions/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export interface PresenceOptions {
    type: Exclude<ActivityType, ActivityType.Custom>;
    name: string;
    url: string;
    assets?: PresenceAssets;
}

export class PresenceUtils {
    public static configured(): PresenceOptions {
        return {
            type: ActivityType[Config.presence.type as keyof typeof ActivityType] as Exclude<
                ActivityType,
                ActivityType.Custom
            >,
            name: Config.presence.name,
            url: Config.presence.url,
            assets: Config.presence.assets,
        };
    }
}
