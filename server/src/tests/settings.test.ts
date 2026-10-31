import { expect } from 'chai';
import { defaultSettings, documentSettings, getDocumentSettings } from '../settings';
import { createConnection, TextDocumentItem } from 'vscode-languageserver/node';
import { PassThrough } from 'node:stream';
import { stub } from 'sinon';
import manifest from '../../../package.json';
import { ruleOptionSchemas, stringListOption, type OptionDefinitions } from '../ruleOptions';
import { Rule } from '../linter/rules/base';
import { Linter } from '../linter/linter';
import type { RulesSettings } from '../settings';

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

  it('reports invalid editor options and keeps rule defaults and other editor fields', async () => {
    const connection = createConnection(new PassThrough(), new PassThrough());
    const request = stub().resolves({
      rules: { CP04: { severity: 'error', options: { capitalisation_policy: 'title' } } },
    });
    const configuration = stub(connection.workspace, 'getConfiguration').callsFake(request);
    const errors: string[] = [];
    try {
      const settings = await getDocumentSettings('options.sql', connection, defaultSettings, true, [], (message) =>
        errors.push(message),
      );
      expect(settings.rules?.CP04).to.deep.equal({
        severity: 'error',
        options: { capitalisation_policy: 'lower' },
      });
      expect(errors).to.have.length(1);
      await getDocumentSettings('options.sql', connection, defaultSettings, true);
      expect(configuration.calledOnce).to.equal(true);
    } finally {
      configuration.restore();
      connection.dispose();
    }
  });

  it('accepts editor string-list options and reports invalid lists without inventing an RF rule', async () => {
    const schemas = ruleOptionSchemas as Record<string, OptionDefinitions>;
    schemas.RF99 = { ignore_words: stringListOption };
    const connection = createConnection(new PassThrough(), new PassThrough());
    const request = stub().resolves({
      rules: { RF99: { enabled: true, options: { ignore_words: ['word', '_'] } }, groups: { references: true } },
    });
    const configuration = stub(connection.workspace, 'getConfiguration').callsFake(request);
    const errors: string[] = [];
    try {
      const settings = await getDocumentSettings('list.sql', connection, defaultSettings, true);
      expect(settings.rules?.RF99).to.deep.equal({ enabled: true, options: { ignore_words: ['word', '_'] } });
      expect(settings.rules?.groups?.references).to.equal(true);
      request.resolves({ rules: { RF99: { severity: 'hint', options: { ignore_words: ['word', false] } } } });
      const invalid = await getDocumentSettings('invalid-list.sql', connection, defaultSettings, true, [], (message) =>
        errors.push(message),
      );
      expect(invalid.rules?.RF99).to.deep.equal({ severity: 'hint', options: { ignore_words: [] } });
      expect(errors).to.have.length(1);
      expect(errors[0]).to.include('rules.RF99.options.ignore_words');
    } finally {
      delete schemas.RF99;
      configuration.restore();
      connection.dispose();
    }
  });

  it('passes a rule disabled by default through the linter only after explicit opt-in', async () => {
    class OptInRule extends Rule<string> {
      readonly code = 'RF99';
      readonly defaultEnabled = false;
      ruleGroup = 'references';
      evaluate = stub().returns(null);
    }
    const cases: [RulesSettings | undefined, boolean][] = [
      [undefined, false],
      [{ RF99: { severity: 'error' } }, false],
      [{ groups: { references: true } }, false],
      [{ RF99: { enabled: true } }, true],
      [{ RF99: { enabled: false } }, false],
      [{ RF99: { enabled: true }, groups: { references: false } }, false],
      [{ RF99: { enabled: true }, exclude: ['RF99'] }, false],
      [{ RF99: { enabled: true, severity: 'off' } }, false],
    ];
    for (const [rules, expected] of cases) {
      const settings = { ...defaultSettings, rules };
      const rule = new OptInRule(settings, 0);
      const linter = new Linter(settings);
      linter.regexRules = [rule];
      linter.parserRules = [];
      await linter.verify(TextDocumentItem.create('file:///opt-in.sql', 'googlesql', 1, 'select 1;'));
      expect(rule.evaluate.called, JSON.stringify(rules)).to.equal(expected);
    }
  });
});
