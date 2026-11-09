import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GitHub, publishReport } from './ptu-docs.mjs';

const REPOSITORY = 'guming3d/ptu_cost_compare_tool';
const OWNER = 'guming3d';
const API_VERSION = '2026-07-01';
const SHA = /^[a-f0-9]{40}$/;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => JSON.stringify(value, (_, item) => item && !Array.isArray(item) &&
  typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);

export function approvedMerge(pr, repository, masterSha) {
  if (repository !== REPOSITORY || !pr?.merged || pr.state !== 'closed' ||
      pr.base?.repo?.full_name !== repository || pr.base.ref !== 'master' ||
      pr.merged_by?.login !== OWNER || !SHA.test(pr.merge_commit_sha ?? '')) {
    throw new Error('Deployment requires a PR manually merged into master by guming3d.');
  }
  if (pr.merge_commit_sha !== masterSha) {
    throw new Error('This merged PR is no longer the master tip; deploy the newest merged PR instead.');
  }
  return pr.merge_commit_sha;
}

export async function resolveSource(github, eventName, event, inputs, actor, ref) {
  if (github.repository !== REPOSITORY || actor !== OWNER || ref !== 'refs/heads/master') {
    throw new Error('Only guming3d can deploy this repository from master.');
  }
  const dryRun = eventName === 'workflow_dispatch' && inputs.dryRun;
  if (eventName !== 'workflow_dispatch' &&
      (eventName !== 'pull_request_target' || event.action !== 'closed' || !event.pull_request?.merged)) {
    throw new Error('Only merged PR events or explicit manual checks are supported.');
  }
  const number = eventName === 'pull_request_target' ? event.pull_request.number : inputs.number;
  if (number && !/^[1-9]\d*$/.test(String(number))) throw new Error('Invalid PR number.');
  if (!number && !dryRun) throw new Error('A previously merged PR is required for a deployment retry.');
  const master = await github.repo('/git/ref/heads/master');
  if (!SHA.test(master.object?.sha ?? '')) throw new Error('Cannot resolve the master commit.');
  if (number) {
    const pr = await github.repo(`/pulls/${number}`);
    return { sha: approvedMerge(pr, github.repository, master.object.sha), number: pr.number, dryRun };
  }
  return { sha: master.object.sha, number: null, dryRun };
}

function config() {
  const names = ['AZURE_SUBSCRIPTION_ID', 'AZURE_TENANT_ID', 'AZURE_RESOURCE_GROUP',
    'AZURE_CONTAINER_APP', 'AZURE_CONTAINER_NAME', 'AZURE_CONTAINER_REGISTRY', 'AZURE_IMAGE_REPOSITORY'];
  for (const name of names) {
    if (!process.env[name]) throw new Error(`Missing production environment setting: ${name}.`);
  }
  const result = {
    subscription: process.env.AZURE_SUBSCRIPTION_ID,
    tenant: process.env.AZURE_TENANT_ID,
    resourceGroup: process.env.AZURE_RESOURCE_GROUP,
    app: process.env.AZURE_CONTAINER_APP,
    container: process.env.AZURE_CONTAINER_NAME,
    registry: process.env.AZURE_CONTAINER_REGISTRY,
    repository: process.env.AZURE_IMAGE_REPOSITORY,
  };
  if (![result.subscription, result.tenant].every((id) => /^[a-f0-9-]{36}$/i.test(id)) ||
      ![result.resourceGroup, result.app, result.container, result.registry].every((name) => /^[\w.-]+$/.test(name)) ||
      !/^[a-z0-9._-]+(?:\/[a-z0-9._-]+)*$/.test(result.repository)) {
    throw new Error('Invalid Azure production environment settings.');
  }
  result.server = `${result.registry}.azurecr.io`;
  result.image = `${result.server}/${result.repository}`;
  result.id = `/subscriptions/${result.subscription}/resourceGroups/${result.resourceGroup}/providers/Microsoft.App/containerApps/${result.app}`;
  result.registryId = `/subscriptions/${result.subscription}/resourceGroups/${result.resourceGroup}/providers/Microsoft.ContainerRegistry/registries/${result.registry}`;
  return result;
}

export function assertTarget(app, target) {
  const properties = app.properties;
  const ingress = properties?.configuration?.ingress;
  const containers = properties?.template?.containers;
  if (app.id?.toLowerCase() !== target.id.toLowerCase() ||
      properties.provisioningState !== 'Succeeded' ||
      properties.configuration.activeRevisionsMode !== 'Single' ||
      !ingress?.external || ingress.targetPort !== 80 || ingress.allowInsecure !== false ||
      ingress.traffic?.length !== 1 || ingress.traffic[0].latestRevision !== true ||
      ingress.traffic[0].weight !== 100 || !/^[\w.-]+\.azurecontainerapps\.io$/.test(ingress.fqdn ?? '') ||
      containers?.length !== 1 || containers[0].name !== target.container ||
      !properties.configuration.registries?.some((registry) =>
        registry.server === target.server && registry.identity === 'system')) {
    throw new Error('The existing app no longer matches the approved single-container HTTPS deployment target.');
  }
  const image = containers[0].image;
  if (!image?.startsWith(`${target.image}@sha256:`) || !/@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('The current image must be a digest-pinned image in the configured registry repository.');
  }
  return image;
}

export function configurationHash(app) {
  const template = structuredClone(app.properties.template);
  delete template.revisionSuffix;
  for (const container of template.containers) delete container.image;
  return hash(stable({
    identity: app.identity, location: app.location,
    environment: app.properties.environmentId,
    managedEnvironment: app.properties.managedEnvironmentId,
    workloadProfile: app.properties.workloadProfileName,
    configuration: app.properties.configuration, template,
  }));
}

export function imagePatch(app, image, suffix, target) {
  assertTarget(app, target);
  if (!image.startsWith(`${target.image}@sha256:`) || !/@sha256:[a-f0-9]{64}$/.test(image) ||
      !/^gh-\d+-\d+$/.test(suffix)) {
    throw new Error('An immutable image digest and unique workflow revision suffix are required.');
  }
  const template = structuredClone(app.properties.template);
  template.containers[0].image = image;
  template.revisionSuffix = suffix;
  return { properties: { template } };
}

export function permits(permissions, action) {
  const matches = (pattern) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*')}$`, 'i').test(action);
  return permissions.value?.some((permission) =>
    permission.actions?.some(matches) && !permission.notActions?.some(matches)) === true;
}

export async function waitForRevision(readApp, revision, target, report, delay = pause) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const current = await readApp();
    if (current.properties.provisioningState === 'Failed') throw new Error('The new revision failed provisioning.');
    if (current.properties.latestReadyRevisionName === revision &&
        current.properties.provisioningState === 'Succeeded') {
      if (assertTarget(current, target) !== report.image || configurationHash(current) !== report.configurationHash) {
        throw new Error('The deployment changed application settings or did not retain the expected image.');
      }
      return;
    }
    await delay(10000);
  }
  throw new Error('The new revision did not become ready within ten minutes; inspect Azure before retrying.');
}

export async function verifySite(directory, baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  const get = async (path) => {
    const response = await fetcher(new URL(path, base), {
      redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Site verification failed: ${path} returned HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  };
  if ((await get('/health')).toString().trim() !== 'healthy') throw new Error('The health endpoint is not healthy.');
  const expected = await readFile(join(directory, 'index.html'));
  if (hash(await get(`/?ptu_deploy=${Date.now()}`)) !== hash(expected)) {
    throw new Error('The served HTML does not match the tested image.');
  }
  const assets = [...expected.toString().matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)]
    .map((match) => match[1]);
  if (!assets.length) throw new Error('The tested HTML contains no application assets.');
  for (const asset of new Set(assets)) {
    if (asset.includes('..') || new URL(asset, base).origin !== base.origin) throw new Error('Unsafe application asset path.');
    if (hash(await get(asset)) !== hash(await readFile(join(directory, asset.slice(1))))) {
      throw new Error(`The served asset does not match the tested image: ${asset}.`);
    }
  }
}

function command(binary, args) {
  return execFileSync(binary, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 600000 }).trim();
}

const azure = (args) => JSON.parse(command('az', [...args, '--only-show-errors', '--output', 'json']));
const resource = (id, version = API_VERSION) =>
  azure(['rest', '--method', 'GET', '--url', `https://management.azure.com${id}?api-version=${version}`]);
const permissions = (id) => resource(`${id}/providers/Microsoft.Authorization/permissions`, '2022-04-01');
const reportPath = () => process.env.DEPLOY_REPORT;

async function save(report) {
  await mkdir(dirname(reportPath()), { recursive: true });
  await writeFile(reportPath(), `${JSON.stringify({ ...report, runAttempt: process.env.GITHUB_RUN_ATTEMPT }, null, 2)}\n`);
}

async function readReport() {
  try { return JSON.parse(await readFile(reportPath(), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function summary(report) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY,
      `## Container App ${report.dryRun ? 'dry run' : 'deployment'}\n\n${report.message}\n\n`
      + `Commit: \`${report.sha ?? 'unresolved'}\`\n\n`
      + (report.url ? `Site: ${report.url}\n\n` : '')
      + (report.image ? `Image: \`${report.image}\`\n\n` : '')
      + (report.previousImage ? `Previous image (rollback): \`${report.previousImage}\`\n\n` : ''),
      { flag: 'a' });
  }
}

async function assertCurrent(github, release) {
  const master = await github.repo('/git/ref/heads/master');
  if (master.object?.sha !== release.sha) throw new Error('Master changed during validation; refusing a stale deployment.');
  if (!release.dryRun) {
    approvedMerge(await github.repo(`/pulls/${release.number}`), github.repository, release.sha);
  }
}

async function preflight(github) {
  const target = config();
  const release = {
    sha: process.env.DEPLOY_SHA, number: Number(process.env.PR_NUMBER) || null,
    dryRun: process.env.DRY_RUN === 'true',
  };
  if (!SHA.test(release.sha ?? '')) throw new Error('Invalid deployment source SHA.');
  await assertCurrent(github, release);
  const account = azure(['account', 'show']);
  if (account.id !== target.subscription || account.tenantId !== target.tenant) {
    throw new Error('Azure login selected the wrong subscription or tenant.');
  }
  const app = resource(target.id);
  const previousImage = assertTarget(app, target);
  const registry = azure(['acr', 'show', '--name', target.registry, '--subscription', target.subscription]);
  if (registry.loginServer !== target.server || registry.adminUserEnabled ||
      registry.id.toLowerCase() !== target.registryId.toLowerCase()) {
    throw new Error('Registry identity, scope or passwordless configuration differs from the approved target.');
  }
  if (!permits(permissions(target.id), 'Microsoft.App/containerApps/write') ||
      !permits(permissions(target.registryId), 'Microsoft.ContainerRegistry/registries/push/write')) {
    throw new Error('The federated identity lacks the required resource-scoped image update/push permission.');
  }
  command('docker', ['load', '--input', join(process.env.RELEASE_DIR, 'image.tar')]);
  const image = JSON.parse(command('docker', ['image', 'inspect', `ptu-cost-planner:${release.sha}`]))[0];
  if (image.Config?.Labels?.['org.opencontainers.image.revision'] !== release.sha) {
    throw new Error('The uploaded image was not built from the resolved commit.');
  }
  command('az', ['acr', 'login', '--name', target.registry, '--subscription', target.subscription, '--only-show-errors']);
  command('docker', ['manifest', 'inspect', previousImage]);
  const report = {
    ...release, previousImage, configurationHash: configurationHash(app),
    url: `https://${app.properties.configuration.ingress.fqdn}/`,
    status: release.dryRun ? 'success' : 'pending',
    message: release.dryRun
      ? 'Dry run passed: tests, image smoke test, federated Azure login, target configuration, registry access and deployment permissions verified. No image was pushed and the Container App was not changed.'
      : 'Merged source, tested image, Azure target and scoped deployment permissions verified.',
  };
  await save(report);
  await summary(report);
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `url=${report.url}\n`, { flag: 'a' });
  }
}

async function deploy(github) {
  const target = config();
  const report = await readReport();
  if (!report || report.dryRun || process.env.DRY_RUN !== 'false' || !report.number) {
    throw new Error('A deployment requires a successful non-dry preflight for an owner-merged PR.');
  }
  await assertCurrent(github, report);
  const before = resource(target.id);
  if (assertTarget(before, target) !== report.previousImage ||
      configurationHash(before) !== report.configurationHash) {
    throw new Error('The app changed after preflight; refusing to overwrite concurrent changes.');
  }
  const suffix = `gh-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  const tag = `${target.image}:${report.sha}-${suffix}`;
  command('docker', ['tag', `ptu-cost-planner:${report.sha}`, tag]);
  command('docker', ['push', tag]);
  const pushed = JSON.parse(command('docker', ['image', 'inspect', tag]))[0];
  report.image = pushed.RepoDigests?.find((digest) => digest.startsWith(`${target.image}@sha256:`));
  await assertCurrent(github, report);
  const latest = resource(target.id);
  if (assertTarget(latest, target) !== report.previousImage ||
      configurationHash(latest) !== report.configurationHash) {
    throw new Error('The app changed while uploading the image; refusing to overwrite concurrent changes.');
  }
  const patch = imagePatch(latest, report.image ?? '', suffix, target);
  await save(report);
  // A full copied template preserves env/resources/probes; no configuration or identity is patched.
  const directory = await mkdtemp(join(tmpdir(), 'ptu-image-update-'));
  const path = join(directory, 'request.json');
  try {
    await writeFile(path, JSON.stringify(patch), { mode: 0o600 });
    azure(['rest', '--method', 'PATCH', '--url', `https://management.azure.com${target.id}?api-version=${API_VERSION}`,
      '--body', `@${path}`]);
  } finally {
    await unlink(path).catch(() => {});
    await rmdir(directory);
  }
  await waitForRevision(() => resource(target.id), `${target.app}--${suffix}`, target, report);
  for (let attempt = 0; ; attempt++) {
    try { await verifySite(join(process.env.RELEASE_DIR, 'site'), report.url); break; }
    catch (error) { if (attempt === 11) throw error; await pause(10000); }
  }
  report.status = 'success';
  report.revision = `${target.app}--${suffix}`;
  report.message = `Deployment passed for merged commit ${report.sha}. The new revision is ready and serves the tested HTML/assets; health passed. Existing configuration and identity are unchanged.\n\nSite: ${report.url}\nRevision: \`${report.revision}\`\nImage: \`${report.image}\`\nPrevious image (rollback): \`${report.previousImage}\``;
  await save(report);
  await summary(report);
}

async function notify(github, event) {
  const results = JSON.parse(process.env.JOB_RESULTS);
  let report = await readReport();
  if (report?.runAttempt !== process.env.GITHUB_RUN_ATTEMPT) report = null;
  const success = results.deploy?.result === 'success' && report?.status === 'success';
  report ??= {
    dryRun: process.env.DRY_RUN === 'true',
    message: `Deployment workflow did not complete. Source: ${results.resolve?.result}; build: ${results.build?.result}; Azure: ${results.deploy?.result}. Inspect the linked run. The app might not have been updated.`,
  };
  report.kind = 'deployment';
  report.status = success ? 'success' : 'failure';
  if (!success && !report.message.includes('did not complete')) {
    report.message = `Deployment workflow failed. ${report.message} Inspect the linked run before retrying.`;
  }
  const number = report.number ?? event.pull_request?.number ?? process.env.PR_NUMBER;
  if (/^[1-9]\d*$/.test(String(number))) report.pr = { url: `https://github.com/${github.repository}/pull/${number}` };
  const runUrl = `${process.env.GITHUB_SERVER_URL}/${github.repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await publishReport(github, report, runUrl, `deployment:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`);
  await summary(report);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'verify-site') return verifySite(process.env.SITE_DIR, process.env.PROBE_URL);
  // 2026-03-10 omits merge_commit_sha, which the current-tip approval guard requires.
  const github = new GitHub(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY, fetch, '2022-11-28');
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (mode === 'resolve') {
    const source = await resolveSource(github, process.env.GITHUB_EVENT_NAME, event, {
      dryRun: process.env.DRY_RUN === 'true', number: process.env.PR_NUMBER,
    }, process.env.GITHUB_ACTOR, process.env.GITHUB_REF);
    await writeFile(process.env.GITHUB_OUTPUT,
      `sha=${source.sha}\npr_number=${source.number ?? ''}\ndry_run=${source.dryRun}\n`, { flag: 'a' });
  } else if (mode === 'preflight') await preflight(github);
  else if (mode === 'deploy') await deploy(github);
  else if (mode === 'notify') await notify(github, event);
  else throw new Error('Unknown deployment operation.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    if (reportPath() && ['preflight', 'deploy'].includes(process.argv[2])) {
      const report = await readReport().catch(() => null);
      await save({ ...report, status: 'failure', message: error.message }).catch(() => {});
    }
    console.error(error.message);
    process.exitCode = 1;
  });
}
