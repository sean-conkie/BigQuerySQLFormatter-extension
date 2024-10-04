/**
 * @fileoverview Test suite for AL02 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Distinct } from '../../../../linter/rules/ambiguous/AM01';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('Distinct', () => {
    let instance: Distinct;

    beforeEach(() => {
        instance = new Distinct(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT distinct a.a\n  from dataset.table a\n group by a.a', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 7 },
                end: { line: 0, character: 15 }
            },
            source: instance.source,
            tags: [1]
        }]);
    });

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const diagnostics = instance.evaluate(await parser.parse({text:'SELECT distinct a.a\n  from dataset.table a\n group by a.a', uri: 'test.sql', languageId: 'sql', version: 0}));
        const actions = instance.createCodeAction({uri: 'test.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['test.sql']: [
                            {
                                newText: '',
                                range: {
                                    start: { line: 0, character: 6 },
                                    end: { line: 0, character: 15 }
                                }
                            }
                        ]
                    }
                },
                kind: kind,
                diagnostics: diagnostics
            };
        }));
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT a.a\n  from dataset.table a\n group by a.a', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});