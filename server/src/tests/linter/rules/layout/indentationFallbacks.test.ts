import { expect } from "chai";
import { Parser } from "../../../../linter/parser";
import {
  ComparisonAST,
  ComparisonGroupAST,
} from "../../../../linter/parser/ast";
import { Indent } from "../../../../linter/rules/layout/LT02";
import { defaultSettings } from "../../../../settings";

describe("Indentation fallbacks for incomplete syntax trees", () => {
  it("defaults missing source locations to the start of the document", async () => {
    const uri = "file:///incomplete-indentation.bqsql";
    const ast = await new Parser().parse({
      text:
        "select a.col1 as x,\na.col2 as y\nfrom dataset.table a\n" +
        "left join other.table b\non a.id = b.id\nand a.value = b.value\n" +
        "where a.id = 1\nor a.value = 2;\n",
      uri,
      languageId: "googlesql",
      version: 1,
    });
    const statement = Object.values(ast)[0];
    expect(statement.columns).to.have.length(2);
    expect(statement.joins).to.have.length(1);
    if (!statement.from || !statement.where || !statement.joins[0].on) {
      throw new Error(
        "Expected FROM, JOIN and WHERE nodes in the test fixture",
      );
    }

    const clearPosition = (node: {
      startLine: number | null;
      startIndex: number | null;
    }) => {
      node.startLine = null;
      node.startIndex = null;
    };
    const clearComparisonPositions = (
      node: ComparisonAST | ComparisonGroupAST,
    ) => {
      clearPosition(node);
      if (node instanceof ComparisonGroupAST) {
        node.comparisons.forEach(clearComparisonPositions);
      }
    };

    clearPosition(statement);
    for (const column of statement.columns) {
      expect(column.alias).not.to.equal(null);
      clearPosition(column);
      column.tokens.forEach((token) => {
        token.lineNumber = null;
      });
    }
    clearPosition(statement.from);
    statement.from.tokens = [];
    for (const join of statement.joins) {
      clearPosition(join);
      join.join = null;
      if (join.on) {
        clearComparisonPositions(join.on);
      }
    }
    clearComparisonPositions(statement.where);

    const diagnostics = new Indent(defaultSettings, 0).evaluate(ast, uri);
    if (!diagnostics || diagnostics.length === 0) {
      throw new Error(
        "Expected diagnostics for nodes without source locations",
      );
    }
    for (const diagnostic of diagnostics) {
      expect(diagnostic.range.start.line).to.equal(0);
      expect(diagnostic.range.end.line).to.equal(0);
      expect(diagnostic.range.start.character).to.be.at.least(0);
      expect(diagnostic.range.end.character).to.be.at.least(0);
    }
  });

  it("leaves diagnostic limiting to the linter rather than disabling individual rules", () => {
    const rule = new Indent(
      defaultSettings,
      defaultSettings.maxNumberOfProblems,
    );
    expect(rule.enabled).to.equal(true);
  });
});
