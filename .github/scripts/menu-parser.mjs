const TITLE_PREFIX = '[Jídelní lístek]';
const FIELD_NAMES = ['Název lístku', 'Platnost od', 'Platnost do', 'Typ lístku', 'Nabídka jídel', 'Soubor lístku', 'Poznámka'];
const MAX_BODY = 20000;

export class MenuValidationError extends Error {}

function reject(message) { throw new MenuValidationError(message); }

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 2000 || year > 2200) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function text(value, label, limit, required = false) {
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  const empty = !normalized || normalized === '_No response_' || normalized === 'No response';
  if (empty) {
    if (required) reject(`Chybí pole „${label}“.`);
    return '';
  }
  if (normalized.length > limit) reject(`Pole „${label}“ je příliš dlouhé (maximum ${limit} znaků).`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) reject(`Pole „${label}“ obsahuje nepovolené řídicí znaky.`);
  return normalized;
}

export function parseSections(body) {
  if (typeof body !== 'string' || body.length > MAX_BODY) reject('Popis lístku chybí nebo je příliš dlouhý.');
  const sections = new Map();
  let field = null;
  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^### (.+?)\s*$/.exec(line);
    if (heading) {
      field = heading[1];
      if (sections.has(field)) reject(`Pole „${field}“ se vyskytuje vícekrát.`);
      sections.set(field, []);
    } else if (field) {
      sections.get(field).push(line);
    }
  }
  for (const name of sections.keys()) {
    if (!FIELD_NAMES.includes(name)) reject(`Neznámé pole „${name}“; použijte formulář pro jídelní lístek.`);
  }
  return Object.fromEntries([...sections].map(([name, lines]) => [name, lines.join('\n')]));
}

function fileType(name) {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase();
  return ({pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp'})[extension] ?? null;
}

export function parseAttachment(input) {
  const value = text(input || '', 'Soubor lístku', 1800);
  if (!value) return null;
  // GitHub emits a Markdown link (or image link) after a native attachment upload.
  const markdown = /^!?\[([^\]\n]{1,180})\]\((https:\/\/[^\s()]+)\)$/.exec(value);
  const link = markdown || (/^https:\/\/[^\s()]+$/.test(value) ? [value, '', value] : null);
  if (!link) reject('Nahrajte právě jeden PDF nebo obrázek přímo do pole „Soubor lístku“.');
  let url;
  try { url = new URL(link[2]); } catch { reject('Odkaz přílohy není platný.'); }
  const asset = url.hostname === 'github.com' && /^\/user-attachments\/assets\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(url.pathname);
  const image = url.hostname === 'user-images.githubusercontent.com' && /^\/\d+\/[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i.test(url.pathname);
  const filePath = url.hostname === 'github.com' && /^\/user-attachments\/files\/[1-9]\d*\/([^/]+)$/.exec(url.pathname);
  let uploadedFilename = null;
  if (filePath) {
    try { uploadedFilename = decodeURIComponent(filePath[1]); } catch { reject('Název přílohy v odkazu není platný.'); }
    // One filename segment, not an encoded path; admit ordinary Czech filenames.
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _().-]{0,179}\.(pdf|png|jpe?g|webp)$/iu.test(uploadedFilename)) reject('Odkaz přílohy obsahuje nepovolený název nebo typ souboru.');
  }
  if ((!asset && !image && !uploadedFilename) || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    reject('Příloha musí být přímo nahraná na GitHub; externí odkazy nejsou povolené.');
  }
  const inferredName = uploadedFilename || (image ? url.pathname.split('/').at(-1) : '');
  const name = text(link[1] || inferredName, 'Název souboru', 180, true);
  if (/\.[a-z0-9]+$/i.test(name) && !fileType(name)) reject('Tento typ přílohy není povolený; použijte PDF, PNG, JPG nebo WebP.');
  const nameType = fileType(name);
  const uploadedType = uploadedFilename ? fileType(uploadedFilename) : null;
  if (nameType && uploadedType && nameType !== uploadedType) reject('Typ souboru v názvu a odkazu přílohy se neshoduje.');
  const type = uploadedType || nameType || (image ? fileType(url.pathname) : null) || (value.startsWith('![') ? 'image/*' : null);
  if (!type) reject('Příloha musí mít příponu .pdf, .png, .jpg, .jpeg nebo .webp.');
  if ((image || value.startsWith('![')) && type === 'application/pdf') reject('Obrázkový odkaz nemůže být vydáván za PDF.');
  return {name, type, url: url.href};
}

export function parseItems(input) {
  const value = text(input || '', 'Nabídka jídel', 10000);
  if (!value) return [];
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length > 60) reject('Lístek může obsahovat nejvýše 60 položek.');
  return lines.map(line => {
    const parts = line.replace(/^[-*]\s+/, '').split('|');
    if (parts.length > 2) reject('U každého jídla oddělte pouze název a nepovinnou cenu jedním znakem |.');
    const name = text(parts[0], 'Název jídla', 220, true);
    const price = text(parts[1] || '', 'Cena', 60);
    return price ? {name, price} : {name};
  });
}

export function parseMenuIssue(issue, {allowedUserIds, repository}) {
  if (!issue || issue.pull_request || issue.state !== 'open' || !String(issue.title || '').startsWith(TITLE_PREFIX)) return null;
  if (!allowedUserIds.includes(issue.user?.id)) return null;
  if (!Number.isSafeInteger(issue.number) || issue.number < 1) reject('Číslo lístku není platné.');
  const fields = parseSections(issue.body);
  const title = text(fields['Název lístku'] || '', 'Název lístku', 120, true);
  const from = text(fields['Platnost od'] || '', 'Platnost od', 10, true);
  const to = text(fields['Platnost do'] || '', 'Platnost do', 10, true);
  if (!validDate(from) || !validDate(to)) reject('Platnost musí obsahovat skutečná data ve formátu RRRR-MM-DD (roky 2000–2200).');
  if (from > to) reject('Datum „Platnost do“ nesmí být před „Platnost od“.');
  const kind = text(fields['Typ lístku'] || '', 'Typ lístku', 80, true);
  if (!['Aktuální nabídka', 'Ukázka — není aktuální nabídka'].includes(kind)) reject('Vyberte platný typ lístku.');
  const notes = text(fields['Poznámka'] || '', 'Poznámka', 2000);
  const items = parseItems(fields['Nabídka jídel']);
  const attachment = parseAttachment(fields['Soubor lístku']);
  if (!items.length && !attachment) reject('Doplňte alespoň jedno jídlo nebo nahrajte soubor lístku.');
  if (typeof issue.updated_at !== 'string' || !Number.isFinite(Date.parse(issue.updated_at))) reject('Datum aktualizace lístku není platné.');
  return {
    id: `github-${issue.number}`, title, from, to, notes, items, attachment,
    demo: kind !== 'Aktuální nabídka', active: true,
    issueUrl: `https://github.com/${repository}/issues/${issue.number}`,
    updatedAt: new Date(issue.updated_at).toISOString(),
  };
}

export function compileIssues(issues, options) {
  if (!Array.isArray(issues)) throw new TypeError('Seznam lístků musí být pole.');
  if (!Array.isArray(options?.allowedUserIds) || !options.allowedUserIds.length || options.allowedUserIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
    throw new TypeError('Chybí platný seznam schválených správců.');
  }
  if (!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(options.repository)) throw new TypeError('Neplatný repozitář.');
  const menus = [];
  const warnings = [];
  const seen = new Set();
  for (const issue of issues) {
    if (seen.has(issue?.number)) continue;
    seen.add(issue?.number);
    try {
      const menu = parseMenuIssue(issue, options);
      if (menu) menus.push(menu);
    } catch (error) {
      if (!(error instanceof MenuValidationError)) throw error;
      warnings.push({issue: issue.number, message: error.message, issueUrl: `https://github.com/${options.repository}/issues/${issue.number}`});
    }
  }
  menus.sort((a, b) => (a.from === b.from ? Number(a.id.slice(7)) - Number(b.id.slice(7)) : a.from > b.from ? -1 : 1));
  warnings.sort((a, b) => a.issue - b.issue);
  return {menus, warnings};
}
