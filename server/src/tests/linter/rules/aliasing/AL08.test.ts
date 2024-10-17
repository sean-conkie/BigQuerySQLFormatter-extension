/**
 * @fileoverview Test suite for AL08 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { UniqueColumn } from '../../../../linter/rules/aliasing/AL08';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('UniqueColumn', () => {
    let instance: UniqueColumn;

    beforeEach(() => {
        instance = new UniqueColumn(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 as c\n       t.col2 as c\n FROM dataset.table t', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 7 },
                end: { line: 0, character: 18 }
            },
            source: instance.source,
        },
        {
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 7 },
                end: { line: 1, character: 18 }
            },
            source: instance.source,
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 as c\n       t.col2 as c2\n FROM dataset.table t', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});