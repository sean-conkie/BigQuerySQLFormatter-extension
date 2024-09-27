/**
 * @fileoverview Test suite for LT12 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { EndofFile } from '../../../../linter/rules/layout/LT12';

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
						code: instance.code,
						message: instance.message,
						severity: instance.severity,
						range: {
								start: { line: 2, character: 12 },
								end: { line: 2, character: 12 }
						},
						source: instance.source()
				}]);
		});

		it('should return null when rule is enabled but pattern does not match', () => {
				instance.enabled = true;
				const result = instance.evaluate('select *\n  from table\n');
				expect(result).to.be.null;
		});
});