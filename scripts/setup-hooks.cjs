#!/usr/bin/env node
// Configure git to use repo-tracked hooks under .githooks.
// Idempotent: safe to run repeatedly.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

try {
    // No-op outside a git checkout (e.g. CI installs).
    if (!fs.existsSync(path.join(__dirname, '..', '.git'))) {
        process.exit(0);
    }
    execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
    // Best-effort chmod on POSIX; ignored on Windows.
    try {
        fs.chmodSync(path.join(__dirname, '..', '.githooks', 'pre-commit'), 0o755);
    } catch { /* ignore on Windows */ }
    console.log('[setup-hooks] git hooks path configured: .githooks');
} catch (e) {
    // Don't break installs if git isn't available.
    process.stderr.write(`[setup-hooks] skipped: ${e.message}\n`);
    process.exit(0);
}
