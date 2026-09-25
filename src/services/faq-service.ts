import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger } from './logger.js';

const ROOT_DIR = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_FILE = path.join(ROOT_DIR, 'faq', 'faq.json');
const DEFAULT_MIN_SCORE = 2;
const MAX_MATCHES = 2;

const STOPWORDS = new Set(
    (
        'a an and are as at be been but by can could did do does doing dont for from get got had has have how i im in ' +
        'is it its just me my of on or please so some that the their them then there this to too was we what when ' +
        'where which who why will with would you your hi hello hey help thanks thank'
    ).split(' ')
);

export interface FaqEntry {
    id: string;
    question: string;
    answer: string;
    keywords: string[];
    categories?: string[];
}

interface FaqFile {
    minScore?: number;
    entries: FaqEntry[];
}

export interface FaqMatch {
    entry: FaqEntry;
    score: number;
}

export class FaqService {
    private static filePath = DEFAULT_FILE;
    private static cache?: { mtimeMs: number; file: FaqFile };

    public static useFile(filePath: string): void {
        this.filePath = filePath;
        this.cache = undefined;
    }

    public static match(text: string, categoryId?: string): FaqMatch[] {
        let file = this.load();
        let words = new Set(this.words(text));
        if (words.size === 0) {
            return [];
        }

        return file.entries
            .filter(
                entry => !entry.categories || !categoryId || entry.categories.includes(categoryId)
            )
            .map(entry => ({ entry, score: this.score(entry, words) }))
            .filter(match => match.score >= (file.minScore ?? DEFAULT_MIN_SCORE))
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_MATCHES);
    }

    public static words(text: string): string[] {
        return text
            .toLowerCase()
            .replaceAll(/[’']/g, '')
            .split(/[^a-z0-9]+/)
            .filter(word => word && !STOPWORDS.has(word))
            .map(word => this.stem(word));
    }

    private static score(entry: FaqEntry, words: Set<string>): number {
        let score = 0;
        for (let keyword of entry.keywords) {
            let parts = this.words(keyword);
            if (parts.length > 0 && parts.every(part => words.has(part))) {
                score += parts.length;
            }
        }
        let overlap = new Set(this.words(entry.question).filter(word => words.has(word)));
        return score + overlap.size * 0.5;
    }

    private static stem(word: string): string {
        if (word.length <= 4) {
            return word;
        }
        for (let ending of ['ing', 'ed', 'es', 's']) {
            if (word.endsWith(ending) && word.length - ending.length >= 3) {
                return word.slice(0, -ending.length);
            }
        }
        return word;
    }

    private static load(): FaqFile {
        try {
            let mtimeMs = fs.statSync(this.filePath).mtimeMs;
            if (this.cache?.mtimeMs !== mtimeMs) {
                this.cache = { mtimeMs, file: JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) };
            }
            return this.cache.file;
        } catch (error) {
            Logger.error(`Couldn't load the FAQ file at ${this.filePath}.`, error);
            return { entries: [] };
        }
    }
}
