import { expect } from 'chai';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultSettings, getProjectSettings, isRuleEnabled, mergeSettings, parseSettings } from '../settings';

describe('Rule configuration', () => {
  it('merges rule fields and group toggles without mutating settings; replaces exclusions', () => {
    const base = {
      ...defaultSettings,
      rules: {
        CV05: { enabled: false, severity: 'error' as const },
        groups: { layout: false },
        exclude: ['CV01'],
      },
    };
    const merged = mergeSettings(base, {
      rules: { CV05: { enabled: true }, groups: { convention: true }, exclude: [] },
    });
    expect(merged.rules).to.deep.equal({
      CV05: { enabled: true, severity: 'error' },
      groups: { layout: false, convention: true },
      exclude: [],
    });
    expect(base.rules.CV05.enabled).to.equal(false);
    expect(base.rules.exclude).to.deep.equal(['CV01']);
    expect(mergeSettings(defaultSettings, { rules: { CV05: { enabled: false } } }).rules?.CV05).to.deep.equal({
      enabled: false,
    });
  });

  it('honours exclusions and group toggles over individual enabled flags', () => {
    expect(
      isRuleEnabled(
        { ...defaultSettings, rules: { groups: { convention: false }, CV05: { enabled: true } } },
        'CV05',
        'convention',
      ),
    ).to.equal(false);
    expect(
      isRuleEnabled(
        { ...defaultSettings, rules: { exclude: ['CV05'], CV05: { enabled: true } } },
        'CV05',
        'convention',
      ),
    ).to.equal(false);
    expect(isRuleEnabled({ ...defaultSettings, rules: { CV05: { severity: 'off' } } }, 'CV05', 'convention')).to.equal(
      false,
    );
    expect(isRuleEnabled(defaultSettings, 'CV05', 'convention')).to.equal(true);
  });

  it('parses supported rule settings and ignores unrelated VS Code settings', () => {
    const rules = {
      CV05: { enabled: true, severity: 'information' },
      LT01: { severity: 'hint' },
      AL01: { severity: 'warning' },
      ST01: { severity: 'off' },
      CV01: { severity: 'error' },
      exclude: ['LT02'],
      groups: { aliasing: false },
    };
    expect(parseSettings({ rules, maxNumberOfProblems: 0, trace: { server: 'off' } })).to.deep.equal({
      rules,
      maxNumberOfProblems: 0,
    });
  });

  for (const value of [
    null,
    [],
    true,
    { maxNumberOfProblems: -1 },
    { maxNumberOfProblems: 1.5 },
    { maxNumberOfProblems: '2' },
    { rules: [] },
    { rules: { exclude: 'CV05' } },
    { rules: { exclude: [12] } },
    { rules: { exclude: ['cv05'] } },
    { rules: { groups: [] } },
    { rules: { groups: { unknown: true } } },
    { rules: { groups: { layout: 'off' } } },
    { rules: { typo: {} } },
    { rules: { CV05: null } },
    { rules: { CV05: { enabled: 'false' } } },
    { rules: { CV05: { severity: 'fatal' } } },
    { rules: { CV05: { unsupported: true } } },
  ]) {
    it(`rejects invalid configuration ${JSON.stringify(value)}`, () => {
      expect(() => parseSettings(value)).to.throw();
    });
  }
});

describe('Project configuration discovery', () => {
  let directory: string;
  const uri = (path: string) => pathToFileURL(path).href;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'bqsql-project-settings-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true });
  });

  it('uses the nearest config, respects workspace boundaries, and isolates multiple roots', async () => {
    const root = join(directory, 'one');
    const otherRoot = join(directory, 'two');
    const nested = join(root, 'nested');
    await mkdir(nested, { recursive: true });
    await mkdir(otherRoot);
    await writeFile(join(directory, '.bqsqlformatter.json'), '{"maxNumberOfProblems":1}');
    await writeFile(join(root, '.bqsqlformatter.json'), '{"rules":{"CV05":{"severity":"error"}}}');
    const roots = [uri(root), uri(otherRoot)];
    const document = uri(join(nested, 'query.sql'));
    expect(await getProjectSettings(document, roots)).to.deep.equal({ rules: { CV05: { severity: 'error' } } });
    expect(await getProjectSettings(uri(join(otherRoot, 'query.sql')), roots)).to.deep.equal({});
    expect(await getProjectSettings(uri(join(directory, 'outside.sql')), roots)).to.deep.equal({
      maxNumberOfProblems: 1,
    });
    await writeFile(join(nested, '.bqsqlformatter.json'), '{"rules":{"LT02":{"enabled":false}}}');
    expect(await getProjectSettings(document, roots)).to.deep.equal({ rules: { LT02: { enabled: false } } });
    expect(await getProjectSettings(document, [uri(root), uri(nested)])).to.deep.equal({
      rules: { LT02: { enabled: false } },
    });
    await rm(join(nested, '.bqsqlformatter.json'));
    expect(await getProjectSettings(document, [uri(root), uri(nested)])).to.deep.equal({});
    expect(await getProjectSettings(document, [])).to.deep.equal({});
    expect(await getProjectSettings('untitled:query.sql', roots)).to.deep.equal({});
  });

  for (const content of ['{', 'null', '{"rule":{}}', '{"rules":{"CV05":{"enabled":"no"}}}']) {
    it(`reports the path and error for invalid project config ${content}`, async () => {
      const configPath = join(directory, '.bqsqlformatter.json');
      await writeFile(configPath, content);
      try {
        await getProjectSettings(uri(join(directory, 'query.sql')), [uri(directory)]);
        expect.fail('Expected invalid configuration to fail');
      } catch (error) {
        expect(String(error)).to.include(`Invalid ${configPath}`);
      }
    });
  }

  it('does not treat unreadable configuration as missing', async () => {
    await mkdir(join(directory, '.bqsqlformatter.json'));
    try {
      await getProjectSettings(uri(join(directory, 'query.sql')), [uri(directory)]);
      expect.fail('Expected a filesystem error');
    } catch (error) {
      expect(error).to.have.property('code', 'EISDIR');
    }
  });
});
