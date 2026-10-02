const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
try {
  if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(repository || '') || !token?.trim()) throw new Error('Chybí repozitář nebo token pro nasazení.');
  const response = await fetch(`https://api.github.com/repos/${repository}/pages/builds`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10'},
  });
  if (response.status !== 201) throw new Error(`Požadavek na GitHub Pages build selhal (HTTP ${response.status}). Lístky jsou v repozitáři; workflow lze znovu spustit.`);
  console.log('GitHub Pages přijal požadavek na nové nasazení lístků.');
} catch (error) {
  console.error(`::error::${error.message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  process.exitCode = 1;
}
