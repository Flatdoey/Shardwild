'use strict';
/* Kill N enemies per region against the live loot table and print tier counts. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4174;
const N = 800;

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
      res.setHeader('Content-Type', path.extname(fp) === '.js' ? 'text/javascript' : 'text/html');
      res.end(data);
    });
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function gearInSpan(gear, lo, hi) {
  for (let t = 0; t <= 8; t++) {
    if ((t < lo || t > hi) && gear[t]) return t;
  }
  return -1;
}

function fmtGear(gear) {
  const parts = [];
  for (let t = 0; t <= 8; t++) if (gear[t]) parts.push((t > 7 ? 'UT' : 'T' + t) + '=' + gear[t]);
  return parts.join(' ') || '(none)';
}

function pct(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '0%'; }

const ENEMY_AI = {wander: 1, charge: 1, orbit: 1, chase: 1, keep: 1, boss: 1};

async function main() {
  const server = serve();
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({args: ['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/Shardwild/', {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__shardwild && typeof window.__shardwild.simLoot === 'function');
    const sim = await page.evaluate(n => window.__shardwild.simLoot(n), N);
    assert(!errors.length, 'console errors during sim:\n' + errors.join('\n'));
    assert(sim.utOutsideBoss === 0, 'UT dropped outside the boss: ' + sim.utOutsideBoss);
    assert(!sim.testDrops, 'admin test weapon dropped from a loot table: ' + sim.testDrops);
    assert(!sim.mastery, 'Potion of Mastery dropped from a loot table: ' + sim.mastery);
    assert(sim.regions.some(r => r.name === 'Godlands'), 'Godlands missing from loot regions');
    assert(!sim.regions.some(r => /Starfall/.test(r.name)), 'old Starfall region still in the loot sim');
    assert(sim.bossSolid === N, 'boss did not always drop solid tiered loot ' + sim.bossSolid + '/' + N);
    const utRate = sim.boss.ut / N;
    assert(utRate > 0.15 && utRate < 0.45, 'boss UT rate should be modest, got ' + utRate.toFixed(3));
    for (let t = 0; t <= 5; t++) assert(!sim.boss.gear[t], 'boss gear leaked T' + t + ': ' + fmtGear(sim.boss.gear));
    assert(sim.boss.gear[8] === sim.boss.ut && sim.boss.gear[6] > 0 && sim.boss.gear[7] > 0, 'boss tier mix ' + fmtGear(sim.boss.gear));

    console.log('Loot sim, ' + N + ' kills each (normal, elite, and the Hollow King)');
    for (const reg of sim.regions) {
      for (const [label, row, span] of [['normal', reg.normal, reg.span], ['elite', reg.elite, reg.eliteSpan]]) {
        const outside = gearInSpan(row.gear, span[0], span[1]);
        assert(outside < 0, reg.name + ' ' + label + ' tier ' + outside + ' outside ' + span.join('-') + ' ' + fmtGear(row.gear));
        assert(row.ut === 0, reg.name + ' ' + label + ' dropped a UT');
        assert(row.gear[span[0]] > 0 && row.gear[span[1]] > 0, reg.name + ' ' + label + ' missing an endpoint ' + fmtGear(row.gear));
        assert(row.gear[span[0]] > row.gear[span[1]], reg.name + ' ' + label + ' higher tier was not rarer ' + fmtGear(row.gear));
        const weapons = row.weapons;
        const wn = weapons.staff + weapons.bow + weapons.sword;
        assert(wn > 0 && weapons.staff / wn > 0.12 && weapons.bow / wn > 0.12 && weapons.sword / wn > 0.12, reg.name + ' ' + label + ' weapons skewed ' + JSON.stringify(weapons));
        const armors = row.armors, an = armors.robe + armors.leather + armors.heavy;
        assert(an > 0 && armors.robe && armors.leather && armors.heavy, reg.name + ' ' + label + ' armors ' + JSON.stringify(armors));
        const abilities = row.abilities;
        assert(abilities.wizard && abilities.archer && abilities.knight, reg.name + ' ' + label + ' abilities ' + JSON.stringify(abilities));
        if (label === 'normal') {
          assert(row.empty + row.potOnly > row.n * 0.45, reg.name + ' almost always dropped gear ' + JSON.stringify({empty: row.empty, potOnly: row.potOnly, withGear: row.withGear}));
        }
        console.log(
          reg.name + ' ' + label + ' T' + span[0] + '-T' + span[1] +
          '  gear ' + fmtGear(row.gear) +
          '  nothing ' + pct(row.empty, row.n) +
          '  pots only ' + pct(row.potOnly, row.n) +
          '  weapons staff/bow/sword ' + weapons.staff + '/' + weapons.bow + '/' + weapons.sword +
          '  UT ' + row.ut
        );
      }
    }
    const bw = sim.boss.weapons;
    console.log(
      'Morvane  guaranteed T6-T7 x' + sim.bossSolid +
      '  gear ' + fmtGear(sim.boss.gear) +
      '  UT ' + sim.boss.ut + '/' + N + ' (' + pct(sim.boss.ut, N) + ')' +
      '  weapons staff/bow/sword ' + bw.staff + '/' + bw.bow + '/' + bw.sword +
      '  elixirs ' + sim.boss.elixirs
    );
    console.log('UT from non-boss: ' + sim.utOutsideBoss);
    assert(sim.dungeonUtOutside === 0, 'dungeon UT leaked into the overworld: ' + sim.dungeonUtOutside);
    assert(sim.keysOutside === 0, 'dungeon key leaked into the overworld: ' + sim.keysOutside);
    const portals = sim.portalByType || {};
    assert(portals.crab > N * 0.01 && portals.crab < N * 0.06, 'crab portal rate ' + portals.crab + '/' + N);
    for (const t of Object.keys(portals)) {
      if (t === 'crab') continue;
      assert(portals[t] === 0, 'portal dropped from ' + t + ': ' + portals[t]);
    }
    const den = sim.dungeon;
    assert(den && den.enemy === 'crab' && den.utName === 'Tidepearl', 'dungeon sim ' + JSON.stringify(den && {enemy: den.enemy, utName: den.utName}));
    assert(den.bossGear === N, 'dungeon boss did not always drop T2-T4 gear ' + den.bossGear + '/' + N);
    assert(den.boss.dungeonUt > N * 0.04 && den.boss.dungeonUt < N * 0.28, 'Tidepearl rate ' + den.boss.dungeonUt);
    assert(den.boss.gear[8] === den.boss.dungeonUt, 'dungeon boss UT mix ' + fmtGear(den.boss.gear));
    assert(den.boss.keys > N * 0.02 && den.boss.keys < N * 0.2, 'dungeon key rate ' + den.boss.keys);
    for (let t = 0; t <= 7; t++) {
      if (t >= 2 && t <= 4) continue;
      assert(!den.boss.gear[t], 'dungeon boss leaked T' + t + ' ' + fmtGear(den.boss.gear));
    }
    assert(den.minion.dungeonUt === 0 && den.minion.keys === 0 && den.minion.test === 0 && den.minion.mastery === 0, 'minion extras ' + JSON.stringify(den.minion));
    assert(den.boss.test === 0 && den.boss.mastery === 0, 'boss dropped a test item or mastery');
    for (const t of [0, 1, 4, 5, 6, 7, 8]) assert(!den.minion.gear[t], 'minion tier ' + t + ' ' + fmtGear(den.minion.gear));
    assert(den.minion.gear[2] > 0 && den.minion.gear[3] > 0, 'minion gear ' + fmtGear(den.minion.gear));
    console.log('Tideclaw portal from crabs ' + portals.crab + '/' + N + '  UT ' + den.boss.dungeonUt + '  keys ' + den.boss.keys);
    const burrows = await page.evaluate(() => window.__shardwild.auditBurrows(200));
    assert(burrows && burrows.ok && burrows.n === 200, 'Tideclaw layouts ' + JSON.stringify(burrows));
    assert(burrows.bossMin >= 26 && burrows.bossMax <= 32, 'boss room size ' + burrows.bossMin + '-' + burrows.bossMax);
    console.log('Tideclaw layouts ' + burrows.n + ' seeds connected, boss room ' + burrows.bossMin + '-' + burrows.bossMax + ' tiles');
    const bands = sim.enemyBands || [];
    assert(bands.length >= 24, 'enemy loot bands missing ' + bands.length);
    const byRegion = {};
    for (const row of bands) {
      byRegion[row.region] = (byRegion[row.region] || 0) + 1;
      const outside = gearInSpan(row.gear, row.span[0], row.span[1]);
      assert(outside < 0, row.name + ' tier ' + outside + ' outside ' + row.span.join('-') + ' ' + fmtGear(row.gear));
      assert(row.ut === 0 && row.test === 0 && row.mastery === 0 && row.dungeonUt === 0 && row.keys === 0, row.name + ' dropped a special ' + JSON.stringify(row));
      assert(ENEMY_AI[row.ai], row.name + ' ai ' + row.ai);
      if (row.region === 'Godlands') assert(row.god, row.name + ' is not a god');
      else assert(!row.god, row.name + ' is marked as a god');
      if (row.god) {
        assert(row.godPot && row.hpPots === 0 && row.lifeElixirs === 0, row.name + ' life/hp or missing pot ' + JSON.stringify({godPot: row.godPot, hpPots: row.hpPots, life: row.lifeElixirs, stats: row.elixirStats}));
        const keys = Object.keys(row.elixirStats || {});
        assert(keys.length === 1 && keys[0] === row.godPot, row.name + ' elixir mix ' + JSON.stringify(row.elixirStats));
        const rate = row.elixirStats[row.godPot] / row.n;
        assert(rate > 0.12 && rate < 0.32, row.name + ' pot rate ' + rate.toFixed(3));
      } else {
        assert(!row.godPot, row.name + ' has a god pot');
      }
    }
    const godPots = {};
    for (const row of bands) if (row.god) godPots[row.type] = row.godPot;
    assert(godPots.eye === 'wis' && godPots.colossus === 'vit' && godPots.oracle === 'mp' && godPots.saint === 'def', 'god pots ' + JSON.stringify(godPots));
    assert(godPots.wyrm === 'spd' && godPots.titan === 'att' && godPots.serpent === 'dex' && godPots.herald === 'mp' && godPots.idol === 'def', 'god pots ' + JSON.stringify(godPots));
    assert(byRegion['Saltmarsh Shore'] >= 6 && byRegion['Greenmarch'] >= 6 && byRegion['Ashen Wilds'] >= 6 && byRegion['Godlands'] >= 8, 'enemies per region ' + JSON.stringify(byRegion));
    console.log('Enemy bands ' + bands.map(r => r.region.slice(0, 4) + ':' + r.type + (r.godPot ? '=' + r.godPot : '')).join(' '));
  } finally {
    try { await browser.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
  }
}

main().catch(err => { console.error(err); process.exit(1); });
