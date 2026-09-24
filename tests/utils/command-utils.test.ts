import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from '../../src/commands/index.js';
import { CommandUtils } from '../../src/utils/command-utils.js';
import {
    clientUserBuilder,
    createMockCommand,
    interactionBuilder,
    textChannelBuilder,
    userBuilder,
} from '../builders/discord-builders.js';

vi.mock('../../src/utils/index.js', () => ({
    InteractionUtils: {
        send: vi.fn().mockResolvedValue({}),
    },
    FormatUtils: {
        duration: vi.fn().mockReturnValue('5 seconds'),
    },
}));

vi.mock('../../src/services/index.js', () => ({
    Lang: {
        getEmbed: vi.fn().mockReturnValue({ title: 'Mock Embed' }),
    },
}));

vi.mock('../../src/models/enum-helpers/index.js', () => ({
    Permission: {
        Data: {
            ViewChannel: {
                displayName: vi.fn().mockReturnValue('View Channel'),
            },
            SendMessages: {
                displayName: vi.fn().mockReturnValue('Send Messages'),
            },
        },
    },
}));

describe('CommandUtils', () => {
    describe('findCommand', () => {
        let mockCommands: Command[];

        beforeEach(() => {
            mockCommands = [
                createMockCommand({ names: ['test'] }),
                createMockCommand({ names: ['user', 'info'] }),
                createMockCommand({ names: ['user', 'avatar'] }),
            ] as unknown as Command[];
        });

        it('should find a command with exact match', () => {
            const result = CommandUtils.findCommand(mockCommands, ['test']);
            expect(result).toBe(mockCommands[0]);
        });

        it('should find a nested command with exact match', () => {
            const result = CommandUtils.findCommand(mockCommands, ['user', 'info']);
            expect(result).toBe(mockCommands[1]);
        });

        it('should return undefined if no match found', () => {
            const result = CommandUtils.findCommand(mockCommands, ['nonexistent']);
            expect(result).toBeUndefined();
        });
    });

    describe('runChecks', () => {
        let mockCommand: Command & {
            cooldown: { take: ReturnType<typeof vi.fn>; amount: number; interval: number };
        };
        let mockInteraction: any;
        let mockEventData: any;

        beforeEach(() => {
            const cmdMock = createMockCommand({
                requireClientPerms: ['ViewChannel', 'SendMessages'],
                cooldown: {
                    take: vi.fn(),
                    amount: 1,
                    interval: 5000,
                },
            });

            mockCommand = cmdMock as unknown as Command & {
                cooldown: {
                    take: ReturnType<typeof vi.fn>;
                    amount: number;
                    interval: number;
                };
            };

            const user = userBuilder().withId('123456789012345678').build();
            const clientUser = clientUserBuilder().withId('987654321098765432').build();
            const channel = textChannelBuilder().botHasPerms().build();

            mockInteraction = interactionBuilder()
                .withUser(user)
                .withClientUser(clientUser)
                .withChannel(channel)
                .build();

            mockEventData = { lang: 'en-US' };
        });

        it('should pass checks when all requirements are met', async () => {
            mockCommand.cooldown.take.mockReturnValue(false);

            const result = await CommandUtils.runChecks(
                mockCommand,
                mockInteraction,
                mockEventData
            );

            expect(result).toBe(true);
            expect(mockCommand.cooldown.take).toHaveBeenCalledWith('123456789012345678');
        });

        it('should fail and send message when on cooldown', async () => {
            const { InteractionUtils } = await import('../../src/utils/index.js');

            mockCommand.cooldown.take.mockReturnValue(true);

            const result = await CommandUtils.runChecks(
                mockCommand,
                mockInteraction,
                mockEventData
            );

            expect(result).toBe(false);
            expect(mockCommand.cooldown.take).toHaveBeenCalledWith('123456789012345678');
            expect(InteractionUtils.send).toHaveBeenCalled();
        });

        it('should fail when missing client permissions', async () => {
            const { InteractionUtils } = await import('../../src/utils/index.js');

            const user = userBuilder().withId('123456789012345678').build();
            const clientUser = clientUserBuilder().withId('987654321098765432').build();
            const channelWithNoPerms = textChannelBuilder()
                .botMissingPerms()
                .asGuildChannel()
                .build();

            mockInteraction = interactionBuilder()
                .withUser(user)
                .withClientUser(clientUser)
                .withChannel(channelWithNoPerms)
                .build();

            mockCommand.cooldown.take.mockReturnValue(false);

            const result = await CommandUtils.runChecks(
                mockCommand,
                mockInteraction,
                mockEventData
            );

            expect(result).toBe(false);
            expect(InteractionUtils.send).toHaveBeenCalled();
        });
    });
});
