/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Literals } from '../../../../linter/rules/capitalisation/CP04';
import { Parser } from '../../../../linter/parser';

describe('Literals', () => {
    let instance: Literals;

    beforeEach(() => {
        instance = new Literals(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select NULL from table');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 7 },
                end: { line: 0, character: 11 }
            },
            source: instance.source
        }]);
    });

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;
        const parser = new Parser();
        await parser.parse({text:'select NULL from table', uri: 'literals.sql', languageId: 'sql', version: 0});
        const diagnostics = instance.evaluate('select NULL from table');
        const actions = instance.createCodeAction({uri: 'literals.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['literals.sql']: [
                            {
                                newText: 'null',
                                range: {
                                    start: { line: 0, character: 7 },
                                    end: { line: 0, character: 11 }
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

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select null from table');
        expect(result).to.be.null;
    });
});