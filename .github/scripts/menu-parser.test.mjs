import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validDate, parseAttachment, parseMenuIssue, compileIssues} from './menu-parser.mjs';
import {getOpenIssues, compileToFiles} from './compile-menus.mjs';

const repository = 'stepanmartinek181-maker/klobys-catering';
const allowedUserIds = [238918077];
const options = {repository, allowedUserIds};
const asset = 'https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789abc';
function body(overrides = {}) {
  const fields = {
    'Název lístku': 'Ukázka pro klienta',
    'Platnost od': '2026-10-02',
    'Platnost do': '2026-10-09',
    'Typ lístku': 'Ukázka — není aktuální nabídka',
    'Nabídka jídel': 'Ukázkové jídlo | cena na vyžádání\nDalší ukázkové jídlo',
    'Soubor lístku': '_No response_',
    'Poznámka': 'Ilustrativní náhled, nikoliv aktuální nabídka.',
    ...overrides,
  };
  return Object.entries(fields).map(([name, value]) => `### ${name}\n\n${value}`).join('\n\n');
}
function issue(overrides = {}) {
  return {number: 5, title: '[Jídelní lístek] Ukázka', body: body(), state: 'open', user: {id: allowedUserIds[0]}, updated_at: '2026-10-02T20:00:00Z', ...overrides};
}
const apiResponse = (entries, status = 200) => new Response(JSON.stringify(entries), {status});

test('Skutečná kalendářní data včetně přestupných roků', () => {
  for (const date of ['2026-10-02', '2024-02-29', '2000-01-01', '2200-12-31']) assert.equal(validDate(date), true);
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '1999-12-31', '2201-01-01', '2026-1-01', '<script>']) assert.equal(validDate(date), false);
});

test('Úplný deterministický kontrakt a jasně označená ukázka', () => {
  const menu = parseMenuIssue(issue(), options);
  assert.deepEqual(menu, {
    id: 'github-5', title: 'Ukázka pro klienta', from: '2026-10-02', to: '2026-10-09',
    notes: 'Ilustrativní náhled, nikoliv aktuální nabídka.',
    items: [{name: 'Ukázkové jídlo', price: 'cena na vyžádání'}, {name: 'Další ukázkové jídlo'}],
    attachment: null, demo: true, active: true,
    issueUrl: `https://github.com/${repository}/issues/5`, updatedAt: '2026-10-02T20:00:00.000Z',
  });
});

test('Skutečná nabídka není označena jako ukázka', () => {
  assert.equal(parseMenuIssue(issue({body: body({'Typ lístku': 'Aktuální nabídka'})}), options).demo, false);
});

test('Cizí autoři, pull requesty, uzavřené a nesouvisející issues nejsou veřejné lístky', () => {
  for (const overrides of [{user: {id: 999}}, {pull_request: {}}, {state: 'closed'}, {title: 'Jiná věc'}]) assert.equal(parseMenuIssue(issue(overrides), options), null);
});

test('Neplatné datum a obrácená platnost jsou odmítnuty', () => {
  assert.throws(() => parseMenuIssue(issue({body: body({'Platnost od': '2026-02-29'})}), options), /skutečná data/);
  assert.throws(() => parseMenuIssue(issue({body: body({'Platnost do': '2026-10-01'})}), options), /nesmí být před/);
});

test('Povinný obsah, typ a názvy mají bezpečné meze', () => {
  for (const fields of [
    {'Název lístku': '_No response_'}, {'Název lístku': 'a'.repeat(121)},
    {'Typ lístku': 'Něco jiného'}, {'Nabídka jídel': '_No response_'},
    {'Nabídka jídel': 'Název | cena | další'}, {'Poznámka': 'x'.repeat(2001)},
    {'Nabídka jídel': Array(61).fill('Jídlo').join('\n')},
  ]) assert.throws(() => parseMenuIssue(issue({body: body(fields)}), options));
});

test('Duplicitní nebo neznámé sekce jsou odmítnuty', () => {
  assert.throws(() => parseMenuIssue(issue({body: `${body()}\n\n### Název lístku\nJiný`}), options), /vícekrát/);
  assert.throws(() => parseMenuIssue(issue({body: `${body()}\n\n### Cizí pole\nText`}), options), /Neznámé pole/);
});

test('Text je uchován jako text, nikoliv vyhodnocen jako HTML nebo kód', () => {
  const text = '<img src=x onerror=alert(1)> ${process.env.GITHUB_TOKEN}';
  const menu = parseMenuIssue(issue({body: body({'Název lístku': text, 'Nabídka jídel': text})}), options);
  assert.equal(menu.title, text);
  assert.equal(menu.items[0].name, text);
});

test('PDF a skutečný GitHub obrázek projdou', () => {
  assert.deepEqual(parseAttachment(`[menu.pdf](${asset})`), {name: 'menu.pdf', type: 'application/pdf', url: asset});
  assert.equal(parseAttachment(`![Image](${asset})`).type, 'image/*');
  assert.equal(parseAttachment(`![menu.png](${asset})`).type, 'image/png');
  assert.equal(parseAttachment('![Image](https://user-images.githubusercontent.com/12345/123-menu.jpg)').type, 'image/jpeg');
  assert.equal(parseMenuIssue(issue({body: body({'Nabídka jídel': '_No response_', 'Soubor lístku': `[menu.pdf](${asset})`})}), options).items.length, 0);
});

test('Přílohy nesmějí používat externí domény, skripty, dotazy, porty ani nebezpečné typy', () => {
  for (const value of [
    '[menu.pdf](javascript:alert)', '[menu.pdf](https://example.org/menu.pdf)',
    '[menu.pdf](https://github.com.evil.org/user-attachments/assets/12345678-1234-1234-1234-123456789abc)',
    `[menu.pdf](${asset}?token=secret)`, `[menu.pdf](${asset}#x)`,
    '[menu.pdf](https://github.com:8443/user-attachments/assets/12345678-1234-1234-1234-123456789abc)',
    `[menu.html](${asset})`, `![menu.svg](${asset})`, `![menu.pdf](${asset})`,
    `[one.pdf](${asset})\n[two.pdf](${asset})`,
  ]) assert.throws(() => parseAttachment(value));
});

test('Skutečné GitHub PDF URLs files/id/name.pdf a bezpečně kódované české názvy projdou', () => {
  const pdf = 'https://github.com/user-attachments/files/17843233/menu-demo.pdf';
  assert.deepEqual(parseAttachment(`[menu-demo.pdf](${pdf})`), {name: 'menu-demo.pdf', type: 'application/pdf', url: pdf});
  const czech = 'https://github.com/user-attachments/files/123/J%C3%ADdeln%C3%AD%20l%C3%ADstek.pdf';
  assert.equal(parseAttachment(`[Jídelní lístek](${czech})`).type, 'application/pdf');
  assert.equal(parseAttachment('![Nabídka](https://github.com/user-attachments/files/123/nabidka.png)').type, 'image/png');
});

test('Samotná URL z upload pole má bezpečný název odvozený z cesty', () => {
  const pdf = 'https://github.com/user-attachments/files/123/menu.pdf';
  assert.deepEqual(parseAttachment(pdf), {name: 'menu.pdf', type: 'application/pdf', url: pdf});
  assert.throws(() => parseAttachment('https://example.org/menu.pdf'));
  assert.throws(() => parseAttachment(asset), /Název souboru/);
});

test('Files URLs nesmějí ukrývat traversal, backslash, dvojité kódování nebo cizí typ', () => {
  for (const suffix of ['..%2Fmenu.pdf', 'menu%2Fother.pdf', 'menu%5Cother.pdf', 'menu%252Fother.pdf', 'menu%00.pdf', '.hidden.pdf', 'menu.html', 'menu.svg', 'menu%ZZ.pdf']) {
    assert.throws(() => parseAttachment(`[menu.pdf](https://github.com/user-attachments/files/123/${suffix})`));
  }
  assert.throws(() => parseAttachment('[menu.png](https://github.com/user-attachments/files/123/menu.pdf)'), /neshoduje/);
  assert.throws(() => parseAttachment('[menu.pdf](https://github.com/user-attachments/files/0/menu.pdf)'));
  assert.throws(() => parseAttachment('[menu.pdf](https://github.com/user-attachments/files/123/menu.pdf?raw=1)'));
});

test('Kompilace je stabilní, deduplikuje a zpřístupní varování ke špatnému lístku', () => {
  const entries = [issue({number: 10}), issue({number: 2}), issue({number: 2}), issue({number: 8, body: body({'Platnost od': '2026-04-31'})}), issue({number: 20, user: {id: 2}})];
  const result = compileIssues(entries, options);
  assert.deepEqual(result.menus.map(menu => menu.id), ['github-2', 'github-10']);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].issue, 8);
  assert.deepEqual(compileIssues([...entries].reverse(), options), result);
});

test('Více než 100 issues načte všechny stránky bez veřejného API ve stránce', async () => {
  const requests = [];
  const issues = await getOpenIssues({repository, token: 'test-only-token', fetchImpl: async (url, init) => {
    requests.push(url);
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Bearer test-only-token');
    return apiResponse(url.endsWith('page=1') ? Array.from({length: 100}, (_, i) => issue({number: i + 1})) : [issue({number: 101})]);
  }});
  assert.equal(issues.length, 101);
  assert.equal(requests.length, 2);
});

test('Selhání poslední stránky nepovažuje neúplný seznam za platný', async () => {
  await assert.rejects(getOpenIssues({repository, token: 'test-only-token', fetchImpl: async url => apiResponse(url.endsWith('page=1') ? Array.from({length: 100}, (_, i) => issue({number: i + 1})) : {}, url.endsWith('page=1') ? 200 : 429)}), /HTTP 429/);
});

test('Neplatná API odpověď a překročení stránkování jsou odmítnuty', async () => {
  await assert.rejects(getOpenIssues({repository, token: 'test-only-token', fetchImpl: async () => apiResponse({})}), /neplatný seznam/);
  await assert.rejects(getOpenIssues({repository, token: 'test-only-token', maxPages: 1, fetchImpl: async () => apiResponse(Array.from({length: 100}, (_, i) => issue({number: i + 1})))}), /limit stránkování/);
});

test('API chyba i neschválený aktér zachovají předchozí veřejná data', async () => {
  const temporary = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.test-'));
  try {
    const configPath = join(temporary, 'editors.json');
    const menusPath = join(temporary, 'menus.json');
    const statusPath = join(temporary, 'status.json');
    const eventPath = join(temporary, 'event.json');
    await writeFile(configPath, JSON.stringify({allowedUserIds}));
    await writeFile(menusPath, '["existing-menu"]\n');
    await writeFile(statusPath, '{"warnings":[]}\n');
    const parameters = {repository, token: 'test-only-token', configPath, menusPath, statusPath};
    await assert.rejects(compileToFiles({...parameters, fetchImpl: async () => apiResponse({}, 403)}), /HTTP 403/);
    assert.equal(await readFile(menusPath, 'utf8'), '["existing-menu"]\n');
    await writeFile(eventPath, JSON.stringify({issue: {number: 1}, sender: {id: 99}}));
    await assert.rejects(compileToFiles({...parameters, eventPath, fetchImpl: async () => assert.fail('Cizí aktér nesmí volat API')}), /schválený správce/);
    assert.equal(await readFile(menusPath, 'utf8'), '["existing-menu"]\n');
    await compileToFiles({...parameters, fetchImpl: async () => apiResponse([issue()])});
    assert.equal(JSON.parse(await readFile(menusPath, 'utf8'))[0].demo, true);
    assert.deepEqual(JSON.parse(await readFile(statusPath, 'utf8')), {warnings: []});
  } finally {
    await rm(temporary, {recursive: true});
  }
});
