/**
 * @fileoverview Test suite for AL05
 * module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { UnusedAlias } from '../../../../linter/rules/aliasing/AL05';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('UnusedAlias', () => {
    let instance: UnusedAlias;

    beforeEach(() => {
        instance = new UnusedAlias(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and as used - column', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT col1 as c\n FROM dataset.table t', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 7 },
                end: { line: 0, character: 16 }
            },
            source: instance.source,
        }]);
    });

    it('should return diagnostic when rule is enabled and as used - where', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 as c\n FROM dataset.table t where col2 = 3', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 28 },
                end: { line: 1, character: 32 }
            },
            source: instance.source,
        }]);
    });

    it('should return diagnostic when rule is enabled and as used - join', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 as c\n       b.col1 as b FROM dataset.table t\n  left join dataset.table1 b on col1 = b.col2', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 2, character: 32 },
                end: { line: 2, character: 36 }
            },
            source: instance.source,
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT t.col1 c\n FROM dataset.table t', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});