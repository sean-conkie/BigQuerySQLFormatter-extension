/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { SelectTrailingComma } from '../../../../linter/rules/convention/CV03';
import { Parser } from '../../../../linter/parser';

describe('SelectTrailingComma', () => {
    let instance: SelectTrailingComma;

    beforeEach(() => {
        instance = new SelectTrailingComma(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col, b.col, from dataset.table a left join dataset.table b on a.col = b.col');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 19 },
                end: { line: 0, character: 20 }
            },
            source: instance.source
        }]);
    });

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;
        const parser = new Parser();
        await parser.parse({text:'select a.col, b.col, from dataset.table a left join dataset.table b on a.col = b.col', uri: 'test.sql', languageId: 'sql', version: 0});
        const diagnostics = instance.evaluate('select a.col, b.col, from dataset.table a left join dataset.table b on a.col = b.col');
        const actions = instance.createCodeAction({uri: 'test.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['test.sql']: [
                            {
                                newText: '',
                                range: {
                                    start: { line: 0, character: 19 },
                                    end: { line: 0, character: 20 }
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
        const result = instance.evaluate('select a.col, b.col from dataset.table a left join dataset.table b on a.col = b.col');
        expect(result).to.be.null;
    });
});