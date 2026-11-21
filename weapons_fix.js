/* Shardwild v30 weapons_fix.js (Sprites): distinct sword / dagger / katana silhouettes.
 * Tier colours are unchanged (sword/dagger palettes stay as they are in v25_art.js). Only the rows change, plus 2 katana palette letters
 * (T = tsuba, w = light wrap) that reuse colours already in each katana tier's palette.
 *
 * WHAT IT REPLACES (game data on origin/cursor/v30-content-6ca4):
 *   v25_art.js   ITEM_GEAR.sword.rows[0..7], .utRows, .test.rows      (pal/ut/test.pal unchanged)
 *   v25_art.js   ITEM_GEAR.dagger.rows[0..7], .utRows, .test.rows     (pal/ut/test.pal unchanged)
 *   v25_art.js   ITEM_SPRITES "sword|0..8","sword|test","dagger|0..8","dagger|test"   (flat copy; not read by game.js, kept in sync)
 *   v25_art.js   ITEM_UNIQUE.voidblade.rows                            (pal unchanged)
 *   class_items.js NEW_ITEM_SPRITES "katana|0".."katana|8","katana|test"  (rows + pal)
 *   loot.js      UT_ART_V30.leviathantooth.rows                         (pal unchanged)
 *   NOT changed: thornblade (Marrowthorn), every other weapon.
 *
 * TWO WAYS TO USE:
 *   a) Drop-in: <script src="./weapons_fix.js"></script> after loot.js and before game.js. It patches the objects in place,
 *      and buildGear() / the UT_ART_V30 loop then build the new sprites. No game.js change.
 *   b) Permanent: paste WEAPONS_FIX.flat[key] rows/pal into the source files listed above, then drop this file.
 */
const WEAPONS_FIX={gear:{"sword":{"rows":[["........","......h.",".g..hbh.","..ghbh..","...gh...","..r.g...",".r...g..","p......."],[".......t",".....hb.",".g..hbh.","..ghbh..","...gh...","..r.g...",".r...g..","p......."],[".......t",".....hb.",".G..hah.","..ghbh..","...gh...","..r.g...",".r...G..","pp......"],[".......t",".....hb.",".G..hbh.","..ghah..","...gh...","..r.g...",".r...G..","pp......"],[".......t",".....hb.",".G..hbh.","..ghbh..","...gh...","..r.g...",".r...G..","pp......"],[".......t",".....hb.",".G..hah.","..ghbh..","...gh...","..r.g...",".r...G..","pp......"],["......st",".....hb.",".G..hbh.","..ghbh..","...gh...","..r.g...",".r...G..","mp......"],["......st",".....hb.",".G..hah.","..ghah..","...gh...","..r.g...",".r...G..","mp......"]],"utRows":["......st",".....th.",".G..thb.","..gthb..","...gb...","..r.g...",".r...G..","mp......"],"testRows":["......st",".....hb.",".G..hah.","..ghah..","...gh...","..r.g...",".r...G..","mp......"]},"dagger":{"rows":[["........","........","....h.b.","..ghhb..","...gb...","..r.g...",".p......","........"],["........","......t.","....hhb.","..ghhb..","...gb...","..r.g...",".p......","........"],["........","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".p......","........"],["........","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".p......","........"],["........","......t.","....hhb.","..Ghhb..","...gb...","..r.G...",".p......","........"],["........","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".p......","........"],[".......s","......t.","....hhb.","..Ghhb..","...gb...","..r.G...",".m......","........"],[".......s","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".m......","s......."]],"utRows":[".......s","......t.","....thb.","..Gthb..","...gb...","..r.G...",".m......","........"],"testRows":[".......s","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".m......","s......."]}},
unique:{voidblade:["......wt",".....hb.",".G..hwh.","..ghbh..","...gh...","..r.g...",".r...G..","mp......"]},
loot:{leviathantooth:["........","......w.",".....wW.","....wwW.","..BwwW..","..rbB...",".b......","........"]},
flat:{
  "sword|0":{"pal":{"b":"#6e6458","g":"#9a7650","h":"#a89c8c","p":"#7a6a58","r":"#4a3424"},"rows":["........","......h.",".g..hbh.","..ghbh..","...gh...","..r.g...",".r...g..","p......."]},
  "dagger|0":{"pal":{"b":"#6e6458","g":"#9a7650","h":"#a89c8c","p":"#7a6a58","r":"#4a3424"},"rows":["........","........","....h.b.","..ghhb..","...gb...","..r.g...",".p......","........"]},
  "katana|0":{"pal":{"T":"#9a7650","b":"#6e6458","h":"#a89c8c","r":"#4a3424","w":"#7a6a58"},"rows":["........",".....h..","....hb..","...hb...","..TT....",".rTT....","rwr.....","wr......"]},
  "sword|1":{"pal":{"b":"#7c848e","g":"#b8904c","h":"#c4cad2","p":"#8a9098","r":"#6a4a30","t":"#e4e8ec"},"rows":[".......t",".....hb.",".g..hbh.","..ghbh..","...gh...","..r.g...",".r...g..","p......."]},
  "dagger|1":{"pal":{"b":"#7c848e","g":"#b8904c","h":"#c4cad2","p":"#8a9098","r":"#6a4a30","t":"#e4e8ec"},"rows":["........","......t.","....hhb.","..ghhb..","...gb...","..r.g...",".p......","........"]},
  "katana|1":{"pal":{"T":"#b8904c","b":"#7c848e","h":"#c4cad2","r":"#6a4a30","t":"#e4e8ec","w":"#8a9098"},"rows":["......ht",".....h..","....hb..","...hb...","..TT....",".rTT....","rwr.....","wr......"]},
  "sword|2":{"pal":{"G":"#b8c8dc","a":"#5ad0ff","b":"#7e8ea4","g":"#7a8aa4","h":"#d0dae6","p":"#7a8aa4","r":"#3a2c22","t":"#f4f8ff"},"rows":[".......t",".....hb.",".G..hah.","..ghbh..","...gh...","..r.g...",".r...G..","pp......"]},
  "dagger|2":{"pal":{"G":"#b8c8dc","a":"#5ad0ff","b":"#7e8ea4","g":"#7a8aa4","h":"#d0dae6","p":"#7a8aa4","r":"#3a2c22","t":"#f4f8ff"},"rows":["........","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".p......","........"]},
  "katana|2":{"pal":{"T":"#b8c8dc","a":"#5ad0ff","b":"#7e8ea4","h":"#d0dae6","r":"#3a2c22","t":"#f4f8ff","w":"#7a8aa4"},"rows":["......ht",".....h..","....ab..","...hb...","..TT....",".rTT....","rwr.....","wr......"]},
  "sword|3":{"pal":{"G":"#ff7a30","a":"#ff7a30","b":"#4e4644","g":"#6a5e5a","h":"#9a908c","p":"#ff7a30","r":"#3a2420","t":"#d8ccc4"},"rows":[".......t",".....hb.",".G..hbh.","..ghah..","...gh...","..r.g...",".r...G..","pp......"]},
  "dagger|3":{"pal":{"G":"#ff7a30","a":"#ff7a30","b":"#4e4644","g":"#6a5e5a","h":"#9a908c","p":"#ff7a30","r":"#3a2420","t":"#d8ccc4"},"rows":["........","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".p......","........"]},
  "katana|3":{"pal":{"T":"#ff7a30","a":"#ff7a30","b":"#4e4644","h":"#9a908c","r":"#3a2420","t":"#d8ccc4","w":"#6a5e5a"},"rows":["......ht",".....h..","....hb..","...ab...","..TT....",".rTT....","rwr.....","wr......"]},
  "sword|4":{"pal":{"G":"#7aa0f0","b":"#8aa4d4","g":"#3a5aa8","h":"#dce8ff","p":"#fff6a0","r":"#22305a","t":"#ffffff"},"rows":[".......t",".....hb.",".G..hbh.","..ghbh..","...gh...","..r.g...",".r...G..","pp......"]},
  "dagger|4":{"pal":{"G":"#7aa0f0","b":"#8aa4d4","g":"#3a5aa8","h":"#dce8ff","p":"#fff6a0","r":"#22305a","t":"#ffffff"},"rows":["........","......t.","....hhb.","..Ghhb..","...gb...","..r.G...",".p......","........"]},
  "katana|4":{"pal":{"T":"#fff6a0","b":"#8aa4d4","h":"#dce8ff","m":"#3a5aa8","r":"#22305a","t":"#ffffff","w":"#7aa0f0"},"rows":["......ht",".....h..","....hb..","...hb...","..TT....",".rTT....","rwr.....","mr......"]},
  "sword|5":{"pal":{"G":"#8a5ad0","a":"#ff9af0","b":"#7a44c0","g":"#3e2068","h":"#d8a8ff","p":"#ff6ae0","r":"#2a1640","t":"#fff0ff"},"rows":[".......t",".....hb.",".G..hah.","..ghbh..","...gh...","..r.g...",".r...G..","pp......"]},
  "dagger|5":{"pal":{"G":"#8a5ad0","a":"#ff9af0","b":"#7a44c0","g":"#3e2068","h":"#d8a8ff","p":"#ff6ae0","r":"#2a1640","t":"#fff0ff"},"rows":["........","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".p......","........"]},
  "katana|5":{"pal":{"T":"#ff6ae0","a":"#ff9af0","b":"#7a44c0","h":"#d8a8ff","m":"#3e2068","r":"#2a1640","t":"#fff0ff","w":"#8a5ad0"},"rows":["......ht",".....h..","....ab..","...hb...","..TT....",".rTT....","rwr.....","mr......"]},
  "sword|6":{"pal":{"G":"#ffd34a","b":"#e0a830","g":"#b07018","h":"#fff2c0","m":"#ff3a4a","p":"#ffd34a","r":"#6a3410","s":"#ffffff","t":"#ffffff"},"rows":["......st",".....hb.",".G..hbh.","..ghbh..","...gh...","..r.g...",".r...G..","mp......"]},
  "dagger|6":{"pal":{"G":"#ffd34a","b":"#e0a830","g":"#b07018","h":"#fff2c0","m":"#ff3a4a","r":"#6a3410","s":"#ffffff","t":"#ffffff"},"rows":[".......s","......t.","....hhb.","..Ghhb..","...gb...","..r.G...",".m......","........"]},
  "katana|6":{"pal":{"T":"#ffd34a","b":"#e0a830","h":"#fff2c0","m":"#ff3a4a","r":"#6a3410","t":"#ffffff","w":"#b07018"},"rows":["......ht",".....h..","....hb..","...hb...","..TT....",".rTT....","rwr.....","mr......"]},
  "sword|7":{"pal":{"G":"#ffb347","a":"#ffb347","b":"#6ad0f0","g":"#e07020","h":"#e0fbff","m":"#ff4a30","p":"#ffb347","r":"#7a3010","s":"#ffd8a0","t":"#ffffff"},"rows":["......st",".....hb.",".G..hah.","..ghah..","...gh...","..r.g...",".r...G..","mp......"]},
  "dagger|7":{"pal":{"G":"#ffb347","a":"#ffb347","b":"#6ad0f0","g":"#e07020","h":"#e0fbff","m":"#ff4a30","r":"#7a3010","s":"#ffd8a0","t":"#ffffff"},"rows":[".......s","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".m......","s......."]},
  "katana|7":{"pal":{"T":"#ffb347","a":"#ffb347","b":"#6ad0f0","h":"#e0fbff","m":"#ff4a30","r":"#7a3010","t":"#ffffff","w":"#e07020"},"rows":["......ht",".....h..","....ab..","...ab...","..TT....",".rTT....","rwr.....","mr......"]},
  "sword|8":{"pal":{"G":"#ffd34a","b":"#7a2a48","g":"#1a1020","h":"#ff5577","m":"#ff5577","p":"#ffd34a","r":"#2a1820","s":"#ffffff","t":"#ffd0dc"},"rows":["......st",".....th.",".G..thb.","..gthb..","...gb...","..r.g...",".r...G..","mp......"]},
  "dagger|8":{"pal":{"G":"#ffd34a","b":"#7a2a48","g":"#1a1020","h":"#ff5577","m":"#ffd34a","r":"#2a1820","s":"#ffffff","t":"#ffd0dc"},"rows":[".......s","......t.","....thb.","..Gthb..","...gb...","..r.G...",".m......","........"]},
  "katana|8":{"pal":{"T":"#ffd34a","a":"#ff5577","b":"#7a2a48","h":"#ff5577","m":"#ff5577","r":"#2a1820","t":"#ffd0dc","w":"#ff5577"},"rows":["......ht",".....h..","....ab..","...ab...","..TT....",".rTT....","rwr.....","mr......"]},
  "sword|test":{"pal":{"G":"#ff3355","a":"#ffffff","b":"#ffe14a","g":"#ff3355","h":"#fff6c0","m":"#ff3355","p":"#fff6c0","r":"#c8a050","s":"#ffffff","t":"#ffffff"},"rows":["......st",".....hb.",".G..hah.","..ghah..","...gh...","..r.g...",".r...G..","mp......"]},
  "dagger|test":{"pal":{"G":"#ff3355","a":"#ffffff","b":"#ffe14a","g":"#ff3355","h":"#fff6c0","m":"#ff3355","r":"#c8a050","s":"#ffffff","t":"#ffffff"},"rows":[".......s","......t.","....hhb.","..Ghab..","...gb...","..r.G...",".m......","s......."]},
  "katana|test":{"pal":{"T":"#ff3355","a":"#ffffff","b":"#ffe14a","h":"#fff6c0","m":"#ff3355","r":"#c8a050","t":"#ffffff","w":"#fff6c0"},"rows":["......ht",".....h..","....ab..","...ab...","..TT....",".rTT....","rwr.....","mr......"]},
  "leviathantooth":{"pal":{"B":"#c8945a","W":"#d8c8a4","b":"#8e5c32","r":"#c0303a","w":"#fff4dc"},"rows":["........","......w.",".....wW.","....wwW.","..BwwW..","..rbB...",".b......","........"]},
  "voidblade":{"pal":{"G":"#c8b0ff","b":"#5a28a0","g":"#7a3ac0","h":"#c46aff","m":"#ff4ad0","p":"#c46aff","r":"#241048","t":"#ffd0ff","w":"#ffffff"},"rows":["......wt",".....hb.",".G..hwh.","..ghbh..","...gh...","..r.g...",".r...G..","mp......"]}
}};
function applyWeaponsFix(){
  const W=WEAPONS_FIX,A=(typeof window!=='undefined'&&window.SHARD_ART)||null;
  if(A&&A.ITEM_GEAR){
    for(const k of ['sword','dagger']){
      const g=A.ITEM_GEAR[k],f=W.gear[k];if(!g)continue;
      g.rows=f.rows;g.utRows=f.utRows;if(g.test)g.test.rows=f.testRows;
    }
    if(A.ITEM_UNIQUE&&A.ITEM_UNIQUE.voidblade)A.ITEM_UNIQUE.voidblade.rows=W.unique.voidblade;
    if(A.ITEM_SPRITES)for(const k in W.flat)if(A.ITEM_SPRITES[k])A.ITEM_SPRITES[k]=W.flat[k];
  }
  if(typeof NEW_ITEM_SPRITES!=='undefined')for(const k in W.flat)if(k.indexOf('katana|')===0)NEW_ITEM_SPRITES[k]=W.flat[k];
  if(typeof UT_ART_V30!=='undefined'&&UT_ART_V30.leviathantooth)UT_ART_V30.leviathantooth.rows=W.loot.leviathantooth;
}
if(typeof window!=='undefined'&&window.SHARD_ART)applyWeaponsFix();
if(typeof module!=='undefined')module.exports={WEAPONS_FIX,applyWeaponsFix};
