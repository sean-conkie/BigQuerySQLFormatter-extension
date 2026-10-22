import { expect } from 'chai';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Parser } from '../../../linter/parser';
import { globalTokenCache } from '../../../linter/parser/tokenCache';

describe('Parser document changes', () => {
    const uri = 'parser-changes.sql';
    let parser: Parser;
    let document: TextDocument;

    beforeEach(() => {
        parser = new Parser();
    });

    afterEach(() => {
        globalTokenCache.delete(uri);
    });

    async function open(text: string) {
        document = TextDocument.create(uri, 'googlesql', 0, text);
        await parser.parse({uri, languageId: document.languageId, version: document.version, text});
    }

    async function change(changes: TextDocumentContentChangeEvent[]) {
        document = TextDocument.update(document, changes, document.version + 1);
        const incremental = await parser.parseChange({
            textDocument: {uri, version: document.version},
            contentChanges: changes
        });
        const cache = globalTokenCache.get(uri)!;
        expect(cache.getText()).to.equal(document.getText());
        const lines = Array.from(cache.tokens);
        const fresh = await parser.parse({
            uri, languageId: document.languageId, version: document.version, text: document.getText()
        });
        expect(incremental).to.deep.equal(fresh);
        const freshLines = Array.from(globalTokenCache.get(uri)!.tokens);
        expect(lines).to.have.length(freshLines.length);
        lines.forEach((line, index) => {
            expect(line.tokens).to.deep.equal(freshLines[index].tokens);
            expect(line.ruleStack.equals(freshLines[index].ruleStack)).to.equal(true);
            expect(line.lineNumber).to.equal(index);
        });
    }

    it('carries block comment state through initially tokenized lines', async () => {
        await open('/*\nselect col\n*/\nselect other_col;\n');
        const cache = globalTokenCache.get(uri)!;
        expect(cache.get(1)!.scopes).to.include('comment.block.c');
        expect(cache.get(3)!.scopes).not.to.include('comment.block.c');
    });

    it('propagates adding and removing a block comment opener to EOF', async () => {
        await open('select col\n  from dataset.table;\nselect other_col;\n');
        await change([{range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}}, text: '/*'}]);
        expect(globalTokenCache.get(uri)!.get(2)!.scopes).to.include('comment.block.c');
        await change([{range: {start: {line: 0, character: 0}, end: {line: 0, character: 2}}, text: ''}]);
        expect(globalTokenCache.get(uri)!.get(2)!.scopes).not.to.include('comment.block.c');
    });

    it('seeds an edited closing delimiter from the preceding line', async () => {
        await open('/*\ncomment\n*/\nselect col;\n');
        await change([{range: {start: {line: 2, character: 0}, end: {line: 2, character: 2}}, text: ''}]);
        expect(globalTokenCache.get(uri)!.get(3)!.scopes).to.include('comment.block.c');
        await change([{range: {start: {line: 2, character: 0}, end: {line: 2, character: 0}}, text: '*/'}]);
        expect(globalTokenCache.get(uri)!.get(3)!.scopes).not.to.include('comment.block.c');
    });

    it('retains both boundary fragments during a multi-line replacement', async () => {
        await open('select first_col,\n       second_col,\n       third_col\n  from dataset.table;\n');
        await change([{
            range: {start: {line: 0, character: 7}, end: {line: 2, character: 16}},
            text: 'new_col,\n       other_col'
        }]);
    });

    it('handles a multi-line insertion inside a line', async () => {
        await open('select col\n  from dataset.table;\n');
        await change([{
            range: {start: {line: 0, character: 7}, end: {line: 0, character: 7}},
            text: '/*\ncomment\n*/ '
        }]);
    });

    it('handles a multi-line deletion starting on the first line', async () => {
        await open('/*\ncomment\n*/ select col;\n');
        await change([{range: {start: {line: 0, character: 0}, end: {line: 2, character: 3}}, text: ''}]);
        expect(document.getText()).to.equal('select col;\n');
    });

    it('applies several content changes sequentially in one event', async () => {
        await open('select col;\nselect other_col;\n');
        await change([
            {range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}}, text: '/*\n'},
            {range: {start: {line: 2, character: 0}, end: {line: 2, character: 0}}, text: '*/\n'},
            {range: {start: {line: 3, character: 7}, end: {line: 3, character: 16}}, text: 'last_col'}
        ]);
    });

    for (const delimiter of ["'''", '"""']) {
        it(`propagates multi-line ${delimiter} string delimiter edits`, async () => {
            await open(`select ${delimiter}first\nsecond\nthird${delimiter} as value;\nselect col;\n`);
            expect(globalTokenCache.get(uri)!.get(1)!.scopes.some(scope => scope.startsWith('string.'))).to.equal(true);
            await change([{range: {start: {line: 2, character: 5}, end: {line: 2, character: 8}}, text: ''}]);
            expect(globalTokenCache.get(uri)!.get(3)!.scopes.some(scope => scope.startsWith('string.'))).to.equal(true);
            await change([{range: {start: {line: 2, character: 5}, end: {line: 2, character: 5}}, text: delimiter}]);
            expect(globalTokenCache.get(uri)!.get(3)!.scopes.some(scope => scope.startsWith('string.'))).to.equal(false);
        });
    }

    it('handles full replacements followed by ranged edits', async () => {
        await open('select col;\n');
        await change([
            {text: '/*\nselect other_col;\n'},
            {range: {start: {line: 2, character: 0}, end: {line: 2, character: 0}}, text: '*/\nselect col;\n'}
        ]);
    });

    it('handles deleting all text and inserting into an empty document', async () => {
        await open('select col;\n');
        await change([{range: {start: {line: 0, character: 0}, end: {line: 1, character: 0}}, text: ''}]);
        await change([{range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}}, text: 'select col;\n'}]);
    });
});
