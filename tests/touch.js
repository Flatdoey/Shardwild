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

    const cards = await page.evaluate(() => window.__shardwild.ui.filter(r => r.kind === 'button' && r.h > 60).sort((a, b) => a.x - b.x));
    assert(cards.length >= 3, 'class cards missing');
    await page.touchscreen.tap(cards[0].x + cards[0].w / 2, cards[0].y + cards[0].h / 2);
    await page.waitForFunction(() => window.__shardwild.state === 'play');
    await frames(page, 3);

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
    assert(cat.weapons === 27 && cat.abilities === 27 && cat.armors === 27 && cat.rings === 9 && cat.elixirs === 8 && cat.pots === 2 && cat.key && cat.n === 101, 'catalog ' + JSON.stringify(cat));

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
    await walkTo(page, cdp, portal.x, portal.y + 6, () => !window.__shardwild.world.isHub, 28);
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
