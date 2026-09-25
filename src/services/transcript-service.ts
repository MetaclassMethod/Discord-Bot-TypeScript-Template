// content derived from flat_bird

import { Collection, Message, ThreadChannel } from 'discord.js';

import { Ticket, TicketService } from './ticket-service.js';

const FETCH_LIMIT = 100;

export type TranscriptRole = 'user' | 'staff' | 'note' | 'system';

export interface TranscriptMessage {
    role: TranscriptRole;
    author: string;
    avatarUrl?: string;
    sentAt: Date;
    text: string;
    attachments: { name: string; url: string; image: boolean }[];
}

export interface TranscriptInfo {
    ticket: Ticket;
    userTag: string;
    closedBy: string;
    closedAt: Date;
    note?: string;
}

export class TranscriptService {
    public static async fetchAll(thread: ThreadChannel): Promise<Message[]> {
        let all: Message[] = [];
        let before: string | undefined;
        for (;;) {
            let page: Collection<string, Message> = await thread.messages.fetch({
                limit: FETCH_LIMIT,
                before,
            });
            all.push(...page.values());
            if (page.size < FETCH_LIMIT) {
                break;
            }
            before = page.lastKey();
        }
        return all.reverse();
    }

    public static convert(
        messages: Message[],
        userName: string,
        notePrefix: string,
        userAvatarUrl?: string
    ): TranscriptMessage[] {
        let botId = messages[0]?.client.user?.id;
        return messages
            .filter(msg => !msg.system)
            .map(msg => {
                let attachments = [...msg.attachments.values()].map(attachment => ({
                    name: attachment.name,
                    url: attachment.url,
                    image: /^image\//.test(attachment.contentType ?? ''),
                }));
                let fromBot = msg.author.id === botId;
                let text = fromBot ? this.componentText(msg) || msg.content : msg.content;
                let userPrefix = `**${userName}**`;

                if (fromBot && text.startsWith(userPrefix)) {
                    return {
                        role: 'user',
                        author: userName,
                        avatarUrl: userAvatarUrl,
                        sentAt: msg.createdAt,
                        text: text.slice(userPrefix.length).trim(),
                        attachments: [...attachments, ...this.componentMedia(msg)],
                    } satisfies TranscriptMessage;
                }

                let staff = !fromBot && !msg.author.bot;
                return {
                    role:
                        fromBot || !staff
                            ? 'system'
                            : text.startsWith(notePrefix)
                              ? 'note'
                              : 'staff',
                    author: msg.member?.displayName ?? msg.author.username,
                    avatarUrl: msg.author.displayAvatarURL({ size: 64 }),
                    sentAt: msg.createdAt,
                    text,
                    attachments,
                } satisfies TranscriptMessage;
            });
    }

    public static html(info: TranscriptInfo, messages: TranscriptMessage[]): string {
        let title = TicketService.title(info.ticket);
        let rows = messages.map(msg => this.row(msg)).join('\n');
        let note = info.note?.trim() ? `<p>Closing note: ${this.markdown(info.note)}</p>\n` : '';

        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escape(title)}</title>
<style>
body { font-family: sans-serif; font-size: 14px; max-width: 800px; margin: 20px auto; padding: 0 12px; background: #313338; color: #dbdee1; }
a { color: #00a8fc; }
hr { border: 0; border-top: 1px solid #3f4147; }
.msg { display: flex; gap: 10px; margin: 0 0 12px; }
.pfp { width: 32px; height: 32px; border-radius: 50%; flex: none; background: #3f4147; }
.msg > div { min-width: 0; }
.meta { color: #949ba4; }
.text { white-space: pre-wrap; overflow-wrap: anywhere; }
.msg a img { max-width: 300px; display: block; margin-top: 4px; }
</style>
</head>
<body>
<h3>${this.escape(title)}</h3>
<p>User: ${this.escape(info.userTag)} (${this.escape(info.ticket.userId)})<br>
Opened: ${this.escape(this.date(new Date(info.ticket.openedAt)))}<br>
Closed: ${this.escape(this.date(info.closedAt))} by ${this.escape(info.closedBy)}</p>
${note}<hr>
${rows}
</body>
</html>
`;
    }

    private static row(msg: TranscriptMessage): string {
        let labels: Record<TranscriptRole, string> = {
            user: 'user',
            staff: 'staff',
            note: 'staff note',
            system: 'bot',
        };
        let files = msg.attachments
            .map(file =>
                file.image
                    ? `<a href="${this.escape(file.url)}"><img src="${this.escape(file.url)}" alt="${this.escape(file.name)}"></a>`
                    : `<div><a href="${this.escape(file.url)}">${this.escape(file.name)}</a></div>`
            )
            .join('');
        let pfp = msg.avatarUrl
            ? `<img class="pfp" src="${this.escape(msg.avatarUrl)}" alt="">`
            : `<div class="pfp"></div>`;
        return `<div class="msg ${msg.role}">${pfp}<div><div class="meta">[${this.escape(this.date(msg.sentAt))}] <b>${this.escape(msg.author)}</b> (${labels[msg.role]})</div><div class="text">${this.markdown(msg.text)}</div>${files}</div></div>`;
    }

    private static markdown(text: string): string {
        return this.escape(text)
            .replaceAll(/^#{1,3} (.*)$/gm, '<h3>$1</h3>')
            .replaceAll(/^-# (.*)$/gm, '<small>$1</small>')
            .replaceAll(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
            .replaceAll(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replaceAll(/`([^`]+)`/g, '<code>$1</code>');
    }

    private static componentText(msg: Message): string {
        let texts: string[] = [];
        let walk = (node: unknown): void => {
            if (Array.isArray(node)) {
                node.forEach(walk);
            } else if (node && typeof node === 'object') {
                let content = (node as { content?: unknown }).content;
                if (typeof content === 'string') {
                    texts.push(content);
                }
                Object.values(node).forEach(walk);
            }
        };
        walk(msg.components.map(component => component.toJSON()));
        return texts.join('\n');
    }

    private static componentMedia(msg: Message): TranscriptMessage['attachments'] {
        let json = JSON.stringify(msg.components.map(component => component.toJSON()));
        let urls = [...json.matchAll(/"url":"(https:[^"]+)"/g)].map(match => match[1]);
        return urls
            .filter(url => ![...msg.attachments.values()].some(a => a.url === url))
            .map(url => ({
                name: decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'file'),
                url,
                image: /\.(png|jpe?g|gif|webp)$/i.test(new URL(url).pathname),
            }));
    }

    private static date(date: Date): string {
        return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    }

    private static escape(text: string): string {
        return text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }
}
