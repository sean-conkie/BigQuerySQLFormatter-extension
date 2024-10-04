/**
 * @fileoverview Test suite for AL05
 * module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { UniqueTable } from '../../../../linter/rules/aliasing/AL04';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('UniqueTable', () => {
    let instance: UniqueTable;

    beforeEach(() => {
        instance = new UniqueTable(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 as c\n FROM dataset.table t\n inner join dataset.table_other t\n;\n', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
                code: instance.diagnosticCode,
                codeDescription: {href: instance.diagnosticCodeDescription},
                message: instance.message,
                severity: instance.severity,
                range: {
                    start: { line: 1, character: 6 },
                    end: { line: 1, character: 21 }
                },
                source: instance.source,
            },
            {
                code: instance.diagnosticCode,
                codeDescription: {href: instance.diagnosticCodeDescription},
                message: instance.message,
                severity: instance.severity,
                range: {
                    start: { line: 2, character: 12 },
                    end: { line: 2, character: 33 }
                },
                source: instance.source,
            }
        ]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 c\n FROM dataset.table t', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});