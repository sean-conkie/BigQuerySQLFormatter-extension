import { expect } from 'chai';
import { CodeActionKind, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '../../linter/linter';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { defaultSettings } from '../../settings';

describe('Document line endings', () => {
    const uri = 'line-endings.sql';
    const clean = 'select t.col\n  from dataset.table t;\n';
    const problems = 'select t.col  \n  from dataset.table as t\n where t.col != null;';

    afterEach(() => {
        globalTokenCache.delete(uri);
    });

    async function verify(text: string) {
        return new Linter(defaultSettings).verify({uri, languageId: 'googlesql', version: 0, text});
    }

    for (const [name, eol] of [['LF', '\n'], ['CRLF', '\r\n'], ['CR', '\r']]) {
        it(`produces no diagnostics for clean ${name} SQL`, async () => {
            expect(await verify(clean.replace(/\n/g, eol))).to.deep.equal([]);
            const cache = globalTokenCache.get(uri)!;
            expect(cache.getText()).to.equal(clean);
            expect(cache.eol).to.equal(eol);
            expect(Array.from(cache.tokens).every(line => !line.value.includes('\r'))).to.equal(true);
            expect(cache.getText({
                start: {line: 0, character: 7}, end: {line: 1, character: 6}
            })).to.equal('t.col\n  from');
        });

        it(`reports identical diagnostics and ranges for ${name}`, async () => {
            const expected = await verify(problems);
            const diagnostics = await verify(problems.replace(/\n/g, eol));
            expect(diagnostics).to.deep.equal(expected);
            expect(diagnostics.map(diagnostic => String(diagnostic.code).split(':')[0]))
                .to.have.members(['AL01', 'CV05', 'LT01', 'LT12']);
        });

        it(`applies quick fixes and fix-all edits correctly to ${name}`, async () => {
            const source = problems.replace(/\n/g, eol);
            const document = TextDocument.create(uri, 'googlesql', 0, source);
            const diagnostics = await verify(source);
            const actions = await new Linter(defaultSettings).createCodeActions({
                textDocument: {uri},
                range: {start: {line: 0, character: 0}, end: {line: 2, character: 20}},
                context: {diagnostics}
            });
            const replacements = [
                ['AL01', `as t`, 't'],
                ['CV05', '!= null', 'is not null'],
                ['LT01', `t.col  ${eol}`, `t.col${eol}`],
                ['LT12', source, source + eol]
            ];
            for (const [code, before, after] of replacements) {
                const action = actions.find(action => action.kind === CodeActionKind.QuickFix &&
                    String(action.diagnostics![0].code).startsWith(code));
                expect(action, code).not.to.equal(undefined);
                expect(TextDocument.applyEdits(document, action!.edit!.changes![uri]))
                    .to.equal(source.replace(before, after));
            }
            const edits = actions.filter(action => action.kind === CodeActionKind.SourceFixAll)
                .flatMap(action => action.edit!.changes![uri]);
            expect(edits).to.have.length(4);
            const fixed = TextDocument.applyEdits(document, edits);
            expect(fixed).to.equal(`select t.col${eol}  from dataset.table t${eol} where t.col is not null;${eol}`);
            expect(await verify(fixed)).to.deep.equal([]);
        });

        it(`removes excess trailing ${name} newlines without changing EOL style`, async () => {
            const expected = clean.replace(/\n/g, eol);
            const source = expected + eol + eol;
            const diagnostics = await verify(source);
            expect(diagnostics).to.have.length(1);
            expect(String(diagnostics[0].code)).to.include('LT12');
            const actions = await new Linter(defaultSettings).createCodeActions({
                textDocument: {uri}, range: diagnostics[0].range, context: {diagnostics}
            });
            const document = TextDocument.create(uri, 'googlesql', 0, source);
            for (const action of actions) {
                expect(TextDocument.applyEdits(document, action.edit!.changes![uri])).to.equal(expected);
            }
        });

        it(`keeps incremental ${name} edits consistent with a fresh lint`, async () => {
            let document = TextDocument.create(uri, 'googlesql', 0, clean.replace(/\n/g, eol));
            await verify(document.getText());

            async function change(changes: TextDocumentContentChangeEvent[]) {
                document = TextDocument.update(document, changes, document.version + 1);
                const diagnostics = await new Linter(defaultSettings).verifyChanges({
                    textDocument: {uri, version: document.version}, contentChanges: changes
                });
                const cache = globalTokenCache.get(uri)!;
                expect(cache.getText()).to.equal(document.getText().replace(/\r\n?/g, '\n'));
                expect(cache.eol).to.equal(eol);
                expect(diagnostics).to.deep.equal(await verify(document.getText()));
            }

            await change([
                {range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}}, text: `/*${eol}`},
                {range: {start: {line: 3, character: 0}, end: {line: 3, character: 0}}, text: `*/${eol}`},
                {range: {start: {line: 1, character: 7}, end: {line: 1, character: 12}}, text: 't.other_col'}
            ]);
            await change([{
                range: {start: {line: 0, character: 0}, end: {line: 1, character: 0}}, text: ''
            }]);
            await change([{text: document.getText()}]);
        });
    }

    it('refreshes the EOL style on a full document replacement', async () => {
        await verify(clean);
        expect(await new Linter(defaultSettings).verifyChanges({
            textDocument: {uri, version: 1}, contentChanges: [{text: clean.replace(/\n/g, '\r\n')}]
        })).to.deep.equal([]);
        expect(globalTokenCache.get(uri)!.eol).to.equal('\r\n');
    });
});
