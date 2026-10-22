import { expect } from "chai";
import { TextEdit } from "vscode-languageserver/node";
import { Parser } from "../../../../linter/parser";
import { Indent } from "../../../../linter/rules/layout/LT02";
import { ComparisonOperators } from "../../../../linter/rules/layout/LT15";
import { defaultSettings } from "../../../../settings";

describe("Cached indentation code actions", () => {
  const cases = [
    {
      name: "LT02 inserts indentation",
      rule: () => new Indent(defaultSettings, 0),
      text: "select t.col1,\nt.col2,\n  from dataset.table t\n;\n",
      replacement: "       ",
    },
    {
      name: "LT02 removes excess indentation",
      rule: () => new Indent(defaultSettings, 0),
      text: "select t.col1,\n          t.col2,\n  from dataset.table t\n;\n",
      replacement: "",
    },
    {
      name: "LT15 inserts alignment spaces",
      rule: () => new ComparisonOperators(defaultSettings, 0),
      text: "select *\n  from dataset.table\n where 1 = 1\n   and 10 = 1",
      replacement: "  ",
    },
    {
      name: "LT15 removes excess alignment spaces",
      rule: () => new ComparisonOperators(defaultSettings, 0),
      text: "select *\n  from dataset.table\n where 1    = 1\n   and 10  = 1",
      replacement: "",
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const rule = testCase.rule();
      const uri = `file:///${encodeURIComponent(testCase.name)}.bqsql`;
      const ast = await new Parser().parse({
        text: testCase.text,
        uri,
        languageId: "googlesql",
        version: 1,
      });
      const diagnostic = rule.evaluate(ast, uri)?.[0];
      if (!diagnostic) {
        throw new Error(
          `Expected an indentation diagnostic for ${testCase.name}`,
        );
      }

      const actions = rule.createCodeAction({ uri }, diagnostic);
      expect(actions.map((action) => action.kind)).to.deep.equal(
        rule.codeActionKind,
      );
      for (const action of actions) {
        expect(action.title).to.equal(rule.codeActionTitle);
        expect(action.diagnostics).to.deep.equal([diagnostic]);
        expect(action.edit?.changes?.[uri]).to.deep.equal([
          TextEdit.replace(diagnostic.range, testCase.replacement),
        ]);
      }
      expect(
        rule.createCodeAction({ uri: `${uri}.uncached` }, diagnostic),
      ).to.deep.equal([]);
      const uncachedDiagnostic = rule.createDiagnostic({
        start: { line: 99, character: 0 },
        end: { line: 99, character: 1 },
      });
      expect(rule.createCodeAction({ uri }, uncachedDiagnostic)).to.deep.equal(
        [],
      );
    });
  }
});
