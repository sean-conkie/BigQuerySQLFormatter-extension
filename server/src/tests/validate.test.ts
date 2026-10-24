import { expect } from 'chai';
import { closeTextDocument, getDocumentLinter, validateTextDocument } from '../validate';
import { defaultSettings, documentSettings } from '../settings';
import { globalTokenCache } from '../linter/parser/tokenCache';
import { CancellationTokenSource, ResponseError, LSPErrorCodes } from 'vscode-languageserver/node';
import { Parser } from '../linter/parser';
import sinon from 'sinon';

describe('Document lifecycle', () => {
  const uri = 'file:///close.bqsql';

  afterEach(() => {
    closeTextDocument(uri);
  });

  it('evicts tokens and settings and clears diagnostics on close, then parses fresh on reopen', async () => {
    documentSettings.set(uri, Promise.resolve(defaultSettings));
    const document = { uri, languageId: 'googlesql', version: 1, text: '\nselect col\nfrom dataset.table' };
    const opened = await validateTextDocument(document, defaultSettings);
    expect(opened.diagnostics).not.to.be.empty;
    expect(globalTokenCache.has(uri)).to.equal(true);
    expect(closeTextDocument(uri)).to.deep.equal({ uri, diagnostics: [] });
    expect(globalTokenCache.has(uri)).to.equal(false);
    expect(documentSettings.has(uri)).to.equal(false);
    expect(closeTextDocument(uri)).to.deep.equal({ uri, diagnostics: [] });
    await validateTextDocument({ ...document, version: 2, text: 'select 1;\n' }, defaultSettings);
    expect(globalTokenCache.get(uri)!.getText()).to.equal('select 1;\n');
  });

  it('caches rule and parser instances across validations, updates settings, and evicts on close', async () => {
    const document = { uri, languageId: 'googlesql', version: 1, text: '\nselect col\nfrom dataset.table' };
    const initialize = sinon.spy(Parser.prototype, 'initialize');
    try {
      const linter = getDocumentLinter(uri, defaultSettings);
      const rule = linter.regexRules[0];
      expect((await validateTextDocument(document, defaultSettings)).diagnostics).not.to.be.empty;
      expect((await validateTextDocument({ ...document, version: 2 }, { maxNumberOfProblems: 0 })).diagnostics).to.be
        .empty;
      expect(getDocumentLinter(uri, defaultSettings)).to.equal(linter);
      expect(linter.regexRules[0]).to.equal(rule);
      expect(rule.settings).to.equal(defaultSettings);
      expect(initialize.callCount).to.equal(1);
      closeTextDocument(uri);
      expect(getDocumentLinter(uri, defaultSettings)).not.to.equal(linter);
    } finally {
      initialize.restore();
    }
  });

  it('honours cancellation before validation without creating document caches', async () => {
    const source = new CancellationTokenSource();
    source.cancel();
    try {
      await validateTextDocument(
        { uri, languageId: 'googlesql', version: 1, text: 'select 1;\n' },
        defaultSettings,
        source.token,
      );
      expect.fail('Expected cancellation');
    } catch (error) {
      expect(error).to.be.instanceOf(ResponseError).with.property('code', LSPErrorCodes.RequestCancelled);
    } finally {
      source.dispose();
    }
    expect(globalTokenCache.has(uri)).to.equal(false);
  });

  it('yields during tokenization and stops cancelled work before repopulating a closed document', async () => {
    const source = new CancellationTokenSource();
    const parser = new Parser();
    await parser.initialize();
    const pending = parser.parse(
      { uri, languageId: 'googlesql', version: 1, text: 'select 1;\n'.repeat(200) },
      source.token,
    );
    setImmediate(() => {
      source.cancel();
      closeTextDocument(uri);
    });
    try {
      await pending;
      expect.fail('Expected cancellation');
    } catch (error) {
      expect(error).to.be.instanceOf(ResponseError).with.property('code', LSPErrorCodes.RequestCancelled);
    } finally {
      source.dispose();
    }
    expect(globalTokenCache.has(uri)).to.equal(false);
  });
});
