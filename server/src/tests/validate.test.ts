import { expect } from 'chai';
import { closeTextDocument, validateTextDocument } from '../validate';
import { defaultSettings, documentSettings } from '../settings';
import { globalTokenCache } from '../linter/parser/tokenCache';

describe('Document lifecycle', () => {
	const uri = 'file:///close.bqsql';

	afterEach(() => {
		closeTextDocument(uri);
	});

	it('evicts tokens and settings and clears diagnostics on close, then parses fresh on reopen', async () => {
		documentSettings.set(uri, Promise.resolve(defaultSettings));
		const document = { uri, languageId: 'googlesql', version: 1, text: '\nselect col\nfrom dataset.table' };
		const opened = await validateTextDocument(document, defaultSettings);
		expect(opened.diagnostics).not.to.be.empty;
		expect(globalTokenCache.has(uri)).to.equal(true);
		expect(closeTextDocument(uri)).to.deep.equal({ uri, diagnostics: [] });
		expect(globalTokenCache.has(uri)).to.equal(false);
		expect(documentSettings.has(uri)).to.equal(false);
		expect(closeTextDocument(uri)).to.deep.equal({ uri, diagnostics: [] });
		await validateTextDocument({ ...document, version: 2, text: 'select 1;\n' }, defaultSettings);
		expect(globalTokenCache.get(uri)!.getText()).to.equal('select 1;\n');
	});
});
