/**
 * @fileoverview Test suite for LT04 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { TrailingComma } from '../../../../linter/rules/layout/LT04';
import { FileMap, StatementAST, Parser, ColumnAST, Token, ObjectAST } from '../../../../linter/parser';

describe('TrailingComma', () => {
    let instance: TrailingComma;

    beforeEach(() => {
        instance = new TrailingComma(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and comma is at start of line', () => {
        instance.enabled = true;

        const ast = new StatementAST();
        ast.startIndex = 0;
        ast.endIndex = 1;
        ast.columns = [
          {
            startIndex: 8,
            endIndex: 12,
            lineNumber: 0,
            tokens: [
              {startIndex: 8, endIndex: 12, value: 'col1', lineNumber: 0, scopes: ['entity.name.tag', 'source.googlesql']} as Token,
            ]
          },
          {
            startIndex: 8,
            endIndex: 9,
            lineNumber: 1,
            tokens: [
              {startIndex: 8, endIndex: 9, value: ',', lineNumber: 1, scopes: ['punctuation.separator.comma.sql', 'source.googlesql']} as Token,
            ]
          },
          {
            startIndex: 9,
            endIndex: 13,
            lineNumber: 1,
            tokens: [
              {startIndex: 9, endIndex: 13, value: 'col2', lineNumber: 1, scopes: ['entity.other.column.sql', 'meta.column.sql', 'source.googlesql']} as Token,
            ]
          }
        ] as ColumnAST[];
        ast.from = {
          project: null,
          dataset: null,
          object: 'table',
          alias: null,
          tokens: [
            {startIndex: 8, endIndex: 13, value: 'table', lineNumber: 0, scopes: ['entity.name.tag', 'source.googlesql']} as Token,
          ] as Token[],
          startIndex: 8,
          endIndex: 13,
          lineNumber: 3
        } as ObjectAST;

        const result = instance.evaluate(
          {0: ast} as FileMap
        );
        expect(result).to.deep.equal([{
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 8 },
                end: { line: 1, character: 9 }
            },
            source: 'trailing_commas'
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;

        const ast = new StatementAST();
        ast.startIndex = 0;
        ast.endIndex = 1;
        ast.columns = [
          {
            startIndex: 8,
            endIndex: 12,
            lineNumber: 0,
            tokens: [
              {startIndex: 8, endIndex: 12, value: 'col1', lineNumber: 0, scopes: ['entity.name.tag', 'source.googlesql']} as Token,
            ]
          },
          {
            startIndex: 12,
            endIndex: 13,
            lineNumber: 0,
            tokens: [
              {startIndex: 12, endIndex: 13, value: ',', lineNumber: 0, scopes: ['punctuation.separator.comma.sql', 'source.googlesql']} as Token,
            ]
          },
          {
            startIndex: 8,
            endIndex: 12,
            lineNumber: 1,
            tokens: [
              {startIndex: 8, endIndex: 12, value: 'col2', lineNumber: 1, scopes: ['entity.other.column.sql', 'meta.column.sql', 'source.googlesql']} as Token,
            ]
          }
        ] as ColumnAST[];
        ast.from = {
          project: null,
          dataset: null,
          object: 'table',
          alias: null,
          tokens: [
            {startIndex: 8, endIndex: 13, value: 'table', lineNumber: 0, scopes: ['entity.name.tag', 'source.googlesql']} as Token,
          ] as Token[],
          startIndex: 8,
          endIndex: 13,
          lineNumber: 3
        } as ObjectAST;

        const result = instance.evaluate({0: ast} as FileMap);
        expect(result).to.be.null;
    });
});