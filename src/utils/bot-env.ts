// wip

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');

export const DEV_FLAG = '--dev';

export function applyBotEnv(argv: string[] = process.argv): boolean {
    let dev = argv.includes(DEV_FLAG);
    if (dev) {
        let { id, token } = Config.client.dev ?? {};
        if (!id || !token) {
            throw new Error(
                `Started with ${DEV_FLAG}, but client.dev.id or client.dev.token is missing.`
            );
        }
        Config.client.id = id;
        Config.client.token = token;
    }
    return dev;
}
