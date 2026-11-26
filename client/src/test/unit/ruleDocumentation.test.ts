import assert from 'node:assert/strict';
import sinon from 'sinon';
import { openRuleDocumentation } from '../../ruleDocumentation';

describe('Rule documentation', () => {
  const href = 'https://bigquerysqlformatter.readthedocs.io/en/latest/rules/convention/CV05.html';

  it('passes the documentation URL unchanged to the browser opener', async () => {
    const open = sinon.stub<[string], Promise<boolean>>().resolves(true);
    await openRuleDocumentation(href, open);
    assert.equal(open.callCount, 1);
    assert.deepEqual(open.firstCall.args, [href]);
  });

  it('rejects invalid or off-site URLs without invoking the browser opener', async () => {
    const open = sinon.stub<[string], Promise<boolean>>().resolves(true);
    for (const invalid of [
      undefined,
      42,
      'not a URL',
      'http://bigquerysqlformatter.readthedocs.io/',
      'https://example.com/',
      'https://bigquerysqlformatter.readthedocs.io.evil.test/',
      'https://bigquerysqlformatter.readthedocs.io@evil.test/',
      'https://bigquerysqlformatter.readthedocs.io:443/',
      'file:///tmp/rule',
    ]) {
      await assert.rejects(openRuleDocumentation(invalid, open), /Rule documentation must use/);
    }
    assert.equal(open.callCount, 0);
  });

  it('reports browser refusal and propagates browser errors', async () => {
    const open = sinon.stub<[string], Promise<boolean>>().resolves(false);
    await assert.rejects(openRuleDocumentation(href, open), /Could not open rule documentation/);
    const failure = new Error('Browser unavailable');
    open.rejects(failure);
    await assert.rejects(openRuleDocumentation(href, open), (error) => error === failure);
  });
});
