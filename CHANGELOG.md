# Changelog

All notable changes to **Tasks2** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.17.0] - 2026-05-05

First release of the **Tasks2** fork
([dragoscv/vscode-tasks2](https://github.com/dragoscv/vscode-tasks2)) based on
[actboy168/vscode-tasks](https://github.com/actboy168/vscode-tasks) `0.16.1`.

### Added

- `tasks.statusbar.displayMode` setting (`menu` | `all`). Default `menu`:
  shows a single `$(checklist) Tasks` button that opens a vertical Quick Pick
  listing every task instead of one status bar item per task.
- `tasks.statusbar.alignment` setting (`left` | `right`). Default `right`.
- `tasks.statusbar.priority` setting to control item placement.
- `tasks.statusbar.menu.label` and `tasks.statusbar.menu.icon` to customize
  the dropdown button's text and codicon.
- `tasks.statusbar.menu.showActionsButton` plus a small `⋮` status bar item
  that opens an actions Quick Pick (Open Settings, Refresh Tasks, Show Tasks
  Menu, Edit `tasks.json`). This works around the missing right-click
  context-menu API on status bar items
  ([microsoft/vscode#27196](https://github.com/microsoft/vscode/issues/27196)).
- Quick Pick `gear` and `refresh` buttons inside the Tasks dropdown.
- Tooltip on the dropdown button with a markdown command-link to settings.
- New commands: `Tasks2: Open Settings`, `Tasks2: Show Actions Menu`,
  `Tasks2: Refresh Tasks`.
- New `Tasks2` logo (SVG + PNG): terminal window with prompt, play triangle
  and gear, plus a tilted "2" badge.

### Changed

- Renamed package to `tasks2`, displayName to `Tasks2`.
- Status bar items are recreated when `alignment` or `priority` change.
- Configuration changes now refresh the menu/items immediately.
- README rewritten to document the new behavior, settings, and credits.

### Credits

- Original project by [actboy168](https://github.com/actboy168).
- Tasks2 fork & new features by
  [Dragos Catalin Vladulescu](https://github.com/dragoscv)
  &lt;dragoscv12@gmail.com&gt;.
