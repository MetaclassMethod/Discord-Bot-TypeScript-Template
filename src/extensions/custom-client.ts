import { ActivityType, Client, ClientOptions, GatewayOpcodes } from 'discord.js';

export interface PresenceAssets {
    largeImage?: string;
    largeText?: string;
    smallImage?: string;
    smallText?: string;
}

export class CustomClient extends Client {
    constructor(clientOptions: ClientOptions) {
        super(clientOptions);
    }

    public setPresence(
        type: Exclude<ActivityType, ActivityType.Custom>,
        name: string,
        url: string,
        assets?: PresenceAssets
    ): void {
        let art = {
            large_image: assets?.largeImage || undefined,
            large_text: assets?.largeImage ? assets?.largeText || undefined : undefined,
            small_image: assets?.smallImage || undefined,
            small_text: assets?.smallImage ? assets?.smallText || undefined : undefined,
        };
        let hasArt = !!(art.large_image || art.small_image);

        let applicationId = this.application?.id ?? this.user?.id;

        let activity = {
            type,
            name,
            url: /^https?:\/\//.test(url) ? url : undefined,
            ...(hasArt ? { application_id: applicationId, assets: art } : {}),
        };

        (this.ws as any).broadcast({
            op: GatewayOpcodes.PresenceUpdate,
            d: {
                activities: [activity],
                afk: false,
                since: null,
                status: 'online',
            },
        });
    }
}
