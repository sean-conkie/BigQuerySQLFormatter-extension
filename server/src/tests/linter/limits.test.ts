import { expect } from 'chai';
import { Linter } from '../../linter/linter';
import { globalTokenCache } from '../../linter/parser/tokenCache';

describe('Diagnostic limits', () => {
  const uri = 'limits.sql';
  afterEach(() => globalTokenCache.delete(uri));

  for (const max of [0, 1, 2]) {
    it(`publishes at most ${max} diagnostics on open and edit, even within one rule`, async () => {
      const linter = new Linter({ maxNumberOfProblems: max });
      linter.parserRules = [];
      linter.regexRules = linter.regexRules.filter((rule) => rule.code === 'CV05');
      const text = 'select a = null, b = null, c = null\n';
      expect(await linter.verify({ uri, text, version: 1, languageId: 'googlesql' })).to.have.length(max);
      expect(
        await linter.verifyChanges({ textDocument: { uri, version: 2 }, contentChanges: [{ text }] }),
      ).to.have.length(max);
      expect(linter.problems).to.equal(max);
    });
  }

  it('applies suppression before the cap, allowing later unsuppressed diagnostics', async () => {
    const linter = new Linter({ maxNumberOfProblems: 1 });
    linter.parserRules = [];
    linter.regexRules = linter.regexRules.filter((rule) => rule.code === 'CV05');
    const diagnostics = await linter.verify({
      uri,
      version: 1,
      languageId: 'googlesql',
      text: 'select a = null -- noqa\nselect b = null\n',
    });
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].range.start.line).to.equal(1);
  });
});
