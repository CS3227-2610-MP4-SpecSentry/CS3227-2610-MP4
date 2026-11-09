import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { validateDigest, validateImageReference } from './release-candidate.mjs';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = 1_048_576;
const ARM_API_VERSION = '2025-07-01';
const subscriptionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const resourceGroupPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const appPattern = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const registryPattern = /^[a-z0-9]{5,50}$/;
const repositoryPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;
const secretRefPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const identityNamePattern = /^[a-z][a-z0-9-]{1,126}[a-z0-9]$/;
const hostPattern = /^[a-z0-9](?:[a-z0-9.-]{1,251}[a-z0-9])$/;
const revisionPattern = /^[a-z][a-z0-9-]{2,127}$/;
const failedRunningStates = new Set(['ActivationFailed', 'Degraded', 'Failed', 'Stopped']);
const pendingRunningStates = new Set([undefined, null, 'Processing', 'Running', 'Unknown']);
const pendingHealthStates = new Set([undefined, null, 'Healthy', 'None', 'Unknown']);
const pendingProvisioningStates = new Set(['Provisioned', 'Provisioning']);

export function validateAzureTarget(subscriptionId, resourceGroup, containerAppName) {
  if (!subscriptionPattern.test(subscriptionId ?? '')) throw new Error('Invalid Azure subscription identity');
  if (!resourceGroupPattern.test(resourceGroup ?? '')) throw new Error('Invalid Azure resource group');
  if (!appPattern.test(containerAppName ?? '')) throw new Error('Invalid Azure Container App name');
  return Object.freeze({ subscriptionId, resourceGroup, containerAppName });
}

export function validateAcrTarget(registryName, registryServer, containerImageName) {
  if (!registryPattern.test(registryName ?? '')) throw new Error('Invalid Azure Container Registry name');
  if (registryServer !== `${registryName}.azurecr.io`) throw new Error('Invalid Azure Container Registry server');
  if (!repositoryPattern.test(containerImageName ?? '')) throw new Error('Invalid Azure container image name');
  return Object.freeze({ registryName, registryServer, containerImageName });
}

export function validateRegistryIdentity(registryIdentity, subscriptionId, resourceGroup) {
  if (typeof registryIdentity !== 'string') throw new Error('Invalid Azure registry pull identity');
  const prefix = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`
    + '/providers/Microsoft.ManagedIdentity/userAssignedIdentities/';
  if (!registryIdentity.toLowerCase().startsWith(prefix.toLowerCase()))
    throw new Error('Azure registry pull identity is outside the target environment');
  const name = registryIdentity.slice(prefix.length);
  if (!identityNamePattern.test(name) || name.includes('/'))
    throw new Error('Invalid Azure registry pull identity');
  return registryIdentity;
}

function parseJson(text) {
  if (Buffer.byteLength(text) > MAX_OUTPUT_BYTES) throw new Error('Azure CLI response is too large');
  try { return JSON.parse(text); }
  catch { throw new Error('Azure CLI returned malformed JSON'); }
}

export async function runAzure(args, { exec = execFileAsync, allowEmpty = false } = {}) {
  if (!Array.isArray(args) || args.length === 0
      || args.some((value) => typeof value !== 'string' || value.length === 0))
    throw new Error('Azure CLI arguments are invalid');
  try {
    const childEnvironment = { ...process.env, AZURE_CORE_ONLY_SHOW_ERRORS: 'true' };
    delete childEnvironment.GHCR_TOKEN;
    const result = await exec('az', args, {
      encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES, timeout: 120_000,
      env: childEnvironment,
    });
    const stdout = result.stdout?.trim() ?? '';
    if (allowEmpty && stdout.length === 0) return null;
    return parseJson(stdout);
  } catch (error) {
    if (error instanceof Error && ['Azure CLI response is too large',
      'Azure CLI returned malformed JSON'].includes(error.message)) throw error;
    throw new Error('Azure CLI command failed', { cause: error });
  }
}

function containerAppResourcePath(subscriptionId, resourceGroup, containerAppName) {
  return `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`
    + `/providers/Microsoft.App/containerApps/${containerAppName}`;
}

function armUrl(resourcePath) {
  return `https://management.azure.com${resourcePath}?api-version=${ARM_API_VERSION}`;
}

function restArguments(method, resourcePath, body) {
  const args = ['rest', '--method', method, '--url', armUrl(resourcePath)];
  if (body !== undefined) args.push('--body', JSON.stringify(body));
  return [...args, '--output', 'json', '--only-show-errors'];
}

function validateRegistryResource(value, subscriptionId, resourceGroup, target) {
  const expectedId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`
    + `/providers/Microsoft.ContainerRegistry/registries/${target.registryName}`;
  if (!value || value.name !== target.registryName || value.loginServer !== target.registryServer
      || value.provisioningState !== 'Succeeded' || value.id?.toLowerCase() !== expectedId.toLowerCase())
    throw new Error('Azure Container Registry identity mismatch');
}

async function verifyRegistryResource({ subscriptionId, registryResourceGroup, target, run }) {
  const value = await run(['acr', 'show', '--subscription', subscriptionId,
    '--resource-group', registryResourceGroup, '--name', target.registryName,
    '--output', 'json', '--only-show-errors']);
  validateRegistryResource(value, subscriptionId, registryResourceGroup, target);
}

async function verifyAcrManifest({ subscriptionId, target, digest, imageSelector, run }) {
  const value = await run(['acr', 'repository', 'show', '--subscription', subscriptionId,
    '--name', target.registryName, '--image', imageSelector, '--output', 'json', '--only-show-errors']);
  if (!value || value.digest !== digest) throw new Error('Azure registry digest mismatch');
}

export async function copyImageToAcr({ subscriptionId, registryResourceGroup, registryName,
  registryServer, containerImageName, sourceImage, expectedDigest, ghcrUsername, ghcrToken, run = runAzure }) {
  if (!subscriptionPattern.test(subscriptionId ?? '')) throw new Error('Invalid Azure subscription identity');
  if (!resourceGroupPattern.test(registryResourceGroup ?? ''))
    throw new Error('Invalid Azure Container Registry resource group');
  const target = validateAcrTarget(registryName, registryServer, containerImageName);
  const digest = validateDigest(expectedDigest);
  validateImageReference(sourceImage, digest);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(ghcrUsername ?? ''))
    throw new Error('Invalid GitHub registry username');
  if (typeof ghcrToken !== 'string' || ghcrToken.length < 1 || ghcrToken.length > 4096 || /[\r\n]/.test(ghcrToken))
    throw new Error('Invalid GitHub registry credential');
  await verifyRegistryResource({ subscriptionId, registryResourceGroup, target, run });
  const importTag = `${containerImageName}:sha256-${digest.slice('sha256:'.length)}`;
  await run(['acr', 'import', '--subscription', subscriptionId, '--resource-group', registryResourceGroup,
    '--name', registryName, '--source', sourceImage, '--image', importTag,
    '--username', ghcrUsername, '--password', ghcrToken, '--force', '--output', 'json', '--only-show-errors'],
  { allowEmpty: true });
  await verifyAcrManifest({ subscriptionId, target, digest, imageSelector: importTag, run });
  await verifyAcrManifest({ subscriptionId, target, digest,
    imageSelector: `${containerImageName}@${digest}`, run });
  return Object.freeze({ image: `${registryServer}/${containerImageName}@${digest}`, imageDigest: digest });
}

export async function verifyAcrImage({ subscriptionId, registryResourceGroup, registryName,
  registryServer, containerImageName, expectedDigest, run = runAzure }) {
  if (!subscriptionPattern.test(subscriptionId ?? '')) throw new Error('Invalid Azure subscription identity');
  if (!resourceGroupPattern.test(registryResourceGroup ?? ''))
    throw new Error('Invalid Azure Container Registry resource group');
  const target = validateAcrTarget(registryName, registryServer, containerImageName);
  const digest = validateDigest(expectedDigest);
  await verifyRegistryResource({ subscriptionId, registryResourceGroup, target, run });
  await verifyAcrManifest({ subscriptionId, target, digest,
    imageSelector: `${containerImageName}@${digest}`, run });
  return Object.freeze({ image: `${registryServer}/${containerImageName}@${digest}`, imageDigest: digest });
}

function validateAcrImageReference(value, expectedDigest, target) {
  const digest = validateDigest(expectedDigest);
  if (value !== `${target.registryServer}/${target.containerImageName}@${digest}`)
    throw new Error('Azure deployment image identity mismatch');
  return digest;
}

function onlyContainer(value) {
  const containers = value?.properties?.template?.containers;
  if (!Array.isArray(containers) || containers.length !== 1)
    throw new Error('Azure deployment container identity mismatch');
  return containers[0];
}

function validateRuntimeEnvironment(container) {
  const entries = container?.env;
  if (!Array.isArray(entries)) throw new Error('Azure runtime environment is missing');
  const names = entries.map((entry) => entry?.name);
  if (names.some((name) => typeof name !== 'string') || new Set(names).size !== names.length)
    throw new Error('Azure runtime environment is ambiguous');
  if (names.includes('DIRECT_DATABASE_URL')) throw new Error('Migration credential reached the Azure runtime');
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  for (const [name, value] of [['PORT', '3000'], ['TRUST_PROXY_HOPS', '1'], ['NODE_ENV', 'production']]) {
    const entry = byName.get(name);
    if (!entry || entry.value !== value || entry.secretRef !== undefined)
      throw new Error(`Azure runtime ${name} contract mismatch`);
  }
  for (const name of ['DATABASE_URL', 'SESSION_SECRET', 'AI_API_KEY']) {
    const entry = byName.get(name);
    if (!entry || !secretRefPattern.test(entry.secretRef ?? '')
        || (entry.value !== undefined && entry.value !== null))
      throw new Error(`Azure runtime ${name} must use a secret reference`);
  }
}

function validateRuntimeProbes(container) {
  const probes = container?.probes;
  if (!Array.isArray(probes)) throw new Error('Azure runtime health probes are missing');
  for (const [type, path] of [['Readiness', '/api/ready'], ['Liveness', '/api/health']]) {
    const matches = probes.filter((probe) => probe?.type === type && probe?.httpGet?.path === path
      && probe.httpGet.port === 3000 && ['HTTP', undefined].includes(probe.httpGet.scheme));
    if (matches.length !== 1) throw new Error(`Azure runtime ${type.toLowerCase()} probe mismatch`);
  }
}

function validateRuntimeContract(value, expectedDeploymentHost) {
  const configuration = value.properties?.configuration;
  if (configuration?.activeRevisionsMode !== 'Single')
    throw new Error('Azure Container App must use single revision mode');
  const ingress = configuration.ingress;
  if (!ingress || ingress.external !== true || ingress.allowInsecure !== false
      || ingress.targetPort !== 3000 || ingress.fqdn !== expectedDeploymentHost)
    throw new Error('Azure Container App HTTPS ingress contract mismatch');
  const container = onlyContainer(value);
  validateRuntimeEnvironment(container);
  validateRuntimeProbes(container);
  return container;
}

function validateRegistryContract(value, registryServer, registryIdentity) {
  const configuration = value.properties?.configuration;
  const registries = configuration?.registries;
  const matchingRegistries = Array.isArray(registries)
    ? registries.filter((entry) => entry?.server === registryServer) : [];
  if (matchingRegistries.length !== 1 || typeof matchingRegistries[0].identity !== 'string'
      || matchingRegistries[0].identity.toLowerCase() !== registryIdentity.toLowerCase()
      || (matchingRegistries[0].username !== undefined && matchingRegistries[0].username !== null)
      || (matchingRegistries[0].passwordSecretRef !== undefined
        && matchingRegistries[0].passwordSecretRef !== null))
    throw new Error('Azure Container App must pull from ACR with one managed identity');
}

function validateApplication(value, containerAppName, registryServer, registryIdentity,
  expectedDeploymentHost, image, { requireRegistry = true } = {}) {
  if (!value || value.name !== containerAppName || value.properties?.provisioningState !== 'Succeeded')
    throw new Error('Azure deployment response identity mismatch');
  const container = validateRuntimeContract(value, expectedDeploymentHost);
  if (requireRegistry) validateRegistryContract(value, registryServer, registryIdentity);
  if (image !== undefined && container.image !== image)
    throw new Error('Azure deployment image identity mismatch');
  return value.properties;
}

function validateUpdate(value, containerAppName, registryServer, registryIdentity,
  expectedDeploymentHost, image) {
  const properties = validateApplication(value, containerAppName, registryServer, registryIdentity,
    expectedDeploymentHost, image);
  const revision = properties.latestRevisionName;
  if (!revisionPattern.test(revision ?? '') || !revision.startsWith(`${containerAppName}--`))
    throw new Error('Azure revision identity mismatch');
  return revision;
}

function validateRevision(value, revision, image) {
  if (!value || value.name !== revision || typeof value.properties?.active !== 'boolean'
      || value.properties?.provisioningState === undefined)
    throw new Error('Azure revision response identity mismatch');
  if (onlyContainer(value).image !== image) throw new Error('Azure deployment image identity mismatch');
  return value.properties;
}

function validateFinalApplication(value, containerAppName, registryServer, registryIdentity,
  expectedDeploymentHost, revision, image, revisionTrafficWeight) {
  const properties = validateApplication(value, containerAppName, registryServer, registryIdentity,
    expectedDeploymentHost, image);
  if (properties.latestRevisionName !== revision)
    throw new Error('Azure latest revision identity mismatch');
  const traffic = properties.configuration?.ingress?.traffic;
  // Azure omits ingress traffic arrays for some single-revision Container Apps and rejects an
  // attempt to set explicit weights. In that case the revision resource still reports the
  // effective traffic weight, so require it to be 100 before accepting the implicit routing.
  if (traffic === undefined || traffic === null) {
    if (revisionTrafficWeight !== 100)
      throw new Error('Azure production traffic did not converge on the approved revision');
    return;
  }
  if (!Array.isArray(traffic) || traffic.length !== 1 || traffic[0]?.weight !== 100
      || !(traffic[0]?.revisionName === revision || traffic[0]?.latestRevision === true))
    throw new Error('Azure production traffic did not converge on the approved revision');
}

export async function deployImage({ subscriptionId, resourceGroup, containerAppName,
  registryName, registryServer, containerImageName, registryIdentity, expectedDeploymentHost,
  image, expectedDigest,
  run = runAzure, sleep = delay, pollIntervalMs = 5_000, maxPolls = 60,
  deadlineMs = 600_000, now = () => Date.now() }) {
  validateAzureTarget(subscriptionId, resourceGroup, containerAppName);
  validateRegistryIdentity(registryIdentity, subscriptionId, resourceGroup);
  if (!hostPattern.test(expectedDeploymentHost ?? '')) throw new Error('Invalid Azure deployment host');
  const registryTarget = validateAcrTarget(registryName, registryServer, containerImageName);
  const digest = validateAcrImageReference(image, expectedDigest, registryTarget);
  const resourcePath = containerAppResourcePath(subscriptionId, resourceGroup, containerAppName);
  const preflight = await run(restArguments('get', resourcePath));
  validateApplication(preflight, containerAppName, registryServer, registryIdentity,
    expectedDeploymentHost, undefined, { requireRegistry: false });
  const updatedContainer = { ...onlyContainer(preflight), image };
  const patch = { properties: {
    configuration: { registries: [{ server: registryServer, identity: registryIdentity }] },
    template: { containers: [updatedContainer] },
  } };
  // Never retry an ambiguous mutation. A later human-authorized run can safely reconcile by exact digest.
  await run(restArguments('patch', resourcePath, patch), { allowEmpty: true });
  const deadline = now() + deadlineMs;
  let revision;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    if (now() >= deadline) break;
    const updated = await run(restArguments('get', resourcePath));
    if (['Canceled', 'Failed'].includes(updated?.properties?.provisioningState))
      throw new Error('Azure Container App update failed');
    try {
      revision = validateUpdate(updated, containerAppName, registryServer, registryIdentity,
        expectedDeploymentHost, image);
      break;
    } catch (error) {
      if (poll + 1 >= maxPolls) throw error;
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - now())));
    }
  }
  if (!revision) throw new Error('Azure Container App update did not complete before the deadline');
  for (let poll = 0; poll < maxPolls; poll += 1) {
    if (now() >= deadline) break;
    let properties;
    try {
      const revisionPath = `${resourcePath}/revisions/${revision}`;
      properties = validateRevision(await run(restArguments('get', revisionPath)), revision, image);
      if (properties.active === true && properties.runningState === 'Running'
          && properties.healthState === 'Healthy' && properties.provisioningState === 'Provisioned') {
        validateFinalApplication(await run(restArguments('get', resourcePath)),
          containerAppName, registryServer, registryIdentity, expectedDeploymentHost, revision, image,
          properties.trafficWeight);
        return Object.freeze({ deployId: revision, imageDigest: digest });
      }
    } catch (error) {
      if (poll + 1 >= maxPolls) throw error;
      await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - now())));
      continue;
    }
    if (failedRunningStates.has(properties.runningState) || properties.healthState === 'Unhealthy'
        || ['Deprovisioned', 'Deprovisioning', 'Failed'].includes(properties.provisioningState))
      throw new Error('Azure revision failed to become healthy');
    if (!pendingRunningStates.has(properties.runningState)
        || !pendingHealthStates.has(properties.healthState)
        || !pendingProvisioningStates.has(properties.provisioningState))
      throw new Error('Azure revision returned an unknown status');
    if (poll + 1 < maxPolls) await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - now())));
  }
  throw new Error('Azure revision did not become healthy before the deadline');
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function writeEvidence(path, value) {
  if (!path) throw new Error('Evidence output is required');
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function main() {
  const output = argument('--output');
  const expectedDigest = argument('--expected-digest');
  const registry = {
    registryResourceGroup: process.env.AZURE_CONTAINER_REGISTRY_RESOURCE_GROUP,
    registryName: process.env.AZURE_CONTAINER_REGISTRY,
    registryServer: process.env.AZURE_REGISTRY_SERVER,
    containerImageName: process.env.AZURE_CONTAINER_IMAGE_NAME,
    registryIdentity: process.env.AZURE_CONTAINER_REGISTRY_IDENTITY,
  };
  const base = { subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
    resourceGroup: process.env.AZURE_RESOURCE_GROUP, ...registry };
  if (process.argv.includes('--copy-to-acr')) {
    if (!process.argv.includes('--execute')) throw new Error('Registry mutation requires the explicit --execute flag');
    const result = await copyImageToAcr({ ...base, sourceImage: argument('--source-image'), expectedDigest,
      ghcrUsername: process.env.GHCR_USERNAME, ghcrToken: process.env.GHCR_TOKEN });
    await writeEvidence(output, { schemaVersion: 1, ...result });
    console.info('PASS Azure registry contains the approved immutable image');
    return;
  }
  if (process.argv.includes('--verify-acr')) {
    const result = await verifyAcrImage({ ...base, expectedDigest });
    await writeEvidence(output, { schemaVersion: 1, ...result });
    console.info('PASS Azure registry still contains the approved immutable image');
    return;
  }
  if (!process.argv.includes('--execute')) throw new Error('Provider mutation requires the explicit --execute flag');
  const image = argument('--image');
  if (!image || !output || !expectedDigest) throw new Error('Image, expected digest and evidence output are required');
  const target = validateAzureTarget(base.subscriptionId,
    base.resourceGroup, process.env.AZURE_CONTAINER_APP_NAME);
  const result = await deployImage({ ...target, ...registry,
    expectedDeploymentHost: process.env.EXPECTED_DEPLOYMENT_HOST, image, expectedDigest });
  const targetIdentity = `${target.subscriptionId}/${target.resourceGroup}/${target.containerAppName}`;
  const serviceFingerprint = createHash('sha256').update(targetIdentity).digest('hex');
  await writeEvidence(output, { schemaVersion: 1, deployId: result.deployId,
    imageDigest: result.imageDigest, serviceFingerprint });
  console.info('PASS Azure reports the immutable image healthy with all traffic');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'Azure deployment failed'}`);
  process.exitCode = 1;
});
