import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  approvedMerge, resolveSource, assertTarget, configurationHash, imagePatch, permits, waitForRevision, verifySite,
} from './deploy-containerapp.mjs';

const repository = 'guming3d/ptu_cost_compare_tool';
const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const pr = {
  number: 3, state: 'closed', merged: true, merged_by: { login: 'guming3d' },
  base: { ref: 'master', repo: { full_name: repository } }, merge_commit_sha: sha,
};
const target = {
  id: '/subscriptions/test/resourceGroups/test/providers/Microsoft.App/containerApps/test',
  container: 'web', server: 'test.azurecr.io', image: 'test.azurecr.io/site/web',
};

function app() {
  return {
    id: target.id, location: 'eastus2', identity: { type: 'SystemAssigned', principalId: 'original' },
    properties: {
      environmentId: 'original-environment', provisioningState: 'Succeeded',
      configuration: {
        activeRevisionsMode: 'Single',
        ingress: {
          external: true, targetPort: 80, allowInsecure: false, fqdn: 'test.eastus2.azurecontainerapps.io',
          traffic: [{ latestRevision: true, weight: 100 }],
        },
        registries: [{ server: target.server, identity: 'system' }],
        secrets: [{ name: 'preserve-reference' }],
      },
      template: {
        revisionSuffix: 'old', scale: { minReplicas: 0, maxReplicas: 2 },
        containers: [{
          name: 'web', image: `${target.image}@sha256:${digest}`,
          env: [{ name: 'EXAMPLE', secretRef: 'preserve-reference' }],
          resources: { cpu: 0.25, memory: '0.5Gi' }, probes: [{ type: 'Readiness' }],
        }],
      },
    },
  };
}

test('only an owner-merged master PR at the latest commit can deploy', () => {
  assert.equal(approvedMerge(pr, repository, sha), sha);
  for (const changed of [
    { merged: false }, { state: 'open' }, { merged_by: { login: 'github-actions[bot]' } },
    { base: { ref: 'typescript', repo: { full_name: repository } } },
    { base: { ref: 'master', repo: { full_name: 'someone/else' } } },
    { merge_commit_sha: 'not-a-commit' },
  ]) {
    assert.throws(() => approvedMerge({ ...pr, ...changed }, repository, sha), /manually merged/);
  }
  assert.throws(() => approvedMerge(pr, repository, 'c'.repeat(40)), /no longer the master tip/);
});

test('approval-only/closed-unmerged events and direct pushes never resolve a deployment', async () => {
  const github = { repository, repo: async () => { throw new Error('Unexpected API request'); } };
  const resolve = (eventName, event, actor = 'guming3d', ref = 'refs/heads/master') =>
    resolveSource(github, eventName, event, {}, actor, ref);
  await assert.rejects(resolve('push', {}), /Only merged PR/);
  await assert.rejects(resolve('pull_request_target', { action: 'closed', pull_request: { merged: false } }), /Only merged PR/);
  await assert.rejects(resolve('pull_request_review', { action: 'submitted' }), /Only merged PR/);
  await assert.rejects(resolve('workflow_dispatch', {}, 'someone'), /Only guming3d/);
  await assert.rejects(resolve('workflow_dispatch', {}, 'guming3d', 'refs/heads/feature'), /from master/);
});

test('manual dry runs can check master, but real retries require a verified merged PR', async () => {
  const calls = [];
  const github = {
    repository,
    repo: async (path) => { calls.push(path); return path.startsWith('/pulls/') ? pr : { object: { sha } }; },
  };
  assert.deepEqual(await resolveSource(github, 'workflow_dispatch', {}, { dryRun: true },
    'guming3d', 'refs/heads/master'), { sha, number: null, dryRun: true });
  await assert.rejects(resolveSource(github, 'workflow_dispatch', {}, { dryRun: false },
    'guming3d', 'refs/heads/master'), /previously merged PR/);
  const source = await resolveSource(github, 'pull_request_target',
    { action: 'closed', pull_request: { number: 3, merged: true } }, {},
    'guming3d', 'refs/heads/master');
  assert.deepEqual(source, { sha, number: 3, dryRun: false });
  assert.equal(calls.at(-1), '/pulls/3');
});

test('deployment fails closed when the target, ingress, traffic, identity or image repository drifts', () => {
  assert.equal(assertTarget(app(), target), `${target.image}@sha256:${digest}`);
  const mutations = [
    (value) => { value.id = `${target.id}-other`; },
    (value) => { value.properties.configuration.ingress.external = false; },
    (value) => { value.properties.configuration.ingress.targetPort = 8501; },
    (value) => { value.properties.configuration.ingress.traffic = [{ revisionName: 'old', weight: 100 }]; },
    (value) => { value.properties.configuration.registries[0].identity = 'other'; },
    (value) => { value.properties.template.containers.push({ name: 'sidecar' }); },
    (value) => { value.properties.template.containers[0].image = 'test.azurecr.io/other@sha256:' + digest; },
  ];
  for (const mutate of mutations) {
    const changed = app();
    mutate(changed);
    assert.throws(() => assertTarget(changed, target), /approved|digest-pinned/);
  }
});

test('image updates preserve all runtime settings and never patch configuration or managed identity', () => {
  const before = app();
  const immutable = structuredClone(before);
  const image = `${target.image}@sha256:${'c'.repeat(64)}`;
  const patch = imagePatch(before, image, 'gh-123-1', target);
  const after = structuredClone(before);
  after.properties.template = patch.properties.template;
  assert.deepEqual(before, immutable);
  assert.deepEqual(Object.keys(patch.properties), ['template']);
  assert.equal(after.properties.template.containers[0].image, image);
  assert.equal(configurationHash(before), configurationHash(after));
  after.properties.template.containers[0].env[0].secretRef = 'changed';
  assert.notEqual(configurationHash(before), configurationHash(after));
  assert.throws(() => imagePatch(before, `${target.image}:latest`, 'gh-123-1', target), /immutable/);
});

test('permission preflight honors exclusions instead of accepting an unrelated broad role', () => {
  assert.equal(permits({ value: [{ actions: ['Microsoft.App/*'], notActions: [] }] },
    'Microsoft.App/containerApps/write'), true);
  assert.equal(permits({ value: [{ actions: ['*'], notActions: ['Microsoft.App/*/write'] }] },
    'Microsoft.App/containerApps/write'), false);
  assert.equal(permits({ value: [{ actions: ['*/read'], notActions: [] }] },
    'Microsoft.ContainerRegistry/registries/push/write'), false);
});

test('a ready revision waits for completed provisioning and rejects configuration drift', async () => {
  const ready = app();
  ready.properties.latestReadyRevisionName = 'test--gh-123-1';
  const report = { image: ready.properties.template.containers[0].image, configurationHash: configurationHash(ready) };
  let polls = 0;
  await waitForRevision(async () => {
    polls++;
    const current = structuredClone(ready);
    if (polls === 1) current.properties.provisioningState = 'InProgress';
    return current;
  }, 'test--gh-123-1', target, report, async () => {});
  assert.equal(polls, 2);
  ready.properties.template.scale.maxReplicas = 3;
  await assert.rejects(waitForRevision(async () => ready, 'test--gh-123-1',
    target, report, async () => {}), /changed application settings/);
});

test('health verification rejects old HTML or modified assets even when HTTP returns success', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ptu-site-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  const html = '<html><script src="/assets/app.js"></script><link href="/assets/app.css" rel="stylesheet"></html>';
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'assets', 'app.js'), 'tested JavaScript');
  await writeFile(join(directory, 'assets', 'app.css'), 'tested CSS');
  const contents = {
    '/health': 'healthy\n', '/': html, '/assets/app.js': 'tested JavaScript', '/assets/app.css': 'tested CSS',
  };
  const fetcher = async (url) => new Response(contents[url.pathname] ?? '', { status: 200 });
  await assert.doesNotReject(verifySite(directory, 'https://test.azurecontainerapps.io/', fetcher));
  contents['/assets/app.js'] = 'old JavaScript';
  await assert.rejects(verifySite(directory, 'https://test.azurecontainerapps.io/', fetcher), /served asset/);
  contents['/'] = '<html>old release</html>';
  await assert.rejects(verifySite(directory, 'https://test.azurecontainerapps.io/', fetcher), /served HTML/);
  contents['/health'] = 'not healthy';
  await assert.rejects(verifySite(directory, 'https://test.azurecontainerapps.io/', fetcher), /health endpoint/);
});
