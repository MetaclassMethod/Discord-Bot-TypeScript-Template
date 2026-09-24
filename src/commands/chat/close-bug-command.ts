import { ChatInputCommandInteraction, PermissionsString, User } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';
import { createRequire } from 'node:module';

import { CloseBugOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { BugReportService, Lang, Logger } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const require = createRequire(import.meta.url);
let Logs = require('../../../lang/logs.json');

export class CloseBugCommand implements Command {
    public names = [Lang.getRef('chatCommands.cb', Language.Default)];
    public cooldown = new RateLimiter(3, 10000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = ['ManageThreads'];

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
                `Sooo.... you don't have permission to close bug reports. In fact, how did you even see this?`,
                true
            );
            return;
        }

        let option = intr.options.getString(
            Lang.getRef('arguments.interaction', Language.Default)
        ) as CloseBugOption;
        let note = intr.options.getString(Lang.getRef('arguments.note', Language.Default));

        let reporter: User;
        if (ctx.reporterId) {
            try {
                reporter = await intr.client.users.fetch(ctx.reporterId);
            } catch {}
        }

        let logged = await BugReportService.postLog(intr.guild, [
            BugReportService.buildLogContainer(ctx, option, intr.user, note, data.lang),
        ]);

        let dmed = false;
        if (reporter) {
            dmed = await BugReportService.sendDm(
                reporter,
                BugReportService.buildCloseDm(
                    ctx,
                    option,
                    note,
                    BugReportService.forumUrl(intr.guild),
                    data.lang
                )
            );
        }

        let blocked = false;
        if (option === CloseBugOption.SPAM_AND_BLOCK && ctx.reporterId) {
            let result = await BugReportService.applyPunishment(
                intr.guild,
                ctx.reporterId,
                option,
                Lang.getRef('bugReports.auditClose', data.lang, {
                    MODERATOR: intr.user.tag,
                    RESOLUTION: BugReportService.resolutionText(option, data.lang),
                })
            );
            blocked = result.blocked;
        }

        let summary = [
            `Closed as **${BugReportService.resolutionText(option, data.lang)}**.`,
            logged ? '✅ Logged to the bug log.' : '⚠️ Could not post to the bug log.',
            reporter
                ? dmed
                    ? '✅ Reporter notified by DM.'
                    : '⚠️ Could not DM the reporter (DMs closed).'
                : '⚠️ Could not resolve the reporter.',
            ...(option === CloseBugOption.SPAM_AND_BLOCK
                ? [blocked ? '✅ Reporter blocked.' : '⚠️ Could not apply the blocked role.']
                : []),
        ];
        await InteractionUtils.send(intr, summary.join('\n'), true);

        try {
            await ctx.thread.delete(
                Lang.getRef('bugReports.auditClose', data.lang, {
                    MODERATOR: intr.user.tag,
                    RESOLUTION: BugReportService.resolutionText(option, data.lang),
                })
            );
        } catch (error) {
            Logger.error(Logs.error.bugThreadDeleteFailed, error);
        }
    }
}
