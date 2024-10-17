/**
 * @fileoverview Test suite for LT06 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Functions } from '../../../../linter/rules/layout/LT06';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('Functions', () => {
    let instance: Functions;

    beforeEach(() => {
        instance = new Functions(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and there is a space between function and parenthesis', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT cast (1 as string),\n col2\n FROM table', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 11 },
                end: { line: 0, character: 12 }
            },
            source: instance.source
        }]);
    });

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();
        const diagnostics = instance.evaluate(await parser.parse({text:'SELECT cast (1 as string),\n col2\n FROM table', uri: 'test.sql', languageId: 'sql', version: 0}));
        const actions = instance.createCodeAction({uri: 'test.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['test.sql']: [
                            {
                                newText: '',
                                range: {
                                    start: { line: 0, character: 11 },
                                    end: { line: 0, character: 12 }
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

        const result = instance.evaluate(await parser.parse({text:'SELECT cast(1 as string),\n col2\n FROM table', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});