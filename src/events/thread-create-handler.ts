import {
    AttachmentBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThreadChannel,
} from 'discord.js';
import { createRequire } from 'node:module';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EventHandler } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { BugReportService, Lang, Logger } from '../services/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

const ASSETS_DIR = path.resolve(dirname(fileURLToPath(import.meta.url)), '../../assets');
const SUBMITTED_BANNER = 'bug_submitted.png';
const STARTER_FETCH_ATTEMPTS = 5;
const STARTER_FETCH_DELAY_MS = 1000;

export class ThreadCreateHandler implements EventHandler {
    public async process(thread: ThreadChannel, newlyCreated: boolean): Promise<void> {
        if (!newlyCreated) {
            return;
        }

        let forumChannelId: string = Config.bugReports?.forumChannelId;
        if (!forumChannelId || thread.parentId !== forumChannelId) {
            return;
        }

        if (thread.ownerId === thread.client.user?.id) {
            return;
        }

        if (!thread.isSendable()) {
            return;
        }

        let langCode = thread.guild?.preferredLocale ?? Language.Default;

        let container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${Lang.getRef('bugReports.threadWelcome', langCode)}`
                )
            )
            .addSeparatorComponents(this.divider());

        let starter = await this.waitForStarterMessage(thread);

        let missing = BugReportService.missingRequirements(starter);
        if (missing.length > 0) {
            container
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        [
                            `### ${Lang.getRef('bugReports.missingHeader', langCode)}`,
                            Lang.getRef('bugReports.missingIntro', langCode),
                            ...missing.map(
                                requirement =>
                                    `- ${BugReportService.requirementText(requirement, langCode)}`
                            ),
                        ].join('\n')
                    )
                )
                .addSeparatorComponents(this.divider())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        Lang.getRef('bugReports.missingOutro', langCode)
                    )
                );
        }

        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${SUBMITTED_BANNER}`)
            )
        );

        try {
            await thread.send({
                components: [container],
                files: [
                    new AttachmentBuilder(path.join(ASSETS_DIR, SUBMITTED_BANNER), {
                        name: SUBMITTED_BANNER,
                    }),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (error) {
            Logger.error(`Failed to send message in thread ${thread.id}.`, error);
        }
    }

    private async waitForStarterMessage(thread: ThreadChannel): Promise<Message | undefined> {
        for (let attempt = 0; attempt < STARTER_FETCH_ATTEMPTS; attempt++) {
            try {
                return await thread.fetchStarterMessage({ force: true });
            } catch {
                await new Promise(resolve => setTimeout(resolve, STARTER_FETCH_DELAY_MS));
            }
        }
        return undefined;
    }

    private divider(): SeparatorBuilder {
        return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
    }
}
