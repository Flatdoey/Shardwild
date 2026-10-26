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
        assert(abilities.pyro && abilities.strider && abilities.bulwark, reg.name + ' ' + label + ' abilities ' + JSON.stringify(abilities));
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
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
