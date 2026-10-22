/** Checks workspace version consistency or prepares the next version and its changelog entry. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = fileURLToPath(new URL('../', import.meta.url));
const changelogPath = join(rootDirectory, 'CHANGELOG.md');
interface Manifest {
  path: string;
  data: { version: string; [key: string]: unknown };
}

/**
 * Reads root and immediate app/package manifests, including modules added in the future.
 * @param root Workspace directory containing package.json, apps/, and packages/.
 */
async function readManifests(root: string): Promise<Manifest[]> {
  const paths = [join(root, 'package.json')];
  for (const group of ['apps', 'packages']) {
    const entries = await readdir(join(root, group), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const path = join(root, group, entry.name, 'package.json');
      try {
        await readFile(path, 'utf8');
        paths.push(path);
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      }
    }
  }
  const manifests = [];
  for (const path of paths) {
    manifests.push({ path, data: JSON.parse(await readFile(path, 'utf8')) });
  }
  return manifests;
}

/**
 * Ensures all modules use the same version and the latest changelog entry matches it.
 * @param manifests Parsed workspace manifests and their file paths.
 * @param changelog Current Markdown changelog text.
 */
function checkVersions(manifests: Manifest[], changelog: string) {
  const version = manifests[0].data.version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use a stable major.minor.patch version.');
  for (const { path, data } of manifests) {
    if (data.version !== version)
      throw new Error(`Version mismatch in ${path}; expected ${version}.`);
  }
  const latestEntry = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
  if (latestEntry !== version) throw new Error(`Latest changelog entry must match ${version}.`);
  return version;
}

/**
 * Computes a new semantic version without modifying any files.
 * @param current Current numeric major.minor.patch version.
 * @param bump Requested patch, minor, or major increment.
 */
function nextVersion(current: string, bump: string) {
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error('Usage: pnpm version:next <patch|minor|major> "Change summary"');
}

/** Reads command-line arguments, then checks versions or updates manifests and inserts a dated entry. */
async function main() {
  const manifests = await readManifests(rootDirectory);
  const changelog = await readFile(changelogPath, 'utf8');
  const current = checkVersions(manifests, changelog);
  const [bump, ...summaryParts] = process.argv.slice(2);
  if (bump === '--check') {
    console.log(
      `Workspace versions and changelog agree: ${current} (${manifests.length} manifests).`,
    );
    return;
  }
  const version = nextVersion(current, bump);
  const summary = summaryParts.join(' ').trim();
  if (!summary || /[\r\n]/.test(summary))
    throw new Error('Provide one non-empty, single-line change summary.');
  // Release dates follow the repository owner's timezone rather than the build host's timezone.
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const headingIndex = changelog.search(/^## \[/m);
  const entry = `## [${version}] - ${date}\n\n- ${summary}\n\n`;
  for (const { path, data } of manifests) {
    await writeFile(path, `${JSON.stringify({ ...data, version }, null, 2)}\n`);
  }
  await writeFile(
    changelogPath,
    changelog.slice(0, headingIndex) + entry + changelog.slice(headingIndex),
  );
  console.log(
    `Prepared ${version}. Review CHANGELOG.md, run pnpm check, then commit and tag v${version} when authorized.`,
  );
}

// CLI failures return a nonzero status so checks and automation cannot report a false success.
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
