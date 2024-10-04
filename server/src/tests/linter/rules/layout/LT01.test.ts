/**
 * @fileoverview Test suite for LT04 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { TrailingSpaces } from '../../../../linter/rules/layout/LT01';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('TrailingSpaces', () => {
    let instance: TrailingSpaces;

    beforeEach(() => {
        instance = new TrailingSpaces(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('', 'test.sql');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and triggered - EOL', async () => {
        instance.enabled = true;


        const result = instance.evaluate('SELECT t.col1  \n FROM dataset.TrailingSpaces as t', 'test.sql');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 13 },
                end: { line: 0, character: 15 }
            },
            source: instance.source,
        }]);
    });

    it('should return diagnostic when rule is enabled and triggered - parenthesis', async () => {
        instance.enabled = true;


        const result = instance.evaluate('SELECT t.col1\n cast(t.col2 as string  ) FROM dataset.TrailingSpaces as t', 'test.sql');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 22 },
                end: { line: 1, character: 24 }
            },
            source: instance.source,
        }]);
    });

    it('should return codeaction when rule is enabled and as used', async () => {
        instance.enabled = true;


        const parser = new Parser();
        await parser.parse({text:'SELECT t.col1  \n FROM dataset.TrailingSpaces as t', uri: 'test.sql', languageId: 'sql', version: 0});
        const diagnostics = instance.evaluate('SELECT t.col1  \n FROM dataset.TrailingSpaces as t');
        const actions = instance.createCodeAction({uri: 'test.sql'}, diagnostics![0]);
        expect(actions).to.deep.equal(instance.codeActionKind.map(kind => {
            return {
                title: instance.codeActionTitle, edit:{
                changes: {
                        ['test.sql']: [
                            {
                                newText: '',
                                range: {
                                    start: { line: 0, character: 13 },
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

        const result = instance.evaluate('SELECT t.col1\n FROM dataset.TrailingSpaces t');
        expect(result).to.be.null;
    });
});