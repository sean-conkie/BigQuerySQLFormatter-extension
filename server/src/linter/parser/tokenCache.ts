
import { DocumentUri } from 'vscode-languageserver';
import { LineToken } from './token';

export const globalTokenCache: TokenCache = new Map<DocumentUri, DocumentCache>();

export type TokenCache = Map<DocumentUri, DocumentCache>;

export class DocumentCache {
	private readonly cache: Map<number, LineToken> = new Map();

	public get(token: number): LineToken | undefined {
		return this.cache.get(token);
	}

	public getText(): string {
		const lines: string[] = [];
		this.cache.forEach((lineToken: LineToken) => lines.push(lineToken.value));
		return lines.join('\n');
	}

	public set(token: number, value: LineToken): void {
		this.cache.set(token, value);
	}

	public delete(token: number): void {
		this.cache.delete(token);
	}

	public has(token: number): boolean {
		return this.cache.has(token);
	}

	public clear(): void {
		this.cache.clear();
	}

	public get size(): number {
		return this.cache.size;
	}

	public get tokens(): IterableIterator<LineToken> {
		return this.cache.values();
	}

	public get keys(): IterableIterator<number> {
		return this.cache.keys();
	}

	public entries(): IterableIterator<[number, LineToken]> {
		return this.cache.entries();
	}
}