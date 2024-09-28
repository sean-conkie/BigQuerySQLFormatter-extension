/**
 * @fileoverview Test suite for LT10 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { SelectModifiers } from '../../../../linter/rules/layout/LT10';
import { runInThisContext } from 'vm';

describe('SelectModifiers', () => {
    let instance: SelectModifiers;

    beforeEach(() => {
        instance = new SelectModifiers(defaultSettings, 0);
    });

    let case_number: number = 1;

    it(`Case ${case_number}: should return null when rule is disabled`, () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });


    const selectMods: string[] = ['distinct',
                                  'as',
                                  'all',
                                  'with',
                                  'DISTINCT',
                                  'AS',
                                  'ALL',
                                  'WITH'
                                ];
    const listSql: string[][] = [

        ['modifier not on same line as select (modifier: <modifier>)',
        `select \n<modifier> column from tablename`,
        '1',
        '0'],

        ['modifier not on same line as select and spacing in front of modifier on second (modifier: <modifier>)',
        `select   \n      <modifier> column from tablename`,'1','6'],

        ['modifier not on same line as select and multiple new lines before modifier (modifier: <modifier>)',
        `select \n\n\n<modifier> column from tablename`,'3','0']
    ];
    


    listSql.forEach((element: string[]) => {
        selectMods.forEach((mod: string) => {
            case_number++;
            const new_title: string = element[0].replace('<modifier>', mod);
            const new_sql: string = element[1].replace('<modifier>', mod);
            const expected_line: number = parseInt(element[2]);
            const expected_character: number = parseInt(element[3]) + mod.length;

            it(`Case ${case_number}: ${new_title}\nshould return diagnostic when rule is enabled and pattern matches`, () => {
                instance.enabled = true;
                const result = instance.evaluate(new_sql);
                expect(result).to.deep.equal([{
                    code: instance.code,
                    message: instance.message,
                    severity: instance.severity,
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: expected_line, character: expected_character }
                    },
                    source: instance.source
                }]);
            });
        });
    });

    const listSqlMultiples: string[][] = [
        ['modifier not on same line as select (multiples)',
        `select \ndistinct column from tablename\n;
         select\n distinct column from tablename`]
    ];

    listSqlMultiples.forEach((element: string[]) => {
        case_number++;
        it(`Case ${case_number}: ${element[0]}\nshould return number of matches greater than 1 when rule is enabled and pattern matches more than once`, () => {
            instance.enabled = true;
            const noOfMatches = instance.matches(element[1]);
            expect(noOfMatches).to.be.greaterThan(1);
        });
    });

    const listSqlNoMatch: string[][] = [
        ['pattern does not match (modifier on same line)',
        `select distinct column\nfrom tablename`],

        ['pattern does not match (modifier on same line but with spacing in between)',
        `select    distinct column\n from tablename`],

        ['pattern does not match (modifier not present)',
        `select columname\n as column\nfrom tablename`],

        ['pattern does not match (modifier name forms part of column name)',
        `select\n distinct_col,`],
    ];

    listSqlNoMatch.forEach((element: string[]) => {
        case_number++;
        it(`Case ${case_number}: ${element[0]}\nshould return null when rule is enabled but pattern does not match`, () => {
            instance.enabled = true;
            const result = instance.evaluate(element[1]);
            expect(result).to.be.null;
        });
    });
});