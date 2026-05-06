#!/usr/bin/env node
// Pre-commit guard: when package.json `version` is being changed in this commit,
// require that CHANGELOG.md (also staged) contains a heading for the new version.
// Skip when version hasn't changed.

const { execSync } = require('node:child_process');
const fs = require('node:fs');

function sh(cmd) {
    return execSync(cmd, { encoding: 'utf8' }).trim();
}

function safeRead(ref, path) {
    try {
        return execSync(`git show ${ref}:${path}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return '';
    }
}

function fail(msg) {
    process.stderr.write(`\n\u001b[31m[pre-commit]\u001b[0m ${msg}\n\n`);
    process.exit(1);
}

let stagedFiles = [];
try {
    stagedFiles = sh('git diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean);
} catch {
    process.exit(0); // initial commit or git error — let it through
}

if (!stagedFiles.includes('package.json')) {
    process.exit(0);
}

const headPkg = safeRead('HEAD', 'package.json');
const stagedPkgRaw = sh('git show :package.json');

let oldVersion = '';
let newVersion = '';
try {
    oldVersion = headPkg ? JSON.parse(headPkg).version : '';
    newVersion = JSON.parse(stagedPkgRaw).version;
} catch (e) {
    fail(`Could not parse package.json: ${e.message}`);
}

if (!newVersion) {
    fail('package.json is missing "version".');
}

if (oldVersion === newVersion) {
    process.exit(0); // version not bumped — nothing to enforce
}

// Version is being bumped. Ensure CHANGELOG.md is staged AND contains the new version.
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
        `Version bumped to ${newVersion} but CHANGELOG.md does not contain a heading like "## [${newVersion}]".\n` +
        `        Add an entry for ${newVersion} in CHANGELOG.md and stage it.`
    );
}

// Sanity: SemVer shape
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    fail(`Version "${newVersion}" is not a valid SemVer.`);
}

process.stdout.write(`[pre-commit] OK: bumping ${oldVersion} -> ${newVersion} with CHANGELOG entry.\n`);
process.exit(0);
