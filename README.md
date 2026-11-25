# Rename Gutter

A PyCharm-style marker for Python. On every `def` / `async def` / `class` line:

- a small pencil in the **gutter** marks the declaration,
- a clickable **✎ inlay right after the symbol name** opens the action picker:

- **Rename symbol (F2)** — the caret is placed on the name and the native rename starts. Pylance (or any LSP) updates all usages across the project.
- **Show all usages (Shift+F12)** — the native references peek for the symbol.

MVP: the pencil marks declaration lines; the heavy lifting (project-wide rename, references) is done by VS Code's native commands.

> The clickable element is an inlay hint (an inlay label part with a command). This is the only supported way to make a marker clickable — the extension-host API of the target VS Code build exposes no mouse-event API (`window.onMouseDown` / `window.onDidChangeMousePosition` do not exist), so a click handler on the gutter decoration is not possible. Inlays require `editor.inlayHints.enabled` to be on (it is on by default).

## Settings

| Setting | Default | Description |
|---|---|---|
| `renameGutter.enabled` | `true` | Toggle the gutter icon and the clickable pencil inlay on/off. |

## Palette command

`Rename Gutter: Actions for the def/class on the current line` — the same picker, driven by the caret position instead of a pencil click.

## Roadmap

- `0.1.x` — assignment targets (`self.x = …`, module variables), usage-count hover preview
- `0.2` — in-place signature-change detection (the full PyCharm "Update usages to reflect signature changes")

## Development

```sh
npm ci
npm run package                                  # vsce package --no-dependencies
code --install-extension rename-gutter-0.1.1.vsix
```

Releases: a `vX.Y.Z` tag triggers the build workflow (vsix + GitHub Release). Publishing to the marketplace is a manual `workflow_dispatch` of `publish-marketplace.yml` (trusted publishing, OIDC).
