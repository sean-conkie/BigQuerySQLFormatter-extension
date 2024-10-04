/**
 * @fileoverview Test suite for LT12 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { UnionCheck } from '../../../../linter/rules/layout/LT11';

describe('UnionCheck', () => {
		let instance: UnionCheck;

		beforeEach(() => {
				instance = new UnionCheck(defaultSettings, 0);
		});

		it('should return null when rule is disabled', () => {
				instance.enabled = false;
				const result = instance.evaluate('test');
				expect(result).to.be.null;
		});

		it('should return diagnostic when rule is enabled and pattern does not match - trailing', () => {
				instance.enabled = true;
				const result = instance.evaluate('select t.col\n  from dataset.table t\nunion all select t.col\n  from dataset.table t');
				expect(result).to.deep.equal([{
						code: instance.diagnosticCode,
                        codeDescription: {href: instance.diagnosticCodeDescription},
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 2, character: 0 },
								end: { line: 2, character: 10 }
						},
						source: instance.source
				}]);
		});

		it('should return diagnostic when rule is enabled and pattern does not match - leading', () => {
				instance.enabled = true;
				const result = instance.evaluate('select t.col\n  from dataset.table t union all\nselect t.col\n  from dataset.table t');
				expect(result).to.deep.equal([{
						code: instance.diagnosticCode,
                        codeDescription: {href: instance.diagnosticCodeDescription},
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 1, character: 22 },
								end: { line: 1, character: 32 }
						},
						source: instance.source
				}]);
		});

		it('should return diagnostic when rule is enabled and pattern does not match - both', () => {
				instance.enabled = true;
				const result = instance.evaluate('select t.col\n  from dataset.table t union all select t.col\n  from dataset.table t');
				expect(result).to.deep.equal([{
						code: instance.diagnosticCode,
                        codeDescription: {href: instance.diagnosticCodeDescription},
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 1, character: 22 },
								end: { line: 1, character: 32 }
						},
						source: instance.source
				}]);
		});

		it('should return null when rule is enabled but pattern does not match', () => {
				instance.enabled = true;
				const result = instance.evaluate('select t.col\n  from dataset.table t\nunion all\nselect t.col\n  from dataset.table t');
				expect(result).to.be.null;
		});
});