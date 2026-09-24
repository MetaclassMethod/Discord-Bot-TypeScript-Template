import { ChatInputCommandInteraction, PermissionsString, User } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

import { BlockBugOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { BugReportService, Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class BlockBugCommand implements Command {
    public names = [Lang.getRef('chatCommands.bb', Language.Default)];
    public cooldown = new RateLimiter(3, 10000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = ['ManageRoles'];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let ctx = await BugReportService.getContext(intr.channel);
        if (!ctx) {
            await InteractionUtils.send(intr, 'Run this inside a post in the bug forums.', true);
            return;
        }

        let member = await intr.guild.members.fetch(intr.user.id);
        if (!BugReportService.isManager(member)) {
            await InteractionUtils.send(
                intr,
                'You do not have permission to block bug reporters.',
                true
            );
            return;
        }

        if (!ctx.reporterId) {
            await InteractionUtils.send(intr, 'Could not work out who posted this thread.', true);
            return;
        }

        let option = intr.options.getString(
            Lang.getRef('arguments.interaction', Language.Default)
        ) as BlockBugOption;

        let target: User;
        try {
            target = await intr.client.users.fetch(ctx.reporterId);
        } catch {
            await InteractionUtils.send(intr, 'Could not fetch that user from Discord.', true);
            return;
        }

        let reason = Lang.getRef('bugReports.auditBlock', data.lang, {
            MODERATOR: intr.user.tag,
        });

        let dmed = await BugReportService.sendDm(
            target,
            BugReportService.buildBlockDm(option, intr.guild.name, data.lang)
        );

        let result = await BugReportService.applyPunishment(
            intr.guild,
            ctx.reporterId,
            option,
            reason
        );

        await BugReportService.postLog(intr.guild, [
            BugReportService.buildBlockLogContainer(
                target,
                option,
                intr.user,
                result,
                ctx.thread,
                data.lang
            ),
        ]);

        let summary = [
            `Action taken against <@${target.id}>.`,
            result.blocked ? '✅ Blocked role applied.' : '⚠️ Blocked role not applied.',
            ...(option === BlockBugOption.BLOCK_AND_KICK
                ? [result.kicked ? '✅ Kicked.' : '⚠️ Could not kick.']
                : []),
            ...(option === BlockBugOption.BLOCK_AND_BAN
                ? [result.banned ? '✅ Banned.' : '⚠️ Could not ban.']
                : []),
            dmed ? '✅ Poster notified by DM.' : '⚠️ Could not DM the poster (DMs closed).',
            ...(result.failures.length > 0 ? [`Failures: ${result.failures.join(', ')}`] : []),
        ];
        await InteractionUtils.send(intr, summary.join('\n'), true);
    }
}
