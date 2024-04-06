/**
 * @fileoverview Test suite for LT11 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { UnionCheck } from '../../../../linter/rules/layout/LT11';
import { runInThisContext } from 'vm';

describe('UnionCheck', () => {
    let instance: UnionCheck;

    beforeEach(() => {
        instance = new UnionCheck(defaultSettings, 0);
    });

    it('Case 1: should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    const listSql: string[][] = [
        ['Case 2: no new line on left (union all)',
        `select *
        from tablename\n union all\nselect
        * from tablename`],

        ['Case 3: no new line on right (union all)',
        `select *
        from tablename\nunion all \nselect
        * from tablename`],

        ['Case 4: no new line on either side (union all)',
        `select *
         from tablename\n union all \nselect
         * from tablename`],

         ['Case 5: multiple errors (union all)',
         `select *
          from tablename\nunion all \nselect
          * from tablename\n union all\nselect
          * from tablename`],

        ['Case 6: no new line on left (union distinct)',
         `select *
          from tablename\n union distinct\nselect
          * from tablename`],

        ['Case 7: no new line on right (union distinct)',
         `select *
          from tablename\nunion distinct \nselect
          * from tablename`],

        ['Case 8: no new line on either side (union distinct)',
         `select *
         from tablename\n union distinct \nselect
         * from tablename`],

         ['Case 9: multiple errors (union distinct)',
          `select *
           from tablename\nunion distinct \nselect
           * from tablename\n union distinct\nselect
           * from tablename`],
        
        ['Case 10: no new line on left (union)',
         `select *
          from tablename\n union\nselect
          * from tablename`],

        ['Case 11: no new line on right (union)',
         `select *
          from tablename\nunion \nselect
          * from tablename`],

        ['Case 12: no new line on either side (union)',
         `select *
         from tablename\n union \nselect
         * from tablename`],

         ['Case 13: multiple errors (union)',
          `select *
           from tablename\nunion \nselect
           * from tablename\n union\nselect
           * from tablename`]
    ];

    listSql.forEach((element: string[]) => {
        it(`${element[0]}\nshould return diagnostic when rule is enabled and pattern matches`, () => {
            instance.enabled = true;
            const result = instance.evaluate(element[1]);
            expect(result).to.deep.equal([{
                message: instance.message,
                severity: instance.severity,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 1000, character: 1000 }
                },
                source: 'union_checks'
            }]);
        });
    });

    const listSqlMultiples: string[][] = [
        ['Case 14: multiple errors (union all)',
        `select *
         from tablename\nunion all \nselect
         * from tablename\n union all\nselect
         * from tablename`],

        ['Case 15: multiple errors (union distinct)',
        `select *
         from tablename\nunion distinct \nselect
         * from tablename\n union distinct\nselect
         * from tablename`],
         
        ['Case 16: multiple errors (union distinct)',
        `select *
         from tablename\nunion distinct \nselect
         * from tablename\n union distinct\nselect
         * from tablename`],
    ];

    listSqlMultiples.forEach((element: string[]) => {
        it(`${element[0]}\nshould return number of matches greater than 1 when rule is enabled and pattern matches more than once`, () => {
            instance.enabled = true;
            const noOfMatches = instance.matches(element[1]);
            expect(noOfMatches).to.be.greaterThan(1);
        });
    });

    const listSqlNoMatch: string[][] = [
        ['Case 17: pattern does not match (union all)',
        `select something_union
         from tablename\nunion all\nselect
         * from tablename`],

        ['Case 18: pattern does not match (union distinct)',
        `select something_union
         from tablename\nunion distinct\nselect
         * from tablename`],
         
        ['Case 19: pattern does not match (union)',
        `select something_union
         from tablename\nunion\nselect
         * from tablename`],
    ];

    listSqlNoMatch.forEach((element: string[]) => {
        it(`${element[0]}\nshould return null when rule is enabled but pattern does not match`, () => {
            instance.enabled = true;
            const result = instance.evaluate(element[1]);
            expect(result).to.be.null;
        });
    });
});