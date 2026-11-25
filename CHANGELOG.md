# Changelog

## 0.1.1

- Fix: the extension crashed on activation (`vscode.window.onDidChangeMousePosition is not a function`) — the mouse-event API does not exist in the extension API of the target VS Code build, so the icon never appeared.
- New: a clickable ✎ inlay right after each `def` / `class` name opens the action picker (rename / usages). This is the supported interactive element in builds without a mouse API.
- The gutter pencil stays as a visual declaration marker (no longer clickable).
- Removed the `renameGutter.hoverOnly` setting — mouse tracking is unavailable in this VS Code build.

## 0.1.0

- Initial MVP: gutter icon on Python `def` / `async def` / `class` lines.
- Click the icon (or the palette command) to rename the symbol (F2) or reveal all usages (Shift+F12).
- Settings: `renameGutter.enabled`, `renameGutter.hoverOnly`.
