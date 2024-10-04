
import { DocumentUri, Range } from 'vscode-languageserver';
import { LineToken } from './token';

export const globalTokenCache: TokenCache = new Map<DocumentUri, DocumentCache>();

export type TokenCache = Map<DocumentUri, DocumentCache>;

export class DocumentCache {
	private readonly cache: Map<number, LineToken> = new Map();

	public get(token: number): LineToken | undefined {
		return this.cache.get(token);
	}

	public getText(range?: Range): string {
		const lines: string[] = [];

		if (range) {
			const start = range.start.line;
			const end = range.end.line;

			for (let i = start; i <= end; i++) {
				const lineToken = this.cache.get(i);
				if (lineToken) {

					const startIndex = range.start.line === i ? range.start.character : 0;
					const endIndex = range.end.line === i ? range.end.character : lineToken.value.length;

					lines.push(lineToken.value.substring(startIndex, endIndex));
				}
			}
			return lines.join('\n');
		}

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