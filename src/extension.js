// @ts-check
'use strict';

const vscode = require('vscode');

/** @type {RegExp} Matches `def name` / `async def name` / `class Name` at the start of a line. */
const DECL_RE = /^([ \t]*)(?:async[ \t]+)?(def|class)[ \t]+([A-Za-z_][A-Za-z0-9_]*)/;

/**
 * @typedef {{ kind: 'def' | 'class', name: string, nameStart: number }} Declaration
 */

/** @type {vscode.TextEditorDecorationType | undefined} */
let decoration;
/** @type {WeakMap<vscode.TextDocument, Map<number, Declaration>>} */
const cache = new WeakMap();
/** @type {vscode.WebviewPanel | undefined} hidden panel that injects the icon CSS. */
let cssPanel;

/**
 * @param {vscode.TextDocument | undefined} doc
 * @returns {boolean}
 */
function isPython(doc) {
    return !!doc && doc.languageId === 'python';
}

/** @returns {{ enabled: boolean }} */
function settings() {
    const c = vscode.workspace.getConfiguration('renameGutter');
    return {
        enabled: c.get('enabled', true)
    };
}

/**
 * Parse declaration lines of a Python document and cache the result.
 * @param {vscode.TextDocument} doc
 * @returns {Map<number, Declaration>} line number -> declaration
 */
function parseDocument(doc) {
    /** @type {Map<number, Declaration>} */
    const map = new Map();
    if (isPython(doc)) {
        for (let i = 0; i < doc.lineCount; i++) {
            const text = doc.lineAt(i).text;
            if (text.trimStart().startsWith('#')) {
                continue;
            }
            const m = DECL_RE.exec(text);
            if (!m) {
                continue;
            }
            const name = m[3];
            map.set(i, {
                kind: m[2] === 'class' ? 'class' : 'def',
                name,
                // the match ends exactly at the end of the name
                nameStart: m[0].length - name.length
            });
        }
    }
    cache.set(doc, map);
    return map;
}

/**
 * @param {vscode.TextDocument} doc
 * @returns {Map<number, Declaration>}
 */
function declarationsFor(doc) {
    if (!cache.has(doc)) {
        parseDocument(doc);
    }
    return /** @type {Map<number, Declaration>} */ (cache.get(doc));
}

/**
 * Move the caret onto the declared symbol and execute a command that
 * acts on the caret position (native rename / references).
 * @param {vscode.TextDocument} doc
 * @param {number} line
 * @param {number} nameStart
 * @param {string} command
 */
async function runAtCaret(doc, line, nameStart, command) {
    const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc)
        || vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const pos = new vscode.Position(line, nameStart);
    editor.selection = new vscode.Selection(pos, pos);
    await vscode.commands.executeCommand(command);
}

/**
 * Show the action picker for a declaration.
 * @param {vscode.TextDocument} doc
 * @param {Declaration} info
 * @param {number} line
 */
async function showActions(doc, info, line) {
    const picked = await vscode.window.showQuickPick(
        [
            {
                label: '$(symbol-method) Rename symbol',
                description: 'F2',
                detail: info.name,
                run: () => runAtCaret(doc, line, info.nameStart, 'editor.action.rename')
            },
            {
                label: '$(references) Show all usages',
                description: 'Shift+F12',
                detail: info.name,
                run: () => runAtCaret(doc, line, info.nameStart, 'editor.action.goToReferences')
            }
        ],
        { title: `Rename Gutter: ${info.name}`, placeHolder: 'What to do with this symbol?' }
    );
    if (picked) {
        await picked.run();
    }
}

/**
 * Build a clickable inlay hint for one declaration: a small pencil right
 * after the symbol name. Clicking it runs `renameGutter.actionsAt`.
 *
 * Note: this VS Code build exposes no mouse-event API
 * (no window.onMouseDown / onDidChangeMousePosition), so a clickable
 * gutter decoration is impossible — the inlay label part with a command
 * is the supported interactive element.
 *
 * @param {number} line
 * @param {Declaration} info
 * @returns {vscode.InlayHint}
 */
function hintFor(line, info) {
    const part = new vscode.InlayHintLabelPart('✎');
    part.tooltip = new vscode.MarkdownString(
        `**${info.name}** — rename / show usages`
    );
    part.command = {
        title: 'Rename Gutter: actions',
        command: 'renameGutter.actionsAt',
        arguments: [line, info.nameStart]
    };
    const hint = new vscode.InlayHint(
        new vscode.Position(line, info.nameStart + info.name.length),
        [part],
        vscode.InlayHintKind.Parameter
    );
    hint.paddingLeft = true;
    hint.paddingRight = true;
    return hint;
}

/** Apply the decoration for one editor. */
function refreshEditor(editor) {
    if (!decoration) {
        return;
    }
    const doc = editor.document;
    if (!settings().enabled || !isPython(doc)) {
        editor.setDecorations(decoration, []);
        return;
    }
    const decls = declarationsFor(doc);
    /** @type {vscode.Range[]} */
    const ranges = [];
    for (const line of decls.keys()) {
        ranges.push(new vscode.Range(line, 0, line, 0));
    }
    editor.setDecorations(decoration, ranges);
}

/** Re-apply the decoration for all visible editors. */
function refreshAll() {
    for (const editor of vscode.window.visibleTextEditors) {
        refreshEditor(editor);
    }
}

/** Inject the icon CSS through a hidden webview (no build assets needed). */
function injectIconCss() {
    const css = [
        '.rename-gutter-icon::before {',
        '    content: "\\270E";',
        '    font-size: 12px;',
        '    color: var(--vscode-descriptionForeground);',
        '    opacity: 0.8;',
        '}'
    ].join('\n');
    cssPanel = vscode.window.createWebviewPanel(
        'renameGutterCss',
        'rename-gutter css',
        { viewColumn: vscode.ViewColumn.Beside, showIfOpen: false, retainContextWhenHidden: true },
        { enableScripts: false, retainContextWhenHidden: true }
    );
    cssPanel.onDidDispose(() => {
        cssPanel = undefined;
    });
    cssPanel.webview.html = `<style>${css}</style>`;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    decoration = vscode.window.createTextEditorDecorationType({
        glyphMarginClassName: 'rename-gutter-icon',
        rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen
    });
    context.subscriptions.push(decoration);

    injectIconCss();
    if (cssPanel) {
        context.subscriptions.push(cssPanel);
    }

    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(refreshAll),
        vscode.window.onDidChangeActiveTextEditor(refreshAll),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (isPython(e.document)) {
                cache.delete(e.document);
            }
            refreshAll();
        }),
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (isPython(doc)) {
                cache.delete(doc);
            }
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('renameGutter')) {
                refreshAll();
            }
        }),
        // Clickable pencil inlay after each def/class name (the interactive
        // part — gutter clicks are unavailable in this VS Code build).
        vscode.languages.registerInlayHintsProvider('python', {
            provideInlayHints: (doc, range) => {
                if (!settings().enabled || !isPython(doc)) {
                    return [];
                }
                const decls = declarationsFor(doc);
                /** @type {vscode.InlayHint[]} */
                const hints = [];
                for (let line = range.start.line; line <= range.end.line && line < doc.lineCount; line++) {
                    const info = decls.get(line);
                    if (info) {
                        hints.push(hintFor(line, info));
                    }
                }
                return hints;
            }
        }),
        vscode.commands.registerCommand('renameGutter.actionsAt', async (line, nameStart) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !isPython(editor.document)) {
                return;
            }
            const info = declarationsFor(editor.document).get(line);
            if (!info) {
                return;
            }
            await showActions(editor.document, info, line);
        }),
        vscode.commands.registerCommand('renameGutter.actionsHere', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !isPython(editor.document)) {
                vscode.window.showInformationMessage('Rename Gutter: place the caret on a Python def/class line.');
                return;
            }
            const line = editor.selection.active.line;
            const info = declarationsFor(editor.document).get(line);
            if (!info) {
                vscode.window.showInformationMessage('Rename Gutter: no def/class declaration on the current line.');
                return;
            }
            await showActions(editor.document, info, line);
        })
    );

    refreshAll();
}

function deactivate() {}

module.exports = { activate, deactivate };
