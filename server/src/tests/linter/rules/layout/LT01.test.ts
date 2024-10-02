/**
 * @fileoverview Test suite for LT11 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { TrailingSpaces } from '../../../../linter/rules/layout/LT01';
import { runInThisContext } from 'vm';

describe('TrailingSpaces', () => {
    let instance: TrailingSpaces;

    beforeEach(() => {
        instance = new TrailingSpaces(defaultSettings, 0);
    });

    it('Case 1: should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    const listSql: string[][] = [
        ['Case 2: trailing spaces',
        `select * \n
        from tablename`,'0','8',
    '0','9'],
 
    ];

    listSql.forEach((element: string[]) => {
        it(`${element[0]}\nshould return diagnostic when rule is enabled and pattern matches`, () => {
            instance.enabled = true;
            const result = instance.evaluate(element[1]);
            expect(result).to.deep.equal([{
                code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
                severity: instance.severity,
                range: {
                    start: { line: parseInt(element[2]), character: parseInt(element[3]) },
                    end: { line: parseInt(element[4]), character: parseInt(element[5]) }
                },
                source: instance.source
            }]);
        });
    });

    const listSQLMultipleErrors: string[][] = [


        ['Case 3: multiple errors',
        `select * \n
         from tablename\nselect
         * \nfrom tablename`,'0','8','0','9','4','10','4','11'],];



          listSQLMultipleErrors.forEach((element: string[]) => {
            it(`${element[0]}\nshould return diagnostic when rule is enabled and pattern matches`, () => {
                instance.enabled = true;
                const result = instance.evaluate(element[1]);
                expect(result).to.deep.equal([{
                    code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
                    severity: instance.severity,
                    range: {
                        start: { line: parseInt(element[2]), character: parseInt(element[3]) },
                        end: { line: parseInt(element[4]), character: parseInt(element[5]) }
                    },
                    source: instance.source
                },{
                    code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
                    severity: instance.severity,
                    range: {
                        start: { line: parseInt(element[6]), character: parseInt(element[7]) },
                        end: { line: parseInt(element[8]), character: parseInt(element[9]) }
                    },
                    source: instance.source
                }]);
            });
        });

    const listSqlMultiples: string[][] = [
        ['Case 4: multiple errors',
        `select * \n
        from tablename\nselect
        * \nfrom tablename`],
    ];

    const listSqlNoMatch: string[][] = [
        ['Case 5: pattern does not match (union all)',
        `select *\nfrom table`],
    ];

    listSqlNoMatch.forEach((element: string[]) => {
        it(`${element[0]}\nshould return null when rule is enabled but pattern does not match`, () => {
            instance.enabled = true;
            const result = instance.evaluate(element[1]);
            expect(result).to.be.null;
        });
    });
});