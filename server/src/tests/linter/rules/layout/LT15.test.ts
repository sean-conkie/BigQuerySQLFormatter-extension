/**
 * @fileoverview Test suite for LT12 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { FileMap, Parser } from '../../../../linter/parser';
import { ComparisonOperators } from '../../../../linter/rules/layout/LT15';

describe('ComparisonOperators', () => {
		let instance: ComparisonOperators;

		beforeEach(() => {
				instance = new ComparisonOperators(defaultSettings, 0);
		});

		it('should return null when rule is disabled', async () => {
				instance.enabled = false;
				const parser = new Parser();
				const result = instance.evaluate(await parser.parse({text:'select *\n from table where    1 = 1 and 10 = 1', uri: 'test.sql', languageId: 'sql', version: 0}));
				expect(result).to.be.null;
		});

		it('should return diagnostic when rule is enabled and pattern does not match - where', async () => {
				instance.enabled = true;
				const parser = new Parser();
				const result = instance.evaluate(await parser.parse({text:'select *\n  from dataset.table\n where 1 = 1\n   and 10 = 1', uri: 'test.sql', languageId: 'sql', version: 0}));
				expect(result).to.deep.equal([{
						code: instance.code,
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 2, character: 9 },
								end: { line: 2, character: 10 }
						},
						source: instance.source()
				},
				{
						code: instance.code,
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 3, character: 10 },
								end: { line: 3, character: 11 }
						},
						source: instance.source()
				}]);
		});

		it('should return null when rule is enabled but pattern does not match - where', async () => {
				instance.enabled = true;
				const parser = new Parser();
				const result = instance.evaluate(await parser.parse({text:'select *\n  from dataset.table\n where 1  = 1\n   and 10 = 1', uri: 'test.sql', languageId: 'sql', version: 0}));
				expect(result).to.be.null;
		});

		it('should return diagnostic when rule is enabled and pattern does not match - join', async () => {
				instance.enabled = true;
				const parser = new Parser();
				const result = instance.evaluate(await parser.parse({text:'select *\n  from dataset.table a\n  left join other.table b\n    on a.id = b.id\n   and a.date = b.date\n where 1  = 1\n   and 10 = 1', uri: 'test.sql', languageId: 'sql', version: 0}));
				expect(result).to.deep.equal([{
						code: instance.code,
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 3, character: 12 },
								end: { line: 3, character: 13 }
						},
						source: instance.source()
				},
				{
						code: instance.code,
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 4, character: 14 },
								end: { line: 4, character: 15 }
						},
						source: instance.source()
				}]);
		});

		it('should return null when rule is enabled but pattern does not match - join', async () => {
				instance.enabled = true;
				const parser = new Parser();
				const result = instance.evaluate(await parser.parse({text:'select *\n  from dataset.table a\n  left join other.table b\n    on a.id   = b.id\n   and a.date = b.date\n where 1  = 1\n   and 10 = 1', uri: 'test.sql', languageId: 'sql', version: 0}));
				expect(result).to.be.null;
		});
});