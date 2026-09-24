import { Channel, DMChannel, GuildChannel, PermissionFlagsBits, ThreadChannel } from 'discord.js';

export class PermissionUtils {
    public static canSend(channel: Channel, embedLinks: boolean = false): boolean {
        if (channel instanceof DMChannel) {
            return true;
        } else if (channel instanceof GuildChannel || channel instanceof ThreadChannel) {
            let channelPerms = channel.permissionsFor(channel.client.user);
            if (!channelPerms) {
                return false;
            }

            return channelPerms.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                ...(embedLinks ? [PermissionFlagsBits.EmbedLinks] : []),
            ]);
        } else {
            return false;
        }
    }
}
