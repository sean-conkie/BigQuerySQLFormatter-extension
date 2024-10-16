/**
 * @fileoverview Test suite for LT04 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Indent } from '../../../../linter/rules/layout/LT02';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('IndentSelect', () => {
    let instance: Indent;

    beforeEach(() => {
        instance = new Indent(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and comma is at start of line', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'select t.col1,\nt.col2,\n  from dataset.table t\nleft join dataset.table r\n on t.col = r.col\nwhere 1 = 1\nand 2 = 2;\n', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 0 }
            },
            source: instance.source
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 3, character: 0 },
                end: { line: 3, character: 0 }
            },
            source: instance.source
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 4, character: 1 },
                end: { line: 4, character: 1 }
            },
            source: instance.source
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 4, character: 4 },
                end: { line: 4, character: 4 }
            },
            source: instance.source
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 5, character: 0 },
                end: { line: 5, character: 0 }
            },
            source: instance.source
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 5, character: 6 },
                end: { line: 5, character: 6 }
            },
            source: instance.source
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 6, character: 0 },
                end: { line: 6, character: 0 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'select t.col1,\n       t.col2,\n  from dataset.table t\n;\n', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});