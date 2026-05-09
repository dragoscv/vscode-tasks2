# Changelog

All notable changes to **Tasks2** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Status bar icon ordering: the **Actions** (kebab) icon now sits to the left
  of the **Tasks** menu icon, which sits immediately before the per-task items
  (left-to-right: Actions → Tasks menu → task items). Ordering is now
  deterministic on both left- and right-aligned status bars.

## [0.19.0] - 2026-05-06

### Added

- New display mode `both` for `tasks.statusbar.displayMode`: shows the
  dropdown **Tasks** button AND every task as its own status bar item at the
  same time.
- Per-view hidden-task lists, each managed independently:
  - `tasks.statusbar.menu.hiddenTasks` — tasks hidden from the dropdown.
  - `tasks.statusbar.list.hiddenTasks` — tasks hidden from the per-task
    status bar items.
- New commands:
  - `Tasks2: Manage Menu Hidden Tasks`
  - `Tasks2: Manage List Hidden Tasks`
- `Tasks2: Manage Hidden Tasks` now asks which view to manage when
  `displayMode` is `both`.
- The actions menu (`⋮`) exposes the new per-view manage commands.

### Changed

- `tasks.statusbar.hiddenTasks` is now a **shared / legacy** list that hides
  matching tasks from *both* views. Prefer the per-view settings above.
- Eye-closed button on a task in the dropdown now hides it from the **menu**
  view only (not the list view).

## [0.18.4] - 2026-05-06

### Changed

- Updated maintainer metadata (name and contact info) in `package.json`,
  `README.md`, and `CHANGELOG.md`.

## [0.18.3] - 2026-05-06

### Changed

- Default `tasks.statusbar.alignment` is now `left` (was `right`).
- "Open Settings" actions now open the full Tasks2 settings page
  (`@ext:dragoscv.tasks2`) instead of an exact-id filter that often returned
  no results.

## [0.18.2] - 2026-05-06

### Changed

- CI: workflow now publishes only when the version in `package.json` is not
  already on the VS Marketplace / Open VSX, so re-runs and unrelated pushes
  no longer fail with "version already exists".
- CI: pinned Node 22 and split the publish steps for clearer logs.

### Added

- `scripts/release.mjs` — release helper that bumps the version and prepends
  a CHANGELOG section. Usage: `npm run release:patch` (or `:minor`/`:major`).
- `.githooks/pre-commit` — pre-commit guard that requires a matching
  CHANGELOG entry whenever `package.json` `version` is bumped. Auto-installed
  via `npm run prepare` / `npm run setup-hooks`.

## [0.18.1] - 2026-05-06

### Changed

- Republished under the `dragoscv` Marketplace publisher
  ([marketplace.visualstudio.com/publishers/dragoscv](https://marketplace.visualstudio.com/publishers/dragoscv)).

## [0.18.0] - 2026-05-06

### Added

- `tasks.statusbar.hiddenTasks` setting: a list of task labels to hide from
  the status bar / dropdown menu.
- New command `Tasks2: Manage Hidden Tasks` to interactively pick which tasks
  are visible.
- Per-item `eye-closed` button in the Tasks dropdown to hide a single task in
  one click, plus an `eye` button in the dropdown title bar that opens the
  manage-hidden dialog.
- "Manage Hidden Tasks" entry in the Actions menu.

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
  [Dragos Catalin](https://github.com/dragoscv).
