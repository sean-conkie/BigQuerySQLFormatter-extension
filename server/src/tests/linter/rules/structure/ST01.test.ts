/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { ElseNull } from '../../../../linter/rules/structure/ST01';
import { Parser } from '../../../../linter/parser';

describe('ElseNull', () => {
    let instance: ElseNull;

    beforeEach(() => {
        instance = new ElseNull(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select case when col1 = 1 then 2 else null end col from table');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 32 },
                end: { line: 0, character: 43 }
            },
            source: instance.source,
            tags: [1]
        }]);
    });

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();
        await parser.parse({text:'select case when col1 = 1 then 2 else null end col from table', uri: 'test.sql', languageId: 'sql', version: 0});
        const diagnostics = instance.evaluate('select case when col1 = 1 then 2 else null end col from table');
        const actions = instance.createCodeAction({uri: 'test.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['test.sql']: [
                            {
                                newText: '',
                                range: {
                                    start: { line: 0, character: 32 },
                                    end: { line: 0, character: 43 }
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
        const result = instance.evaluate('select case when col1 = 1 then 2 end col from table');
        expect(result).to.be.null;
    });
});