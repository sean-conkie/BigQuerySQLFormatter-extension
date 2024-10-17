import { CompletionItem, CompletionItemKind, Hover, HoverParams, TextDocumentPositionParams } from 'vscode-languageserver/node';
import { DocumentCache, globalTokenCache } from '../linter/parser/tokenCache';
import { dateFunctions } from './date';
import { getWordAt } from '../utils';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { aggregateFunctions } from './aggregate';
import { approxFunctions } from './approx';
import { arrayFunctions } from './array';
import { bitFunctions } from './bit';
import { conversionFunctions } from './conversions';
import { datetimeFunctions } from './datetime';
import { debuggingFunctions } from './debugging';
import { dlpFunctions } from './dlp';
import { federatedQueryFunctions } from './federatedQuery';
import { geographyFunctions } from './geography';
import { hashFunctions } from './hash';
import { hyperLogFunctions } from './hyperLog';
import { intervalFunctions } from './interval';
import { jsonFunctions } from './json';
import { mathFunctions } from './math';
import { navigationFunctions } from './navigation';
import { netFunctions } from './net';
import { numberingFunctions } from './numbering';
import { rangeFunctions } from './range';
import { searchFunctions } from './search';
import { securityFunctions } from './security';
import { statisticalFunctions } from './statistical';
import { stringFunctions } from './string';
import { textAnalysisFunctions } from './textAnalysis';
import { timeFunctions } from './time';
import { utilityFunctions } from './utility';

export class CompletionBuilder {
	uri: DocumentUri;
	cachedDocument: DocumentCache | undefined = undefined;
	functionSymbols: CompletionItem[] = [
		...aggregateFunctions,
		...approxFunctions,
		...arrayFunctions,
		...bitFunctions,
		...conversionFunctions,
		...dateFunctions,
		...datetimeFunctions,
		...debuggingFunctions,
		...dlpFunctions,
		...federatedQueryFunctions,
		...geographyFunctions,
		...hashFunctions,
		...hyperLogFunctions,
		...intervalFunctions,
		...jsonFunctions,
		...mathFunctions,
		...navigationFunctions,
		...netFunctions,
		...numberingFunctions,
		...rangeFunctions,
		...searchFunctions,
		...securityFunctions,
		...statisticalFunctions,
		...stringFunctions,
		...textAnalysisFunctions,
		...timeFunctions,
		...utilityFunctions
	];

	constructor(uri: DocumentUri) {
		this.uri = uri;
		this.cachedDocument = globalTokenCache.get(uri);
	}
	
	getCompletions(params: TextDocumentPositionParams): CompletionItem[] {

		if (!this.cachedDocument) {
			return [];
		}
		
		const position = params.position;
	
	
		const text = this.cachedDocument.getText({
			start: { line: position.line, character: 0 },
			end: position,
		});
	
		// Use a simple regex to get the current word being typed
		const match = text.match(/[\w$]+$/);
		const prefix = match ? match[0] : '';
	
		// Filter symbols that start with the prefix
		const filteredSymbols = this.functionSymbols.filter((symbol) =>
			symbol.label.startsWith(prefix)
		);
	
		// Map to CompletionItems
		const completionItems: CompletionItem[] = filteredSymbols.map((symbol) => ({
			label: symbol.label,
			kind: CompletionItemKind.Function,
			detail: symbol.detail,
			documentation: symbol.documentation,
			insertText: symbol.label,
		}));
	
		return completionItems;
	}

	getHover(params: HoverParams): Hover | null {
	
		if (!this.cachedDocument) {
			return null;
		}

		// Analyze the document and position to provide hover information
		const range = {
			start: params.position,
			end: {
				line: params.position.line,
				character: params.position.character + 1,
			},
		};
	
		const word = getWordAt(this.cachedDocument.getText({
			start: { line: params.position.line, character: 0 },
			end: { line: params.position.line + 1, character: 0 },
		}), params.position.character);
	
		const filteredSymbols = this.functionSymbols.filter((symbol) => symbol.label === word);

		if (filteredSymbols.length === 0 || filteredSymbols[0].documentation == null) {
			return null;
		}

		return {
			contents: filteredSymbols[0].documentation!,
			range: range
		};

	}
}