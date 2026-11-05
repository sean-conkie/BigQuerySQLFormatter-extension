import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Indent } from '../../../../linter/rules/layout/LT02';
import { type FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('IndentSelect', () => {
  let instance: Indent;

  beforeEach(() => {
    instance = new Indent(defaultSettings, 0);
  });

  it('should return null when rule is disabled', () => {
    instance.enabled = false;
    const result = instance.evaluate({ 1: new StatementAST() } as FileMap);
    expect(result).to.be.null;
  });

  it('reports exact ranges for SELECT, JOIN, ON and WHERE indentation', async () => {
    const uri = 'file:///indent-ranges.sql';
    const ast = await new Parser().parse({
      text: 'select t.col1,\nt.col2,\n  from dataset.table t\nleft join dataset.table r\n on t.col = r.col\nwhere 1 = 1\nand 2 = 2;\n',
      uri,
      languageId: 'googlesql',
      version: 0,
    });
    expect(instance.evaluate(ast, uri)).to.deep.equal(
      [
        [3, 0],
        [4, 1],
        [1, 0],
        [5, 0],
        [5, 6],
        [6, 0],
      ].map(([line, character]) =>
        instance.createDiagnostic({ start: { line, character }, end: { line, character } }, uri),
      ),
    );
  });

  it('should return null when rule is enabled but pattern does not match', async () => {
    const uri = 'file:///indent-clean.sql';
    const result = instance.evaluate(
      await new Parser().parse({
        text: 'select t.col1,\n       t.col2,\n  from dataset.table t\n;\n',
        uri,
        languageId: 'googlesql',
        version: 0,
      }),
      uri,
    );
    expect(result).to.be.null;
  });
});
