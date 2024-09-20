// /**
//  * @fileoverview Test suite for LT04 module
//  */

// import { expect } from 'chai';
// import { defaultSettings } from '../../../../settings';
// import { TrailingComma } from '../../../../linter/rules/layout/LT04';
// import { FileMap, StatementAST, Parser } from '../../../../linter/parser';

// describe('TrailingComma', () => {
//     let instance: TrailingComma;

//     beforeEach(() => {
//         instance = new TrailingComma(defaultSettings, 0);
//     });

//     it('should return null when rule is disabled', () => {
//         instance.enabled = false;
//         const result = instance.evaluate({1: new StatementAST()} as FileMap);
//         expect(result).to.be.null;
//     });

//     it('should return diagnostic when rule is enabled and comma is at start of line', () => {
//         instance.enabled = true;
//         const result = instance.evaluate(await parser.parse('select col1\n,col2 from table'));
//         expect(result).to.deep.equal([{
//             message: instance.message,
//             severity: instance.severity,
//             range: {
//                 start: { line: 1, character: 0 },
//                 end: { line: 1, character: 1 }
//             },
//             source: 'trailing_commas'
//         }]);
//     });

//     it('should return null when rule is enabled but pattern does not match', () => {
//         instance.enabled = true;
//         const result = instance.evaluate(new Parser().parse('select col1,\ncol2 from table'));
//         expect(result).to.be.null;
//     });
// });