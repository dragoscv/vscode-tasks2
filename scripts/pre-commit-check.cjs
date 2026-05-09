#!/usr/bin/env node
// Pre-commit guard. Runs on `git commit` via .githooks/pre-commit.
//
// Responsibilities (fail fast, never destructive):
//   1. Validate package.json JSON.
//   2. Syntax-check every staged .js/.cjs/.mjs file (`node --check`).
//   3. If any "release-affecting" file is staged (code, manifest, schemas,
//      logo), require:
//        - package.json `version` is bumped vs HEAD
//        - CHANGELOG.md is staged AND contains a heading for the new version
//        - SemVer shape on the new version
//   4. (Optional) Smoke-test packaging via `vsce package` — skippable with
//      SKIP_PACKAGE=1 (fast path for trivial commits / CI re-runs).
//
// Bypass the whole hook with `git commit --no-verify` (use sparingly).

const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RED = '\u001b[31m';
const YEL = '\u001b[33m';
const GRN = '\u001b[32m';
const DIM = '\u001b[2m';
const RST = '\u001b[0m';

function sh(cmd) {
    return execSync(cmd, { encoding: 'utf8' }).trim();
}

function safeRead(ref, p) {
    try {
        return execSync(`git show ${ref}:${p}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return '';
    }
}

function fail(msg) {
    process.stderr.write(`\n${RED}[pre-commit]${RST} ${msg}\n\n`);
    process.exit(1);
}

function info(msg) {
    process.stdout.write(`${DIM}[pre-commit]${RST} ${msg}\n`);
}

function ok(msg) {
    process.stdout.write(`${GRN}[pre-commit]${RST} ${msg}\n`);
}

function warn(msg) {
    process.stderr.write(`${YEL}[pre-commit]${RST} ${msg}\n`);
}

// --- 0. Collect staged files ------------------------------------------------
let stagedFiles = [];
try {
    stagedFiles = sh('git diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean);
} catch {
    process.exit(0); // initial commit or git error — let it through
}

if (stagedFiles.length === 0) {
    process.exit(0);
}

// --- 1. JSON validity for package.json -------------------------------------
let stagedPkg = null;
if (stagedFiles.includes('package.json')) {
    try {
        const stagedPkgRaw = sh('git show :package.json');
        stagedPkg = JSON.parse(stagedPkgRaw);
    } catch (e) {
        fail(`Staged package.json is not valid JSON: ${e.message}`);
    }
}

// --- 2. Syntax-check staged JS files ---------------------------------------
const stagedJs = stagedFiles.filter((f) => /\.(c|m)?js$/.test(f) && fs.existsSync(f));
if (stagedJs.length > 0) {
    info(`syntax-checking ${stagedJs.length} JS file(s)...`);
    for (const f of stagedJs) {
        const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
        if (r.status !== 0) {
            const msg = (r.stderr || r.stdout || '').trim();
            fail(`Syntax error in ${f}:\n${msg}`);
        }
    }
    ok(`syntax OK for ${stagedJs.length} file(s).`);
}

// --- 3. Release-affecting changes need a version bump + CHANGELOG ---------
// Doc-only / tooling-only commits don't need a bump.
const RELEASE_AFFECTING = (f) =>
    f === 'extension.js' ||
    f === 'package.json' ||
    f === 'logo.png' ||
    f === 'logo.svg' ||
    /^jshintrc\..*\.json$/.test(f) ||
    /^src\//.test(f);

const releaseFiles = stagedFiles.filter(RELEASE_AFFECTING);

if (releaseFiles.length > 0) {
    const headPkgRaw = safeRead('HEAD', 'package.json');
    let oldVersion = '';
    let newVersion = '';
    try {
        oldVersion = headPkgRaw ? JSON.parse(headPkgRaw).version : '';
        // If package.json itself isn't staged, the new version === HEAD version.
        const effectivePkg = stagedPkg ?? (headPkgRaw ? JSON.parse(headPkgRaw) : {});
        newVersion = effectivePkg.version || '';
    } catch (e) {
        fail(`Could not parse package.json: ${e.message}`);
    }

    if (!newVersion) {
        fail('package.json is missing "version".');
    }

    if (oldVersion === newVersion) {
        fail(
            `Release-affecting files changed but version is still ${oldVersion}.\n` +
            `        Staged release files:\n          - ${releaseFiles.join('\n          - ')}\n\n` +
            `        Bump the version (and add a CHANGELOG entry) before committing:\n` +
            `          npm run release:patch    # or release:minor / release:major\n\n` +
            `        For doc-only edits to package.json (no contributes/version impact)\n` +
            `        you can bypass with: git commit --no-verify  (use sparingly).`
        );
    }

    if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
        fail(`Version "${newVersion}" is not a valid SemVer.`);
    }

    if (!stagedFiles.includes('CHANGELOG.md')) {
        fail(
            `Version bumped ${oldVersion} -> ${newVersion} but CHANGELOG.md is not staged.\n` +
            `        Add a section for [${newVersion}] in CHANGELOG.md and stage it.`
        );
    }

    let changelog = '';
    try {
        changelog = sh('git show :CHANGELOG.md');
    } catch (e) {
        fail(`Could not read staged CHANGELOG.md: ${e.message}`);
    }

    const headingPattern = new RegExp(`^##\\s*\\[?${newVersion.replace(/\./g, '\\.')}\\]?`, 'm');
    if (!headingPattern.test(changelog)) {
        fail(
            `Version bumped to ${newVersion} but CHANGELOG.md has no heading like "## [${newVersion}]".\n` +
            `        Add an entry for ${newVersion} in CHANGELOG.md and stage it.`
        );
    }

    ok(`version ${oldVersion} -> ${newVersion} with CHANGELOG entry.`);
} else {
    info('no release-affecting files staged — skipping version-bump check.');
}

// --- 4. Smoke-test packaging (skippable) -----------------------------------
if (process.env.SKIP_PACKAGE === '1') {
    warn('SKIP_PACKAGE=1 — skipping `vsce package` smoke test.');
    process.exit(0);
}

// Only run the package smoke test when something publishable changed.
if (releaseFiles.length === 0 && !stagedFiles.includes('README.md') && !stagedFiles.includes('CHANGELOG.md')) {
    process.exit(0);
}

info('running `vsce package` smoke test (set SKIP_PACKAGE=1 to skip)...');
const tmpVsix = path.join(os.tmpdir(), `tasks2-precommit-${process.pid}.vsix`);
const isWin = process.platform === 'win32';
const r = spawnSync(
    isWin ? 'npx.cmd' : 'npx',
    ['--yes', '@vscode/vsce', 'package', '--no-dependencies', '-o', tmpVsix],
    { encoding: 'utf8', shell: isWin }
);

try { fs.unlinkSync(tmpVsix); } catch { /* ignore */ }

if (r.status !== 0) {
    const out = (r.stdout || '') + (r.stderr || '');
    fail(
        `\`vsce package\` failed (exit ${r.status}). Fix the errors below before committing,\n` +
        `        or bypass with SKIP_PACKAGE=1 / --no-verify if you know what you're doing.\n\n` +
        out.trim()
    );
}

const stderr = (r.stderr || '').trim();
if (stderr && /warning/i.test(stderr)) {
    warn(`\`vsce package\` reported warnings:\n${stderr}`);
}

ok('`vsce package` succeeded.');
process.exit(0);
