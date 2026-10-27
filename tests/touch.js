'use strict';
/* Pixel 7 landscape, touch, served under /Shardwild/. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const {chromium, devices} = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ART = '/opt/cursor/artifacts';
const PORT = 4173;

function serve() {
  return http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/Shardwild') u = '/Shardwild/';
    if (u === '/Shardwild/') u = '/Shardwild/index.html';
    if (!u.startsWith('/Shardwild/')) { res.statusCode = 404; res.end('not found'); return; }
    const rel = u.slice('/Shardwild/'.length);
    const fp = path.normalize(path.join(ROOT, rel));
    if (!fp.startsWith(ROOT)) { res.statusCode = 403; res.end('no'); return; }
    fs.readFile(fp, (err, data) => {
      if (err) { res.statusCode = 404; res.end('missing'); return; }
      const ext = path.extname(fp);
      const types = {'.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png'};
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
      res.end(data);
    });
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function frames(page, n) {
  await page.evaluate(count => new Promise(resolve => {
    let i = 0;
    const step = () => { if (++i >= count) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), n);
}

async function nudge(cdp, page, x, y, dx, dy) {
  const pt = (px, py) => ({x: px, y: py, id: 1, radiusX: 2, radiusY: 2, force: 1});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [pt(x, y)]});
  try {
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [pt(x + dx, y + dy)]});
      await page.waitForTimeout(40);
    }
  } finally {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
}

async function walkTo(page, cdp, tx, ty, until, steps) {
  let last = null, stuck = 0;
  for (let n = 0; n < steps; n++) {
    if (await page.evaluate(until)) return;
    const pos = await page.evaluate(() => {
      const P = window.__shardwild.P, m = window.__shardwild.layout.move;
      return {x: P.x, y: P.y, mx: m.x, my: m.y};
    });
    let dx = tx - pos.x, dy = ty - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    let sx = dx / len * 58, sy = dy / len * 58;
    if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < 2) stuck++;
    else stuck = 0;
    last = {x: pos.x, y: pos.y};
    if (stuck) { const px = -sy, py = sx; sx = px * (stuck % 2 ? 1 : -1); sy = py * (stuck % 2 ? 1 : -1); }
    await nudge(cdp, page, pos.mx, pos.my, sx, sy);
  }
  if (!(await page.evaluate(until))) {
    const pos = await page.evaluate(() => ({x: window.__shardwild.P.x, y: window.__shardwild.P.y, hub: window.__shardwild.world.isHub, chest: window.__shardwild.chestOpen}));
    throw new Error('walk failed toward ' + tx + ',' + ty + ' at ' + JSON.stringify(pos));
  }
}

async function drag(cdp, page, x1, y1, x2, y2) {
  const pt = (x, y) => ({x: Math.round(x), y: Math.round(y), id: 1, radiusX: 2, radiusY: 2, force: 1});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [pt(x1, y1)]});
  await page.waitForTimeout(40);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [pt(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps)]
    });
    await page.waitForTimeout(28);
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await frames(page, 3);
}

async function longPress(cdp, page, x, y) {
  const pt = (x, y) => ({x: Math.round(x), y: Math.round(y), id: 1, radiusX: 2, radiusY: 2, force: 1});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [pt(x, y)]});
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await frames(page, 3);
}

async function tapAt(cdp, page, x, y) {
  const pt = (x, y) => ({x: Math.round(x), y: Math.round(y), id: 1, radiusX: 2, radiusY: 2, force: 1});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [pt(x, y)]});
  await page.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await frames(page, 3);
}

async function tapTag(page, pred) {
  const ui = await page.evaluate(() => window.__shardwild.ui);
  const r = ui.find(pred);
  if (!r) throw new Error('no ui match among ' + ui.map(x => x.tag).filter(Boolean).join(','));
  await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
  await frames(page, 2);
  return r;
}

function audioOf(page) {
  return page.evaluate(() => window.__shardwild.audio);
}

async function fireBurst(page, cdp) {
  const aim = await page.evaluate(() => window.__shardwild.layout.aim);
  await nudge(cdp, page, aim.x, aim.y, 46, -8);
  await frames(page, 4);
}

async function chestNames(page) {
  return page.evaluate(() => window.__shardwild.slots.filter(s => s.area === 'chest').map(s => s.name));
}

async function openChestTab(page, tab) {
  await tapTag(page, r => r.tag === 'chest-tab' && r.tab === tab);
  for (let i = 0; i < 8; i++) {
    const names = await chestNames(page);
    if (names[0] && names[0].indexOf('Splintered') === 0) return;
    await tapTag(page, r => r.tag === 'chest-prev');
  }
}

async function findChest(page, includes) {
  for (let i = 0; i < 16; i++) {
    const names = await chestNames(page);
    if (includes.every(w => names.some(n => n && n.indexOf(w) >= 0))) return names;
    await tapTag(page, r => r.tag === 'chest-next');
  }
  throw new Error('chest missing ' + includes.join(', '));
}

async function charactersVaultWeapons(page, cdp) {
  await tapTag(page, r => r.tag === 'char-select');
  await page.waitForFunction(() => window.__shardwild.state === 'title');
  await frames(page, 3);
  const selectButtons = await page.evaluate(() => window.__shardwild.ui.filter(r => r.tag === 'char-play' || r.tag === 'char-new' || r.tag === 'char-delete' || r.tag === 'char-continue'));
  assert(selectButtons.length >= 4, 'character select buttons missing');
  for (const b of selectButtons) assert(b.w >= 44 && b.h >= 40, 'character button too small ' + JSON.stringify(b));
  await tapTag(page, r => r.tag === 'char-new');
  await frames(page, 2);
  await tapTag(page, r => r.tag === 'class-pick' && r.tab === 'strider');
  await page.waitForFunction(() => window.__shardwild.state === 'play' && window.__shardwild.P.cls === 'strider');
  await frames(page, 4);
  assert(await page.evaluate(() => window.__shardwild.place === 'haven'), 'new hero did not start in the Haven');
  await page.evaluate(() => window.__shardwild.clearInv());
  const chest = await page.evaluate(() => window.__shardwild.world.chest);
  await walkTo(page, cdp, chest.x, chest.y, () => window.__shardwild.chestOpen, 18);
  await tapTag(page, r => r.tag === 'chest-tab' && r.tab === 'pots');
  let wind = null;
  for (let i = 0; i < 6 && !wind; i++) {
    wind = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'chest' && s.name === 'Elixir of Wind'));
    if (!wind) await tapTag(page, r => r.tag === 'chest-next');
  }
  assert(wind, 'Elixir of Wind missing from the test chest');
  await page.touchscreen.tap(wind.x + wind.w / 2, wind.y + wind.h / 2);
  await frames(page, 3);
  assert(await page.evaluate(() => window.__shardwild.P.inv.some(it => it && it.name === 'Elixir of Wind')), 'strider did not take Elixir of Wind');

  await tapTag(page, r => r.tag === 'char-select');
  await page.waitForFunction(() => window.__shardwild.state === 'title');
  await frames(page, 4);
  const roster = await page.evaluate(() => window.__shardwild.chars);
  assert(roster.filter(Boolean).length === 2, 'expected 2 heroes ' + JSON.stringify(roster));
  assert(roster[0].cls === 'pyro' && roster[1].cls === 'strider', 'hero order ' + JSON.stringify(roster));
  assert(roster[1].inv.indexOf('Elixir of Wind') >= 0, 'strider inventory was not saved ' + JSON.stringify(roster[1]));
  assert(roster[0].inv.indexOf('Elixir of Wind') < 0, 'pyro inventory picked up the strider elixir ' + JSON.stringify(roster[0]));
  const sprites = await page.evaluate(() => {
    const c = document.getElementById('game');
    const g = c.getContext('2d', {alpha: false});
    const dpr = c.width / window.innerWidth;
    return window.__shardwild.ui.filter(r => r.tag === 'char-play').map(r => {
      const x = Math.floor((r.x + 8) * dpr);
      const y = Math.floor((r.y - 108) * dpr);
      const w = Math.max(4, Math.floor((r.w - 16) * dpr));
      const h = Math.floor(96 * dpr);
      const img = g.getImageData(Math.max(0, x), Math.max(0, y), w, h).data;
      let n = 0;
      for (let i = 0; i < img.length; i += 4) if (img[i] + img[i + 1] + img[i + 2] > 140) n++;
      return n;
    });
  });
  assert(sprites.length === 2 && sprites.every(n => n > 12), 'hero sprites missing on character select ' + JSON.stringify(sprites));
  await page.screenshot({path: path.join(ART, 'screenshot_character_select.png')});

  await tapTag(page, r => r.tag === 'char-play' && r.slot === 0);
  await page.waitForFunction(() => window.__shardwild.state === 'play' && window.__shardwild.P.cls === 'pyro');
  await frames(page, 3);
  const pyroInv = await page.evaluate(() => window.__shardwild.P.inv.map(it => it && it.name));
  assert(pyroInv.indexOf('Elixir of Wind') < 0, 'switching to pyro showed the strider elixir ' + JSON.stringify(pyroInv));
  await page.evaluate(() => window.__shardwild.clearInv());
  const pyroChest = await page.evaluate(() => window.__shardwild.world.chest);
  await walkTo(page, cdp, pyroChest.x, pyroChest.y, () => window.__shardwild.chestOpen, 18);
  await openChestTab(page, 'strider');
  const bow = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'chest' && s.name === 'Splintered Bow'));
  assert(bow, 'Splintered Bow missing from the strider tab');
  await page.touchscreen.tap(bow.x + bow.w / 2, bow.y + bow.h / 2);
  await frames(page, 3);
  assert(await page.evaluate(() => window.__shardwild.P.inv.some(it => it && it.name === 'Splintered Bow') && !(window.__shardwild.P.eq.weapon && window.__shardwild.P.eq.weapon.name === 'Splintered Bow')), 'pyro should hold the bow in the backpack');

  await walkTo(page, cdp, pyroChest.x + 40, pyroChest.y, () => !window.__shardwild.chestOpen, 12);
  const vaultDoor = await page.evaluate(() => window.__shardwild.world.vault);
  assert(vaultDoor, 'Haven is missing the vault portal');
  await walkTo(page, cdp, vaultDoor.x, vaultDoor.y, () => window.__shardwild.place === 'vault', 24);
  await frames(page, 3);
  assert(await page.evaluate(() => window.__shardwild.place === 'vault' && window.__shardwild.foes.length === 0), 'vault should be empty of enemies');
  const vchest = await page.evaluate(() => window.__shardwild.world.chests[0]);
  await walkTo(page, cdp, vchest.x, vchest.y, () => window.__shardwild.vaultOpen === 0, 16);
  const bowSlot = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'inv' && s.name === 'Splintered Bow'));
  assert(bowSlot, 'bow left the backpack before the vault opened');
  await page.touchscreen.tap(bowSlot.x + bowSlot.w / 2, bowSlot.y + bowSlot.h / 2);
  await frames(page, 4);
  const stored = await page.evaluate(() => ({
    vault: window.__shardwild.vaultItems,
    inv: window.__shardwild.P.inv.map(it => it && it.name),
    open: window.__shardwild.vaultOpen
  }));
  assert(stored.open === 0, 'vault chest closed after storing');
  assert(stored.vault[0].indexOf('Splintered Bow') >= 0, 'vault did not keep the bow ' + JSON.stringify(stored.vault));
  assert(stored.inv.indexOf('Splintered Bow') < 0, 'bow stayed in the backpack ' + JSON.stringify(stored.inv));
  const vaultSlots = await page.evaluate(() => window.__shardwild.slots.filter(s => s.area === 'vault').length);
  assert(vaultSlots === 8, 'vault chest should show 8 slots, got ' + vaultSlots);
  await page.screenshot({path: path.join(ART, 'screenshot_vault_chest.png')});

  const exit = await page.evaluate(() => window.__shardwild.world.portal);
  await walkTo(page, cdp, exit.x, exit.y, () => window.__shardwild.place === 'haven', 18);
  assert(await page.evaluate(() => window.__shardwild.place === 'haven' && !!window.__shardwild.world.chest), 'exit portal did not return to the Haven');

  await tapTag(page, r => r.tag === 'char-select');
  await page.waitForFunction(() => window.__shardwild.state === 'title');
  await tapTag(page, r => r.tag === 'char-play' && r.slot === 1);
  await page.waitForFunction(() => window.__shardwild.state === 'play' && window.__shardwild.P.cls === 'strider');
  await frames(page, 3);
  const striderAfter = await page.evaluate(() => ({
    inv: window.__shardwild.P.inv.map(it => it && it.name),
    wind: window.__shardwild.chars[1].inv.indexOf('Elixir of Wind') >= 0
  }));
  assert(striderAfter.inv.indexOf('Splintered Bow') < 0, 'strider received pyro backpack item ' + JSON.stringify(striderAfter));
  assert(striderAfter.inv.indexOf('Elixir of Wind') >= 0 || striderAfter.wind, 'strider lost their own elixir');
  const door = await page.evaluate(() => window.__shardwild.world.vault);
  await walkTo(page, cdp, door.x, door.y, () => window.__shardwild.place === 'vault', 24);
  const again = await page.evaluate(() => window.__shardwild.world.chests[0]);
  await walkTo(page, cdp, again.x, again.y, () => window.__shardwild.vaultOpen === 0, 16);
  const shared = await page.evaluate(() => window.__shardwild.vaultItems[0]);
  assert(shared.indexOf('Splintered Bow') >= 0, 'vault item did not survive a hero switch ' + JSON.stringify(shared));
  await walkTo(page, cdp, (await page.evaluate(() => window.__shardwild.world.portal)).x, (await page.evaluate(() => window.__shardwild.world.portal)).y, () => window.__shardwild.place === 'haven', 18);

  const testChest = await page.evaluate(() => window.__shardwild.world.chest);
  await walkTo(page, cdp, testChest.x, testChest.y, () => window.__shardwild.chestOpen, 18);
  await tapTag(page, r => r.tag === 'chest-tab' && r.tab === 'test');
  await frames(page, 3);
  const testNames = await chestNames(page);
  assert(testNames.indexOf('Godslayer Staff') >= 0 && testNames.indexOf('Godslayer Bow') >= 0 && testNames.indexOf('Godslayer Blade') >= 0, 'test tab ' + testNames.join(','));
  const dim = await page.evaluate(() => window.__shardwild.slots.filter(s => s.area === 'chest').map(s => s.name + ':' + (s.dim ? 'dim' : 'ok')));
  assert(dim.some(s => s.indexOf('Godslayer Bow:ok') === 0), 'strider should be able to use the bow ' + dim.join(','));
  assert(dim.some(s => s.indexOf('Godslayer Staff:dim') === 0) && dim.some(s => s.indexOf('Godslayer Blade:dim') === 0), 'off-class godslayers should be dimmed ' + dim.join(','));
  await page.screenshot({path: path.join(ART, 'screenshot_test_weapons.png')});
  await page.evaluate(() => window.__shardwild.clearInv());
  const god = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'chest' && s.name === 'Godslayer Bow'));
  assert(god, 'Godslayer Bow slot missing');
  await page.touchscreen.tap(god.x + god.w / 2, god.y + god.h / 2);
  await frames(page, 3);
  const armed = await page.evaluate(() => {
    const w = window.__shardwild.P.eq.weapon;
    return {name: w && w.name, shot: w && w.shot, lethal: !!(w && w.lethal), tier: w && w.tier};
  });
  assert(armed.name === 'Godslayer Bow' && armed.shot === 'star' && armed.lethal && armed.tier === 9, 'godslayer equip ' + JSON.stringify(armed));
  await walkTo(page, cdp, testChest.x + 36, testChest.y, () => !window.__shardwild.chestOpen, 12);
  // The chest sits beside the Haven beacon and a pillar. A shot from there is shoved off the beacon or dies on the pillar, so step into an open lane first.
  await page.evaluate(() => window.__shardwild.teleport(32, 72));
  await frames(page, 2);
  const beforeKills = await page.evaluate(() => window.__shardwild.P.kills);
  const foe = await page.evaluate(() => window.__shardwild.spawnFoe('colossus'));
  assert(foe && foe.max >= 3000, 'high-HP foe was not spawned ' + JSON.stringify(foe));
  await page.evaluate(() => { window.__shardwild.P.fireCd = 0; });
  await fireBurst(page, cdp);
  let after = null;
  for (let i = 0; i < 24; i++) {
    after = await page.evaluate(() => ({
      foes: window.__shardwild.foes,
      kills: window.__shardwild.P.kills,
      shots: window.__shardwild.projectiles.filter(s => s.shape === 'star').length
    }));
    if (!after.foes.some(e => e.name.indexOf('Colossus') >= 0)) break;
    await frames(page, 2);
  }
  assert(!after.foes.some(e => e.name.indexOf('Colossus') >= 0), 'colossus survived a godslayer hit ' + JSON.stringify(after));
  assert(after.kills === beforeKills + 1, 'expected a single killing blow, kills ' + beforeKills + ' -> ' + after.kills);

  await tapTag(page, r => r.tag === 'char-select');
  await page.waitForFunction(() => window.__shardwild.state === 'title');
  await tapTag(page, r => r.tag === 'char-new');
  await tapTag(page, r => r.tag === 'class-pick' && r.tab === 'bulwark');
  await page.waitForFunction(() => window.__shardwild.P && window.__shardwild.P.cls === 'bulwark');
  await tapTag(page, r => r.tag === 'char-select');
  await page.waitForFunction(() => window.__shardwild.state === 'title');
  await tapTag(page, r => r.tag === 'char-delete' && r.slot === 2);
  await frames(page, 2);
  const confirm = await page.evaluate(() => window.__shardwild.ui.filter(r => r.tag === 'char-confirm' || r.tag === 'char-cancel'));
  assert(confirm.length === 2 && confirm.every(b => b.w >= 44 && b.h >= 40), 'confirm buttons ' + JSON.stringify(confirm));
  await tapTag(page, r => r.tag === 'char-cancel');
  await frames(page, 2);
  assert(await page.evaluate(() => window.__shardwild.chars[2] && window.__shardwild.chars[2].cls === 'bulwark'), 'cancel deleted the hero');
  await tapTag(page, r => r.tag === 'char-delete' && r.slot === 2);
  await tapTag(page, r => r.tag === 'char-confirm');
  await frames(page, 3);
  const afterDelete = await page.evaluate(() => window.__shardwild.chars);
  assert(!afterDelete[2], 'bulwark was not deleted ' + JSON.stringify(afterDelete));
  assert(afterDelete[0] && afterDelete[0].cls === 'pyro' && afterDelete[1] && afterDelete[1].cls === 'strider', 'delete removed another hero ' + JSON.stringify(afterDelete));

  await page.evaluate(() => {
    localStorage.removeItem('shardwild_chars_v1');
    localStorage.setItem('shardwild_save_v1', JSON.stringify({
      cls: 'bulwark', lvl: 7, xp: 4, xpTotal: 40,
      stats: {hp: 220, mp: 80, att: 14, def: 8, spd: 11, dex: 11, vit: 15, wis: 8},
      eq: {}, inv: [null, null, null, null, null, null, null, null],
      beacons: ['haven'], seen: [], explored: {}, hpPots: 1, mpPots: 1
    }));
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__shardwild && window.__shardwild.state === 'title');
  const migrated = await page.evaluate(() => {
    const chars = window.__shardwild.chars;
    const raw = JSON.parse(localStorage.getItem('shardwild_chars_v1') || 'null');
    return {chars, slot: raw && raw.slots && raw.slots[0] && raw.slots[0].lvl};
  });
  assert(migrated.chars[0] && migrated.chars[0].cls === 'bulwark' && migrated.chars[0].lvl === 7, 'old save was not migrated into slot 1 ' + JSON.stringify(migrated));
  assert(migrated.slot === 7, 'roster did not persist the migrated hero');
}

async function main() {
  fs.mkdirSync(ART, {recursive: true});
  const errors = [];
  const server = serve();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const pixel = devices['Pixel 7'];
  const browser = await chromium.launch({args: ['--no-sandbox']});
  const context = await browser.newContext({
    ...pixel,
    viewport: {width: 915, height: 412},
    screen: {width: 915, height: 412},
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  const cdp = await context.newCDPSession(page);
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/Shardwild/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__shardwild && window.__shardwild.state === 'title' && !window.__shardwild.layout.portrait);
    const size = await page.evaluate(() => ({w: window.innerWidth, h: window.innerHeight, touch: navigator.maxTouchPoints}));
    assert(size.w > size.h, 'expected landscape, got ' + JSON.stringify(size));
    assert(size.touch > 0, 'expected touch, got ' + JSON.stringify(size));

    const sprErr = await page.evaluate(() => {
      const kinds = ['staff','bow','sword','codex','quiver','seal','robe','leather','heavy','ring'];
      for (const k of kinds) {
        const infos = [];
        for (let t = 0; t <= 8; t++) infos.push(window.__shardwild.spriteInfo(k, t));
        for (const t of [0, 1, 2]) if (infos[t].hot > 100) return k + ' T' + t + ' too vivid hot=' + infos[t].hot;
        for (const t of [6, 7, 8]) if (infos[t].hot < 160) return k + ' T' + t + ' not vivid hot=' + infos[t].hot + ' ' + infos[t].name;
        if (!(infos[6].n > infos[0].n && infos[7].n > infos[0].n)) return k + ' high tier is not more detailed';
        const masks = [0, 4, 7, 8].map(t => infos[t].mask);
        if (new Set(masks).size !== 4) return k + ' T0/T4/T7/UT silhouettes are not distinct';
        if (infos[0].avg === infos[1].avg || infos[1].avg === infos[2].avg) return k + ' low tiers share a palette';
        if (infos[3].avg === infos[4].avg || infos[4].avg === infos[5].avg) return k + ' mid tiers share a palette';
        if (infos[6].avg === infos[7].avg) return k + ' high tiers share a palette';
        if (k === 'staff' || k === 'bow' || k === 'sword') {
          const cols = [0, 4, 7, 8].map(t => infos[t].col);
          if (new Set(cols).size !== 4) return k + ' projectile colors ' + cols.join(',');
          if (infos[0].shot !== 'dot' || infos[8].shot === 'dot') return k + ' shot shape ' + infos[8].shot;
        }
      }
      const shots = ['staff','bow','sword'].map(k => window.__shardwild.spriteInfo(k, 8).shot);
      if (new Set(shots).size !== 3) return 'UT projectiles are not distinct ' + shots.join(',');
      return '';
    });
    assert(!sprErr, sprErr);

    const beforeTap = await audioOf(page);
    assert(!beforeTap.unlocked && beforeTap.state === 'none', 'audio started before a tap ' + JSON.stringify(beforeTap));
    assert(beforeTap.sfx === true && beforeTap.music === true, 'audio defaults ' + JSON.stringify(beforeTap));
    assert(beforeTap.played === 0 && beforeTap.notes === 0, 'audio played before unlock');

    const cards = await page.evaluate(() => window.__shardwild.ui.filter(r => r.kind === 'button' && r.h > 60).sort((a, b) => a.x - b.x));
    assert(cards.length >= 3, 'class cards missing');
    await page.touchscreen.tap(cards[0].x + cards[0].w / 2, cards[0].y + cards[0].h / 2);
    await page.waitForFunction(() => window.__shardwild.state === 'play');
    await frames(page, 6);
    let heard = await audioOf(page);
    assert(heard.unlocked && heard.state === 'running', 'audio context after tap ' + JSON.stringify(heard));
    const hud = await page.evaluate(() => window.__shardwild.ui);
    const mm = hud.find(r => r.tag === 'minimap');
    const au = hud.find(r => r.tag === 'audio');
    const panel = await page.evaluate(() => window.__shardwild.layout.panel);
    assert(au, 'speaker button missing');
    assert(au.y >= mm.y + mm.h - 4 && au.y <= mm.y + mm.h + 28, 'speaker not under minimap ' + JSON.stringify({au, mm}));
    assert(au.x + au.w / 2 >= mm.x && au.x + au.w / 2 <= mm.x + mm.w, 'speaker not aligned with minimap');
    assert(au.x + au.w < panel.x, 'speaker overlaps the inventory panel');

    await page.waitForTimeout(450);
    heard = await audioOf(page);
    assert(heard.notes > 0, 'haven music did not start');
    const played0 = heard.played;
    await fireBurst(page, cdp);
    heard = await audioOf(page);
    assert(heard.played > played0, 'staff shot was silent');
    const tint = await page.evaluate(() => {
      const col = window.__shardwild.spriteInfo('staff', 0).col;
      const shots = window.__shardwild.projectiles;
      return {col, shots: shots.slice(0, 6)};
    });
    assert(tint.shots.length > 0 && tint.shots.every(s => s.shape === 'dot' && s.col === tint.col), 'T0 projectile tint ' + JSON.stringify(tint));

    await tapTag(page, r => r.tag === 'audio');
    heard = await audioOf(page);
    assert(heard.sfx === true && heard.music === false, 'first toggle should drop music ' + JSON.stringify(heard));
    await tapTag(page, r => r.tag === 'audio');
    heard = await audioOf(page);
    assert(heard.sfx === false && heard.music === false, 'second toggle should mute ' + JSON.stringify(heard));
    const savedMute = await page.evaluate(() => JSON.parse(localStorage.getItem('shardwild_audio_v1') || 'null'));
    assert(savedMute && savedMute.sfx === false && savedMute.music === false, 'mute was not saved ' + JSON.stringify(savedMute));
    const mutedPlayed = heard.played;
    await fireBurst(page, cdp);
    heard = await audioOf(page);
    assert(heard.played === mutedPlayed, 'muted shot still made a sound');

    await page.reload({waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__shardwild && window.__shardwild.state === 'title' && !window.__shardwild.layout.portrait);
    const reloaded = await audioOf(page);
    assert(!reloaded.unlocked && reloaded.state === 'none', 'reload unlocked audio ' + JSON.stringify(reloaded));
    assert(reloaded.sfx === false && reloaded.music === false, 'reload lost the mute ' + JSON.stringify(reloaded));
    const cont = await page.evaluate(() => window.__shardwild.ui.filter(r => r.kind === 'button').sort((a, b) => a.y - b.y)[0]);
    await page.touchscreen.tap(cont.x + cont.w / 2, cont.y + cont.h / 2);
    await page.waitForFunction(() => window.__shardwild.state === 'play');
    await frames(page, 4);
    heard = await audioOf(page);
    assert(heard.unlocked && heard.state === 'running' && heard.sfx === false && heard.music === false, 'continue audio ' + JSON.stringify(heard));
    await tapTag(page, r => r.tag === 'audio');
    heard = await audioOf(page);
    assert(heard.sfx === true && heard.music === true, 'third toggle should restore sound ' + JSON.stringify(heard));

    assert(await page.evaluate(() => window.__shardwild.world.isHub), 'drops should work in the Haven');
    const feet = await page.evaluate(() => ({x: window.__shardwild.P.x, y: window.__shardwild.P.y}));
    const playPt = await page.evaluate(() => {
      const p = window.__shardwild.layout.play;
      return {x: p.x + p.w * 0.4, y: p.y + 72};
    });

    const wslot = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'eq' && s.slot === 'weapon'));
    assert(wslot && wslot.name, 'missing equipped weapon');
    await drag(cdp, page, wslot.x + wslot.w / 2, wslot.y + wslot.h / 2, playPt.x, playPt.y);
    const eqDrop = await page.evaluate(origin => {
      const sw = window.__shardwild;
      return {
        weapon: sw.P.eq.weapon && sw.P.eq.weapon.name,
        bags: sw.bags,
        moved: Math.hypot(sw.P.x - origin.x, sw.P.y - origin.y),
        hub: sw.world.isHub
      };
    }, feet);
    assert(eqDrop.hub && eqDrop.moved < 2, 'equip drop moved the player or left the Haven: ' + JSON.stringify(eqDrop));
    assert(!eqDrop.weapon, 'equipped weapon was not cleared: ' + JSON.stringify(eqDrop));
    assert(eqDrop.bags.length === 1 && eqDrop.bags[0].items.length === 1 && eqDrop.bags[0].items[0].name === wslot.name, 'weapon did not drop into a new bag: ' + JSON.stringify(eqDrop.bags));
    assert(eqDrop.bags[0].t >= 60 && eqDrop.bags[0].t <= 90, 'dropped bag lifetime ' + eqDrop.bags[0].t);
    const bagSlot = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'bag' && s.name));
    assert(bagSlot, 'dropped weapon bag did not open');
    await tapAt(cdp, page, bagSlot.x + bagSlot.w / 2, bagSlot.y + bagSlot.h / 2);
    const reequipped = await page.evaluate(() => ({
      weapon: window.__shardwild.P.eq.weapon && window.__shardwild.P.eq.weapon.name,
      bags: window.__shardwild.bags.length
    }));
    assert(reequipped.weapon === wslot.name && reequipped.bags === 0, 'did not pick the weapon back up: ' + JSON.stringify(reequipped));

    const potSlot = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'inv' && s.name === 'Healing Draught'));
    assert(potSlot, 'backpack is missing the healing draught');
    await drag(cdp, page, potSlot.x + potSlot.w / 2, potSlot.y + potSlot.h / 2, playPt.x, playPt.y);
    const potDrop = await page.evaluate(() => {
      const sw = window.__shardwild;
      return {bags: sw.bags, inv: sw.P.inv.map(it => it && it.name), hub: sw.world.isHub};
    });
    assert(potDrop.hub, 'left the Haven while dropping');
    assert(potDrop.bags.length === 1 && potDrop.bags[0].items.length === 1 && potDrop.bags[0].items[0].name === 'Healing Draught', 'draught did not drop: ' + JSON.stringify(potDrop));
    assert(potDrop.bags[0].t >= 60 && potDrop.bags[0].t <= 90, 'draught bag lifetime');
    assert(potDrop.bags[0].col === 'brown', 'a plain draught should be a brown bag');
    assert(!potDrop.inv.includes('Healing Draught'), 'draught still in the backpack');
    await page.evaluate(() => window.__shardwild.teleport(window.__shardwild.P.x + 16, window.__shardwild.P.y));
    await frames(page, 2);
    await page.screenshot({path: path.join(ART, 'screenshot_dropped_bag.png')});
    await page.evaluate(origin => window.__shardwild.teleport(origin.x, origin.y), feet);
    await frames(page, 2);
    const potBag = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'bag' && s.name === 'Healing Draught'));
    assert(potBag, 'loot panel closed after stepping back onto the bag');
    await tapAt(cdp, page, potBag.x + potBag.w / 2, potBag.y + potBag.h / 2);
    const picked = await page.evaluate(() => ({
      bags: window.__shardwild.bags.length,
      inv: window.__shardwild.P.inv.map(it => it && it.name)
    }));
    assert(picked.bags === 0 && picked.inv.includes('Healing Draught'), 'did not pick the draught back up: ' + JSON.stringify(picked));

    const offclass = await page.evaluate(() => window.__shardwild.spawnBag([
      {k: 'weapon', w: 'bow', t: 3},
      {k: 'weapon', w: 'sword', t: 4},
      {k: 'ability', cls: 'strider', t: 2},
      {k: 'armor', a: 'heavy', t: 3}
    ]));
    assert(offclass.length === 4, 'off-class bag failed: ' + JSON.stringify(offclass));
    assert(await page.evaluate(() => window.__shardwild.bags[0].col === 'purple'), 'mid/high gear should be a purple bag');
    await page.evaluate(() => window.__shardwild.teleport(window.__shardwild.P.x + 16, window.__shardwild.P.y));
    await frames(page, 2);
    await page.screenshot({path: path.join(ART, 'screenshot_offclass_loot.png')});
    await page.evaluate(origin => window.__shardwild.teleport(origin.x, origin.y), feet);
    await frames(page, 2);
    const mergeSlot = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'inv' && s.name === 'Healing Draught'));
    assert(mergeSlot, 'no draught to merge into the bag');
    await longPress(cdp, page, mergeSlot.x + mergeSlot.w / 2, mergeSlot.y + mergeSlot.h / 2);
    const tip = await page.evaluate(() => window.__shardwild.tooltip);
    assert(tip === 'Healing Draught', 'hold did not open the tooltip: ' + tip);
    const dropBtn = await page.evaluate(() => window.__shardwild.ui.find(r => r.tag === 'drop-item'));
    assert(dropBtn, 'tooltip has no Drop button');
    await tapAt(cdp, page, dropBtn.x + dropBtn.w / 2, dropBtn.y + dropBtn.h / 2);
    const merged = await page.evaluate(() => {
      const bags = window.__shardwild.bags;
      return {n: bags.length, items: bags[0] ? bags[0].items.map(it => it.name) : [], col: bags[0] && bags[0].col};
    });
    assert(merged.n === 1 && merged.items.length === 5 && merged.items.includes('Healing Draught'), 'drop did not merge into the open bag: ' + JSON.stringify(merged));
    assert(merged.items.some(n => n.indexOf('Bow') >= 0) && merged.items.some(n => n.indexOf('Blade') >= 0), 'off-class weapons missing: ' + JSON.stringify(merged.items));

    await page.evaluate(() => {
      const sw = window.__shardwild;
      sw.clearBags();
      sw.clearInv();
      sw.grant('hp');
      sw.grant('mp');
      sw.spawnBag(['att', 'def', 'spd', 'dex', 'vit', 'wis', 'hp', 'mp'].map(stat => ({k: 'elixir', stat})));
    });
    await frames(page, 2);
    const colors = await page.evaluate(() => {
      const c = document.getElementById('game');
      const g = c.getContext('2d', {alpha: false});
      const dpr = c.width / window.innerWidth;
      const slots = window.__shardwild.slots.filter(s => s.name && (s.area === 'inv' || s.area === 'bag'));
      return slots.map(s => {
        const x0 = Math.floor((s.x + s.w * 0.3) * dpr);
        const y0 = Math.floor((s.y + s.h * 0.32) * dpr);
        const w = Math.max(4, Math.floor(s.w * 0.4 * dpr));
        const h = Math.max(4, Math.floor(s.h * 0.4 * dpr));
        const img = g.getImageData(x0, y0, w, h).data;
        let r = 0, gv = 0, b = 0, n = 0;
        for (let i = 0; i < img.length; i += 4) {
          const R = img[i], G = img[i + 1], B = img[i + 2];
          if (R < 55 && G < 48 && B < 80) continue;
          r += R; gv += G; b += B; n++;
        }
        return {name: s.name, area: s.area, n, rgb: n ? [Math.round(r / n), Math.round(gv / n), Math.round(b / n)] : [0, 0, 0]};
      });
    });
    await page.evaluate(() => window.__shardwild.teleport(window.__shardwild.P.x + 16, window.__shardwild.P.y));
    await frames(page, 2);
    assert(colors.length >= 10, 'expected every potion on screen, got ' + JSON.stringify(colors));
    for (let i = 0; i < colors.length; i++) {
      assert(colors[i].n > 4, 'empty potion sprite ' + JSON.stringify(colors[i]));
      for (let j = i + 1; j < colors.length; j++) {
        const a = colors[i].rgb, b = colors[j].rgb;
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        assert(d > 22, 'potion colors too similar ' + colors[i].name + ' vs ' + colors[j].name + ' d=' + d.toFixed(1) + ' ' + JSON.stringify([a, b]));
      }
    }
    assert(await page.evaluate(() => window.__shardwild.bags[0] && window.__shardwild.bags[0].col === 'cyan'), 'elixir bag should be cyan');
    await page.screenshot({path: path.join(ART, 'screenshot_potion_colors.png')});
    await page.evaluate(origin => window.__shardwild.teleport(origin.x, origin.y), feet);
    await page.evaluate(() => {
      const sw = window.__shardwild;
      sw.clearBags();
      sw.clearInv();
      sw.grant('hp');
    });
    await frames(page, 2);

    const chest = await page.evaluate(() => window.__shardwild.world.chest);
    await walkTo(page, cdp, chest.x, chest.y, () => {
      const P = window.__shardwild.P, c = window.__shardwild.world.chest;
      return Math.hypot(P.x - c.x, P.y - c.y) < 12;
    }, 16);
    assert(await page.evaluate(() => window.__shardwild.chestOpen), 'chest did not open');
    const cat = await page.evaluate(() => window.__shardwild.catalog);
    assert(cat.weapons === 30 && cat.abilities === 27 && cat.armors === 27 && cat.rings === 9 && cat.elixirs === 8 && cat.pots === 2 && cat.key && cat.test === 3 && cat.n === 104, 'catalog ' + JSON.stringify(cat));
    assert(cat.testNames && cat.testNames.join(',') === 'Godslayer Staff,Godslayer Bow,Godslayer Blade', 'test weapons ' + JSON.stringify(cat.testNames));

    let staff = null;
    for (let i = 0; i < 8 && !staff; i++) {
      const slots = await page.evaluate(() => window.__shardwild.slots);
      staff = slots.find(s => s.area === 'chest' && s.name === 'Iron Staff');
      if (!staff) await tapTag(page, r => r.tag === 'chest-next');
    }
    assert(staff, 'Iron Staff not in the chest');
    await page.touchscreen.tap(staff.x + staff.w / 2, staff.y + staff.h / 2);
    await frames(page, 3);
    const equipped = await page.evaluate(() => {
      const w = window.__shardwild.P.eq.weapon;
      const still = window.__shardwild.slots.some(s => s.area === 'chest' && s.name === 'Iron Staff');
      return {name: w.name, tier: w.tier, still};
    });
    assert(equipped.name === 'Iron Staff' && equipped.tier === 1, 'did not equip Iron Staff: ' + JSON.stringify(equipped));
    assert(equipped.still, 'chest lost Iron Staff; it should copy');

    await tapTag(page, r => r.tag === 'chest-tab' && r.tab === 'all');
    let sawDim = false, sawUsable = false;
    for (let i = 0; i < 14; i++) {
      const slots = await page.evaluate(() => window.__shardwild.slots.filter(s => s.area === 'chest'));
      if (slots.some(s => s.dim && s.name && s.name.indexOf('Bow') >= 0)) sawDim = true;
      if (slots.some(s => !s.dim && s.name && s.name.indexOf('Staff') >= 0)) sawUsable = true;
      if (sawDim && sawUsable) break;
      await tapTag(page, r => r.tag === 'chest-next');
    }
    assert(sawDim, 'other-class bows were not dimmed');
    assert(sawUsable, 'current-class staves were not shown usable');
    await page.screenshot({path: path.join(ART, 'screenshot_test_chest.png')});

    await tapTag(page, r => r.tag === 'chest-tab' && r.tab === 'pots');
    const potNames = [];
    for (let i = 0; i < 4; i++) {
      const slots = await page.evaluate(() => window.__shardwild.slots.filter(s => s.area === 'chest' && s.name).map(s => s.name));
      potNames.push(...slots);
      const more = await page.evaluate(() => window.__shardwild.ui.some(r => r.tag === 'chest-next'));
      if (!more) break;
      await tapTag(page, r => r.tag === 'chest-next');
    }
    const potSet = new Set(potNames);
    for (const name of ['Healing Draught', 'Mana Draught', 'Elixir of Life', 'Elixir of Mind', 'Elixir of Fury', 'Elixir of Stone', 'Elixir of Wind', 'Elixir of Grace', 'Elixir of Vigor', 'Elixir of Insight']) {
      assert(potSet.has(name), 'test chest potions missing ' + name + ' from ' + [...potSet].join(', '));
    }

    const classes = [
      ['pyro', 'Splintered Staff', 'Starforged Staff', 'Mythic Staff', 'Hollow Crown Staff', 'Hollow Codex', 'Hollow Robe'],
      ['strider', 'Splintered Bow', 'Starforged Bow', 'Mythic Bow', 'Kingsbane Bow', 'Hollow Quiver', 'Hollow Jerkin'],
      ['bulwark', 'Splintered Blade', 'Starforged Blade', 'Mythic Blade', "Morvane's Edge", 'Hollow Seal', 'Hollow Plate']
    ];
    for (const [tab, t0, t4, t7, utW, utA, utR] of classes) {
      await openChestTab(page, tab);
      const low = await findChest(page, [t0, t4, t7]);
      assert(low.indexOf(t0) >= 0 && low.indexOf(t4) >= 0 && low.indexOf(t7) >= 0, tab + ' tier row ' + low.join(','));
      await frames(page, 3);
      await page.screenshot({path: path.join(ART, 'screenshot_chest_' + tab + '_t0_t7.png')});
      await findChest(page, [utW]);
      await frames(page, 3);
      await page.screenshot({path: path.join(ART, 'screenshot_chest_' + tab + '_ut_weapon.png')});
      await findChest(page, [utA]);
      await frames(page, 3);
      await page.screenshot({path: path.join(ART, 'screenshot_chest_' + tab + '_ut_ability.png')});
      await findChest(page, [utR]);
      await frames(page, 3);
      await page.screenshot({path: path.join(ART, 'screenshot_chest_' + tab + '_ut_armor.png')});
    }
    await findChest(page, ['Astral Band']);
    await frames(page, 3);
    await page.screenshot({path: path.join(ART, 'screenshot_chest_rings_ut.png')});

    const utSlot = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'chest' && s.name === 'Hollow Crown Staff'));
    if (!utSlot) {
      await openChestTab(page, 'pyro');
      await findChest(page, ['Hollow Crown Staff']);
    }
    const crown = await page.evaluate(() => window.__shardwild.slots.find(s => s.area === 'chest' && s.name === 'Hollow Crown Staff'));
    assert(crown, 'Hollow Crown Staff slot missing');
    await page.touchscreen.tap(crown.x + crown.w / 2, crown.y + crown.h / 2);
    await frames(page, 4);
    const crowned = await page.evaluate(() => {
      const w = window.__shardwild.P.eq.weapon;
      return {name: w.name, shot: w.shot, col: w.col};
    });
    assert(crowned.name === 'Hollow Crown Staff' && crowned.shot === 'ring', 'UT staff equip ' + JSON.stringify(crowned));
    await fireBurst(page, cdp);
    const utShots = await page.evaluate(() => window.__shardwild.projectiles.filter(s => s.shape === 'ring'));
    assert(utShots.length > 0 && utShots.every(s => s.col === crowned.col), 'UT projectile ' + JSON.stringify(utShots.slice(0, 4)) + ' want ' + crowned.col);
    await page.screenshot({path: path.join(ART, 'screenshot_ut_projectiles.png')});

    await page.waitForTimeout(500);
    const fpsChest = await page.evaluate(() => window.__shardwild.fps);
    assert(fpsChest > 50, 'fps while chest shimmer is up: ' + fpsChest);

    await walkTo(page, cdp, chest.x + 48, chest.y, () => !window.__shardwild.chestOpen, 14);
    const bagNames = await page.evaluate(() => window.__shardwild.spawnBag([{k:'weapon', w:'staff', t:8}, {k:'ring', t:8}]));
    assert(bagNames.indexOf('Hollow Crown Staff') >= 0 && bagNames.indexOf('Astral Band') >= 0, 'bag ' + bagNames.join(','));
    await frames(page, 4);
    const bagSlots = await page.evaluate(() => window.__shardwild.slots.filter(s => s.area === 'bag').map(s => s.name + ':' + s.tier));
    assert(bagSlots.some(s => s.indexOf('Hollow Crown Staff:8') === 0), 'loot panel ' + bagSlots.join(','));
    await page.screenshot({path: path.join(ART, 'screenshot_loot_bag_ut.png')});

    const haven = await page.evaluate(() => {
      const b = window.__shardwild.world.beacons.find(x => x.id === 'haven');
      return {x: b.x, y: b.y};
    });
    await walkTo(page, cdp, haven.x, haven.y, () => window.__shardwild.beacons.indexOf('haven') >= 0, 16);
    await walkTo(page, cdp, haven.x, haven.y, () => {
      const P = window.__shardwild.P, b = window.__shardwild.world.beacons.find(x => x.id === 'haven');
      return Math.hypot(P.x - b.x, P.y - b.y) < 6;
    }, 10);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shardwild_save_v1') || '{}'));
    assert(saved.beacons && saved.beacons.indexOf('haven') >= 0, 'haven beacon was not saved');
    await frames(page, 2);
    await page.screenshot({path: path.join(ART, 'screenshot_beacon.png')});

    await tapTag(page, r => r.tag === 'minimap');
    assert(await page.evaluate(() => window.__shardwild.mapOpen), 'minimap tap did not open the map');
    const held = await page.evaluate(() => ({x: window.__shardwild.P.x, y: window.__shardwild.P.y, hp: window.__shardwild.P.hp, m: window.__shardwild.layout.move}));
    await nudge(cdp, page, held.m.x, held.m.y, 50, -20);
    const held2 = await page.evaluate(() => ({x: window.__shardwild.P.x, y: window.__shardwild.P.y, hp: window.__shardwild.P.hp, map: window.__shardwild.mapOpen}));
    assert(held2.map, 'stick input closed the map');
    assert(Math.hypot(held2.x - held.x, held2.y - held.y) < 1, 'player moved while the map was open');
    assert(held2.hp >= held.hp - 0.01, 'player took damage while the map was open');
    await tapTag(page, r => r.tag === 'map-close');
    assert(!(await page.evaluate(() => window.__shardwild.mapOpen)), 'close button did not close the map');
    await tapTag(page, r => r.tag === 'minimap');
    assert(await page.evaluate(() => window.__shardwild.mapOpen), 'minimap did not reopen');
    await page.touchscreen.tap(3, 3);
    await frames(page, 2);
    assert(!(await page.evaluate(() => window.__shardwild.mapOpen)), 'outside tap did not close the map');

    await walkTo(page, cdp, 110, 158, () => {
      const P = window.__shardwild.P, b = window.__shardwild.world.beacons.find(x => x.id === 'haven');
      return Math.hypot(P.x - b.x, P.y - b.y) > 46;
    }, 16);
    const before = await page.evaluate(() => ({x: window.__shardwild.P.x, y: window.__shardwild.P.y}));
    await tapTag(page, r => r.tag === 'minimap');
    await tapTag(page, r => r.tag === 'beacon' && r.beacon === 'haven' && r.where === 'map' && r.unlocked);
    const warped = await page.evaluate(() => {
      const P = window.__shardwild.P, b = window.__shardwild.world.beacons.find(x => x.id === 'haven');
      return {x: P.x, y: P.y, d: Math.hypot(P.x - b.x, P.y - b.y), inv: P.invuln, flash: window.__shardwild.flash, map: window.__shardwild.mapOpen};
    });
    assert(warped.d < 2, 'teleport missed the beacon: ' + JSON.stringify(warped));
    assert(Math.hypot(warped.x - before.x, warped.y - before.y) > 30, 'teleport did not move the player');
    assert(warped.inv > 2, 'no arrival invulnerability: ' + JSON.stringify(warped));
    assert(warped.flash > 0, 'no warp flash');
    assert(!warped.map, 'map stayed open after warp');

    const portal = await page.evaluate(() => window.__shardwild.world.portal);
    await walkTo(page, cdp, portal.x, portal.y + 6, () => window.__shardwild.place === 'realm', 28);
    await frames(page, 4);
    const realm = await page.evaluate(() => {
      const w = window.__shardwild.world;
      const half = w.w * 8 / 2;
      return {
        n: (w.beacons || []).length,
        ids: (w.beacons || []).map(b => b.id),
        bands: (w.beacons || []).map(b => Math.hypot(b.x - w.cx, b.y - w.cy) / half)
      };
    });
    assert(realm.n === 4, 'expected 4 realm beacons, got ' + JSON.stringify(realm));
    assert(realm.bands[0] > 0.72 && realm.bands[0] < 0.93, 'shore beacon band ' + realm.bands[0]);
    assert(realm.bands[3] > 0.12 && realm.bands[3] < 0.32, 'star beacon band ' + realm.bands[3]);
    await tapTag(page, r => r.tag === 'minimap');
    assert(await page.evaluate(() => window.__shardwild.mapOpen), 'realm map did not open');
    const locked = await page.evaluate(() => window.__shardwild.ui.filter(r => r.tag === 'beacon' && r.where === 'map'));
    assert(locked.length === 4, 'map beacon icons ' + locked.length);
    assert(locked.every(b => !b.unlocked), 'realm beacons should start locked: ' + JSON.stringify(locked.map(b => b.beacon)));
    await frames(page, 3);
    await page.screenshot({path: path.join(ART, 'screenshot_expanded_map.png')});
    await tapTag(page, r => r.tag === 'map-close');
    assert(!(await page.evaluate(() => window.__shardwild.mapOpen)), 'realm map did not close');

    await charactersVaultWeapons(page, cdp);

    await page.waitForTimeout(1200);
    const fps = await page.evaluate(() => window.__shardwild.fps);
    assert(fps > 50, 'fps too low: ' + fps);
    assert(!errors.length, 'console errors:\n' + errors.join('\n'));
    console.log('ok fps=' + fps.toFixed(1) + ' catalog=' + cat.n + ' beacons=' + realm.ids.join(','));
  } catch (err) {
    const fail = path.join(ART, 'screenshot_failure.png');
    try { await page.screenshot({path: fail}); } catch (e) {}
    if (errors.length) console.error(errors.join('\n'));
    throw err;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
