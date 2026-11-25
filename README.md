# Rename Gutter

A PyCharm-style gutter icon for Python. A small pencil appears next to every `def` / `async def` / `class` line — click it (or run the command from the palette) and choose what to do with the symbol:

- **Rename symbol (F2)** — the caret is placed on the name and the native rename starts. Pylance (or any LSP) updates all usages across the project.
- **Show all usages (Shift+F12)** — the native references peek for the symbol.

MVP: the icon marks declaration lines; the heavy lifting (project-wide rename, references) is done by VS Code's native commands.

## Settings

| Setting | Default | Description |
|---|---|---|
| `renameGutter.enabled` | `true` | Toggle the gutter icon on/off. |
| `renameGutter.hoverOnly` | `false` | When `true`, show the icon only on the line under the mouse, instead of on every declaration line. |

## Palette command

`Rename Gutter: Actions for the def/class on the current line` — the same picker, driven by the caret position instead of a gutter click.

## Roadmap

- `0.1.x` — assignment targets (`self.x = …`, module variables), usage-count hover preview
- `0.2` — in-place signature-change detection (the full PyCharm "Update usages to reflect signature changes")

## Development

```sh
npm ci
npm run package                                  # vsce package --no-dependencies
code --install-extension rename-gutter-0.1.0.vsix
```

Releases: a `vX.Y.Z` tag triggers the build workflow (vsix + GitHub Release). Publishing to the marketplace is a manual `workflow_dispatch` of `publish-marketplace.yml` (trusted publishing, OIDC).
