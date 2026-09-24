import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { vi } from 'vitest';

export function mockProp<T, K extends keyof T>(obj: T, key: K, value: T[K]): void {
    Object.defineProperty(obj, key, { value, configurable: true });
}

export function createRelativeDate(days: number = 0, hours: number = 0, minutes: number = 0): Date {
    const now = new Date();
    const result = new Date(now);

    if (days !== 0) {
        result.setDate(result.getDate() + days);
    }

    if (hours !== 0) {
        result.setHours(result.getHours() + hours);
    }

    if (minutes !== 0) {
        result.setMinutes(result.getMinutes() + minutes);
    }

    return result;
}

export function mockRandomValues(...values: number[]): () => void {
    let index = 0;
    const originalRandom = Math.random;

    Math.random = vi.fn().mockImplementation(() => {
        const result = values[index % values.length];
        index++;
        return result;
    });

    return () => {
        Math.random = originalRandom;
    };
}

export function createMockEntityManager(): any {
    return {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
        persist: vi.fn(),
        persistAndFlush: vi.fn().mockResolvedValue(undefined),
        flush: vi.fn().mockResolvedValue(undefined),
        getReference: vi.fn(),
    };
}

export function getDescriptionFromPayload(payload: any): string {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && payload.description) return payload.description;
    if (payload && typeof payload === 'object' && payload.data && payload.data.description)
        return payload.data.description;
    return '';
}

export function getDescriptionFromStringOrEmbed(message: string | EmbedBuilder): string {
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object' && message.data && message.data.description)
        return message.data.description;
    return '';
}

export function setSystemTime(
    day: { day: number; month: number; year?: number },
    hour: number = 0,
    timeZone: string = 'America/New_York'
): void {
    const year = day.year ?? 2023;
    const date = DateTime.fromObject(
        { year, month: day.month, day: day.day, hour },
        { zone: timeZone }
    );
    vi.setSystemTime(date.toJSDate());
}
