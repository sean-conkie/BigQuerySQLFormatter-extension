/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Distinct } from '../../../../linter/rules/structure/ST08';
import { Parser } from '../../../../linter/parser';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('Distinct', () => {
  let instance: Distinct;

  beforeEach(() => {
    instance = new Distinct(defaultSettings, 0);
  });
  afterEach(() => globalTokenCache.delete('test.sql'));

  async function evaluate(text: string) {
    const ast = await new Parser().parse({ text, uri: 'test.sql', languageId: 'googlesql', version: 1 });
    return instance.evaluate(ast, 'test.sql')?.map(({ relatedInformation, ...diagnostic }) => diagnostic) ?? null;
  }

  it('should return null when rule is disabled', () => {
    instance.enabled = false;
    const result = instance.evaluate({});
    expect(result).to.be.null;
  });

  it('should return diagnostic when rule is enabled and pattern matches', async () => {
    instance.enabled = true;
    const result = await evaluate('select distinct(a), b from table');
    expect(result).to.deep.equal([
      {
        code: instance.diagnosticCode,
        codeDescription: { href: instance.diagnosticCodeDescription },
        message: instance.message,
        severity: instance.severity,
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 18 },
        },
        source: instance.source,
      },
    ]);
  });

  it('should return null when rule is enabled but pattern does not match', async () => {
    instance.enabled = true;
    const result = await evaluate('select distinct a, b from table');
    expect(result).to.be.null;
  });
});
