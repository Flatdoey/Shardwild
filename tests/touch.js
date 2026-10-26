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
