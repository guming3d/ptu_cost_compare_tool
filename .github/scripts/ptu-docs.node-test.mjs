import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMarkdown, snapshotDocument, validateSnapshot, compareSnapshots,
  fetchDocument, fingerprint, GitHub, agentRecord, startAgent, monitoredPull, publishReport,
  assertPublishedSnapshot,
} from './ptu-docs.mjs';

const source = {
  id: 'fireworks',
  url: 'https://learn.microsoft.com/en-us/azure/foundry/how-to/fireworks/fireworks-model-catalog',
  heading: 'Provisioned throughput units (PTU)',
  minimumLength: 1,
};

function document(capacity = '11,000', extra = '') {
  return `---
updated_at: 2026-10-19
---
# Fireworks model catalog

## Pay-per-token

PayGO retirement does not retire PTU.

## Provisioned throughput units (PTU)

| Model provider | Model name | Global Provisioned | Data Zone Provisioned | Minimum deployment | Scale increment | Input TPM per PTU |
| --- | --- | --- | --- | --- | --- | --- |
| DeepSeek | \`FW-DeepSeek-V4.1-Flash\` | yes | | 5 | 1 | ${capacity} |

${extra}
`;
}

test('metadata/line-ending noise does not trigger a documentation update', () => {
  const before = snapshotDocument(source, document());
  const after = snapshotDocument(source, document().replace('2026-10-19', '2026-11-08').replaceAll('\n', '\r\n'));
  assert.equal(compareSnapshots(before, after).changed, false);
  assert.equal(fingerprint([before]), fingerprint([after]));
});

test('capacity changes retain old/new facts and identify the affected section', () => {
  const before = snapshotDocument(source, document());
  const after = snapshotDocument(source, document('12,000'));
  const diff = compareSnapshots(before, after);
  assert.equal(diff.changed, true);
  assert.equal(diff.sections.length, 1);
  assert.equal(diff.sections[0].factsChanged, true);
  assert.equal(before.sections.at(-1).tables[0].rows[0].at(-1), '11,000');
  assert.equal(after.sections.at(-1).tables[0].rows[0].at(-1), '12,000');
});

test('footnotes and prose/formula changes are not hidden by unchanged table values', () => {
  const before = snapshotDocument(source, document('11,000', 'Standard capacity applies to all deployments.'));
  const after = snapshotDocument(source, document('11,000',
    'Standard capacity applies only to Global Provisioned.\nNormalized TPM = input TPM + output TPM'));
  const diff = compareSnapshots(before, after);
  assert.equal(diff.changed, true);
  assert.equal(after.sections.at(-1).formulas.length, 1);
  assert.equal(after.sections.at(-1).tables[0].rows[0].at(-1), '11,000');
});

test('HTML, missing model tables, truncated metadata and malformed tables fail closed', () => {
  assert.throws(() => snapshotDocument(source, '<html>Service unavailable</html>'), /unexpected/);
  assert.throws(() => snapshotDocument(source, document().replace('Input TPM per PTU', 'No table')), /missing/);
  assert.throws(() => normalizeMarkdown('---\nunfinished metadata'), /Incomplete/);
  assert.throws(() => snapshotDocument(source, document().replace('| 5 | 1 |', '| 5 |')), /Malformed/);
});

test('corrupt baselines and abrupt bulk model disappearance require review', () => {
  const current = snapshotDocument(source, document());
  assert.throws(() => validateSnapshot({ ...current, source: 'https://example.invalid' }, source), /corrupt/);
  assert.throws(() => compareSnapshots({ ...current, modelCount: 39 }, current), /half/);
});

test('validation rejects tampered facts and a source that changed again after PR creation', () => {
  const current = snapshotDocument(source, document());
  assert.doesNotThrow(() => assertPublishedSnapshot(current, current, source));
  const tampered = structuredClone(current);
  tampered.sections.at(-1).tables[0].rows[0][4] = '1';
  assert.throws(() => assertPublishedSnapshot(tampered, current, source), /no longer match/);
  assert.throws(() => assertPublishedSnapshot(current, snapshotDocument(source, document('12,000')), source),
    /no longer match/);
});

test('Azure transposed model tables and normalized weights are captured', () => {
  const sizing = {
    id: 'sizing', url: 'https://learn.microsoft.com/sizing', minimumLength: 1,
    heading: 'Deployment parameters and throughput values by model',
  };
  const snapshot = snapshotDocument(sizing, `# PTU sizing
## Deployment parameters and throughput values by model
| Topic | gpt-6-sol | gpt-5.4-mini |
| --- | --- | --- |
| Input TPM per PTU | 3,000 | 7,900 |
| Output-to-input ratio | See normalized pricing | 6 |
### Normalized pricing
| Token type | Normalized token cost |
| --- | --- |
| Cache write | 1.25 |
`);
  assert.equal(snapshot.modelCount, 2);
  assert.equal(snapshot.sections.at(-1).tables[0].rows[0][1], '1.25');
});

test('failed downloads and wrong content types never produce empty replacement snapshots', async () => {
  await assert.rejects(fetchDocument(source, async () => ({
    ok: false, status: 404,
  })), /HTTP 404/);
  await assert.rejects(fetchDocument(source, async () => ({
    ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => document(),
  })), /did not return Markdown/);
});

const hash = 'a'.repeat(64);
const taskId = '11111111-2222-3333-4444-555555555555';
const bot = { login: 'github-actions[bot]' };

test('only monitor-owned comments can establish an existing agent start', () => {
  const body = `<!-- ptu-docs-agent:${hash}:${taskId} -->`;
  assert.equal(agentRecord([{ user: { login: 'someone-else' }, body }], hash).taskId, null);
  assert.deepEqual(agentRecord([
    { user: bot, body: `<!-- ptu-docs-agent-requested:${hash} -->` },
    { user: bot, body },
  ], hash), { requested: true, taskId });
});

test('Copilot is started against the existing PR branch after persisting the attempt marker', async () => {
  const calls = [];
  const github = {
    repository: 'guming3d/ptu_cost_compare_tool',
    repo: async (...args) => { calls.push(['repo', ...args]); return {}; },
  };
  const agent = {
    request: async (...args) => { calls.push(['agent', ...args]); return { id: taskId }; },
  };
  const report = {
    fingerprint: hash, needsAgent: true,
    pr: { number: 12, url: 'https://github.com/guming3d/ptu_cost_compare_tool/pull/12', branch: `copilot/ptu-docs-${hash.slice(0, 16)}` },
  };
  await startAgent(github, agent, report, 'Trusted instructions');
  assert.match(calls[0][3].body, /ptu-docs-agent-requested/);
  const request = calls[1][3];
  assert.equal(request.head_ref, report.pr.branch);
  assert.equal(request.base_ref, 'master');
  assert.equal(request.create_pull_request, false);
  assert.equal(report.taskId, taskId);
});

test('an ambiguous billable POST is not retried', async () => {
  let attempts = 0;
  const github = new GitHub('test-token', 'guming3d/ptu_cost_compare_tool', async () => {
    attempts++;
    throw new TypeError('Lost connection');
  });
  await assert.rejects(github.request('/agents/repos/guming3d/ptu_cost_compare_tool/tasks', 'POST', {}));
  assert.equal(attempts, 1);
});

test('completion automation rejects foreign, spoofed or unrelated pull requests', () => {
  const pr = {
    user: bot,
    head: { ref: `copilot/ptu-docs-${hash.slice(0, 16)}`, repo: { full_name: 'guming3d/ptu_cost_compare_tool' } },
    base: { ref: 'master' },
    body: `<!-- ptu-docs-update:${hash} -->`,
  };
  assert.equal(monitoredPull(pr, 'guming3d/ptu_cost_compare_tool'), true);
  assert.equal(monitoredPull({ ...pr, user: { login: 'someone-else' } }, 'guming3d/ptu_cost_compare_tool'), false);
  assert.equal(monitoredPull(pr, 'someone-else/repo'), false);
});

test('completion and failure reports mention the owner and deduplicate by run event', async () => {
  const posted = [];
  const issue = { number: 5, user: bot, body: '<!-- ptu-docs-status -->' };
  const github = {
    list: async (path) => path.startsWith('/issues?') ? [issue] : posted,
    repo: async (path, method, body) => {
      posted.push({ user: bot, body: body.body });
      return {};
    },
  };
  const report = {
    status: 'failure', message: 'Document fetch failed; baseline unchanged.',
    pr: { url: 'https://github.com/guming3d/ptu_cost_compare_tool/pull/12' },
  };
  await publishReport(github, report, 'https://github.com/run/1', 'run-1');
  await publishReport(github, report, 'https://github.com/run/1', 'run-1');
  assert.equal(posted.length, 1);
  assert.match(posted[0].body, /@guming3d/);
  assert.match(posted[0].body, /failure/);
  assert.match(posted[0].body, /pull\/12/);
});
