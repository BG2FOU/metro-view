import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'vitest';

const script = resolve('scripts/publish-public.sh');
test('public releases append changes, skip identical trees and isolate private ancestry', () => {
  const root = mkdtempSync(join(tmpdir(), 'metro-release-'));
  const source = join(root, 'source');
  const remote = join(root, 'public.git');
  mkdirSync(source);
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Sample Author', GIT_AUTHOR_EMAIL: 'author@example.com', GIT_COMMITTER_NAME: 'Sample Committer', GIT_COMMITTER_EMAIL: 'committer@example.com' };
  const git = (args: string[], cwd = source) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (message: string) => { git(['add', '-A']); git(['commit', '-m', message]); return git(['rev-parse', 'HEAD']); };
  const publish = () => execFileSync('bash', [script, remote], { cwd: source, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const head = () => git(['rev-parse', 'main'], remote);
  try {
    git(['init', '-b', 'main']);
    git(['init', '--bare', '-b', 'main', remote]);
    writeFileSync(join(source, 'private.txt'), 'private ancestor\n');
    const privateCommit = commit('private history must stay private');
    rmSync(join(source, 'private.txt'));
    mkdirSync(join(source, '.github/workflows'), { recursive: true });
    writeFileSync(join(source, '.github/workflows/release-public.yml'), 'private workflow\n');
    writeFileSync(join(source, 'unchanged.txt'), 'stable\n');
    writeFileSync(join(source, 'changed.txt'), 'first\n');
    writeFileSync(join(source, 'deleted.txt'), 'remove next time\n');
    writeFileSync(join(source, 'mode.sh'), '#!/bin/sh\n');
    commit('feat: first sample release');
    publish();
    const first = head();
    assert.equal(git(['rev-list', '--count', 'main'], remote), '1');
    assert.equal(git(['ls-tree', '-r', '--name-only', 'main'], remote).includes('release-public.yml'), false);
    assert.throws(() => git(['cat-file', '-e', privateCommit], remote));
    writeFileSync(join(source, 'changed.txt'), 'second\n');
    writeFileSync(join(source, 'added.txt'), 'new\n');
    rmSync(join(source, 'deleted.txt'));
    chmodSync(join(source, 'mode.sh'), 0o755);
    const secondSource = commit('feat: incremental sample release\n\nPublic details.');
    publish();
    const second = head();
    assert.equal(git(['show', '-s', '--format=%P', second], remote), first);
    assert.equal(git(['diff', '--name-status', first, second], remote), 'A\tadded.txt\nM\tchanged.txt\nD\tdeleted.txt\nM\tmode.sh');
    assert.equal(git(['show', '-s', '--format=%an|%ae|%cn|%ce', second], remote), 'Sample Author|author@example.com|Sample Committer|committer@example.com');
    assert.match(git(['show', '-s', '--format=%B', second], remote), new RegExp(`Public details\\.\\n\\nPublic-Source-Commit: ${secondSource}`));
    assert.throws(() => git(['cat-file', '-e', secondSource], remote));
    assert.match(publish(), /unchanged/);
    assert.equal(head(), second);
    writeFileSync(join(source, '.github/workflows/release-public.yml'), 'workflow-only change\n');
    commit('ci: workflow only');
    assert.match(publish(), /unchanged/);
    assert.equal(head(), second);
    assert.equal(git(['status', '--porcelain']), '');

    // Change the public ref between fetch and ref update, simulating a race.
    writeFileSync(join(source, 'added.txt'), 'third\n');
    commit('feat: competing release');
    const hook = join(remote, 'hooks/pre-receive');
    writeFileSync(hook, `#!/bin/sh\nunset GIT_QUARANTINE_PATH\nGIT_OBJECT_DIRECTORY='${remote}/objects' git update-ref refs/heads/main ${first} ${second}\n`);
    chmodSync(hook, 0o755);
    assert.throws(publish);
    assert.equal(head(), first);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
