import { expect } from 'chai';
import { defaultSettings, documentSettings, getDocumentSettings } from '../settings';
import { createConnection } from 'vscode-languageserver/node';
import { PassThrough } from 'node:stream';
import { stub } from 'sinon';
import manifest from '../../../package.json';

describe('Document settings', () => {
  afterEach(() => documentSettings.clear());

  it('uses the same default as the extension manifest', () => {
    expect(defaultSettings.maxNumberOfProblems).to.equal(
      manifest.contributes.configuration.properties['bigquerySQLFormatter.maxNumberOfProblems'].default,
    );
  });

  it('uses fallback settings without configuration support', async () => {
    const connection = createConnection(new PassThrough(), new PassThrough());
    try {
      expect(await getDocumentSettings('test.sql', connection, { maxNumberOfProblems: 2 }, false)).to.deep.equal({
        maxNumberOfProblems: 2,
      });
    } finally {
      connection.dispose();
    }
  });

  it('requests and caches resource-scoped settings, merging partial values with defaults', async () => {
    const connection = createConnection(new PassThrough(), new PassThrough());
    const request = stub().resolves({});
    const configuration = stub(connection.workspace, 'getConfiguration').callsFake(request);
    try {
      expect(await getDocumentSettings('one.sql', connection, { maxNumberOfProblems: 2 }, true)).to.deep.equal(
        defaultSettings,
      );
      await getDocumentSettings('one.sql', connection, defaultSettings, true);
      expect(request.calledOnceWithExactly({ scopeUri: 'one.sql', section: 'bigquerySQLFormatter' })).to.equal(true);
      request.resolves({ maxNumberOfProblems: 3 });
      expect(await getDocumentSettings('two.sql', connection, defaultSettings, true)).to.deep.equal({
        maxNumberOfProblems: 3,
      });
    } finally {
      configuration.restore();
      connection.dispose();
    }
  });
});
