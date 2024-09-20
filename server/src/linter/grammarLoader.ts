import * as fs from 'fs';
import * as path from 'path';
import { Registry, INITIAL, IGrammar, ITokenizeLineResult, IToken } from 'vscode-textmate';
import { readFileSync } from 'fs';

// Load the oniguruma library for vscode-textmate
import { loadWASM } from 'onigasm';
import { OnigScanner, OnigString } from 'onigasm';

const wasmPath = require.resolve('onigasm/lib/onigasm.wasm');

// re-export

export type Grammar = IGrammar;
export type GrammarTokenizeLineResult = ITokenizeLineResult;
export class GrammarToken implements IToken {
  scopes: string[];
  startIndex: number;
  endIndex: number;

  constructor(scopes: string[], startIndex: number, endIndex: number) {
    this.scopes = scopes;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
  }
}


export class GrammarLoader {
  private registry: Registry;
  private static wasmLoaded: boolean = false; // Static flag to check if wasm is loaded

  constructor() {
    this.registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (patterns: string[]) => new OnigScanner(patterns),
        createOnigString: (s: string) => new OnigString(s)
      }),
      loadGrammar: async (scopeName: string) => {
        // Adjust the condition to match the scopeName for your grammar
        if (scopeName === 'source.googlesql') {
          const grammarPath = path.join(__dirname, 'syntaxes', 'googlesql.tmLanguage.json');
          const grammarContent = JSON.parse(readFileSync(grammarPath, 'utf-8'));
          return grammarContent;
        }
        return null;
      }
    });
  }

  /**
   * Loads a grammar by its scope name. If the WebAssembly (WASM) module
   * required for grammar processing is not already loaded, it loads the
   * WASM module first.
   *
   * @param scopeName - The scope name of the grammar to load.
   * @returns A promise that resolves to the loaded Grammar object, or null if the grammar could not be loaded.
   */
  async loadGrammar(scopeName: string): Promise<Grammar | null> {
    // Check if wasm is already loaded
    if (!GrammarLoader.wasmLoaded) {
      // Load WASM only if it hasn't been loaded yet
      await loadWASM(fs.readFileSync(wasmPath).buffer);
      GrammarLoader.wasmLoaded = true; // Set the flag to true after loading
    }

    // Load the grammar by scope name
    return this.registry.loadGrammar(scopeName);
  }

  /**
   * Tokenizes a single line of text using the provided grammar.
   *
   * @param grammar - The grammar to use for tokenization.
   * @param line - The line of text to tokenize.
   * @param ruleStack - The initial rule stack to use for tokenization. Defaults to INITIAL.
   * @returns An object containing the tokens and the updated rule stack.
   */
  tokenizeLine(grammar: Grammar, line: string, ruleStack = INITIAL) {
    const result = grammar.tokenizeLine(line, ruleStack);
    return {
      tokens: result.tokens,
      ruleStack: result.ruleStack,
    };
  }
}
