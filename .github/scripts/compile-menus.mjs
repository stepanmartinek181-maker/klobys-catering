import {readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {resolve, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileIssues} from './menu-parser.mjs';

const REPOSITORY_PATTERN = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/;

export async function getOpenIssues({repository, token, fetchImpl = fetch, maxPages = 100}) {
  if (!REPOSITORY_PATTERN.test(repository || '')) throw new Error('Chybí platný GITHUB_REPOSITORY.');
  if (typeof token !== 'string' || !token.trim()) throw new Error('Chybí GITHUB_TOKEN; použijte tajný token poskytovaný workflow.');
  const issues = [];
  for (let page = 1; page <= maxPages; page++) {
    // Fetch closed records too so an archive operation cannot shift later pages.
    // The parser below publishes only open issues by approved authors.
    const endpoint = `https://api.github.com/repos/${repository}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`;
    const response = await fetchImpl(endpoint, {
      headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10'},
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const suffix = [403, 429].includes(response.status) ? ' Zkontrolujte oprávnění nebo limit GitHub API; dosavadní lístky zůstaly beze změny.' : '';
      throw new Error(`Načtení lístků selhalo (GitHub HTTP ${response.status}).${suffix}`);
    }
    const payload = await response.text();
    if (payload.length > 10000000) throw new Error('Odpověď GitHub API je příliš velká; dosavadní lístky zůstaly beze změny.');
    let entries;
    try { entries = JSON.parse(payload); } catch { throw new Error('GitHub API vrátilo neplatná data; dosavadní lístky zůstaly beze změny.'); }
    if (!Array.isArray(entries) || entries.length > 100 || entries.some(item => !item || !Number.isSafeInteger(item.number) || typeof item.state !== 'string' || !item.user)) {
      throw new Error('GitHub API vrátilo neplatný seznam; dosavadní lístky zůstaly beze změny.');
    }
    issues.push(...entries);
    if (entries.length < 100) return issues;
  }
  throw new Error('Seznam přesáhl bezpečný limit stránkování; dosavadní lístky zůstaly beze změny.');
}

function annotation(value) { return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'); }

async function atomicJson(path, value) {
  const target = resolve(path);
  const temporary = resolve(dirname(target), `.${basename(target)}.${process.pid}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {encoding: 'utf8', flag: 'wx'});
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function compileToFiles({repository, token, configPath = '.github/menu-editors.json', menusPath = 'menus.json', statusPath = 'menus-status.json', eventPath, fetchImpl}) {
  const options = JSON.parse(await readFile(configPath, 'utf8'));
  const allowedUserIds = options.allowedUserIds;
  // Validate configuration before querying the API or touching published files.
  compileIssues([], {allowedUserIds, repository});
  if (eventPath) {
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    if (event.issue && !allowedUserIds.includes(event.sender?.id)) throw new Error('Změnu neprovedl schválený správce; publikace byla odmítnuta.');
  }
  const issues = await getOpenIssues({repository, token, fetchImpl});
  const {menus, warnings} = compileIssues(issues, {allowedUserIds, repository});
  // All pagination and validation finished before the first atomic write.
  await atomicJson(menusPath, menus);
  await atomicJson(statusPath, {warnings});
  for (const warning of warnings) console.warn(`::warning::${annotation(`Jídelní lístek #${warning.issue}: ${warning.message}`)}`);
  console.log(`Připraveno ${menus.length} jídelních lístků; upozornění: ${warnings.length}.`);
  return {menus, warnings};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  compileToFiles({repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN, eventPath: process.env.GITHUB_EVENT_PATH})
    .catch(error => { console.error(`::error::${annotation(error.message)}`); process.exitCode = 1; });
}
