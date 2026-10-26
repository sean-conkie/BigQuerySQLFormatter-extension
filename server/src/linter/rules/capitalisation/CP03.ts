import { CapitalisationRule } from './base';
import type { DocumentCache } from '../../parser/tokenCache';
import functions from '../../../completions/functions.json';
import { keyword, sourceTokens } from '../source';

const builtins = new Set(functions.map(({ name }) => name.toUpperCase()));

export class Functions extends CapitalisationRule {
  readonly name = 'functions';
  readonly code = 'CP03';
  readonly message = 'Capitalisation of function name';
  readonly scopes = ['support.function', 'meta.function.sql'];

  protected *tokens(cache: DocumentCache) {
    const source = sourceTokens(cache);
    const positionKey = (line: number, character: number) => `${line}:${character}`;
    const candidates = new Map(
      [...super.tokens(cache)].map((token) => [
        positionKey(token.range.start.line, token.range.start.character),
        token,
      ]),
    );
    const userFunctions = new Set<string>();
    for (let i = 0; i < source.length; i++) {
      const start = i;
      if (keyword(source[i - 1], 'FUNCTION') && source[i].value.startsWith('`'))
        userFunctions.add(source[i].value.slice(1, -1).toUpperCase());
      if (source[i].literal || keyword(source[i - 1], '.') || !/^[a-z_][\w$]*$/i.test(source[i].value)) continue;
      while (keyword(source[i + 1], '.') && source[i + 2] && !source[i + 2].literal) i += 2;
      const name = source
        .slice(start, i + 1)
        .map((token) => token.value)
        .join('')
        .toUpperCase();
      if (keyword(source[start - 1], 'FUNCTION')) userFunctions.add(name);
      if (
        !builtins.has(name.replace(/^SAFE\./, '')) ||
        userFunctions.has(name) ||
        /^(TABLE|VIEW|MODEL|FUNCTION|PROCEDURE|INTO|INSERT)$/i.test(source[start - 1]?.value ?? '')
      )
        continue;
      const last = source[i].range.end;
      for (let j = start; j <= i; j += 2) {
        const position = source[j].range.start;
        const token = candidates.get(positionKey(position.line, position.character));
        if (
          token &&
          (token.range.end.line < last.line ||
            (token.range.end.line === last.line && token.range.end.character <= last.character))
        )
          yield token;
      }
    }
  }
}
