import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_STORE = path.join(ROOT_DIR, 'data', 'tickets.json');

export interface TicketCategory {
    id: string;
    name: string;
    emoji: string;
}

export interface Ticket {
    threadId: string;
    userId: string;
    categoryId: string;
    number: number;
    open: boolean;
    openedAt: string;
}

export interface TicketStatus {
    paused: boolean;
    message?: string;
    changedBy?: string;
    changedAt?: string;
}

interface TicketStore {
    counters: { [categoryId: string]: number };
    tickets: Ticket[];
    status?: TicketStatus;
}

export const REPORT_CATEGORIES: TicketCategory[] = [
    { id: 'exploiter', name: 'Exploiter', emoji: '💻' },
    { id: 'bug-abuse', name: 'Bug Abuse', emoji: '🐛' },
    { id: 'player-report', name: 'Player Report', emoji: '🚩' },
];

export const TICKET_CATEGORIES: TicketCategory[] = [
    ...REPORT_CATEGORIES,
    { id: 'ban-appeal', name: 'Ban Appeal', emoji: '⚖️' },
    { id: 'data-issue', name: 'Data Issue', emoji: '💾' },
    { id: 'question', name: 'Question', emoji: '❓' },
];

export class TicketService {
    private static storePath = DEFAULT_STORE;
    private static cache?: TicketStore;

    public static useStore(filePath: string): void {
        this.storePath = filePath;
        this.cache = undefined;
    }

    public static category(id: string): TicketCategory | undefined {
        return TICKET_CATEGORIES.find(category => category.id === id);
    }

    public static title(ticket: Pick<Ticket, 'categoryId' | 'number'>): string {
        let name = this.category(ticket.categoryId)?.name ?? 'Ticket';
        return `${name} ${String(ticket.number).padStart(3, '0')}`;
    }

    public static status(): TicketStatus {
        return this.load().status ?? { paused: false };
    }

    public static setStatus(status: TicketStatus): void {
        let store = this.load();
        store.status = status;
        this.save(store);
    }

    public static openFor(userId: string): Ticket | undefined {
        return this.load().tickets.find(ticket => ticket.open && ticket.userId === userId);
    }

    public static openTickets(): Ticket[] {
        return this.load().tickets.filter(ticket => ticket.open);
    }

    public static byThread(threadId: string): Ticket | undefined {
        return this.load().tickets.find(ticket => ticket.threadId === threadId);
    }

    public static nextNumber(categoryId: string): number {
        let store = this.load();
        let number = (store.counters[categoryId] ?? 0) + 1;
        store.counters[categoryId] = number;
        this.save(store);
        return number;
    }

    public static add(ticket: Ticket): void {
        let store = this.load();
        store.tickets.push(ticket);
        this.save(store);
    }

    public static close(threadId: string): Ticket | undefined {
        let store = this.load();
        let ticket = store.tickets.find(t => t.threadId === threadId && t.open);
        if (ticket) {
            ticket.open = false;
            this.save(store);
        }
        return ticket;
    }

    private static load(): TicketStore {
        if (!this.cache) {
            try {
                this.cache = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
            } catch {
                this.cache = { counters: {}, tickets: [] };
            }
        }
        return this.cache;
    }

    private static save(store: TicketStore): void {
        this.cache = store;
        fs.mkdirSync(dirname(this.storePath), { recursive: true });
        fs.writeFileSync(this.storePath, JSON.stringify(store, undefined, 4));
    }
}
