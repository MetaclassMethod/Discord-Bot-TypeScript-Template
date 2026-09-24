import { fetchRecommendedShardCount, ShardClientUtil, ShardingManager } from 'discord.js';

import { MathUtils } from './index.js';
import { DiscordLimits } from '../constants/index.js';

export class ShardUtils {
    public static async requiredShardCount(token: string): Promise<number> {
        return await this.recommendedShardCount(token, DiscordLimits.GUILDS_PER_SHARD);
    }

    public static async recommendedShardCount(
        token: string,
        serversPerShard: number
    ): Promise<number> {
        return Math.ceil(
            await fetchRecommendedShardCount(token, { guildsPerShard: serversPerShard })
        );
    }

    public static shardId(guildId: number | string, shardCount: number): number {
        return Number((BigInt(guildId) >> 22n) % BigInt(shardCount));
    }

    public static async serverCount(
        shardInterface: ShardingManager | ShardClientUtil
    ): Promise<number> {
        let shardGuildCounts = (await shardInterface.fetchClientValues(
            'guilds.cache.size'
        )) as number[];
        return MathUtils.sum(shardGuildCounts);
    }
}
