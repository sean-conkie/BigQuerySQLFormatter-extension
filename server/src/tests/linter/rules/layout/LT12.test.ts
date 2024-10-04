/**
 * @fileoverview Test suite for LT12 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { EndofFile } from '../../../../linter/rules/layout/LT12';
import { Parser } from '../../../../linter/parser';

describe('EndofFile', () => {
		let instance: EndofFile;

		beforeEach(() => {
				instance = new EndofFile(defaultSettings, 0);
		});

		it('should return null when rule is disabled', () => {
				instance.enabled = false;
				const result = instance.evaluate('test');
				expect(result).to.be.null;
		});

		it('should return diagnostic when rule is enabled and pattern does not match', () => {
				instance.enabled = true;
				const result = instance.evaluate('select *\n  from table');
				expect(result).to.deep.equal([{
						code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 1, character: 11 },
								end: { line: 1, character: 11 }
						},
						source: instance.source
				}]);
		});

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();
        await parser.parse({text:'select *\n  from table', uri: 'test.sql', languageId: 'sql', version: 0});
        const diagnostics = instance.evaluate('select *\n  from table');
        const actions = instance.createCodeAction({uri: 'test.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['test.sql']: [
                            {
                                newText: '\n',
                                range: {
                                    start: { line: 1, character: 11 },
                                    end: { line: 1, character: 11 }
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
				const result = instance.evaluate('select *\n  from table\n');
				expect(result).to.be.null;
		});
});