#!/usr/bin/env node
// Release helper for Tasks2.
// Usage: node scripts/release.mjs <patch|minor|major|x.y.z> [--notes "free text"]
// - Bumps version in package.json
// - Prepends a new section to CHANGELOG.md (with today's date)
// - Stages package.json + CHANGELOG.md
// - Lets the user review/edit the CHANGELOG section, then commit & push manually
//   (or pass --commit to commit + tag automatically).

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node scripts/release.mjs <patch|minor|major|x.y.z> [--commit] [--notes "..."]');
    process.exit(1);
}

const bump = args[0];
const commitFlag = args.includes('--commit');
const notesIdx = args.indexOf('--notes');
const notes = notesIdx >= 0 ? args[notesIdx + 1] : '';

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const cur = pkg.version;

function nextVersion(v, kind) {
    if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
    const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) throw new Error(`Cannot parse current version ${v}`);
    let [_, M, m2, p] = m.map((x, i) => (i === 0 ? x : Number(x)));
    if (kind === 'patch') p++;
    else if (kind === 'minor') { m2++; p = 0; }
    else if (kind === 'major') { M++; m2 = 0; p = 0; }
    else throw new Error(`Unknown bump: ${kind}`);
    return `${M}.${m2}.${p}`;
}

const next = nextVersion(cur, bump);
const today = new Date().toISOString().slice(0, 10);

console.log(`Bumping ${cur} -> ${next}`);

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');

const cgPath = path.join(root, 'CHANGELOG.md');
const cg = fs.readFileSync(cgPath, 'utf8');
const anchor = '## [';
const idx = cg.indexOf(anchor);
if (idx === -1) {
    console.error('Could not locate first "## [" heading in CHANGELOG.md');
    process.exit(1);
}
const stub = `## [${next}] - ${today}\n\n${notes ? notes + '\n\n' : '### Changed\n\n- _TODO: describe the changes._\n\n'}`;
const newCg = cg.slice(0, idx) + stub + cg.slice(idx);
fs.writeFileSync(cgPath, newCg);

console.log('Updated CHANGELOG.md and package.json.');

execSync('git add package.json CHANGELOG.md', { cwd: root, stdio: 'inherit' });

if (commitFlag) {
    execSync(`git commit -m "release: v${next}"`, { cwd: root, stdio: 'inherit' });
    execSync(`git tag v${next}`, { cwd: root, stdio: 'inherit' });
    console.log(`\nDone. Push with: git push origin main --tags`);
} else {
    console.log(`\nReview CHANGELOG.md, then run:\n  git commit -m "release: v${next}"\n  git push origin main`);
}
