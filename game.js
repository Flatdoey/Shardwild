'use strict';
/* Shardwild: an original mobile bullet-hell realm crawler. Plain JS + canvas, no build step. */
(function(){
const GAME_VERSION='v27';
const cv=document.getElementById('game');
const ctx=cv.getContext('2d',{alpha:false});
let W=1,H=1,DPR=1,S=4,VW=1,VH=1;
const TS=8, TAU=Math.PI*2;
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.floor(Math.random()*a.length)];
function mulberry(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const FONT='ui-monospace,Menlo,Consolas,monospace';
function font(n,b){ctx.font=(b===false?'':'bold ')+Math.round(n)+'px '+FONT;}

/* ---------------- sprites ---------------- */
function mkSprite(rows,pal){
  const h=rows.length,w=Math.max(...rows.map(r=>r.length));
  const c=document.createElement('canvas');c.width=w+2;c.height=h+2;const g=c.getContext('2d');
  g.fillStyle='#0d0b12';
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ch=rows[y][x];if(ch&&ch!=='.'&&pal[ch])g.fillRect(x,y,3,3);}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ch=rows[y][x];if(ch&&ch!=='.'&&pal[ch]){g.fillStyle=pal[ch];g.fillRect(x+1,y+1,1,1);}}
  const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const g2=f.getContext('2d');g2.translate(c.width,0);g2.scale(-1,1);g2.drawImage(c,0,0);
  return {c,f,w:c.width,h:c.height};
}
// Item art is raw 8x8. A one-pixel dark outline is stamped in art space and
// nearest-neighbor scaled so the icon fills the slot the way the pre-v12 gear did.
let rawSeq=1;
function mkRaw(rows,pal){
  const h=rows.length,w=Math.max(...rows.map(r=>r.length));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d'),img=g.createImageData(w,h),d=img.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const ch=rows[y][x];
    if(!ch||ch==='.'||!pal[ch])continue;
    const n=parseInt(pal[ch].slice(1),16),i=(y*w+x)*4;
    d[i]=(n>>16)&255;d[i+1]=(n>>8)&255;d[i+2]=n&255;d[i+3]=255;
  }
  g.putImageData(img,0,0);
  const f=document.createElement('canvas');f.width=w;f.height=h;
  const g2=f.getContext('2d');g2.translate(w,0);g2.scale(-1,1);g2.drawImage(c,0,0);
  return {c,f,w,h,id:rawSeq++};
}
const iconCache=new Map();
function outlinedIcon(sp,scale){
  const key=sp.id+'@'+scale,hit=iconCache.get(key);
  if(hit)return hit;
  const sw=sp.w,sh=sp.h,src=sp.c.getContext('2d').getImageData(0,0,sw,sh).data;
  const solid=(x,y)=>x>=0&&y>=0&&x<sw&&y<sh&&src[(y*sw+x)*4+3]>200;
  const W=(sw+2)*scale,H=(sh+2)*scale;
  const out=document.createElement('canvas');out.width=W;out.height=H;
  const og=out.getContext('2d'),im=og.createImageData(W,H),od=im.data;
  function stamp(px,py,r,g,b){
    if(px<0||py<0||px>=sw+2||py>=sh+2)return;
    for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){
      const i=((py*scale+y)*W+(px*scale+x))*4;
      od[i]=r;od[i+1]=g;od[i+2]=b;od[i+3]=255;
    }
  }
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    if(!solid(x,y))continue;
    // One art-pixel outline. Down-right is a touch heavier so it reads as a drop shadow.
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if((!dx&&!dy)||solid(x+dx,y+dy))continue;
      const soft=dx>0||dy>0;
      stamp(x+dx+1,y+dy+1,soft?10:22,soft?8:16,soft?16:28);
    }
  }
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    if(!solid(x,y))continue;
    const i=(y*sw+x)*4;
    stamp(x+1,y+1,src[i],src[i+1],src[i+2]);
  }
  og.putImageData(im,0,0);
  iconCache.set(key,out);
  return out;
}
function drawItemIcon(sp,x,y,box){
  if(!sp||!sp.c)return;
  ctx.imageSmoothingEnabled=false;
  if(sp.id){
    const cell=Math.max(sp.w,sp.h)+2;
    const scale=Math.max(1,Math.min(5,Math.floor((box-2)/cell)));
    const icon=outlinedIcon(sp,scale);
    ctx.drawImage(icon,Math.round(x+(box-icon.width)/2),Math.round(y+(box-icon.height)/2));
    return;
  }
  const sc=(box-2)/Math.max(sp.w,sp.h);
  const w=Math.round(sp.w*sc),h=Math.round(sp.h*sc);
  ctx.drawImage(sp.c,Math.round(x+(box-w)/2),Math.round(y+(box-h)/2),w,h);
}

const V25_FIT = 0.667;
const ATK_WIND = 0.18;
const ATK_FIRE = 0.2;
function mkAnim(frames, pal, fit){
  const list = frames.map(rows => mkSprite(rows, pal));
  const base = list[0];
  base.frames = list;
  if (fit) base.fit = fit;
  return base;
}
function installV25Sprites(){
  const A = window.SHARD_ART;
  if (!A) throw new Error('v27 art missing');
  for (const k in A.ENEMY_FRAMES){
    const s = A.ENEMY_FRAMES[k];
    SPR[k] = mkAnim(s.frames, s.pal, V25_FIT);
  }
  for (const k in A.GOD_FRAMES){
    const s = A.GOD_FRAMES[k];
    SPR[k] = mkAnim(s.frames, s.pal);
  }
  for (const k in A.BOSS_FRAMES){
    const s = A.BOSS_FRAMES[k];
    SPR[k] = mkAnim(s.frames, s.pal);
  }
  for (const k in A.EVENT_FRAMES){
    const s = A.EVENT_FRAMES[k];
    SPR[k] = mkAnim(s.frames, s.pal);
  }
  if(typeof EVENT_FRAMES_2!=='undefined'){
    for(const k in EVENT_FRAMES_2){
      const s=EVENT_FRAMES_2[k];
      SPR[k]=mkAnim(s.frames,s.pal,1);
    }
  }
  if(typeof MEGAKING_FRAMES!=='undefined'){
    for(const k in MEGAKING_FRAMES){
      const s=MEGAKING_FRAMES[k];
      SPR[k]=mkAnim(s.frames,s.pal,1);
    }
  }
  if(typeof MEGAKING_ENEMIES!=='undefined'){
    const big={kingsguard:1,shardherald:1};
    for(const k in MEGAKING_ENEMIES){
      const s=MEGAKING_ENEMIES[k];
      SPR[k]=mkAnim(s.frames,s.pal,big[k]?1:V25_FIT);
    }
  }
  // v27 body is drawn 1:1. body16 is the foe-sheet stand-in for the old serpentbody.
  const S2=typeof SEG_SPRITES_V27!=='undefined'?SEG_SPRITES_V27:null;
  if(S2){
    for(const k of ['body16','body14','body12','body10','tail'])SPR['serpent_'+k]=mkSprite(S2[k],S2.pal);
    SPR.serpentbody=SPR.serpent_body16;
    SPR.serpenttail=SPR.serpent_tail;
  }else{
    const seg=A.SEG_SPRITES;
    SPR.serpentbody=mkSprite(seg.serpentbody,seg.pal);
    SPR.serpenttail=mkSprite(seg.serpenttail,seg.pal);
  }
  for (const k in A.PLAYER_FRAMES){
    const p = A.PLAYER_FRAMES[k];
    const paint = rows => rows.map(r => mkSprite(r, p.pal));
    const side = paint(p.side), front = paint(p.front), back = paint(p.back);
    const base = side[0];
    base.frames = side;
    base.side = side;
    base.front = front;
    base.back = back;
    SPR[k] = base;
  }
  const pots = A.ITEM_CONSUMABLES.pots;
  SPR.pots = {};
  for (const k in pots) SPR.pots[k] = mkRaw(pots[k].rows, pots[k].pal);
  SPR.hp = SPR.pots.hp; SPR.mp = SPR.pots.mp; SPR.elixir = SPR.pots.att;
  const keys = A.ITEM_CONSUMABLES.keys;
  for (const k in keys) SPR[k] = mkRaw(keys[k].rows, keys[k].pal);
  const pearl = A.ITEM_UNIQUE.tidepearl;
  SPR.tidepearl = mkRaw(pearl.rows, pearl.pal);
}
const SK='#f1c27d',EY='#1b1b24';
const SPR={};
function buildSprites(){
  // Props stay hand-authored. Creatures, classes, pots, and keys are replaced by installV25Sprites.
  const pot=['...cc...','...nn...','..nlln..','.nlllln.','.nlllln.','.nlgln..','.nlllln.','..nnnn..'];
  const statPot=['...CC...','...GG...','..GLLG..','.GLHLLG.','.GLLLLG.','.GLLLLG.','..GLLG..','...GG...'];
  function potSprite(liquid,glint){return mkRaw(pot,{c:'#e8d2a2',n:'#d7e6f2',l:liquid,g:glint});}
  function statPotSprite(liquid,rim){return mkRaw(statPot,{C:'#8a5a2b',G:rim,L:liquid,H:'#ffffff'});}
  SPR.pots={
    hp:potSprite('#ff5c7a','#ffe0e8'),
    mp:potSprite('#6aa6ff','#e4f0ff'),
    att:statPotSprite('#ff4d9a','#ffc0dc'),
    def:statPotSprite('#121218','#6a6a74'),
    spd:statPotSprite('#2ea028','#c6ee9a'),
    dex:statPotSprite('#ff7a12','#ffd0a0'),
    vit:statPotSprite('#e02028','#ffb0b0'),
    life:statPotSprite('#9ad8ff','#eef8ff'),
    mana:statPotSprite('#ffe14a','#fff6c0'),
    wis:statPotSprite('#1a3ad0','#9ab0ff'),
    mastery:potSprite('#f0c020','#fff6a0')
  };
  SPR.hp=SPR.pots.hp;SPR.mp=SPR.pots.mp;SPR.elixir=SPR.pots.att;
  function keyArt(bow,shaft,tooth){return mkRaw(['..bbb...','b.....b.','b.....b.','..bsb...','...s....','...st...','...s.t..','...s....'],{b:bow,s:shaft,t:tooth});}
  SPR.key=keyArt('#ffd34a','#e0b040','#c89820');
  SPR.chest=mkSprite(["..gggg..","gggggggg","ggyyyggg","gggggggg","ggyyyggg","gggggggg"],{g:'#e3b33d',y:'#fff1a8'});
  SPR.beacon=mkSprite(["...cc...","..cwwc..","...cc...","...ll...","...ll...","..llll..","..lssl.."],{c:'#7af0ff',w:'#ffffff',l:'#d8dce8',s:'#5a6070'});
  // RotMG sack. Outline is baked by mkSprite. One palette per bag colour.
  const BAG_ROWS=['.tT..Tt.','..tTTt..','...cc...','.bhhbbb.','bhhbbbbd','bhbbbbdd','bbbbbddd','.dddddd.'];
  const BAG_PALS={
    brown:{t:'#f0d0a0',T:'#e8b878',h:'#e8b878',b:'#c4843c',d:'#7a4818',c:'#3f240e'},
    pink:{t:'#ffd6ea',T:'#ff9cc8',h:'#ff9cc8',b:'#f04898',d:'#a02868',c:'#6a1844'},
    purple:{t:'#f0d4ff',T:'#d498f8',h:'#d498f8',b:'#9030d0',d:'#541888',c:'#300860'},
    blue:{t:'#dce6ff',T:'#90b0ff',h:'#90b0ff',b:'#3060e8',d:'#1a2878',c:'#101848'},
    cyan:{t:'#eaffff',T:'#98f4f8',h:'#98f4f8',b:'#2ec4d0',d:'#0e7080',c:'#083840'},
    white:{t:'#ffffff',T:'#f6f8ff',h:'#f6f8ff',b:'#e0e6f2',d:'#a8b0c4',c:'#6c748c'}
  };
  SPR.bags={};
  for(const k in BAG_PALS)SPR.bags[k]=mkSprite(BAG_ROWS,BAG_PALS[k]);
  installWorldProps();
  SPR.keyTide=keyArt('#7ee0c8','#1a9a90','#e25a32');
  SPR.keyHex=keyArt('#9a5ad0','#6a38a0','#8fd16a');
  SPR.keyCinder=keyArt('#ff6a28','#c04018','#ffd34a');
  SPR.keyVoid=keyArt('#6a38a8','#3a1868','#e8e0ff');
  SPR.portalTide=mkSprite(['..cccc..','.c....c.','c..rr..c','c.r..r.c','c.r..r.c','c..rr..c','.c....c.','..cccc..'],{c:'#7ee0c8',r:'#e25a32'});
  SPR.portalHex=mkSprite(['..pppp..','.p....p.','p..gg..p','p.gwwg.p','p.gwwg.p','p..gg..p','.p....p.','..pppp..'],{p:'#8a44c8',g:'#8fd16a',w:'#e8ffc0'});
  SPR.portalCinder=mkSprite(['..oooo..','.o....o.','o..yy..o','o.ywwy.o','o.ywwy.o','o..yy..o','.o....o.','..oooo..'],{o:'#e04818',y:'#ffd34a',w:'#fff0c0'});
  SPR.portalVoid=mkSprite(['..vvvv..','.v.ww.v.','v..ss..v','vws..swv','vws..swv','v..ss..v','.v.ww.v.','..vvvv..'],{v:'#3a1868',w:'#ffffff',s:'#c46aff'});
  SPR.keyCoil=keyArt('#3d8a28','#1a5a20','#ffd34a');
  SPR.portalCoil=mkSprite(['..gggg..','.g.yy.g.','g.yssy.g','gy.ss.yg','gy.ss.yg','g.yssy.g','.g.yy.g.','..gggg..'],{g:'#2a6a28',y:'#ffd34a',s:'#7dce4a'});
  if(typeof MEGAKING_KEY!=='undefined')SPR.keyMega=mkRaw(MEGAKING_KEY.rows,MEGAKING_KEY.pal);
  if(typeof MEGAKING_PORTAL!=='undefined')SPR.portalMega=mkSprite(MEGAKING_PORTAL.rows,MEGAKING_PORTAL.pal);
  installV25Sprites();
  installLairProps();
  if(SPR.megaking_p4)SPR.megaking_ghost=tintFrames(SPR.megaking_p4,'#ffb8cc');
  if(typeof MEGAKING_TILES!=='undefined')DUNGEON_TILES.throne=MEGAKING_TILES;
}
function tintFrames(anim,hex){
  const n=parseInt(hex.slice(1),16)||0xffb8cc;
  const R=(n>>16)&255,G=(n>>8)&255,B=n&255;
  const frames=(anim.frames||[anim]).map(sp=>{
    const c=document.createElement('canvas');c.width=sp.w;c.height=sp.h;
    const g=c.getContext('2d');
    g.drawImage(sp.c,0,0);
    g.globalCompositeOperation='source-atop';
    g.fillStyle='rgba('+R+','+G+','+B+',0.55)';
    g.fillRect(0,0,sp.w,sp.h);
    const f=document.createElement('canvas');f.width=sp.w;f.height=sp.h;
    const g2=f.getContext('2d');g2.translate(sp.w,0);g2.scale(-1,1);g2.drawImage(c,0,0);
    return {c,f,w:sp.w,h:sp.h};
  });
  const base=frames[0];base.frames=frames;return base;
}
function installLairProps(){
  if(typeof LAIR_TILES==='undefined')return;
  for(const ev in LAIR_TILES){
    const props=LAIR_TILES[ev].props||{};
    for(const name in props)SPR['lair:'+ev+':'+name]=mkSprite(props[name].rows,LAIR_TILES[ev].pal);
  }
}
function installWorldProps(){
  function add(setName,set){
    const props=set.props;
    for(const name in props)SPR['w:'+setName+':'+name]=mkSprite(props[name],set.pal);
  }
  for(const k in WORLD_TILES)add(k,WORLD_TILES[k]);
  add('haven',HAVEN_TILES);
  // Dress sprites (bush, banners, torch, fountain) and the old prop names.
  // Raster draws SPR['w:'+set+':'+name] from wtLayers, not these aliases.
  const alias={
    tree:['greenmarch','tree'],boulder:['greenmarch','boulder'],reed:['shore','reed'],drift:['shore','drift'],
    flower:['greenmarch','flower'],stump:['greenmarch','stump'],vent:['ashen','vent'],pillar:['godlands','pillar'],
    ruin:['godlands','ruin'],campfire:['greenmarch','campfire'],statue:['godlands','statue'],
    planter:['haven','planter'],bench:['haven','bench'],crate:['haven','crate'],
    bush:['haven','bush'],banner:['haven','banner'],bannerB:['haven','bannerB'],bannerG:['haven','bannerG'],
    torch:['haven','torch'],fountain:['haven','fountain']
  };
  for(const k in alias){const a=alias[k];SPR[k]=SPR['w:'+a[0]+':'+a[1]];}
}

/* ---------------- tiered gear sprites ---------------- */
// Hand-authored 8x8 icons. Bows and staves still point down-left. Swords use the
// RotMG diagonal: pommel at the bottom-left, a crossguard across the blade, tip
// at the top-right. One dark outline is added at draw time. T0-T2 stay muted,
// T6-T8 carry a vivid pixel, and higher tiers add trim on the same silhouette.
const GEARSPR={};
const GEAR={
  sword:{
    rows:[
      ['.......t','......hb','.....hb.','....hb..','...hb...','..ggg...','r.......','p.......'],
      ['.......t','......hb','.....hb.','....hb..','...hb...','..ggg...','rr......','p.......'],
      ['.......t','......hb','.....hb.','....hbg.','...gg...','..ggg...','rr......','pp......'],
      ['.......t','......hb','.....hbg','....hbg.','..ghbg..','.rggg...','rr......','pm......'],
      ['.......t','......hb','.....hbs','....hbg.','..ghbg..','.rgggr..','rr......','pm......'],
      ['......st','......hb','.....hbs','....hbg.','..ghbg..','.rgggr..','rrr.....','pmm.....'],
      ['......st','......hb','.....hbs','....hbgs','..ghbg..','.rggggr.','rrrr....','pmm.....'],
      ['......st','......hb','.....hbs','....hbgs','..ghhbg.','.rggggr.','rrrrr...','pmmm....']
    ],
    pal:[
      {t:'#c8ccd0',h:'#b0b4b8',b:'#909498',g:'#6a5844',r:'#544030',p:'#3a2c22'},
      {t:'#bcc6d0',h:'#a4aeb8',b:'#849098',g:'#5c5048',r:'#484038',p:'#302820'},
      {t:'#d0c4b4',h:'#c0b09c',b:'#a09078',g:'#7a684c',r:'#5c4834',p:'#403028'},
      {t:'#e6eaf0',h:'#d0d6de',b:'#b4bcc6',g:'#c0a068',r:'#6a5038',p:'#d8dce4',m:'#8a4048'},
      {t:'#e8f2ff',h:'#d0e0f4',b:'#b0c4dc',g:'#d0b060',r:'#5c4830',p:'#d4e4f8',m:'#3060c8',s:'#7ec8ff'},
      {t:'#f0e0c8',h:'#e0c098',b:'#c08858',g:'#e0b050',r:'#6a4020',p:'#f0d8b0',m:'#9040b0',s:'#e0c8ff'},
      {t:'#fff6e0',h:'#ffe0a0',b:'#f4f7ff',g:'#ffd24a',r:'#6a3818',p:'#fff0c0',m:'#ff2458',s:'#ffffff'},
      {t:'#fff8f0',h:'#ffd090',b:'#ffb020',g:'#ffe14a',r:'#c4a050',p:'#fff6c0',m:'#ff4040',s:'#ffffff'}
    ],
    utRows:['......st','.....hhb','....hhb.','...hhbgs','..ghhbg.','.rggggr.','rrrrr...','pmmm....'],
    ut:{t:'#ffe0f4',h:'#ff4ad0',b:'#5a28a0',g:'#ffd34a',r:'#2a1038',p:'#140818',m:'#ff4ad0',s:'#ffe14a'},
    shot:['#c8c0b4','#d0d6e0','#aeb6c0','#f0e0b0','#8ec8ff','#d8b8ff','#ffe070','#ff5058'],
    utShot:'#ff2a5a',utShape:'slash',
    test:{rows:['.......t','......hb','.....hb.','....hb..','..ghbg..','.rgggr..','.rrr....','pm......'],pal:{t:'#ffffff',h:'#fff6c0',b:'#ffe9a0',g:'#ff3355',r:'#c8a050',p:'#fff6c0',m:'#ff3355'}}
  },
  bow:{
    rows:[
      ['......sb','.....s.b','....s..b','...s...b','..s.g..b','.s.....b','s......b','bbbb....'],
      ['......sb','.....s.b','....s..b','...s..gb','..s.g..b','.s.....b','s.....bb','bbbb....'],
      ['......sb','.....s.b','....s..b','...sg..b','..s.b..b','.s.....b','s.....bb','bbbb....'],
      ['......sb','.....s.b','....s..b','...sg.tb','..s.bb.b','.s....bb','s.....bb','bbbbb...'],
      ['.....tsb','....ts.b','....s..b','...sg.tb','..s.bb.b','.s....bb','s.....bb','bbbbb...'],
      ['.....tsb','....ts.b','...ts..b','...sg.tb','..s.bbt.','.s....bb','s.....bb','bbbbb...'],
      ['....ttsb','...tts.b','...ts..b','...sg.tb','..s.bbt.','.s...bbt','s.....bb','bbbbbb..'],
      ['...tttsb','..ttts.b','...ts..b','..tsg.tb','..s.bbt.','.s...bbt','s....bbb','bbbbbb..']
    ],
    pal:[
      {s:'#a09888',b:'#6a5438',g:'#8a6848'},
      {s:'#b0b4b8',b:'#5c6068',g:'#7a7e86'},
      {s:'#c0b8a0',b:'#5a4632',g:'#7a6248',t:'#8a7050'},
      {s:'#e0d8c0',b:'#8a6840',g:'#c4a060',t:'#a88848'},
      {s:'#d8e8e0',b:'#3a6848',g:'#c4a878',t:'#7ef0c8'},
      {s:'#f0e0c0',b:'#a06030',g:'#e0a848',t:'#c070c0'},
      {s:'#e8ff40',b:'#40c040',g:'#ff2860',t:'#ffe14a'},
      {s:'#ffe080',b:'#ffb020',g:'#ff2848',t:'#ffffff'}
    ],
    utRows:['.....tsc','....ts.c','...ts..c','...sg.tc','..s.cc..','.s..c...','s...c...','ccccc...'],
    ut:{s:'#ffe14a',c:'#d070ff',g:'#3dffa0',t:'#ffffff'},
    shot:['#c4b49a','#c8ccd4','#a89878','#e0b050','#5ad4c8','#c090e0','#ffe04a','#ff5050'],
    utShot:'#ffd34a',utShape:'diamond',
    test:{rows:['......sw','.....s.w','....s..w','...s.g.w','..s..ww.','.s..w...','s...w...','wwww....'],pal:{s:'#ffffff',w:'#ffe14a',g:'#fff6c0'}}
  },
  staff:{
    rows:[
      ['.....GG.','....GHHG','....GHHG','...S.GG.','..S.....','.S......','S.......','........'],
      ['.....GG.','....GHHG','....GHHG','...S.GG.','..S.....','.S......','S.......','........'],
      ['.....GG.','....GHHG','....GHHG','...S.GG.','..S.....','.S......','S.......','........'],
      ['.....GG.','....GHHG','....GHHG','...S.GG.','..S.....','.S......','S.......','........'],
      ['....mGG.','....GHHG','....GHHG','...S.GG.','..S.....','.S......','S.......','........'],
      ['....mGG.','...mGHHG','....GHHG','...S.GG.','..S.....','.S......','S.......','........'],
      ['.....GG.','....GHHG','....GHHm','...S.GG.','..SS....','.SS.....','SS......','S.......'],
      ['.....GGm','....GHHm','....GHHG','...SSGG.','..SSS...','.SS.....','SSS.....','SS......']
    ],
    pal:[
      {G:'#8a6840',H:'#c4b090',S:'#5c4030'},
      {G:'#7a7e86',H:'#b0b6be',S:'#4a5058'},
      {G:'#7a6248',H:'#b09070',S:'#5a4632'},
      {G:'#c07040',H:'#e0b070',S:'#6a5040'},
      {G:'#d8f4f8',H:'#eef8fc',S:'#4a6878',m:'#3ad4f0'},
      {G:'#e0d0f0',H:'#f4e8ff',S:'#5a4868',m:'#c080e0'},
      {G:'#fff0c0',H:'#ffe040',S:'#c06010',m:'#ff2860'},
      {G:'#ffffff',H:'#ffd060',S:'#e09020',m:'#ff4040'}
    ],
    utRows:['....mGG.','...mGHHg','....GHHG','...S.GG.','..S.....','.S......','S.......','B.......'],
    ut:{G:'#ffe14a',H:'#ffffff',S:'#2a1248',m:'#ff4ad0',g:'#ff9adf',B:'#6a30a0'},
    shot:['#c07840','#a8adb8','#8a7048','#e88830','#3ad4f0','#b070e8','#ff9a1a','#ff3868'],
    utShot:'#ff4aa0',utShape:'ring',
    test:{rows:['......oo','.....soo','....s...','...s....','..s.....','s.......','s.......','w.......'],pal:{o:'#ffffff',s:'#ff3355',w:'#ffe14a'}}
  },
  wand:{
    rows:[
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
      ['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........']
    ],
    pal:[
      {H:'#c4a070',G:'#e8d8c0',S:'#6a4a30',W:'#8a5a38',P:'#6a6e78'},
      {H:'#8a9098',G:'#d0d6de',S:'#5a6068',W:'#4a5058',P:'#b0b6be'},
      {H:'#c4a060',G:'#e8dcc0',S:'#6a5430',W:'#7a5430',P:'#c8b898'},
      {H:'#e0b040',G:'#fff0c0',S:'#8a6840',W:'#a07030',P:'#e0c888'},
      {H:'#3ad4f0',G:'#e8fbff',S:'#4a6878',W:'#2a4858',P:'#c0d0dc'},
      {H:'#c080e0',G:'#f4d8ff',S:'#5a4868',W:'#3a2848',P:'#c8c0d0'},
      {H:'#ff7030',G:'#fff6c0',S:'#ffd34a',W:'#8a2808',P:'#ffe08a'},
      {H:'#ff4040',G:'#ffffff',S:'#ffe080',W:'#c06020',P:'#fff6c0'}
    ],
    utRows:['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],
    ut:{H:'#ff9adf',G:'#ffffff',S:'#ffe08a',W:'#4a1868',P:'#ffd34a'},
    shot:['#c4a070','#b0b6be','#c4a070','#e0b050','#3ad4f0','#c080e0','#ffe040','#ff5058'],
    utShot:'#ff4ad0',utShape:'ring',
    test:{rows:['......H.','.....HGH','....S.H.','...S....','..WW....','.WW.....','.P......','........'],pal:{H:'#ffffff',G:'#ffe14a',S:'#ff3355',W:'#c8a050',P:'#ffffff'}}
  },
  dagger:{
    rows:[
      ['.......t','......hb','.....hb.','....gh..','...r....','..p.....','p.......','........'],
      ['.......t','......hb','.....hb.','....ghg.','...r....','..p.....','p.......','........'],
      ['.......t','......hb','.....hb.','...ghg..','...rr...','..p.....','pp......','........'],
      ['.......t','......hb','.....hbs','...gmg..','...rr...','..p.....','pp......','........'],
      ['......st','......hb','.....hbs','...gmg..','...rr...','..pp....','pp......','........'],
      ['......st','......hb','.....hbs','...gmg..','..rrr...','..pp....','pp......','p.......'],
      ['......st','......hb','....hhbs','...gmg..','..rrrr..','..ppp...','pp......','p.......'],
      ['.....sst','......hb','....hhbs','..ggmg..','..rrrr..','..pppp..','ppp.....','pp......']
    ],
    pal:[
      {t:'#d0d4dc',h:'#b4bac2',b:'#9098a0',g:'#6a6860',r:'#4a4038',p:'#3a3028'},
      {t:'#d8dce4',h:'#a8b0b8',b:'#848c94',g:'#5a646c',r:'#3a444c',p:'#2e343c'},
      {t:'#e0d0b8',h:'#c0a888',b:'#9c8464',g:'#7a6248',r:'#5a4030',p:'#3a2818'},
      {t:'#eee4d4',h:'#d4c4a4',b:'#b89c74',g:'#c4a060',r:'#5c4030',p:'#e4d4b0',m:'#8a3844',s:'#d8d0c4'},
      {t:'#f4eccc',h:'#d8ccaa',b:'#c0b080',g:'#d0a848',r:'#5a4030',p:'#ead8b0',m:'#3060b0',s:'#ffffff'},
      {t:'#ffe8c0',h:'#e0b878',b:'#c08040',g:'#e0b050',r:'#6a4020',p:'#f0d0a0',m:'#c06030',s:'#fff0c0'},
      {t:'#ffffff',h:'#ffd34a',b:'#e8a020',g:'#ff2860',r:'#6a3010',p:'#ffe14a',m:'#ffffff',s:'#fff6c0'},
      {t:'#ffffff',h:'#ffe08a',b:'#ffb020',g:'#ff4040',r:'#c4a050',p:'#fff6c0',m:'#ff2860',s:'#ffffff'}
    ],
    utRows:['.....sst','......hb','....hhbs','..ggmmg.','..rrrrr.','..pppp..','pppp....','pp......'],
    ut:{t:'#fff6c0',h:'#ff4a4a',b:'#c02020',g:'#ffd34a',r:'#3a1810',p:'#1a0c08',m:'#ffd34a',s:'#ffffff'},
    shot:['#c8ccd4','#b4bcc6','#c0b090','#e0c080','#8ec0e8','#e0a060','#ffe040','#ff5050'],
    utShot:'#ff4040',utShape:'slash',
    test:{rows:['.......t','......hb','.....hb.','....gh..','...r....','..p.....','p.......','........'],pal:{t:'#ffffff',h:'#fff6c0',b:'#ffe14a',g:'#ff3355',r:'#c8a050',p:'#ffffff'}}
  },
  shield:{
    rows:[
      ['.RRRRRR.','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','...RR...'],
      ['.RRRRRR.','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','...RR...'],
      ['.RRRRRR.','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','..RRR...'],
      ['.RRRRRR.','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','..RRR...'],
      ['RRRRRRR.','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','..RRR...'],
      ['RRRRRRRR','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','..RRRR..']
    ],
    pal:[
      {R:'#6a6660',M:'#8a8680',B:'#5a564e'},
      {R:'#5a646e',M:'#7a8490',B:'#4a545c'},
      {R:'#4e545c',M:'#6a7078',B:'#3e444c'},
      {R:'#c4a060',M:'#3a5a88',B:'#d0b070'},
      {R:'#ffd34a',M:'#d8e6ff',B:'#ff2860'},
      {R:'#ff4ad0',M:'#fff0c0',B:'#ff2028'}
    ],
    utRows:['.RRRRRR.','RMMMMMMR','RMMBBMMR','RMBBBBMR','RMMBBMMR','.RMMMMR.','..RMMR..','s..RR..s'],
    ut:{R:'#ffd34a',M:'#243058',B:'#7af0ff',s:'#ffffff'}
  },
  quiver:{
    rows:[
      ['....F.F.','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','.L......'],
      ['....F.F.','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','.L......'],
      ['...FF.F.','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','.L......'],
      ['...FF.F.','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','.L......'],
      ['..FFF.F.','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','.L......'],
      ['..FFF.FF','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','LL......']
    ],
    pal:[
      {F:'#8a6840',A:'#c4b090',L:'#6a5038',B:'#5c4030'},
      {F:'#7a7e86',A:'#b0b4ba',L:'#5c6068',B:'#4a4e56'},
      {F:'#8a7050',A:'#c0b090',L:'#6a5840',B:'#5a4632'},
      {F:'#6a8850',A:'#c8e0a0',L:'#3a6840',B:'#2a5030'},
      {F:'#ffe14a',A:'#ffffff',L:'#40c040',B:'#ff2860'},
      {F:'#ffffff',A:'#ffe080',L:'#ffb020',B:'#ff4040'}
    ],
    utRows:['....F.F.','...FAFA.','...LLL..','..LLLL..','.LBLL...','.LLL....','LLL.....','pL......'],
    ut:{F:'#ff4ad0',A:'#ffe14a',L:'#1c1028',B:'#3dffa0',p:'#ffffff'}
  },
  spell:{
    rows:[
      ['.CCCCCC.','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','.CCCCCC.','........'],
      ['.CCCCCC.','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','.CCCCCC.','........'],
      ['CCCCCCC.','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','.CCCCCC.','........'],
      ['CCCCCCC.','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','.CCCCCC.','........'],
      ['.CCCCCC.','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','C......C','........'],
      ['CCCCCCCC','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','CCCCCCCC','........']
    ],
    pal:[
      {C:'#6a5038',W:'#e4dcc8',S:'#8a7050',T:'#5c4838'},
      {C:'#5a6068',W:'#d8dce4',S:'#7a8088',T:'#4a5058'},
      {C:'#6a5840',W:'#e0d4c0',S:'#8a6848',T:'#5a4030'},
      {C:'#3a5888',W:'#e8eef8',S:'#6a80a0',T:'#2a4068'},
      {C:'#ff7030',W:'#fffef8',S:'#c8a060',T:'#6a4030'},
      {C:'#ff2860',W:'#ffffff',S:'#ffe08a',T:'#5a3020'}
    ],
    utRows:['gCCCCCC.','CWWWSWWC','CTTTSTTC','CWWWSWWC','CTTTSTTC','CWWWSWWC','.CCCCCC.','...C....'],
    ut:{C:'#ffd34a',W:'#fffef6',S:'#ffffff',T:'#6a2848',g:'#ff4ad0'}
  },
  tome:{
    rows:[
      ['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.'],
      ['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.'],
      ['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.'],
      ['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.'],
      ['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.'],
      ['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.']
    ],
    pal:[
      {S:'#5c3a24',C:'#a07850',X:'#b89850',P:'#d9d0c2'},
      {S:'#4a5058',C:'#9aa0a8',X:'#c4a050',P:'#d9d0c2'},
      {S:'#8a6840',C:'#c8a878',X:'#d0a848',P:'#e4dcc8'},
      {S:'#3a5878',C:'#b9d4f0',X:'#e0b040',P:'#e6dece'},
      {S:'#e8c050',C:'#eef6ff',X:'#e01828',P:'#d4ccc0'},
      {S:'#ffd34a',C:'#fffef8',X:'#ff2438',P:'#d4ccc0'}
    ],
    utRows:['.CCCCCC.','SCCCCCCP','SCCXCCCP','SCXXXCCP','SCCXCCCP','SCCXCCCP','SCCCCCCP','.PPPPPP.'],
    ut:{S:'#ffd34a',C:'#fffef6',X:'#ffffff',P:'#e6dece'}
  },
  robe:{
    rows:[
      ['..HHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['..HHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['..HHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['..HHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['.HHHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['.HHHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['HHHHHHH.','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR'],
      ['HHHHHHHH','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRR']
    ],
    pal:[
      {H:'#6a5870',R:'#5a4860',T:'#3a3048'},
      {H:'#7a7e88',R:'#5a5e68',T:'#3a3e48'},
      {H:'#6a5040',R:'#4a3828',T:'#8a7050'},
      {H:'#7a68b0',R:'#5a4890',T:'#c4a060'},
      {H:'#5a78a8',R:'#3a5888',T:'#d0b070'},
      {H:'#8a5070',R:'#6a3858',T:'#e0b060'},
      {H:'#ff7030',R:'#ff4018',T:'#ffe14a'},
      {H:'#ff70c0',R:'#ff40a0',T:'#ffffff'}
    ],
    utRows:['H.HHHH..','.HRRRRH.','.RRTRRR.','RRRTRRRR','.RRTRRR.','.RRTRRR.','RRRTRRRR','RRRRRRRg'],
    ut:{H:'#ffd34a',R:'#7a30b0',T:'#fff6c0',g:'#ff4ad0'}
  },
  leather:{
    rows:[
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','........'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','........'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','........'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','........'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','.L......'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','.L......'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','.LL..LL.'],
      ['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBBBBB.','.LLLLLL.','.LL..LL.','LLL..LLL']
    ],
    pal:[
      {L:'#c4b090',B:'#4a3424'},
      {L:'#b0b4ba',B:'#3a3e46'},
      {L:'#c0b090',B:'#3a2c20'},
      {L:'#e0c8a0',B:'#5a3820'},
      {L:'#7aaa68',B:'#142818'},
      {L:'#d0b080',B:'#6a3810'},
      {L:'#d4ff9a',B:'#ff2860'},
      {L:'#ffffff',B:'#ff3038'}
    ],
    utRows:['.LL..LL.','LLLLLLLL','LLLLLLLL','.LLLLLL.','.BBGBBB.','.LLLLLL.','.LL..LL.','L......L'],
    ut:{L:'#b6ff3a',B:'#6a4428',G:'#ffd34a'}
  },
  heavy:{
    rows:[
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','........'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','........'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','........'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','........'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','.P....P.'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','.P....P.'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','.PP..PP.'],
      ['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','PP....PP']
    ],
    pal:[
      {P:'#9a968e',H:'#d4d0c6',B:'#6a6660'},
      {P:'#8a929a',H:'#d4dce4',B:'#5a646e'},
      {P:'#6a7078',H:'#9aa0a8',B:'#4a5058'},
      {P:'#7a6a50',H:'#d0c0a0',B:'#5a4830'},
      {P:'#607080',H:'#e8eef4',B:'#c4a060'},
      {P:'#a08868',H:'#f4ead8',B:'#e0b060'},
      {P:'#d8e6ff',H:'#ffffff',B:'#ffd34a'},
      {P:'#ff3860',H:'#ffe14a',B:'#6a1020'}
    ],
    utRows:['PP....PP','PPPPPPPP','.PPHHPP.','.PPHHPP.','.PPPPPP.','.BBBBBB.','.PP..PP.','t......t'],
    ut:{P:'#7af0ff',H:'#ffffff',B:'#3a5080',t:'#ffd34a'}
  },
  helm:{
    rows:[
      ['...cc...','..hhhh..','.hhhhhh.','hhvvvvhh','hh.vv.hh','hhhhhhhh','h......h','hh....hh'],
      ['..cccc..','.hhhhhh.','lhhhhhhl','hhvvvvhh','hh.vv.hh','hhhhhhhh','h......h','hh....hh'],
      ['..cccc..','.hhhhhh.','lhhhhhhl','hhvvvvhh','hh.vv.hh','hhhhhhhh','h......h','ch....hc'],
      ['...pp...','.hhhhhh.','lhhhhhhl','hhvvvvhh','hh.vv.hh','hhhhhhhh','gh....hg','ch....hc'],
      ['g.pppp.g','.hhhhhh.','lhhhhhhl','hhvvvvhh','hh.vv.hh','hhhhhhhh','gh....hg','hh....hh'],
      ['g.pppp.g','ghhhhhhg','lhhhhhhl','hhvvvvhh','hh.vv.hh','gh....hg','h......h','hh....hh']
    ],
    pal:[
      {c:'#8a8478',h:'#6e6a64',v:'#1c1a16',l:'#a8a29a'},
      {c:'#9aa0a8',h:'#8a94a0',v:'#1a2026',l:'#c8d0d8'},
      {c:'#c4a868',h:'#b89858',v:'#2a2010',l:'#e0c888'},
      {c:'#e0c878',h:'#d0b060',v:'#2a1808',l:'#fff0c0',p:'#c02028',g:'#ffe9a0'},
      {c:'#ffe08a',h:'#e8c060',v:'#2a1408',l:'#fff6d0',p:'#ff2840',g:'#ffffff'},
      {c:'#fff6d0',h:'#ffd34a',v:'#1a0808',l:'#ffffff',p:'#ffd34a',g:'#ff4ad0'}
    ],
    utRows:['g.pppp.g','ghhhhhhg','lhhhhhhl','hhsssshh','hh.ss.hh','gh....hg','h......h','hh....hh'],
    ut:{h:'#fff6d0',l:'#ffffff',s:'#2a0818',p:'#ff4ad0',g:'#ffd34a'}
  },
  cloak:{
    rows:[
      ['....H...','...HHH..','..HLLH..','.HLLLLH.','HH.C.HH.','HHHHHHHH','HHH..HHH','HHHHHHHH'],
      ['....H...','...HHH..','..HLLH..','.HLLLLH.','HH.C.HH.','HHHHHHHH','HHH..HHH','HHHHHHHH'],
      ['....H...','...HHH..','..HLLH..','.HLLLLH.','HH.C.HH.','HHHHHHHH','HHH..HHH','HHHHHHHH'],
      ['....H...','...HHH..','..HLLH..','.HLLLLH.','HH.C.HH.','HHHHHHHH','HHH..HHH','HHTHTHHH'],
      ['...HT...','...HHH..','..HLLH..','.HLLLLH.','HH.C.HH.','HHTHTHHH','HHH..HHH','TTTHTHTT'],
      ['...HT...','...HTH..','..HLLH..','.HLLLLH.','TT.C.TT.','HHTHTHHH','HHH..HHH','TTTHTHTT']
    ],
    pal:[
      {H:'#8a9098',L:'#3a4048',C:'#d8dce4'},
      {H:'#8a6844',L:'#3a2818',C:'#e0c090'},
      {H:'#2a6848',L:'#143028',C:'#c8e090'},
      {H:'#7a48a8',L:'#2a1848',C:'#ffe08a',T:'#ffd34a'},
      {H:'#3a78c8',L:'#1a3058',C:'#ffffff',T:'#ffe14a'},
      {H:'#e04898',L:'#5a1848',C:'#fff6c0',T:'#ffe14a'}
    ],
    utRows:['...HT...','...HHH..','..HLLH..','.HLLLLH.','HH.C.HH.','HHHHHHHH','HHH..HHH','TTTHTHTT'],
    ut:{H:'#2a1848',L:'#100818',C:'#ff9adf',T:'#ffe08a'}
  }
};
function installRingSprites(){
  const art=window.SHARD_ART;
  const shape=art.RING_SHAPES,band=art.RING_BAND,gem=art.RING_GEM;
  for(const stat of STATK){
    const pals=[];
    for(let t=0;t<8;t++){
      const pair=gem[stat][t];
      const pal=Object.assign({g:pair[0],G:pair[1],r:pair[1]},band[t]);
      pals.push(pal);
    }
    const key=stat==='hp'?'ring':'ring_'+stat;
    GEAR[key]={rows:shape,pal:pals};
  }
}
const ABILITY_GEAR={spell:1,quiver:1,shield:1,tome:1,helm:1,cloak:1};
function buildGear(){
  const gearArt=window.SHARD_ART.ITEM_GEAR;
  for(const k in gearArt){
    const src=gearArt[k],g=GEAR[k];
    if(!g)throw new Error('v26 gear '+k);
    g.rows=src.rows;g.pal=src.pal;
    if(src.utRows)g.utRows=src.utRows;
    if(src.ut)g.ut=src.ut;
    if(src.test)g.test=src.test;
  }
  installRingSprites();
  for(const k in GEAR){
    const g=GEAR[k];
    for(let t=0;t<=8;t++){
      if(t>7&&!g.utRows)continue;
      if(t<=7&&!g.rows[t])continue;
      const rows=t>7?g.utRows:g.rows[t],pal=t>7?g.ut:g.pal[t],need={};
      for(const row of rows)for(const ch of row)if(ch!=='.')need[ch]=1;
      for(const ch in need)if(!pal[ch])throw new Error('sprite '+k+' T'+t+' missing '+ch);
      GEARSPR[k+'|'+t]=mkRaw(rows,pal);
    }
    if(g.test){
      const rows=g.test.rows,pal=g.test.pal,need={};
      for(const row of rows)for(const ch of row)if(ch!=='.')need[ch]=1;
      for(const ch in need)if(!pal[ch])throw new Error('sprite '+k+' test missing '+ch);
      GEARSPR[k+'|test']=mkRaw(rows,pal);
    }
    if(g.shot&&g.shot.length!==8)throw new Error('shot '+k);
  }
  function paintUnique(id,rows,pal){
    const need={};
    for(const row of rows)for(const ch of row)if(ch!=='.')need[ch]=1;
    for(const ch in need)if(!pal[ch])throw new Error('sprite '+id+' missing '+ch);
    GEARSPR[id]=mkRaw(rows,pal);
  }
  const uni=window.SHARD_ART.ITEM_UNIQUE;
  paintUnique('voidblade',uni.voidblade.rows,uni.voidblade.pal);
  paintUnique('vinebow',uni.vinebow.rows,uni.vinebow.pal);
  paintUnique('magmastaff',uni.magmastaff.rows,uni.magmastaff.pal);
  paintUnique('serpentwand',uni.serpentwand.rows,uni.serpentwand.pal);
}
function gearSpr(kind,tier){
  if(tier==='test')return GEARSPR[kind+'|test']||null;
  const ring=kind==='ring'||(typeof kind==='string'&&kind.indexOf('ring_')===0);
  let t=tier|0;
  if(ring)t=clamp(t,0,7);
  else if(ABILITY_GEAR[kind])t=t>7?8:clamp(t,0,5);
  else t=t>7?8:clamp(t,0,7);
  return GEARSPR[kind+'|'+t]||null;
}

/* ---------------- pixel bullets ---------------- */
const bulletCache={};
function mixCol(hex,p){
  const n=parseInt(String(hex).slice(1),16)||0xffffff;
  const R=(n>>16)&255,G=(n>>8)&255,B=n&255;
  const f=v=>clamp(Math.round(v+(255-v)*p),0,255).toString(16).padStart(2,'0');
  return '#'+f(R)+f(G)+f(B);
}
function bulletSpr(col,r,shape){
  const k=col+'|'+r+'|'+(shape||'dot');if(bulletCache[k])return bulletCache[k];
  const fancy=shape&&shape!=='dot';
  const sz=Math.ceil(r*2)+(fancy?6:2),c=document.createElement('canvas');c.width=c.height=sz;const g=c.getContext('2d');const m=sz/2;
  const core=mixCol(col,0.72);
  if(shape==='diamond'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const d=Math.abs(x+.5-m)+Math.abs(y+.5-m);
      if(d<=r+1.6){g.fillStyle=d>r*0.85?'#1a1028':d<r*0.42?'#fff6c8':col;g.fillRect(x,y,1,1);}}
  }else if(shape==='ring'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const d=Math.hypot(x+.5-m,y+.5-m);
      if(d<=r+1.5&&d>=r*0.55){g.fillStyle=d>r?core:col;g.fillRect(x,y,1,1);}
      else if(d<r*0.4){g.fillStyle='#fff4c0';g.fillRect(x,y,1,1);}}
  }else if(shape==='slash'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const dx=x+.5-m,dy=y+.5-m,along=(dx-dy)*0.55,side=(dx+dy)*0.55;
      if(Math.abs(along)<r+1.3&&Math.abs(side)<1.45){g.fillStyle=Math.abs(side)>0.75?'#241028':Math.abs(along)<r*0.35?'#fff':col;g.fillRect(x,y,1,1);}}
  }else if(shape==='leaf'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const dx=x+.5-m,dy=y+.5-m,along=(dx-dy)*0.7,side=(dx+dy)*0.85;
      if(Math.abs(along)<r+0.8&&Math.abs(side)<r*0.55+0.4){g.fillStyle=Math.abs(side)>r*0.28?'#1a3010':Math.abs(along)<0.7?'#e8ffc0':col;g.fillRect(x,y,1,1);}}
  }else if(shape==='void'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const dx=x+.5-m,dy=y+.5-m,d=Math.hypot(dx,dy);
      if(d<=r+1.2){g.fillStyle=d>r*0.72?'#ff4ad0':d<r*0.38?'#ffe0ff':'#2a0848';g.fillRect(x,y,1,1);}}
  }else if(shape==='star'){
    const rainbow=['#ff3355','#ff9a1a','#ffe14a','#3dffa0','#3aa0ff','#d060ff'];
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const dx=x+.5-m,dy=y+.5-m,ax=Math.abs(dx),ay=Math.abs(dy);
      if(ax>r+1.5||ay>r+1.5)continue;
      if(ax<1.25||ay<1.25||Math.abs(ax-ay)<1.05){const hue=(Math.round((Math.atan2(dy,dx)+Math.PI)/TAU*6)+6)%6;g.fillStyle=ax+ay<1.3?'#ffffff':rainbow[hue];g.fillRect(x,y,1,1);}}
  }else if(shape==='crown'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){
      const dx=x+.5-m,dy=y+.5-m,ax=Math.abs(dx);
      const band=dy>-r*0.2&&dy<r*0.72&&ax<r*1.05;
      const point=dy<=-r*0.2&&dy>-r*0.95&&(ax<r*0.22||Math.abs(ax-r*0.7)<r*0.24);
      if(band||point){g.fillStyle=dy<-r*0.45?'#fff6c0':ax>r*0.75?'#b8801c':col;g.fillRect(x,y,1,1);}
      else if(band&&false){}
    }
  }else if(shape==='venom'){
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const dx=x+.5-m,dy=y+.5-m,d=Math.hypot(dx,dy);
      if(d<=r+1.1){g.fillStyle=d>r*0.78?'#1a3010':(dx<-0.4&&dy<-0.3)?'#fff6c0':d<r*0.4?'#e8ff90':col;g.fillRect(x,y,1,1);}}
  }else{
    for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const d=Math.hypot(x+.5-m,y+.5-m);
      if(d<=r-0.6){g.fillStyle=d<r*0.45?'#ffffff':col;g.fillRect(x,y,1,1);}else if(d<=r+0.4){g.fillStyle='rgba(10,5,15,.8)';g.fillRect(x,y,1,1);}}
  }
  return bulletCache[k]=c;
}

/* ---------------- worlds ---------------- */
// tile types
const T_WATER=0,T_WET=1,T_SAND=2,T_GRASS=3,T_DARK=4,T_ROCK=5,T_ARENA=6,T_TREE=7,T_BOULDER=8,T_FLOOR=10,T_WALL=11,T_CARPET=12;
const T_RUG=20,T_PLANTER=21,T_BENCH=22,T_CRATE=23;
const T_REED=13,T_DRIFT=14,T_FLOWER=15,T_STUMP=16,T_VENT=17,T_PILLAR=18,T_RUIN=19;
const T_BFLOOR=30,T_BWALL=31,T_BPOOL=32,T_BCORAL=33,T_BPEARL=34;
const T_BROCK=35,T_BPLANK=36,T_BCRYST=37,T_BWEED=38;
const T_HFLOOR=40,T_HWALL=41,T_HPOOL=42,T_HROOT=43,T_HTOTEM=44,T_HCAUL=45,T_HSHALLOW=46,T_HCLEAR=47;
const T_CFLOOR=50,T_CWALL=51,T_CLAVA=52,T_CEGG=53,T_CROCK=54,T_CASH=55;
const T_VFLOOR=60,T_VWALL=61,T_VRUNE=62,T_VVOID=63,T_VPILLAR=64;
const T_SFLOOR=70,T_SWALL=71,T_SBREAK=72,T_SJADE=73;
const T_FIRE=80,T_STATUE=81,T_LAVA=82;
const T_MFLOOR=90,T_MWALL=91,T_MDAIS=92,T_MCARPET=93,T_MEND=94,T_MTHRONE=95,T_MPILLAR=96,T_MBROKEN=97,T_MPYLON=98,T_MRIFT=99,T_MBRAZIER=100;
const TCOL={
  0:[38,78,160],1:[196,182,120],2:[228,206,140],3:[86,150,70],4:[58,108,58],5:[104,102,120],6:[92,48,72],
  10:[118,116,134],11:[52,48,64],12:[120,40,56],
  13:[168,150,86],14:[190,160,110],15:[96,168,78],16:[70,120,62],17:[72,96,108],18:[150,130,150],19:[78,68,88],
  30:[176,132,84],31:[96,58,48],32:[36,118,132],33:[196,92,64],34:[214,168,120]
};
const SOLID=new Set([T_WATER,T_TREE,T_BOULDER,T_WALL,T_PILLAR,T_RUIN,T_STATUE,T_BWALL,T_BCORAL,T_BROCK,T_PLANTER,T_BENCH,T_CRATE,T_HWALL,T_HPOOL,T_HROOT,T_HTOTEM,T_HCAUL,T_CWALL,T_CLAVA,T_CEGG,T_CROCK,T_VWALL,T_VVOID,T_VPILLAR,T_SWALL,T_SBREAK,T_MWALL,T_MPILLAR,T_MPYLON,T_MBRAZIER]);
const DECO_SPR={
  [T_TREE]:'tree',[T_BOULDER]:'boulder',[T_REED]:'reed',[T_DRIFT]:'drift',[T_FLOWER]:'flower',
  [T_STUMP]:'stump',[T_VENT]:'vent',[T_PILLAR]:'pillar',[T_RUIN]:'ruin',
  [T_PLANTER]:'planter',[T_BENCH]:'bench',[T_CRATE]:'crate',
  [T_FIRE]:'campfire',[T_STATUE]:'statue'
};
const ZONES=[
  {name:'Saltmarsh Shore',types:['crab','imp','gull','slime','hermit','jelly'],col:'#e4ce8c'},
  {name:'Greenmarch',types:['wolf','hexer','dire','treant','bandit','moss'],col:'#7fd06a'},
  {name:'Ashen Wilds',types:['ogre','wisp','cinder','wraith','beetle','hound'],col:'#4fe6ff'},
  {name:'Godlands',types:['eye','colossus','oracle','saint','wyrm','titan','voidkeeper','idol','serpent'],col:'#ff6a8a'}];
// Beach-to-center ramp. Caps are about 1.6–1.8× the v11 counts so a region feels lived-in,
// while the shore stays the smallest and slowest. Packs are player-local. Far enemies are
// culled, and the global cap below keeps the bullet pool inside a 60 fps budget.
const SPAWN_CFG=[
  {cap:7, every:1.7, n:[1,2], elite:0, dist:[80,150]},
  {cap:16, every:0.95, n:[2,3], elite:0.04, dist:[108,200]},
  {cap:26, every:0.68, n:[2,3], elite:0.07, dist:[120,220]},
  {cap:8, every:1.6, n:[1,2], elite:0, dist:[160,260]}];
// 1200 tiles on a side. Bands stay radial fractions, so each biome and the walk
// between them grows with the disc. Spawns stay player-local so the phone still holds 60 fps.
const REALM_N=1200;
const ENTRY_SAFE=20*TS;
const CHUNK=32,CHUNK_CAP=36;
function mkWorld(w,h){return {w,h,tiles:new Uint8Array(w*h),zone:new Int8Array(w*h).fill(-1),canvas:null,mini:null,map:null,chunks:null,chunked:false,enemies:[],bags:[],portals:[],landmarks:[],isHub:false};}
function tileAt(wd,x,y){const tx=Math.floor(x/TS),ty=Math.floor(y/TS);if(tx<0||ty<0||tx>=wd.w||ty>=wd.h)return T_WATER;return wd.tiles[ty*wd.w+tx];}
function lairCell(wd,x,y){
  if(!wd||!wd.lair)return null;
  const tx=Math.floor(x/TS),ty=Math.floor(y/TS);
  return wd.lair[tx+','+ty]||null;
}
function lairSolid(wd,x,y){const c=lairCell(wd,x,y);return !!(c&&c.solid);}
function solidAt(wd,x,y){return lairSolid(wd,x,y)||SOLID.has(tileAt(wd,x,y));}
function zoneAt(wd,x,y){const tx=Math.floor(x/TS),ty=Math.floor(y/TS);if(tx<0||ty<0||tx>=wd.w||ty>=wd.h)return -1;return wd.zone[ty*wd.w+tx];}
function solidBox(wd,x,y,r){return solidAt(wd,x-r,y-r)||solidAt(wd,x+r,y-r)||solidAt(wd,x-r,y+r)||solidAt(wd,x+r,y+r);}
function findOpen(wd,tx,ty,zone){
  const lim=Math.max(28,Math.min(72,Math.floor(Math.min(wd.w,wd.h)*0.08)));
  for(let r=0;r<lim;r++){
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(r&&Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=tx+dx,y=ty+dy;
      if(x<3||y<3||x>=wd.w-3||y>=wd.h-3)continue;
      const i=y*wd.w+x;
      if(zone!=null&&wd.zone[i]!==zone)continue;
      const t=wd.tiles[i];
      if(t===T_WATER||t===T_WALL||t===T_WET)continue;
      return {tx:x,ty:y};
    }
  }
  return {tx:clamp(tx,3,wd.w-4),ty:clamp(ty,3,wd.h-4)};
}
function clearSolids(wd,tx,ty,rad){
  const z=wd.zone[ty*wd.w+tx];
  const ground=z<=0?T_SAND:z===1?T_GRASS:z===2?T_DARK:T_ROCK;
  for(let y=ty-rad;y<=ty+rad;y++)for(let x=tx-rad;x<=tx+rad;x++){
    if(x<1||y<1||x>=wd.w-1||y>=wd.h-1)continue;
    const i=y*wd.w+x,t=wd.tiles[i];
    if(t===T_WATER||t===T_WET||t===T_WALL||t===ground)continue;
    wd.tiles[i]=ground;
  }
}
function hash2(x,y){
  let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)|0;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function tileBase(wd,i,t){
  const z=wd.zone[i];
  if(t===T_TREE||t===T_FLOWER||t===T_STUMP)return z>=2?T_DARK:T_GRASS;
  if(t===T_BOULDER)return z>=3?T_ROCK:(z>=2?T_DARK:T_SAND);
  if(t===T_REED)return T_WET;
  if(t===T_DRIFT)return T_SAND;
  if(t===T_VENT)return T_DARK;
  if(t===T_PILLAR||t===T_RUIN||t===T_STATUE)return T_ROCK;
  if(t===T_FIRE)return z<=0?T_SAND:z===1?T_GRASS:z===2?T_DARK:T_ROCK;
  if(t===T_BCORAL||t===T_BROCK||t===T_BPLANK||t===T_BCRYST||t===T_BWEED)return T_BFLOOR;
  if(t===T_HROOT||t===T_HTOTEM||t===T_HCAUL||t===T_HSHALLOW)return T_HFLOOR;
  if(t===T_CEGG||t===T_CROCK||t===T_CASH)return T_CFLOOR;
  if(t===T_VRUNE||t===T_VPILLAR)return T_VFLOOR;
  if(t===T_PLANTER||t===T_BENCH||t===T_CRATE||t===T_RUG)return t===T_RUG?T_RUG:T_FLOOR;
  return t;
}
function dungeonSetOf(wd){
  const th=wd&&wd.theme;
  if(th==='tide'||(wd&&wd.dungeonId==='tideclaw'))return 'tideclaw';
  if(th==='hex')return 'hexmire';
  if(th==='cinder')return 'cinder';
  if(th==='sanctum')return 'void';
  if(th==='coil')return 'coil';
  if(th==='throne')return 'throne';
  return null;
}
// Out-of-map counts as wall, matching burrowWallAt/denWallAt. T_VVOID is a pit, not a wall.
// T_SBREAK is a wall so the coil seals pick a face or a cracked cap from their neighbours.
function dunIsWall(set,wd,tx,ty){
  if(!wd||tx<0||ty<0||tx>=wd.w||ty>=wd.h)return true;
  const t=wd.tiles[ty*wd.w+tx];
  if(set==='tideclaw')return t===T_BWALL;
  if(set==='hexmire')return t===T_HWALL;
  if(set==='cinder')return t===T_CWALL;
  if(set==='void')return t===T_VWALL;
  if(set==='throne')return t===T_MWALL;
  return t===T_SWALL||t===T_SBREAK;
}
function dunKind(set,wd,tx,ty){
  if(!wd||tx<0||ty<0||tx>=wd.w||ty>=wd.h)return null;
  const t=wd.tiles[ty*wd.w+tx];
  if(set==='tideclaw'){
    if(t===T_BPOOL)return 'pool';
    if(t===T_BCORAL)return 'coral';
    if(t===T_BPEARL)return 'pearlFloor';
    if(t===T_BROCK)return 'rock';
    if(t===T_BPLANK)return 'plank';
    if(t===T_BCRYST)return 'crystal';
    if(t===T_BWEED)return 'weed';
    return null;
  }
  if(set==='hexmire'){
    if(t===T_HPOOL)return 'pool';
    if(t===T_HSHALLOW)return 'shallow';
    if(t===T_HCLEAR)return 'clearing';
    if(t===T_HROOT)return 'root';
    if(t===T_HTOTEM)return 'totem';
    if(t===T_HCAUL)return 'cauldron';
    return null;
  }
  if(set==='cinder'){
    if(t===T_CLAVA)return 'lava';
    if(t===T_CASH)return 'ash';
    if(t===T_CEGG)return 'egg';
    if(t===T_CROCK)return 'rock';
    return null;
  }
  if(set==='void'){
    if(t===T_VRUNE)return 'rune';
    if(t===T_VPILLAR)return 'pillar';
    if(t===T_VVOID)return 'void';
    return null;
  }
  if(t===T_SJADE)return 'jade';
  if(t===T_SBREAK)return 'breakWall';
  return null;
}
function dungeonLayers(wd,tx,ty){
  const set=dungeonSetOf(wd);
  if(!set)return null;
  if(set==='throne')return {set:set,layers:throneLayers(wd,tx,ty)};
  return {set:set,layers:dtLayers(set,(x,y)=>dunIsWall(set,wd,x,y),(x,y)=>dunKind(set,wd,x,y),tx,ty)};
}
function throneAt(wd,x,y){
  if(!wd||x<0||y<0||x>=wd.w||y>=wd.h)return 0;
  return wd.tiles[y*wd.w+x];
}
function throneLayers(wd,tx,ty){
  const D=DUNGEON_TILES.throne;
  if(!D)return [['kkkkkkkk','kkkkkkkk','kkkkkkkk','kkkkkkkk','kkkkkkkk','kkkkkkkk','kkkkkkkk','kkkkkkkk']];
  const E=D.edges,t=throneAt(wd,tx,ty);
  const isWall=(x,y)=>x<0||y<0||x>=wd.w||y>=wd.h||throneAt(wd,x,y)===T_MWALL;
  const N=isWall(tx,ty-1),S=isWall(tx,ty+1),W=isWall(tx-1,ty),Ea=isWall(tx+1,ty);
  if(t===T_MWALL||tx<0||ty<0||tx>=wd.w||ty>=wd.h){
    if(!S){
      const face=D.wallBanner&&dtHash(tx,ty,13)<1/6?D.wallBanner:(dtHash(tx,ty,7)<0.2?D.wallFace2:D.wallFace);
      const L=[face];
      if(!N)L.push(E.edgeN);if(!W)L.push(E.faceEdgeL);if(!Ea)L.push(E.faceEdgeR);
      return L;
    }
    if(N&&W&&Ea&&isWall(tx-1,ty-1)&&isWall(tx+1,ty-1)&&isWall(tx-1,ty+1)&&isWall(tx+1,ty+1))return [D.wallDeep];
    const L=[dtHash(tx,ty,3)<0.2?D.wallTop2:D.wallTop];
    if(!N)L.push(E.edgeN);if(!W)L.push(E.edgeL);if(!Ea)L.push(E.edgeR);
    if(N&&W&&!isWall(tx-1,ty-1))L.push(E.cornerNW);
    if(N&&Ea&&!isWall(tx+1,ty-1))L.push(E.cornerNE);
    if(W&&!isWall(tx-1,ty+1))L.push(E.cornerSW);
    if(Ea&&!isWall(tx+1,ty+1))L.push(E.cornerSE);
    return L;
  }
  const L=[];
  const floorMix=()=>{const r=dtHash(tx,ty,1),f=D.floors;return f[r<0.55?0:r<0.7?1:r<0.85?2:3];};
  const daisLike=t===T_MDAIS||t===T_MTHRONE||t===T_MBRAZIER;
  const carpetLike=t===T_MCARPET||t===T_MEND;
  if(t===T_MRIFT){
    L.push(dtAlt(D.props,'rift',tx,ty));
    const rim=D.rims.rift,same=k=>throneAt(wd,tx+k[0],ty+k[1])===T_MRIFT;
    if(rim){
      if(!same([0,-1]))L.push(rim.n);
      if(!same([0,1]))L.push(rim.s);
      if(!same([-1,0]))L.push(rim.w);
      if(!same([1,0]))L.push(rim.e);
    }
  }else if(daisLike){
    L.push(D.props.dais);
  }else if(carpetLike){
    L.push(t===T_MEND?D.props.carpetEnd:D.props.carpet);
  }else L.push(floorMix());
  const raw=D.propsRaw||{};
  if(t===T_MTHRONE){
    const name=(wd.mkName&&wd.mkName[tx+','+ty])||'throne22';
    if(raw[name])L.push(raw[name]);
    else if(D.props[name])L.push(D.props[name]);
  }else if(t===T_MPILLAR)L.push(raw.pillar||D.props.pillar);
  else if(t===T_MBROKEN)L.push(raw.brokenPillar||D.props.brokenPillar);
  else if(t===T_MPYLON){
    const alt=dtHash(tx,ty,4)<0.5;
    L.push(alt?(raw.pylon2||D.props.pylon2):(raw.pylon||D.props.pylon));
  }else if(t===T_MBRAZIER)L.push(raw.brazier||D.props.brazier);
  else if(t===T_MFLOOR&&dtHash(tx,ty,5)<0.1){
    const d=Object.values(D.details||{});
    if(d.length)L.push(d[(dtHash(tx,ty,9)*d.length)|0]);
  }
  if(daisLike&&D.rims&&D.rims.dais){
    const rim=D.rims.dais,same=k=>{const u=throneAt(wd,tx+k[0],ty+k[1]);return u===T_MDAIS||u===T_MTHRONE||u===T_MBRAZIER;};
    if(!same([0,-1]))L.push(rim.n);
    if(!same([0,1]))L.push(rim.s);
    if(!same([-1,0]))L.push(rim.w);
    if(!same([1,0]))L.push(rim.e);
  }
  if(carpetLike&&D.rims&&D.rims.carpet){
    const rim=D.rims.carpet,same=k=>{const u=throneAt(wd,tx+k[0],ty+k[1]);return u===T_MCARPET||u===T_MEND;};
    if(!same([0,-1]))L.push(rim.n);
    if(t!==T_MEND&&!same([0,1]))L.push(rim.s);
    if(!same([-1,0]))L.push(rim.w);
    if(!same([1,0]))L.push(rim.e);
  }
  if(N)L.push(E.shadowN);
  if(W)L.push(E.shadowW);
  return L;
}
function lairRGB(art,ch){
  if(!ch||ch==='.'||!art.pal[ch])return null;
  const n=parseInt(art.pal[ch].slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function lairPlainGround(wd,x,y,ground){
  if(!wd||x<0||y<0||x>=wd.w||y>=wd.h)return false;
  if(wd.lair&&wd.lair[x+','+y])return false;
  const c=wtClassify(wd,x,y);
  return c.k==='ground'&&c.ter===ground;
}
function paintLairTile(wd,tx,ty){
  const cell=wd.lair[tx+','+ty];
  if(!cell)return null;
  const art=LAIR_TILES[cell.event];
  if(!art)return null;
  const anchor=cell.anchor?{spr:SPR['lair:'+cell.event+':'+cell.prop]}:null;
  if(cell.kind==='prop'||cell.kind==='decal'){
    const base=wtLayers(wd,tx,ty);
    return {col:(px,py)=>{
      let c=wtPixel(base.layers,px,py);
      if(cell.decal){
        const rows=art.decals[cell.decal]&&art.decals[cell.decal].rows;
        const ch=rows&&rows[py]&&rows[py][px];
        const rgb=lairRGB(art,ch);
        if(rgb)c=rgb;
      }
      return c;
    },deco:anchor};
  }
  const floorArt=LAIR_TILES[cell.artEvent||cell.event];
  const floor=floorArt&&floorArt.floors[cell.floor];
  return {col:(px,py)=>{
    let c=[40,36,48];
    if(floor){
      const ch=floor.rows[py][px];
      c=lairRGB(floorArt,ch)||c;
    }
    if(floor&&floor.blend){
      const edges=WORLD_TILES[floorArt.biome]&&WORLD_TILES[floorArt.biome].edges[floorArt.ground];
      if(edges){
        const alt=hash2(tx,ty)<0.5?'2':'';
        const g=floorArt.ground;
        const paintEdge=(rows)=>{
          const ch=rows&&rows[py]&&rows[py][px];
          if(ch&&ch!=='.')c=wtRGB(floorArt.biome,ch);
        };
        const side=(dir,dx,dy)=>{
          if(!lairPlainGround(wd,tx+dx,ty+dy,g))return;
          paintEdge(edges[dir+alt]||edges[dir]);
        };
        side('n',0,-1);side('s',0,1);side('w',-1,0);side('e',1,0);
        const corner=(dir,dx,dy,a,b)=>{
          if(!lairPlainGround(wd,tx+dx,ty+dy,g))return;
          if(lairPlainGround(wd,tx+a,ty,g)||lairPlainGround(wd,tx,ty+b,g))return;
          paintEdge(edges[dir]);
        };
        corner('nw',-1,-1,-1,-1);corner('ne',1,-1,1,-1);corner('sw',-1,1,-1,1);corner('se',1,1,1,1);
      }
    }
    const rims=floorArt.rims||{};
    for(const key in rims){
      const rim=rims[key];
      if(!rim.tiles||rim.tiles.indexOf(cell.floor)<0)continue;
      const same=(dx,dy)=>{
        const o=wd.lair[(tx+dx)+','+(ty+dy)];
        return !!(o&&rim.tiles.indexOf(o.floor)>=0);
      };
      const paint=(dir,dx,dy)=>{
        if(same(dx,dy)||!rim[dir])return;
        const ch=rim[dir][py][px];
        const rgb=lairRGB(floorArt,ch);
        if(rgb)c=rgb;
      };
      paint('n',0,-1);paint('s',0,1);paint('w',-1,0);paint('e',1,0);
    }
    return c;
  },deco:null};
}
function outsideDist(wd,tx,ty){
  const dx=tx<0?-tx:tx>=wd.w?tx-(wd.w-1):0;
  const dy=ty<0?-ty:ty>=wd.h?ty-(wd.h-1):0;
  return Math.max(dx,dy);
}
function fadeVoid(c,tx,ty,px,py,dist,reach){
  const fade=dist<=1?1:clamp(1-(dist-1)/reach,0,1);
  const k=fade*fade;
  const g=(hash2(tx*5+px,ty*9+py)-0.5)*12*fade;
  return [clamp(c[0]*k+g,0,255)|0,clamp(c[1]*k+g*0.9,0,255)|0,clamp(c[2]*k+g*0.75,0,255)|0];
}
// Sanctum fills the outside with the void pit. Coil fills it with wallDeep. Tide, hex and cinder fade wallDeep to black.
function outsideLayers(wd,tx,ty){
  if(wd.theme==='throne'){
    return {set:'throne',layers:dtLayers('throne',()=>true,()=>null,tx,ty)};
  }
  if(wd.theme==='sanctum'){
    return {set:'void',layers:dtLayers('void',
      (x,y)=>x>=0&&y>=0&&x<wd.w&&y<wd.h&&wd.tiles[y*wd.w+x]===T_VWALL,
      (x,y)=>{
        if(x<0||y<0||x>=wd.w||y>=wd.h)return 'void';
        return wd.tiles[y*wd.w+x]===T_VVOID?'void':null;
      },tx,ty)};
  }
  return {set:'coil',layers:dtLayers('coil',()=>true,()=>null,tx,ty)};
}
function voidRGB(wd,tx,ty,px,py){
  const theme=wd&&wd.theme;
  if(theme==='sanctum'||theme==='coil'||theme==='throne'){
    const pack=outsideLayers(wd,tx,ty);
    return dtPixel(pack.set,pack.layers,px,py);
  }
  const set=theme==='hex'?'hexmire':theme==='cinder'?'cinder':'tideclaw';
  return fadeVoid(dtRGBOf(set,'D'),tx,ty,px,py,outsideDist(wd,tx,ty),12);
}

function field(tx,ty,s){
  const x=tx/s,y=ty/s,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(ix,iy)=>hash2(ix,iy);
  const a=h(x0,y0),b=h(x0+1,y0),c=h(x0,y0+1),d=h(x0+1,y0+1);
  return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}
function paintWorldTile(wd,wx,wy){
  if(wd.lair){
    const painted=paintLairTile(wd,wx,wy);
    if(painted)return painted;
  }
  if(wd.isDungeon){
    const pack=dungeonLayers(wd,wx,wy);
    return {col:(px,py)=>pack?dtPixel(pack.set,pack.layers,px,py):[8,12,16],deco:null};
  }
  const pack=wtLayers(wd,wx,wy);
  return {col:(px,py)=>wtPixel(pack.layers,px,py),deco:pack.deco};
}
function tileRGB(wd,tx,ty,px,py){
  if(!wd||tx<0||ty<0||tx>=wd.w||ty>=wd.h)return [8,12,16];
  return paintWorldTile(wd,tx,ty).col(px,py);
}
function minimapRGB(wd,tx,ty){
  if(wd.lair&&wd.lair[tx+','+ty]){
    const c=paintWorldTile(wd,tx,ty).col(4,4);
    return c;
  }
  const t=wd.tiles[ty*wd.w+tx],k=DECO_SPR[t]?0.62:1;
  if(wd.isDungeon){
    let r=0,g=0,b=0;
    const pack=dungeonLayers(wd,tx,ty);
    for(const [px,py] of [[1,1],[4,2],[3,5],[6,4]]){
      const c=pack?dtPixel(pack.set,pack.layers,px,py):[8,12,16];
      r+=c[0];g+=c[1];b+=c[2];
    }
    return [(r*k/4)|0,(g*k/4)|0,(b*k/4)|0];
  }
  const c=wtPixel(wtLayers(wd,tx,ty).layers,4,4);
  return [(c[0]*k)|0,(c[1]*k)|0,(c[2]*k)|0];
}
function blitTile(d,width,tx,ty,colAt){
  for(let py=0;py<TS;py++)for(let px=0;px<TS;px++){
    const col=colAt(px,py),p=((ty*TS+py)*width+(tx*TS+px))*4;
    d[p]=col[0];d[p+1]=col[1];d[p+2]=col[2];d[p+3]=255;
  }
}
function drawProp(g,tx,ty,deco){
  if(!deco)return;
  if(deco.spr){g.drawImage(deco.spr.c,tx*TS-1,ty*TS-1);return;}
  const s=SPR['w:'+deco[0]+':'+deco[1]];
  if(s)g.drawImage(s.c,tx*TS-1,ty*TS-1);
}
function raster(wd,x0,y0,tw,th){
  const c=document.createElement('canvas');c.width=tw*TS;c.height=th*TS;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const img=g.createImageData(c.width,c.height),d=img.data;
  const decos=[];
  for(let ty=0;ty<th;ty++)for(let tx=0;tx<tw;tx++){
    const wx=x0+tx,wy=y0+ty;
    if(wx<0||wy<0||wx>=wd.w||wy>=wd.h)continue;
    // One neighbour pass per tile. Dungeons still paint through the 8x8 pieces; the realm does not.
    const tile=paintWorldTile(wd,wx,wy);
    if(tile.deco)decos.push([tx,ty,tile.deco]);
    blitTile(d,c.width,tx,ty,tile.col);
  }
  g.putImageData(img,0,0);
  for(const deco of decos)drawProp(g,deco[0],deco[1],deco[2]);
  return c;
}
function rasterVoid(wd,x0,y0,tw,th){
  const c=document.createElement('canvas');c.width=tw*TS;c.height=th*TS;
  const g=c.getContext('2d'),img=g.createImageData(c.width,c.height),d=img.data;
  const decos=[];
  const hub=!!(wd&&wd.isHub);
  for(let ty=0;ty<th;ty++)for(let tx=0;tx<tw;tx++){
    const wx=x0+tx,wy=y0+ty;
    if(wx>=0&&wy>=0&&wx<wd.w&&wy<wd.h)continue;
    let colAt;
    if(hub){
      const pack=wtLayers(wd,wx,wy);
      colAt=(px,py)=>wtPixel(pack.layers,px,py);
      const deco=wtOutsideDeco(wx,wy);
      if(deco)decos.push([tx,ty,deco]);
    }else if(wd.theme==='sanctum'||wd.theme==='coil'){
      const pack=outsideLayers(wd,wx,wy);
      colAt=(px,py)=>dtPixel(pack.set,pack.layers,px,py);
    }else colAt=(px,py)=>voidRGB(wd,wx,wy,px,py);
    blitTile(d,c.width,tx,ty,colAt);
  }
  g.putImageData(img,0,0);
  for(const deco of decos)drawProp(g,deco[0],deco[1],deco[2]);
  return c;
}
function paintMinimap(wd){
  const mini=document.createElement('canvas');mini.width=wd.w;mini.height=wd.h;
  const mg=mini.getContext('2d'),img=mg.createImageData(wd.w,wd.h),md=img.data;
  for(let y=0;y<wd.h;y++)for(let x=0;x<wd.w;x++){
    const col=minimapRGB(wd,x,y),o=(y*wd.w+x)*4;
    md[o]=col[0];md[o+1]=col[1];md[o+2]=col[2];md[o+3]=255;
  }
  mg.putImageData(img,0,0);
  wd.mini=mini;wd.map=mini;
}
function renderWorld(wd){
  paintMinimap(wd);
  // Haven and the Vault fit in one canvas. The realm is chunked so a 1200-tile map
  // never allocates a full pixel buffer, and only the tiles on screen are drawn.
  if(wd.w*wd.h<=96*96){wd.canvas=raster(wd,0,0,wd.w,wd.h);wd.chunked=false;wd.chunks=null;}
  else{wd.canvas=null;wd.chunked=true;wd.chunks=new Map();}
}
let chunkTick=0;
function drawDungeonVoid(wd){
  if(!wd||(!wd.isDungeon&&!wd.isHub))return;
  if(!wd.voidChunks)wd.voidChunks=new Map();
  chunkTick++;
  const tx0=Math.floor(camX/TS)-1,ty0=Math.floor(camY/TS)-1,tx1=Math.ceil((camX+VW)/TS)+1,ty1=Math.ceil((camY+VH)/TS)+1;
  for(let cy=Math.floor(ty0/CHUNK);cy<=Math.floor(ty1/CHUNK);cy++)for(let cx=Math.floor(tx0/CHUNK);cx<=Math.floor(tx1/CHUNK);cx++){
    const x0=cx*CHUNK,y0=cy*CHUNK,x1=x0+CHUNK,y1=y0+CHUNK;
    if(x0>=0&&y0>=0&&x1<=wd.w&&y1<=wd.h)continue;
    const dx=x1<=0?1-x1:x0>=wd.w?x0-(wd.w-1):0;
    const dy=y1<=0?1-y1:y0>=wd.h?y0-(wd.h-1):0;
    if(Math.max(dx,dy)>(wd.isHub?80:18))continue;
    const key=cx+','+cy;
    let ch=wd.voidChunks.get(key);
    if(!ch){
      ch={c:rasterVoid(wd,x0,y0,CHUNK,CHUNK),used:0};
      wd.voidChunks.set(key,ch);
      if(wd.voidChunks.size>48){
        let oldK=null,oldU=1e15;
        for(const [k,v] of wd.voidChunks){if(k!==key&&v.used<oldU){oldU=v.used;oldK=k;}}
        if(oldK)wd.voidChunks.delete(oldK);
      }
    }
    ch.used=chunkTick;
    ctx.drawImage(ch.c,x0*TS,y0*TS);
  }
}
function drawTerrain(wd){
  if(!wd)return;
  if(wd.canvas){
    const wc=wd.canvas;
    const sx=clamp(Math.floor(camX),0,Math.max(0,wc.width-1)),sy=clamp(Math.floor(camY),0,Math.max(0,wc.height-1));
    const sw=Math.min(Math.ceil(VW)+2,wc.width-sx),sh=Math.min(Math.ceil(VH)+2,wc.height-sy);
    if(sw>0&&sh>0)ctx.drawImage(wc,sx,sy,sw,sh,sx,sy,sw,sh);
    return;
  }
  if(!wd.chunks)wd.chunks=new Map();
  chunkTick++;
  const tx0=Math.floor(camX/TS)-1,ty0=Math.floor(camY/TS)-1,tx1=Math.ceil((camX+VW)/TS)+1,ty1=Math.ceil((camY+VH)/TS)+1;
  for(let cy=Math.floor(ty0/CHUNK);cy<=Math.floor(ty1/CHUNK);cy++)for(let cx=Math.floor(tx0/CHUNK);cx<=Math.floor(tx1/CHUNK);cx++){
    const x0=cx*CHUNK,y0=cy*CHUNK;
    if(x0<0||y0<0||x0>=wd.w||y0>=wd.h)continue;
    const key=cx+','+cy;
    let ch=wd.chunks.get(key);
    if(!ch){
      const tw=Math.min(CHUNK,wd.w-x0),th=Math.min(CHUNK,wd.h-y0);
      if(tw<=0||th<=0)continue;
      ch={c:raster(wd,x0,y0,tw,th),used:0};
      wd.chunks.set(key,ch);
      if(wd.chunks.size>CHUNK_CAP){
        let oldK=null,oldU=1e15;
        for(const [k,v] of wd.chunks){if(k!==key&&v.used<oldU){oldU=v.used;oldK=k;}}
        if(oldK)wd.chunks.delete(oldK);
      }
    }
    ch.used=chunkTick;
    ctx.drawImage(ch.c,x0*TS,y0*TS);
  }
}

// Bands are fractions of the disc. A smooth noise offset waves the borders. It does not call R().
const BANDS=[
  {dd:0.95,t:T_WATER,z:-1},
  {dd:0.90,t:T_WET,z:0},
  {dd:0.74,t:T_SAND,z:0},
  {dd:0.52,t:T_GRASS,z:1},
  {dd:0.30,t:T_DARK,z:2},
  {dd:-1,t:T_ROCK,z:3}
];
function pickBand(dd,x,y){
  const j=(field(x,y,7)-0.5)*0.018+(field(x+91,y+37,2.6)-0.5)*0.008;
  const v=dd+j;
  for(let k=0;k<BANDS.length-1;k++)if(v>BANDS[k].dd)return BANDS[k];
  return BANDS[BANDS.length-1];
}
// Value noise wraps, so a second octave (nx*2+phase) stays on the grid. The v10
// octave indexed past a 50-wide buffer; those reads were undefined, dd became NaN,
// and NaN failed every band test, so the tile fell through to red-tinted Godlands rock.
function makeNoise(R,cells){
  const G=cells,grid=new Float32Array(G*G);
  for(let i=0;i<grid.length;i++)grid[i]=R();
  return function(x,y){
    const gx=x*G,gy=y*G,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const x0=((ix%G)+G)%G,y0=((iy%G)+G)%G,x1=(x0+1)%G,y1=(y0+1)%G;
    const a=grid[y0*G+x0],b=grid[y0*G+x1],c=grid[y1*G+x0],d=grid[y1*G+x1];
    return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
  };
}
function genRealm(seed){
  const R=mulberry(seed),N=REALM_N,wd=mkWorld(N,N),cx=N/2,cy=N/2;
  const noise=makeNoise(R,10);
  const ph=R()*10;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const dx=(x-cx)/(N/2),dy=(y-cy)/(N/2),geo=Math.hypot(dx,dy);
    const nx=x/N,ny=y/N;
    // Low-frequency wobble keeps each band a region. A steep octave folds the coast
    // back on itself, so sand and grass checkerboard and a step past the border is inland again.
    let dd=geo+(noise(nx,ny)-0.5)*0.1+(noise(nx*2+1.7,ny*2+0.4)-0.5)*0.03+Math.sin(Math.atan2(dy,dx)*5+ph)*0.02;
    if(!isFinite(dd))dd=geo;
    const tdist=Math.hypot(x-cx,y-cy);
    let t,z;
    // Corners sit outside the disc. Keep them ocean even if noise tugs the coast.
    if(geo>1.02){t=T_WATER;z=-1;}
    else{const band=pickBand(dd,x,y);t=band.t;z=band.z;}
    const arenaR=Math.max(16,Math.round(N*0.02));
    if(tdist<arenaR){t=T_ARENA;z=3;}
    else if(tdist>arenaR+6){
      if(z===1&&t===T_GRASS){if(R()<0.02)t=T_TREE;else if(R()<0.008)t=T_FLOWER;else if(R()<0.0028)t=T_STUMP;}
      else if(z===2&&t===T_DARK){if(R()<0.012)t=T_BOULDER;else if(R()<0.005)t=T_STUMP;else if(R()<0.004)t=T_VENT;else if(R()<0.0025)t=T_RUIN;}
      else if(z===3&&t===T_ROCK&&R()<0.006)t=T_BOULDER;
      else if(z===0&&t===T_WET&&R()<0.012)t=T_REED;
      else if(z===0&&t===T_SAND&&R()<0.001)t=T_DRIFT;
    }
    wd.tiles[y*N+x]=t;wd.zone[y*N+x]=z;
  }
  function ring(rad,n,gapEvery,tile,zone){
    for(let i=0;i<n;i++){
      if(gapEvery&&i%gapEvery===0)continue;
      const a=i*TAU/n+0.35,tx=Math.round(cx+Math.cos(a)*rad),ty=Math.round(cy+Math.sin(a)*rad);
      if(tx<3||ty<3||tx>=N-3||ty>=N-3)continue;
      const i0=ty*N+tx;
      if(wd.zone[i0]===zone&&wd.tiles[i0]!==T_ARENA&&wd.tiles[i0]!==T_WATER)wd.tiles[i0]=tile;
    }
  }
  // Radii are fractions of the realm, matching the 400-tile layout (pillars in the
  // Godlands, ruins out in the Ashen Wilds).
  ring(Math.round(N*0.065),18,3,T_PILLAR,3);
  ring(Math.round(N*0.195),28,4,T_RUIN,2);
  wd.landmarks=[];
  wd.beacons=[];
  const spots=[
    {id:'shore',name:'Saltmarsh Shore',zone:0,ang:0.4,dd:0.82},
    {id:'green',name:'Greenmarch',zone:1,ang:2.2,dd:0.63},
    {id:'ashen',name:'Ashen Wilds',zone:2,ang:3.8,dd:0.41},
    {id:'star',name:'Godlands',zone:3,ang:5.3,dd:0.20}];
  for(const s of spots){
    const rad=s.dd*(N/2);
    const tx=Math.round(cx+Math.cos(s.ang)*rad),ty=Math.round(cy+Math.sin(s.ang)*rad);
    const p=findOpen(wd,tx,ty,s.zone);
    clearSolids(wd,p.tx,p.ty,2);
    wd.beacons.push({id:s.id,name:s.name,place:'realm',x:(p.tx+0.5)*TS,y:(p.ty+0.5)*TS});
  }
  placeStructures(wd,R,N,cx,cy);
  placeLairs(wd,R,N,cx,cy);
  renderWorld(wd);
  wd.cx=cx*TS;wd.cy=cy*TS;wd.bossT=0;wd.boss=null;wd.clearKills=0;wd.eventT=100;wd.eventIx=0;
  return wd;
}
function placeLairs(wd,R,N,cx,cy){
  wd.lair={};wd.lairs=[];
  if(typeof LAIR_LAYOUTS==='undefined')return;
  const order=['saltwyrm','drownedcaptain','briarstag','eldertreant','ashphoenix','obsidiangolem','marblesphinx','fallenseraph'];
  const ground={0:T_SAND,1:T_GRASS,2:T_DARK,3:T_ROCK};
  for(const ev of order){
    const L=LAIR_LAYOUTS[ev];
    if(!L)continue;
    const want=1+((R()*2)|0);
    let got=0;
    const gnd=ground[L.zone|0];
    for(let n=0;n<240&&got<want;n++){
      const dd=[0.83,0.62,0.40,0.18][L.zone|0];
      const ang=R()*TAU,rad=dd*(N/2)+(R()-0.5)*N*0.1;
      const tx=Math.round(cx+Math.cos(ang)*rad),ty=Math.round(cy+Math.sin(ang)*rad);
      if(stampLair(wd,L,tx,ty,N,gnd))got++;
    }
    // A missed biome gets a stride search so every event still has a lair.
    for(let y=40;y<N-40&&got<1;y+=11)for(let x=40;x<N-40&&got<1;x+=11){
      if(stampLair(wd,L,x,y,N,gnd))got++;
    }
  }
}
function lairPiece(ev,ch){
  const L=LAIR_LAYOUTS[ev],name=L.legend[ch];
  if(!name||name==='ground'||ch==='.')return {kind:'skip'};
  if(name.indexOf('WALL')===0)return {kind:'wall'};
  if(name.indexOf('lava')===0)return {kind:'lava'};
  if(name.indexOf('tree')===0)return {kind:'tree'};
  const art=LAIR_TILES[ev];
  if(name==='halo')return {kind:'floor',floor:'halo'};
  if(art.floors&&art.floors[name])return {kind:'floor',floor:name};
  if(name.indexOf('wetsand')===0)return {kind:'wet'};
  if(art.decals&&art.decals[name])return {kind:'decal',decal:name};
  if(art.props&&art.props[name])return {kind:'prop',prop:name};
  return {kind:'skip'};
}
function stampLair(wd,L,tx,ty,N,ground){
  const rows=L.rows,solid=L.solid,h=rows.length,w=rows[0].length;
  const x0=tx-((w/2)|0),y0=ty-((h/2)|0);
  if(x0<4||y0<4||x0+w>=N-4||y0+h>=N-4)return false;
  if(Math.hypot((x0+7)-N/2,(y0+7)-N/2)<N*0.07)return false;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const X=x0+x,Y=y0+y,i=Y*N+X;
    if(wd.zone[i]!==L.zone)return false;
    const t=wd.tiles[i];
    const soft=t===ground||t===T_TREE||t===T_FLOWER||t===T_STUMP||t===T_BOULDER||t===T_REED||t===T_WET;
    if(!soft)return false;
    if(t===T_WATER||t===T_WALL||t===T_ARENA||t===T_LAVA||t===T_PILLAR||t===T_RUIN||t===T_STATUE||t===T_CRATE||t===T_VENT||t===T_DRIFT||t===T_FIRE)return false;
    if(nearBeacon(wd,X,Y,16))return false;
    if(wd.lair[X+','+Y])return false;
  }
  for(const other of wd.lairs){
    if(Math.hypot(other.tx-(x0+7),other.ty-(y0+7))<18)return false;
  }
  const placed=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const X=x0+x,Y=y0+y,ch=rows[y][x],piece=lairPiece(L.event,ch);
    const block=solid[y][x]==='#';
    if(piece.kind==='wall'){wd.tiles[Y*N+X]=T_WALL;continue;}
    if(piece.kind==='lava'){wd.tiles[Y*N+X]=T_LAVA;continue;}
    if(piece.kind==='tree'){wd.tiles[Y*N+X]=T_TREE;continue;}
    if(piece.kind==='wet'){wd.tiles[Y*N+X]=T_WET;continue;}
    if(piece.kind==='skip')continue;
    const cell={event:L.event,kind:piece.kind,floor:piece.floor||null,decal:piece.decal||null,prop:piece.prop||null,solid:block,anchor:false,artEvent:L.event};
    if(piece.kind==='floor'&&piece.floor==='wetsand')cell.artEvent='saltwyrm';
    wd.lair[X+','+Y]=cell;
    placed.push({x:X,y:Y,cell});
  }
  const halos=placed.filter(p=>p.cell.floor==='halo');
  if(halos.length){
    const minX=Math.min.apply(null,halos.map(p=>p.x)),minY=Math.min.apply(null,halos.map(p=>p.y));
    for(const p of halos){
      const r=p.y-minY,c=p.x-minX;
      if(r>=0&&r<3&&c>=0&&c<3&&LAIR_TILES[L.event].floors['halo'+r+c])p.cell.floor='halo'+r+c;
    }
  }
  for(const p of placed){
    if(p.cell.kind!=='prop')continue;
    const left=wd.lair[(p.x-1)+','+p.y],up=wd.lair[p.x+','+(p.y-1)];
    const same=o=>o&&o.kind==='prop'&&o.prop===p.cell.prop&&o.event===p.cell.event;
    if(!same(left)&&!same(up))p.cell.anchor=true;
  }
  wd.lairs.push({event:L.event,zone:L.zone,tx:x0+7,ty:y0+7,x:(x0+7.5)*TS,y:(y0+7.5)*TS,busy:false});
  return true;
}
function nearBeacon(wd,tx,ty,rad){
  for(const b of wd.beacons||[]){
    if(Math.hypot(tx-b.x/TS,ty-b.y/TS)<rad)return true;
  }
  return false;
}
function placeStructures(wd,R,N,cx,cy){
  const legend={b:T_BOULDER,c:T_CRATE,f:T_FIRE,s:T_STUMP,W:T_WALL,V:T_VENT,P:T_PILLAR,F:T_FLOWER,R:T_RUIN,D:T_DRIFT,S:T_STATUE,T:T_TREE,L:T_LAVA};
  const plans={
    wreck:[
      '...WWWWWWWWWWW...',
      '...WWWWWWWWWWW...',
      '..WW.........WW..',
      '.WW.c..........WW',
      'WW..............W',
      'WW.........c....W',
      '.WWWWWWWWWWWWWW..',
      '....DDDDDDDDD....'
    ],
    dock:[
      'bbbbbbbbbbbbbb',
      '..............',
      'DDDDDDDDDDDDDD',
      '......RRRR....',
      '......RRRR....'
    ],
    circle:[
      '...P.......P...',
      '.P...........P.',
      'P.............P',
      'P......F......P',
      '.P...........P.',
      '..P....f....P..',
      '....P..s..P....',
      '......TTT......'
    ],
    camp:[
      'TT....c....TT',
      'T..s..f..s..T',
      '....ssssss...',
      '..s..b.b..s..',
      'TT....s....TT',
      '.....sss.....'
    ],
    temple:[
      '.WWWWWWWWWWW.',
      'WW.P.....P.WW',
      'W...........W',
      'W.....S.....W',
      'W...........W',
      'WW.P.....P.WW',
      '.WWWWW.WWWWW.',
      '......P.P....'
    ],
    pillars:[
      'P....R....P....R',
      '................',
      '..P........R....',
      'R...............',
      '......P....P....',
      '....R...........',
      'P..........P....',
      '.......S........'
    ],
    ruin:[
      'WWWWW.....WWWWW',
      'W..R..L.L..R..W',
      'W.............W',
      '...LLLLLLLLL...',
      'W......L......W',
      'WWWWW.....WWWWW',
      '....P.....P....'
    ],
    lava:[
      '...LLL...',
      '.LLLLLLL.',
      'LLLLLLLLL',
      '.LLLLLLL.',
      '...VLL...'
    ]
  };
  const spots=[
    {z:0,ang:0.95,dd:0.84,kind:'wreck',name:'Gull Wreck'},
    {z:0,ang:2.4,dd:0.86,kind:'dock',name:'Tide Dock'},
    {z:0,ang:4.2,dd:0.81,kind:'wreck'},
    {z:0,ang:5.55,dd:0.85,kind:'dock'},
    {z:1,ang:0.55,dd:0.62,kind:'circle',name:'Briar Stones'},
    {z:1,ang:1.75,dd:0.58,kind:'camp',name:'Woodcutter Camp'},
    {z:1,ang:3.3,dd:0.66,kind:'circle'},
    {z:1,ang:4.65,dd:0.60,kind:'camp'},
    {z:1,ang:5.75,dd:0.64,kind:'circle'},
    {z:2,ang:0.4,dd:0.40,kind:'ruin',name:'Obsidian Ruin'},
    {z:2,ang:1.6,dd:0.36,kind:'lava',name:'Lava Pool'},
    {z:2,ang:2.95,dd:0.42,kind:'ruin'},
    {z:2,ang:4.4,dd:0.34,kind:'lava'},
    {z:2,ang:5.5,dd:0.39,kind:'ruin'},
    {z:3,ang:0.75,dd:0.18,kind:'temple',name:'Marble Temple'},
    {z:3,ang:2.2,dd:0.15,kind:'pillars',name:'Broken Pillars'},
    {z:3,ang:3.65,dd:0.19,kind:'temple'},
    {z:3,ang:5.1,dd:0.16,kind:'pillars'}
  ];
  function stamp(tx,ty,rows,zone){
    const h=rows.length,w=rows[0].length;
    const x0=tx-((w/2)|0),y0=ty-((h/2)|0);
    const ground=zone<=0?T_SAND:zone===1?T_GRASS:zone===2?T_DARK:T_ROCK;
    const cells=[];
    let blocked=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const X=x0+x,Y=y0+y;
      if(X<3||Y<3||X>=N-3||Y>=N-3){blocked++;continue;}
      const i=Y*N+X;
      if(wd.zone[i]!==zone||wd.tiles[i]===T_WATER||wd.tiles[i]===T_ARENA||nearBeacon(wd,X,Y,12)){blocked++;continue;}
      const ch=rows[y][x];
      cells.push([X,Y,ch&&legend[ch]?legend[ch]:ground]);
    }
    if(blocked>8||cells.length<12)return 0;
    for(const [X,Y,t] of cells)wd.tiles[Y*N+X]=t;
    return cells.length;
  }
  let placedN=0;
  for(const s of spots){
    const rad=s.dd*(N/2);
    let placed=false;
    for(let k=0;k<36&&!placed;k++){
      const a=s.ang+(R()-0.5)*0.55,d=rad+(R()-0.5)*40;
      const tx=Math.round(cx+Math.cos(a)*d),ty=Math.round(cy+Math.sin(a)*d);
      if(Math.hypot(tx-cx,ty-cy)<N*0.05)continue;
      const got=stamp(tx,ty,plans[s.kind],s.z);
      if(got>=12){
        placed=true;placedN++;
        if(s.name)wd.landmarks.push({id:'r:'+s.kind+Math.round(s.ang*10),name:s.name,x:(tx+0.5)*TS,y:(ty+0.5)*TS});
      }
    }
  }
  wd.structN=placedN;
}
function genHub(){
  const w=96,h=96,wd=mkWorld(w,h);wd.isHub=true;
  wd.wallKind=new Uint8Array(w*h);
  // Portal room, a short corridor, then the hall. Everything else is meadow.
  const portal=(x,y)=>x>=40&&x<=55&&y>=26&&y<=33;
  const corridor=(x,y)=>x>=45&&x<=50&&y>=34&&y<=39;
  const hall=(x,y)=>x>=32&&x<=63&&y>=40&&y<=70;
  const inside=(x,y)=>portal(x,y)||corridor(x,y)||hall(x,y);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    wd.tiles[y*w+x]=inside(x,y)?T_FLOOR:T_GRASS;
    wd.zone[y*w+x]=0;
  }
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    if(inside(x,y))continue;
    let touch=false;
    for(let dy=-1;dy<=1&&!touch;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      if(inside(x+dx,y+dy)){touch=true;break;}
    }
    if(touch)wd.tiles[y*w+x]=T_WALL;
  }
  function wallAt(x,y){return x>=0&&y>=0&&x<w&&y<h&&wd.tiles[y*w+x]===T_WALL;}
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    if(!wallAt(x,y))continue;
    const n=wallAt(x,y-1),s=wallAt(x,y+1),e=wallAt(x+1,y),wv=wallAt(x-1,y);
    const straight=(n&&s&&!e&&!wv)||(e&&wv&&!n&&!s);
    const ends=[n,s,e,wv].filter(Boolean).length;
    let kind=0;
    if(!straight)kind=1;
    if(ends<=1)kind=2;
    wd.wallKind[y*w+x]=kind;
  }
  for(const [x,y] of [[44,34],[51,34],[44,39],[51,39],[44,40],[51,40]]){
    if(wallAt(x,y))wd.wallKind[y*w+x]=2;
  }
  function put(x,y,t){
    if(x<1||y<1||x>=w-1||y>=h-1)return;
    if(wd.tiles[y*w+x]===T_WALL)return;
    wd.tiles[y*w+x]=t;
  }
  for(let y=27;y<=31;y++)for(let x=44;x<=51;x++)put(x,y,T_CARPET);
  for(let y=34;y<=39;y++)for(let x=45;x<=50;x++)put(x,y,T_CARPET);
  for(let y=40;y<=68;y++)for(let x=46;x<=49;x++)put(x,y,T_CARPET);
  for(let y=44;y<=66;y++)for(let x=34;x<=39;x++){
    if(y>=56&&y<=60)continue;
    put(x,y,T_GRASS);
  }
  for(let y=44;y<=66;y++)for(let x=56;x<=61;x++){
    if(y>=50&&y<=54)continue;
    put(x,y,T_GRASS);
  }
  for(const [x,y] of [[34,44],[39,44],[34,66],[39,66],[56,44],[61,44],[56,66],[61,66]])put(x,y,T_PLANTER);
  for(const [x,y] of [[35,47],[38,52],[36,63],[57,47],[60,58],[58,64]])put(x,y,T_FLOWER);
  for(const [x,y] of [[35,46],[38,65],[60,46],[57,65]])put(x,y,T_TREE);
  for(const [x,y] of [[36,42],[59,42],[36,68],[59,68]])put(x,y,T_PILLAR);
  for(const [x,y] of [[44,48],[44,60],[51,48],[51,62]])put(x,y,T_BENCH);
  function pond(cx,cy,r){
    const y0=Math.floor(cy-r-3),y1=Math.ceil(cy+r+3),x0=Math.floor(cx-r-3),x1=Math.ceil(cx+r+3);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      if(x<2||y<2||x>=w-2||y>=h-2)continue;
      if(wd.tiles[y*w+x]!==T_GRASS)continue;
      const dx=x-cx,dy=y-cy,wob=(field(x,y,3)-0.35)*2.2;
      if(dx*dx+dy*dy<(r+wob)*(r+wob))wd.tiles[y*w+x]=T_WATER;
    }
  }
  pond(15,50,4.2);
  pond(80,34,3.1);
  for(let y=74;y<94;y++){
    const x=Math.round(22+Math.sin((y-74)*0.42)*9+(y-74)*0.28);
    for(let k=-1;k<=1;k++)if(x+k>1&&x+k<w-1&&wd.tiles[y*w+x+k]===T_GRASS)wd.tiles[y*w+x+k]=T_SAND;
  }
  for(let y=28;y<62;y++){
    const x=Math.round(78+Math.sin((y-28)*0.33)*6);
    if(x>1&&x<w-2&&wd.tiles[y*w+x]===T_GRASS)wd.tiles[y*w+x]=T_SAND;
    if(x+1<w-1&&wd.tiles[y*w+x+1]===T_GRASS)wd.tiles[y*w+x+1]=T_SAND;
  }
  function clearOfWall(x,y,rad){
    for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
      const xx=x+dx,yy=y+dy;
      if(xx<0||yy<0||xx>=w||yy>=h)return false;
      if(wd.tiles[yy*w+xx]===T_WALL)return false;
    }
    return true;
  }
  let planted=0;
  for(let y=2;y<h-2&&planted<48;y++)for(let x=2;x<w-2&&planted<48;x++){
    if(wd.tiles[y*w+x]!==T_GRASS||hash2(x*3+1,y*5+4)<0.986)continue;
    if(!clearOfWall(x,y,3))continue;
    let close=false;
    for(let dy=-4;dy<=4&&!close;dy++)for(let dx=-4;dx<=4;dx++){
      const xx=x+dx,yy=y+dy;
      if(xx<0||yy<0||xx>=w||yy>=h)continue;
      if(wd.tiles[yy*w+xx]===T_TREE){close=true;break;}
    }
    if(close)continue;
    wd.tiles[y*w+x]=T_TREE;planted++;
  }
  for(let s=0;s<14;s++){
    const sx=3+((hash2(s,9)*88)|0),sy=3+((hash2(s,13)*88)|0);
    const n=2+((hash2(s,4)*4)|0);
    for(let k=0;k<n;k++){
      const x=sx+((hash2(s,k+1)*5)|0)-2,y=sy+((hash2(k,s+3)*5)|0)-2;
      if(x<2||y<2||x>=w-2||y>=h-2)continue;
      if(wd.tiles[y*w+x]===T_GRASS)wd.tiles[y*w+x]=T_FLOWER;
    }
  }
  renderWorld(wd);
  wd.portal={x:48*TS,y:29*TS+4};
  wd.fountain={x:48*TS,y:54*TS};
  wd.spawn={x:48*TS,y:66*TS};
  wd.chest={x:36*TS+4,y:58*TS};
  wd.vault={x:60*TS,y:52*TS};
  wd.beacons=[];
  wd.arches=[
    {x:48*TS,y:34*TS,w:6*TS},
    {x:48*TS,y:40*TS,w:6*TS}
  ];
  const dress=[];
  const banners=['banner','bannerB','bannerG'];
  [[42,27],[53,27],[36,41],[59,41],[42,44],[53,44],[42,64],[53,64]].forEach((p,i)=>{
    dress.push({k:banners[i%3],x:p[0]*TS+4,y:p[1]*TS});
  });
  for(const [x,y] of [[41,28],[54,28],[41,32],[54,32],[34,42],[61,42],[34,50],[61,50],[34,64],[61,64],[46,41],[49,41]]){
    dress.push({k:'torch',x:x*TS+4,y:y*TS+4});
  }
  let bushes=0;
  for(let y=3;y<h-3&&bushes<36;y++)for(let x=3;x<w-3&&bushes<36;x++){
    if(wd.tiles[y*w+x]!==T_GRASS||hash2(x+20,y+8)<0.992)continue;
    if(!clearOfWall(x,y,2))continue;
    dress.push({k:'bush',x:x*TS+4,y:y*TS+8});
    bushes++;
  }
  wd.dress=dress;
  return wd;
}
function genVault(){
  const w=18,h=14,wd=mkWorld(w,h);wd.isVault=true;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let t=T_FLOOR;
    if(x===0||y===0||x===w-1||y===h-1)t=T_WALL;
    if(x>=2&&x<=w-3&&y>=2&&y<=5)t=T_CARPET;
    wd.tiles[y*w+x]=t;wd.zone[y*w+x]=t===T_WALL?-1:0;
  }
  renderWorld(wd);
  wd.chests=[
    {i:0,x:3*TS+4,y:4*TS},
    {i:1,x:7*TS+4,y:4*TS},
    {i:2,x:11*TS+4,y:4*TS},
    {i:3,x:15*TS+4,y:4*TS}
  ];
  wd.portal={x:9*TS,y:11*TS+4};
  wd.spawn={x:9*TS,y:8*TS+4};
  wd.beacons=[];
  return wd;
}

const DUNGEONS={
  tideclaw:{
    id:'tideclaw',
    name:'Tideclaw Burrow',
    enemy:'crab',
    portalRate:0.03,
    keyName:'Tideclaw Burrow Key',
    blurb:'A flooded warren of the saltmarsh crabs.',
    lore:'Saltwater still breathes in the burrow Old Tideclaw never left.',
    utName:'Tidepearl',
    boss:'tideclaw',
    theme:'tide',
    keySpr:'keyTide',
    portalSpr:'portalTide',
    col:'#ffb070',
    loreCol:'#7ee0c8',
    music:'burrow',
    musicBoss:'burrowBoss',
    bossHear:200,
    fallLine:'OLD TIDECLAW FALLS',
    mapBlurb:'Crab warren. The gold portal leaves after Old Tideclaw falls.',
    legend:['#ffb070','Old Tideclaw','#7ee0c8','Tide pools'],
    inspired:'Pirate Cave, as a shore warren',
    loot:{bossHi:0.45,bossN:[1,2],bossTier:[2,4],hp:0.7,mp:0.45,elixir:0,elixir2:0,ut:0.12,key:0.08,minP:0.22,minTier:[2,3],minHp:0.3,chest:[2,3],chestHp:0.55}
  },
  hexmire:{
    id:'hexmire',
    name:'Hexmire Hollow',
    enemy:'hexer',
    portalRate:0.03,
    keyName:'Hexmire Hollow Key',
    blurb:'A drowned witch-hollow under the Greenmarch.',
    lore:'The Mire Hexer\'s sisters boil names in the hollow\'s black pools.',
    utName:'Vine Bow',
    boss:'hexmatron',
    theme:'hex',
    keySpr:'keyHex',
    portalSpr:'portalHex',
    col:'#c48aff',
    loreCol:'#8fd16a',
    music:'hex',
    musicBoss:'hexBoss',
    bossHear:230,
    fallLine:'THE HEX MATRIARCH UNRAVELS',
    mapBlurb:'Bog paths and witch-pools. The gold portal leaves when the Matriarch falls.',
    legend:['#c48aff','Hex Matriarch','#3c6a40','Bog water'],
    inspired:'Snake Pit and Forbidden Jungle',
    tier:'low',
    loot:{bossHi:0.5,bossN:[1,2],bossTier:[3,5],hp:0.65,mp:0.4,elixir:0.22,elixir2:0,ut:0.12,key:0.06,minP:0.28,minTier:[2,4],minHp:0.28,chest:[2,4],chestHp:0.5}
  },
  cinderhive:{
    id:'cinderhive',
    name:'Cinder Hive',
    enemy:'beetle',
    portalRate:0.03,
    keyName:'Cinder Hive Key',
    blurb:'A magma nest bored through the Ashen Wilds.',
    lore:'The hive remembers every beetle the magma took.',
    utName:'Magma Staff',
    boss:'broodqueen',
    theme:'cinder',
    keySpr:'keyCinder',
    portalSpr:'portalCinder',
    col:'#ff8a3a',
    loreCol:'#ffd34a',
    music:'cinder',
    musicBoss:'cinderBoss',
    bossHear:250,
    fallLine:'THE BROOD QUEEN SPLITS',
    mapBlurb:'Basalt cells and lava cuts. The gold portal leaves when the Queen falls.',
    legend:['#ff8a3a','Brood Queen','#ff5a28','Lava'],
    inspired:'Abyss of Demons and The Nest',
    tier:'mid',
    loot:{bossHi:0.55,bossN:[2,3],bossTier:[4,6],hp:0.7,mp:0.5,elixir:0.45,elixir2:0.2,ut:0.11,key:0.06,minP:0.32,minTier:[3,5],minHp:0.3,chest:[3,5],chestHp:0.5}
  },
  sanctum:{
    id:'sanctum',
    name:'Void Sanctum',
    enemy:'voidkeeper',
    portalRate:0.09,
    keyName:'Void Sanctum Key',
    blurb:'A starry sanctum past the Godlands.',
    lore:'The Void Keeper only opens a door. The Archon is what waits past it.',
    utName:'Void Blade',
    boss:'archon',
    theme:'sanctum',
    keySpr:'keyVoid',
    portalSpr:'portalVoid',
    col:'#d0a0ff',
    loreCol:'#e8e0ff',
    music:'sanctum',
    musicBoss:'sanctumBoss',
    bossHear:280,
    fallLine:'THE VOID ARCHON COLLAPSES',
    mapBlurb:'Bridges over the starfield. The gold portal leaves when the Archon falls.',
    legend:['#d0a0ff','Void Archon','#6a38c0','Starfield'],
    inspired:'The Shatters and The Void',
    tier:'end',
    loot:{bossHi:1,bossN:[2,2],bossTier:[6,7],hp:0.8,mp:0.65,elixir:0.85,elixir2:0.55,ut:0.1,key:0.08,minP:0.4,minTier:[5,7],minHp:0.25,chest:[5,7],chestHp:0.45}
  },
  coil:{
    id:'coil',
    name:"Serpent's Coil",
    enemy:'serpent',
    portalRate:0.09,
    keyName:"Serpent's Coil Key",
    blurb:'A jade serpent temple under the Godlands.',
    lore:'Crown scales open the coil. The Serpent King sleeps on the last jade ring.',
    utName:'Serpent Wand',
    boss:'ouroboros',
    theme:'coil',
    keySpr:'keyCoil',
    portalSpr:'portalCoil',
    col:'#7dce4a',
    loreCol:'#e0c060',
    music:'coil',
    musicBoss:'coilBoss',
    bossHear:260,
    fallLine:'THE SERPENT KING UNWINDS',
    mapBlurb:'Sealed serpent halls. Shoot the scale gates. The gold portal leaves when the Serpent King falls.',
    legend:['#7dce4a','Serpent King','#c6a15a','Jade stone'],
    inspired:'Snake Pit',
    tier:'end',
    loot:{bossHi:1,bossN:[2,2],bossTier:[6,7],hp:0.8,mp:0.65,elixir:0.85,elixir2:0.55,ut:0.1,key:0.08,minP:0.4,minTier:[5,7],minHp:0.25,chest:[5,7],chestHp:0.45}
  },
  throne:{
    id:'throne',
    name:'Throne of Ruin',
    enemy:null,
    portalRate:0,
    keyName:'Throne of Ruin Key',
    blurb:'The ruined throne hall of the king Morvane served.',
    lore:'Morvane kept the gate. The Mega King still sits the throne.',
    utName:null,
    boss:'megaking',
    theme:'throne',
    keySpr:'keyMega',
    portalSpr:'portalMega',
    col:'#ff4fa8',
    loreCol:'#ffd34a',
    music:'throne',
    musicBoss:'throneBoss',
    bossHear:420,
    fallLine:'THE MEGA KING\'S CROWN BREAKS',
    mapBlurb:'One throne hall. The gold portal leaves when the Mega King falls.',
    legend:['#ff4fa8','Mega King','#ffd34a','Throne'],
    inspired:'The Shatters, as a single throne hall',
    tier:'end',
    loot:{bossHi:1,bossN:[1,1],bossTier:[7,7],hp:0.8,mp:0.65,elixir:0.9,elixir2:0.5,ut:0,key:0.08,minP:0.36,minTier:[5,7],minHp:0.28,chest:[6,7],chestHp:0.5}
  }
};
const BCOLS=7,BROWS=7,BCELL=16,BPAD=3,BOSS_PAD=48;
function burrowShuffle(a,R){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=(R()*(i+1))|0;const t=b[i];b[i]=b[j];b[j]=t;}return b;}
function burrowOrigin(cx,cy){return {x:BOSS_PAD+BPAD+cx*BCELL,y:BOSS_PAD+BPAD+cy*BCELL};}
function burrowCenter(cx,cy){const p=burrowOrigin(cx,cy);return {x:p.x+((BCELL/2)|0),y:p.y+((BCELL/2)|0)};}
function burrowSolid(t){return t===T_BWALL||t===T_BCORAL||t===T_BROCK;}
function attachBurrowSides(path,occ,sideN,R){
  const cols=BCOLS,rows=BROWS,at=(x,y)=>y*cols+x,sides=[];
  const order=[];
  for(let i=1;i<=path.length-3;i++)order.push(i);
  for(const i of burrowShuffle(order,R)){
    if(sides.length>=sideN)break;
    const room=path[i];
    for(const d of burrowShuffle([[1,0],[-1,0],[0,1],[0,-1]],R)){
      const nx=room.x+d[0],ny=room.y+d[1];
      if(nx<0||ny<0||nx>=cols||ny>=rows||occ[at(nx,ny)])continue;
      occ[at(nx,ny)]=1;
      sides.push({x:nx,y:ny,parent:i});
      break;
    }
  }
  return sides;
}
function carveBurrow(R,path,sides,pathN,sideN){
  const w=BOSS_PAD*2+BPAD*2+BCOLS*BCELL,h=w,tiles=new Uint8Array(w*h),spine=new Uint8Array(w*h);
  tiles.fill(T_BWALL);
  const rooms=[];
  const bossR=13+((R()*3)|0);
  function set(x,y,t){if(x>0&&y>0&&x<w-1&&y<h-1)tiles[y*w+x]=t;}
  function disk(cx,cy,rad,t,mark){
    for(let y=cy-rad;y<=cy+rad;y++)for(let x=cx-rad;x<=cx+rad;x++){
      if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=rad*rad){set(x,y,t);if(mark&&x>0&&y>0&&x<w-1&&y<h-1)spine[y*w+x]=1;}
    }
  }
  function line(a,b,rad){
    const steps=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y),1);
    for(let i=0;i<=steps;i++){
      const x=Math.round(a.x+(b.x-a.x)*i/Math.max(1,steps)),y=Math.round(a.y+(b.y-a.y)*i/Math.max(1,steps));
      disk(x,y,rad,T_BFLOOR,true);
    }
  }
  const shapes=['round','tunnel','chamber'];
  function addRoom(cell,role){
    const c=burrowCenter(cell.x,cell.y),p=burrowOrigin(cell.x,cell.y);
    let shape=shapes[(R()*shapes.length)|0];
    if(role==='start')shape='chamber';
    const rad=shape==='tunnel'?4:shape==='round'?6:8;
    const room={cx:cell.x,cy:cell.y,role,shape,x0:p.x,y0:p.y,x1:p.x+BCELL,y1:p.y+BCELL,links:[],enc:'',rad};
    rooms.push(room);
    if(shape==='round')disk(c.x,c.y,5,T_BFLOOR,false);
    else if(shape==='tunnel')disk(c.x,c.y,3,T_BFLOOR,false);
    else for(let y=c.y-5;y<=c.y+5;y++)for(let x=c.x-5;x<=c.x+5;x++)set(x,y,T_BFLOOR);
    disk(c.x,c.y,2,T_BFLOOR,true);
    return room;
  }
  for(let i=0;i<path.length;i++){
    if(i===path.length-1){
      const p=burrowOrigin(path[i].x,path[i].y);
      rooms.push({cx:path[i].x,cy:path[i].y,role:'boss',shape:'round',x0:p.x,y0:p.y,x1:p.x+BCELL,y1:p.y+BCELL,links:[],enc:'',rad:bossR});
    }else addRoom(path[i],i===0?'start':'path');
  }
  for(let i=0;i<path.length-1;i++){
    rooms[i].links.push(i+1);rooms[i+1].links.push(i);
    if(i<path.length-2)line(burrowCenter(path[i].x,path[i].y),burrowCenter(path[i+1].x,path[i+1].y),1);
  }
  sides.forEach((cell,s)=>{
    const role=s===0?'chest':s===1?'mini':'side';
    const room=addRoom(cell,role);
    const id=rooms.length-1,pi=cell.parent;
    room.links.push(pi);rooms[pi].links.push(id);
    line(burrowCenter(cell.x,cell.y),burrowCenter(path[pi].x,path[pi].y),1);
  });
  const prevC=burrowCenter(path[path.length-2].x,path[path.length-2].y);
  const startC0=burrowCenter(path[path.length-1].x,path[path.length-1].y);
  function fitsBoss(x,y){
    if(x-bossR<2||y-bossR<2||x+bossR>=w-2||y+bossR>=h-2)return false;
    for(const room of rooms){
      if(room.role==='boss')continue;
      const c=burrowCenter(room.cx,room.cy);
      if(Math.hypot(x-c.x,y-c.y)<(room.rad||6)+bossR+2)return false;
    }
    return true;
  }
  function placeBoss(){
    let dx=startC0.x-prevC.x,dy=startC0.y-prevC.y,len=Math.hypot(dx,dy)||1;
    let sx=0,sy=0,n=0;
    for(const room of rooms){if(room.role==='boss')continue;const c=burrowCenter(room.cx,room.cy);sx+=c.x;sy+=c.y;n++;}
    if(n){sx/=n;sy/=n;const ax=startC0.x-sx,ay=startC0.y-sy,al=Math.hypot(ax,ay)||1;
      dx=dx/len*0.7+(ax/al)*0.3;dy=dy/len*0.7+(ay/al)*0.3;len=Math.hypot(dx,dy)||1;}
    dx/=len;dy/=len;
    for(let step=0;step<=56;step++){
      const x=Math.round(startC0.x+dx*step),y=Math.round(startC0.y+dy*step);
      if(fitsBoss(x,y))return {x,y};
    }
    for(let a=0;a<8;a++){
      const ux=Math.cos(a*Math.PI/4),uy=Math.sin(a*Math.PI/4);
      for(let step=6;step<=60;step+=2){
        const x=Math.round(startC0.x+ux*step),y=Math.round(startC0.y+uy*step);
        if(fitsBoss(x,y))return {x,y};
      }
    }
    return null;
  }
  const bossAt=placeBoss();
  if(!bossAt)return null;
  const bx=bossAt.x,by=bossAt.y;
  disk(bx,by,bossR,T_BFLOOR,false);
  line(prevC,{x:bx,y:by},1);
  for(let y=by-4;y<=by+4;y++)for(let x=bx-4;x<=bx+4;x++){
    if((x-bx)*(x-bx)+(y-by)*(y-by)>16)continue;
    if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
    if(tiles[y*w+x]!==T_BWALL)tiles[y*w+x]=T_BPEARL;
  }
  for(let y=by-bossR;y<=by+bossR;y++)for(let x=bx-bossR;x<=bx+bossR;x++){
    const dx=x-bx,dy=y-by,d2=dx*dx+dy*dy;
    if(d2>bossR*bossR||d2<(bossR-1)*(bossR-1))continue;
    if(Math.abs(dx)===bossR||Math.abs(dy)===bossR)continue;
    if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
    if(hash2(x*3,y*5)<0.42)tiles[y*w+x]=T_BWALL;
  }
  const pdx=prevC.x-bx,pdy=prevC.y-by,plen=Math.hypot(pdx,pdy)||1;
  let rocks=0;
  for(let k=0;k<10&&rocks<3;k++){
    const ang=(k+0.5)/10*TAU,dist=Math.round(bossR*0.62);
    const x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
    if(x<=1||y<=1||x>=w-2||y>=h-2)continue;
    const vx=x-bx,vy=y-by,vl=Math.hypot(vx,vy)||1;
    if((vx*pdx+vy*pdy)/vl/plen>0.55)continue;
    if(spine[y*w+x]||tiles[y*w+x]===T_BWALL)continue;
    tiles[y*w+x]=T_BROCK;rocks++;
  }
  for(let k=0;k<6;k++){
    const ang=R()*TAU,dist=bossR-2,x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
    if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
    if(tiles[y*w+x]===T_BWALL||tiles[y*w+x]===T_BROCK)continue;
    if(Math.hypot(x-bx,y-by)<5)continue;
    tiles[y*w+x]=R()<0.5?T_BCRYST:T_BWEED;
  }
  for(let k=0;k<4;k++){
    const x=bx+((R()*(bossR-2))|0)-((bossR/2)|0),y=by+((R()*(bossR-2))|0)-((bossR/2)|0);
    if(Math.hypot(x-bx,y-by)<6||x<=1||y<=1||x>=w-2||y>=h-2)continue;
    if(spine[y*w+x]||tiles[y*w+x]===T_BWALL||tiles[y*w+x]===T_BROCK)continue;
    tiles[y*w+x]=T_BPOOL;
  }
  const bossRoom=rooms[path.length-1];
  bossRoom.x0=bx-bossR;bossRoom.y0=by-bossR;bossRoom.x1=bx+bossR+1;bossRoom.y1=by+bossR+1;
  for(const room of rooms){
    if(room.role==='boss'||room.role==='start')continue;
    const c=burrowCenter(room.cx,room.cy);
    for(let n=0;n<6;n++){
      const x=c.x+((R()*9)|0)-4,y=c.y+((R()*9)|0)-4;
      if(x<=1||y<=1||x>=w-2||y>=h-2)continue;
      const i=y*w+x;
      if(tiles[i]===T_BWALL||spine[i])continue;
      if(Math.abs(x-c.x)+Math.abs(y-c.y)<3)continue;
      const roll=R();
      tiles[i]=roll<0.22?T_BCORAL:roll<0.4?T_BROCK:roll<0.55?T_BPLANK:roll<0.72?T_BCRYST:roll<0.86?T_BWEED:T_BPOOL;
    }
  }
  function walkable(tx,ty){
    if(tx<=0||ty<=0||tx>=w-1||ty>=h-1)return false;
    return !burrowSolid(tiles[ty*w+tx]);
  }
  function pix(tx,ty){return {x:(tx+0.5)*TS,y:(ty+0.5)*TS};}
  function findSpot(cx,cy,avoid){
    const c=burrowCenter(cx,cy);
    for(let r=0;r<8;r++){
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        if(r&&Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const x=c.x+dx,y=c.y+dy;
        if(!walkable(x,y))continue;
        if(spine[y*w+x]&&r<2)continue;
        const p=pix(x,y);let bad=false;
        for(const a of avoid)if(Math.hypot(p.x-a.x,p.y-a.y)<16)bad=true;
        if(!bad)return p;
      }
    }
    return walkable(c.x,c.y)?pix(c.x,c.y):null;
  }
  const startC=burrowCenter(path[0].x,path[0].y);
  const spawn=pix(startC.x,startC.y),anchor=pix(bx,by);
  let ex=Math.round(bx+(pdx/plen)*(bossR-4)),ey=Math.round(by+(pdy/plen)*(bossR-4));
  if(!walkable(ex,ey)){ex=bx;ey=by;}
  const exit=pix(ex,ey);
  const encounters=[],chests=[],taken=[spawn,anchor,exit];
  function place(type,room){
    const p=findSpot(room.cx,room.cy,taken);
    if(!p)return false;
    encounters.push({type,x:p.x,y:p.y});taken.push(p);return true;
  }
  for(const room of rooms){
    if(room.role==='start'||room.role==='boss')continue;
    if(room.role==='chest'){
      const p=findSpot(room.cx,room.cy,taken);
      if(!p)return null;
      chests.push({x:p.x,y:p.y,open:false});taken.push(p);continue;
    }
    if(room.role==='mini'){
      room.enc='mini';
      if(!place('tidematron',room)||!place('pincer',room)||!place('pincer',room))return null;
      continue;
    }
    const kind=['swarm','turrets','pack','mixed'][(R()*4)|0];
    room.enc=kind;
    const plan=kind==='swarm'?[['pincer',3]]:kind==='turrets'?[['barnacle',2]]:kind==='pack'?[['shellguard',2]]:[['pincer',2],['shellguard',1]];
    for(const [type,n] of plan)for(let i=0;i<n;i++)if(!place(type,room))return null;
  }
  const dist=new Array(rooms.length).fill(-1),queue=[0];
  dist[0]=0;
  for(let qi=0;qi<queue.length;qi++){
    const i=queue[qi];
    for(const j of rooms[i].links)if(dist[j]<0){dist[j]=dist[i]+1;queue.push(j);}
  }
  let bossD=-1,maxD=-1,ties=0;
  for(let i=0;i<rooms.length;i++){
    if(dist[i]<0)return null;
    if(dist[i]>maxD){maxD=dist[i];ties=1;}
    else if(dist[i]===maxD)ties++;
    if(rooms[i].role==='boss')bossD=dist[i];
  }
  if(bossD!==maxD||ties!==1)return null;
  const seen=new Uint8Array(w*h),stack=[startC.y*w+startC.x];
  seen[startC.y*w+startC.x]=1;
  while(stack.length){
    const i=stack.pop(),x=i%w,y=(i/w)|0;
    for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+d[0],ny=y+d[1];
      if(nx<0||ny<0||nx>=w||ny>=h)continue;
      const j=ny*w+nx,t=tiles[j];
      if(seen[j]||burrowSolid(t))continue;
      seen[j]=1;stack.push(j);
    }
  }
  function reached(tx,ty){return tx>0&&ty>0&&tx<w&&ty<h&&seen[ty*w+tx]===1;}
  if(!reached(startC.x,startC.y)||!reached(bx,by)||!reached(ex,ey))return null;
  for(const room of rooms){const c=room.role==='boss'?{x:bx,y:by}:burrowCenter(room.cx,room.cy);if(!reached(c.x,c.y))return null;}
  function clearPoint(p){const tx=Math.floor(p.x/TS),ty=Math.floor(p.y/TS);return reached(tx,ty);}
  if(!clearPoint(spawn)||!clearPoint(anchor)||!clearPoint(exit))return null;
  for(const e of encounters)if(!clearPoint(e))return null;
  for(const c of chests)if(!clearPoint(c))return null;
  let minx=bx,maxx=bx,miny=by,maxy=by,open=0;
  for(let y=by-bossR;y<=by+bossR;y++)for(let x=bx-bossR;x<=bx+bossR;x++){
    const dx=x-bx,dy=y-by;
    if(dx*dx+dy*dy>bossR*bossR)continue;
    const t=tiles[y*w+x];
    if(t===T_BWALL||t===T_BCORAL||t===T_BROCK)continue;
    open++;
    if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
  }
  const bossW=maxx-minx+1,bossH=maxy-miny+1;
  if(bossW<26||bossH<26||bossW>32||bossH>32||open<360)return null;
  let x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(tiles[y*w+x]!==T_BWALL){
    if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;
  }
  x0=Math.max(0,x0-3);y0=Math.max(0,y0-3);x1=Math.min(w-1,x1+3);y1=Math.min(h-1,y1+3);
  const nw=x1-x0+1,nh=y1-y0+1,nt=new Uint8Array(nw*nh);
  nt.fill(T_BWALL);
  for(let y=0;y<nh;y++)for(let x=0;x<nw;x++)nt[y*nw+x]=tiles[(y+y0)*w+(x+x0)];
  const sh=o=>{o.x-=x0*TS;o.y-=y0*TS;};
  sh(spawn);sh(anchor);sh(exit);
  encounters.forEach(sh);chests.forEach(sh);
  for(const r of rooms){r.x0-=x0;r.y0-=y0;r.x1-=x0;r.y1-=y0;}
  let hash=0;
  for(let i=0;i<nt.length;i+=5)hash=Math.imul(hash,33)+nt[i]|0;
  const sig=rooms.map(r=>r.cx+','+r.cy+':'+r.shape+':'+r.role+':'+r.enc).join('|')+'#'+(hash>>>0);
  return {w:nw,h:nh,tiles:nt,rooms,pathN,sideN,spawn,anchor,exit,encounters,chests,sig,bossDist:bossD,maxDist:maxD,connected:queue.length===rooms.length,bossW,bossH,bossR,bossOpen:open};
}
function tryBurrow(R){
  const pathN=8+((R()*7)|0),sideN=2+((R()*3)|0),occ=new Uint8Array(BCOLS*BROWS);
  const at=(x,y)=>y*BCOLS+x;
  const sx=(R()*BCOLS)|0,sy=(R()*BROWS)|0,path=[{x:sx,y:sy}];
  occ[at(sx,sy)]=1;
  function grow(){
    if(path.length===pathN)return true;
    const last=path[path.length-1];
    for(const d of burrowShuffle([[1,0],[-1,0],[0,1],[0,-1]],R)){
      const nx=last.x+d[0],ny=last.y+d[1];
      if(nx<0||ny<0||nx>=BCOLS||ny>=BROWS||occ[at(nx,ny)])continue;
      occ[at(nx,ny)]=1;path.push({x:nx,y:ny});
      if(grow())return true;
      path.pop();occ[at(nx,ny)]=0;
    }
    return false;
  }
  if(!grow())return null;
  const sides=attachBurrowSides(path,occ,sideN,R);
  if(sides.length!==sideN)return null;
  return carveBurrow(R,path,sides,pathN,sideN);
}
function snakeBurrow(R){
  const pathN=11,sideN=3,path=[],occ=new Uint8Array(BCOLS*BROWS);
  let x=0,y=0,dir=1;
  for(let i=0;i<pathN;i++){
    path.push({x,y});occ[y*BCOLS+x]=1;
    const nx=x+dir;
    if(nx<0||nx>=BCOLS){y++;dir=-dir;}
    else x=nx;
  }
  const sides=attachBurrowSides(path,occ,sideN,R);
  if(sides.length!==sideN)return null;
  return carveBurrow(R,path,sides,pathN,sideN);
}
function layoutTideclaw(seed){
  const base=seed|0;
  for(let attempt=0;attempt<8;attempt++){
    const L=tryBurrow(mulberry((base+Math.imul(attempt+1,0x9E3779B9))|0));
    if(L)return L;
  }
  return snakeBurrow(mulberry(base^0x51f15e));
}
function genTideclaw(seed){
  if(seed==null)seed=(Math.random()*0x7fffffff)|0;
  seed|=0;
  const L=layoutTideclaw(seed);
  const wd=mkWorld(L.w,L.h);
  wd.isDungeon=true;wd.dungeonId='tideclaw';wd.dname='Tideclaw Burrow';
  wd.tiles.set(L.tiles);
  for(let i=0;i<wd.zone.length;i++)wd.zone[i]=L.tiles[i]===T_BWALL?-1:0;
  wd.spawn=L.spawn;wd.exit=L.exit;wd.exitOpen=false;wd.anchor=L.anchor;
  wd.beacons=[];wd.encounters=L.encounters;wd.lootChests=L.chests;wd.rooms=L.rooms;
  wd.layoutSig=L.sig;wd.seed=seed;wd.pathRooms=L.pathN;wd.roomCount=L.rooms.length;
  renderWorld(wd);
  return wd;
}
function measureBossRoom(L){
  const cx=Math.floor(L.anchor.x/TS),cy=Math.floor(L.anchor.y/TS),r=L.bossR|0;
  let minx=cx,maxx=cx,miny=cy,maxy=cy,open=0;
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
    const dx=x-cx,dy=y-cy;
    if(dx*dx+dy*dy>r*r)continue;
    if(x<0||y<0||x>=L.w||y>=L.h)return null;
    const t=L.tiles[y*L.w+x];
    if(t===T_BWALL||t===T_BCORAL||t===T_BROCK)continue;
    open++;
    if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
  }
  return {w:maxx-minx+1,h:maxy-miny+1,open};
}
function auditBurrows(n){
  n=n||200;const fails=[];let prev='',bossMin=99,bossMax=0;
  for(let s=1;s<=n;s++){
    const L=layoutTideclaw(s);
    if(!L){fails.push(s+':no layout');continue;}
    if(L.pathN<8||L.pathN>14)fails.push(s+':path '+L.pathN);
    if(L.rooms.length<10||L.rooms.length>18)fails.push(s+':rooms '+L.rooms.length);
    if(L.sideN<2||L.sideN>4)fails.push(s+':sides '+L.sideN);
    if(!L.connected||L.bossDist!==L.maxDist)fails.push(s+':reach '+L.bossDist+'/'+L.maxDist);
    if(L.sig===prev)fails.push(s+':duplicate');
    prev=L.sig;
    const boss=measureBossRoom(L);
    if(!boss||boss.w<26||boss.h<26||boss.w>32||boss.h>32||boss.open<360)fails.push(s+':boss '+(boss?boss.w+'x'+boss.h+' open '+boss.open:'missing'));
    else{bossMin=Math.min(bossMin,boss.w,boss.h);bossMax=Math.max(bossMax,boss.w,boss.h);}
    const bad=p=>{const tx=Math.floor(p.x/TS),ty=Math.floor(p.y/TS);if(tx<0||ty<0||tx>=L.w||ty>=L.h)return true;const t=L.tiles[ty*L.w+tx];return t===T_BWALL||t===T_BCORAL||t===T_BROCK;};
    if(bad(L.spawn)||bad(L.anchor)||bad(L.exit))fails.push(s+':anchor in wall');
    for(const e of L.encounters)if(bad(e)){fails.push(s+':enemy in wall');break;}
    for(const c of L.chests)if(bad(c)){fails.push(s+':chest in wall');break;}
  }
  return {n,ok:!fails.length,failCount:fails.length,fails:fails.slice(0,8),bossMin,bossMax};
}

const DEN_SPEC={
  hexmire:{
    style:'hex',cols:8,rows:7,cell:18,pad:36,total:[14,18],minDepth:8,salt:0x51a11e,
    floor:T_HFLOOR,wall:T_HWALL,fill:T_HWALL,hazard:T_HPOOL,shallow:T_HSHALLOW,
    props:[T_HROOT,T_HTOTEM],bossProp:T_HCAUL,bossR:[12,14],
    templates:['flood','roots','ritual','corridor','ruins'],
    rooms:{
      swarm:[['heximp',3]],
      turrets:[['hextotem',2]],
      pack:[['bogtoad',2],['cursetreant',1]],
      mixed:[['heximp',2],['mirebat',2]],
      mini:[['cursetreant',1],['bogtoad',2]],
      flood:[['bogtoad',2],['mirebat',1]],
      roots:[['cursetreant',1],['heximp',2]],
      ritual:[['hextotem',2],['heximp',1]],
      corridor:[['mirebat',2],['bogtoad',1]],
      ruins:[['bogtoad',1],['cursetreant',1]]
    }
  },
  cinderhive:{
    style:'cinder',cols:9,rows:8,cell:18,pad:40,total:[18,23],minDepth:9,salt:0xc1ade,
    floor:T_CFLOOR,wall:T_CWALL,fill:T_CWALL,hazard:T_CLAVA,shallow:T_CASH,
    props:[T_CEGG,T_CROCK],bossProp:T_CEGG,bossR:[13,15],
    templates:['honey','river','eggs','tunnels','cavern'],
    rooms:{
      swarm:[['cindermite',4]],
      turrets:[['lavaspit',2]],
      pack:[['broodguard',2],['hivedrone',1]],
      mixed:[['hivedrone',2],['ashlarva',2]],
      mini:[['broodguard',1],['lavaspit',2],['ashlarva',1]],
      honey:[['cindermite',3]],
      river:[['lavaspit',2],['hivedrone',1]],
      eggs:[['ashlarva',2],['broodguard',1]],
      tunnels:[['cindermite',2],['hivedrone',1]],
      cavern:[['broodguard',1],['ashlarva',1]]
    }
  },
  sanctum:{
    style:'sanctum',cols:9,rows:8,cell:18,pad:46,total:[22,27],minDepth:12,salt:0x5a9c7,
    floor:T_VFLOOR,wall:T_VWALL,fill:T_VVOID,hazard:0,shallow:T_VRUNE,
    props:[T_VPILLAR],bossProp:T_VRUNE,bossR:[15,17],
    rooms:{
      swarm:[['starwisp',3]],
      turrets:[['eclipser',2]],
      pack:[['runeguard',2],['acolyte',1]],
      mixed:[['acolyte',2],['voidshade',2]],
      mini:[['runeguard',1],['acolyte',2],['starwisp',1]]
    }
  }
};
function denCenter(spec,cell){
  return {x:spec.pad+cell.x*spec.cell+((spec.cell/2)|0),y:spec.pad+cell.y*spec.cell+((spec.cell/2)|0)};
}
function growDenTree(R,spec){
  const cols=spec.cols,rows=spec.rows,dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  const want=spec.total[0]+((R()*(spec.total[1]-spec.total[0]+1))|0);
  const occ=new Uint8Array(cols*rows),cells=[],parent=[];
  const sx=(R()*cols)|0,sy=(R()*rows)|0;
  cells.push({x:sx,y:sy});parent.push(-1);occ[sy*cols+sx]=1;
  const tipBias=spec.style==='hex'?0.78:spec.style==='cinder'?0.5:0.66;
  function freeNeighbor(i){
    const c=cells[i],opts=[];
    for(const d of dirs){
      const nx=c.x+d[0],ny=c.y+d[1];
      if(nx<0||ny<0||nx>=cols||ny>=rows||occ[ny*cols+nx])continue;
      opts.push({x:nx,y:ny});
    }
    return opts;
  }
  let guard=0;
  while(cells.length<want&&guard++<want*40){
    let i=R()<tipBias?cells.length-1:(R()*cells.length)|0;
    let opts=freeNeighbor(i);
    if(!opts.length){
      i=-1;
      for(let k=cells.length-1;k>=0;k--){opts=freeNeighbor(k);if(opts.length){i=k;break;}}
      if(i<0)break;
    }
    const pick=opts[(R()*opts.length)|0];
    occ[pick.y*cols+pick.x]=1;
    parent.push(i);
    cells.push(pick);
  }
  if(cells.length<spec.total[0])return null;
  function depths(){
    const depth=new Array(cells.length).fill(0);
    for(let i=1;i<cells.length;i++)depth[i]=depth[parent[i]]+1;
    let max=-1,ties=0,boss=0;
    for(let i=0;i<cells.length;i++){
      if(depth[i]>max){max=depth[i];ties=1;boss=i;}
      else if(depth[i]===max)ties++;
    }
    return {depth,max,ties,boss};
  }
  let info=depths();
  let extend=0;
  while(info.ties!==1&&extend++<6){
    const opts=freeNeighbor(info.boss);
    if(!opts.length)break;
    const pick=opts[(R()*opts.length)|0];
    occ[pick.y*cols+pick.x]=1;
    parent.push(info.boss);
    cells.push(pick);
    info=depths();
  }
  if(info.ties!==1||info.max<spec.minDepth)return null;
  return {cells,parent,boss:info.boss,depth:info.depth,max:info.max};
}
function carveDen(R,spec,tree){
  const w=spec.pad*2+spec.cols*spec.cell,h=spec.pad*2+spec.rows*spec.cell;
  const tiles=new Uint8Array(w*h),spine=new Uint8Array(w*h);
  tiles.fill(spec.fill);
  const floor=spec.floor,bossR=spec.bossR[0]+((R()*(spec.bossR[1]-spec.bossR[0]+1))|0);
  function set(x,y,t,mark){
    if(x<=1||y<=1||x>=w-2||y>=h-2)return;
    const i=y*w+x;
    if(spine[i]&&t!==floor)return;
    tiles[i]=t;
    if(mark)spine[i]=1;
  }
  function disk(cx,cy,rad,t,mark){
    for(let y=cy-rad;y<=cy+rad;y++)for(let x=cx-rad;x<=cx+rad;x++){
      if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=rad*rad)set(x,y,t,mark);
    }
  }
  function line(a,b,rad,mark){
    let pts=[a,b];
    if(spec.templates){
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      const bend=((R()*5)|0)-2;
      if(bend)pts=[a,{x:Math.round(mx+(-dy/len)*bend),y:Math.round(my+(dx/len)*bend)},b];
    }
    for(let s=0;s<pts.length-1;s++){
      const p=pts[s],q=pts[s+1];
      const steps=Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y),1);
      for(let i=0;i<=steps;i++){
        const x=Math.round(p.x+(q.x-p.x)*i/steps),y=Math.round(p.y+(q.y-p.y)*i/steps);
        if(!spec.templates&&spec.style==='hex'&&i>1&&i<steps&&(i%3)===0)disk(x+((R()*3)|0)-1,y+((R()*3)|0)-1,rad,floor,true);
        disk(x,y,rad,floor,mark);
      }
    }
  }
  function carveTemplate(id,c){
    const cx=c.x,cy=c.y;
    if(id==='flood'){disk(cx,cy,7,T_HSHALLOW,false);disk(cx,cy,2,floor,false);return 7;}
    if(id==='roots'){disk(cx,cy,5,floor,false);return 5;}
    if(id==='ritual'){disk(cx,cy,6,floor,false);return 6;}
    if(id==='corridor'){
      const horiz=R()<0.5,len=8,wid=2;
      for(let dy=-wid;dy<=wid;dy++)for(let dx=-len;dx<=len;dx++)set(cx+(horiz?dx:dy),cy+(horiz?dy:dx),floor,false);
      for(const s of [-1,1])for(let a=0;a<3;a++)for(let b=-2;b<=2;b++)set(cx+(horiz?b:s*(wid+1+a)),cy+(horiz?s*(wid+1+a):b),floor,false);
      return 8;
    }
    if(id==='ruins'){for(let y=cy-5;y<=cy+5;y++)for(let x=cx-5;x<=cx+5;x++)set(x,y,floor,false);return 5;}
    if(id==='honey'){
      for(const o of [[0,0],[5,-2],[-5,-2],[5,3],[-5,3],[0,6],[0,-5]])disk(cx+o[0],cy+o[1],2,floor,false);
      return 8;
    }
    if(id==='river'){for(let y=cy-3;y<=cy+3;y++)for(let x=cx-8;x<=cx+8;x++)set(x,y,floor,false);return 8;}
    if(id==='eggs'){disk(cx,cy,6,floor,false);return 6;}
    if(id==='tunnels'){
      disk(cx,cy,2,floor,false);
      for(const d of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]]){
        if(R()<0.25)continue;
        let x=cx,y=cy;const n=4+((R()*3)|0);
        for(let i=0;i<n;i++){x+=d[0];y+=d[1];disk(x,y,1,floor,false);}
      }
      return 7;
    }
    if(id==='cavern'){disk(cx,cy,6,floor,false);disk(cx+4,cy-3,3,floor,false);disk(cx-4,cy+3,3,floor,false);return 8;}
    disk(cx,cy,4,floor,false);return 4;
  }
  const centers=tree.cells.map(c=>denCenter(spec,c));
  const roomRad=spec.style==='sanctum'?4:spec.style==='cinder'?5:4;
  const roomRadAt=new Array(tree.cells.length).fill(roomRad);
  const roomTpl=new Array(tree.cells.length).fill('');
  const tplCounts={};
  for(let i=0;i<tree.cells.length;i++){
    if(i===tree.boss)continue;
    const c=centers[i];
    if(spec.templates){
      const ban=tree.parent[i]>=0?roomTpl[tree.parent[i]]:'';
      const opts=spec.templates.filter(id=>id!==ban).sort((a,b)=>((tplCounts[a]||0)-(tplCounts[b]||0))||(R()<0.5?-1:1));
      const id=opts[0]||spec.templates[0];
      roomTpl[i]=id;tplCounts[id]=(tplCounts[id]||0)+1;
      roomRadAt[i]=carveTemplate(id,c);
      disk(c.x,c.y,1,floor,true);
    }else if(spec.style==='hex'){
      disk(c.x,c.y,roomRad+((R()*2)|0),floor,false);
      disk(c.x+((R()*3)|0)-1,c.y+((R()*3)|0)-1,roomRad-1,floor,false);
      disk(c.x,c.y,1,floor,true);
    }else if(spec.style==='cinder'){
      for(let y=c.y-roomRad;y<=c.y+roomRad;y++)for(let x=c.x-roomRad;x<=c.x+roomRad;x++){
        if(Math.abs(x-c.x)+Math.abs(y-c.y)<=roomRad+2)set(x,y,floor,false);
      }
      disk(c.x,c.y,1,floor,true);
    }else{disk(c.x,c.y,roomRad,floor,false);disk(c.x,c.y,2,floor,true);}
  }
  for(let i=1;i<tree.cells.length;i++){
    if(i===tree.boss)continue;
    const tpl=roomTpl[i];
    const rad=!spec.templates?1:(tpl==='corridor'||tpl==='tunnels'||tpl==='roots')?1:(R()<0.45?2:1);
    line(centers[tree.parent[i]],centers[i],rad,true);
  }
  const prev=tree.parent[tree.boss];
  const prevC=centers[prev],bossCell=centers[tree.boss];
  let dx=bossCell.x-prevC.x,dy=bossCell.y-prevC.y,len=Math.hypot(dx,dy)||1;
  dx/=len;dy/=len;
  function fitsBoss(x,y){
    if(x-bossR<3||y-bossR<3||x+bossR>=w-3||y+bossR>=h-3)return false;
    for(let i=0;i<centers.length;i++){
      if(i===tree.boss)continue;
      if(Math.hypot(x-centers[i].x,y-centers[i].y)<(roomRadAt[i]||roomRad)+bossR+3)return false;
    }
    return true;
  }
  let bossAt=null;
  for(let step=6;step<=64;step+=2){
    const x=Math.round(bossCell.x+dx*step),y=Math.round(bossCell.y+dy*step);
    if(fitsBoss(x,y)){bossAt={x,y};break;}
  }
  if(!bossAt){
    for(let a=0;a<8&&!bossAt;a++){
      const ux=Math.cos(a*Math.PI/4),uy=Math.sin(a*Math.PI/4);
      for(let step=8;step<=70;step+=2){
        const x=Math.round(bossCell.x+ux*step),y=Math.round(bossCell.y+uy*step);
        if(fitsBoss(x,y)){bossAt={x,y};break;}
      }
    }
  }
  if(!bossAt)return null;
  const bx=bossAt.x,by=bossAt.y;
  disk(bx,by,bossR,floor,false);
  line(prevC,{x:bx,y:by},1,true);
  disk(bx,by,3,floor,true);
  const pdx=prevC.x-bx,pdy=prevC.y-by,plen=Math.hypot(pdx,pdy)||1;
  function away(x,y){
    const vx=x-bx,vy=y-by,vl=Math.hypot(vx,vy)||1;
    return (vx*pdx+vy*pdy)/vl/plen;
  }
  if(spec.style==='hex'){
    for(let y=by-bossR;y<=by+bossR;y++)for(let x=bx-bossR;x<=bx+bossR;x++){
      if((x-bx)*(x-bx)+(y-by)*(y-by)>(bossR-1)*(bossR-1))continue;
      if(x<=1||y<=1||x>=w-2||y>=h-2)continue;
      if(tiles[y*w+x]===floor)tiles[y*w+x]=T_HCLEAR;
    }
    const cx=bx+Math.round(-pdx/plen*5),cy=by+Math.round(-pdy/plen*5);
    for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
      if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
      tiles[y*w+x]=T_HCAUL;
    }
    for(let k=0;k<8;k++){
      const ang=(k+0.5)/8*TAU,dist=Math.round(bossR*0.62);
      const x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
      if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
      if(away(x,y)>0.45)continue;
      tiles[y*w+x]=k%2?T_HROOT:T_HTOTEM;
    }
    for(let k=0;k<5;k++){
      const ang=R()*TAU,dist=bossR-3;
      const x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
      if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
      if(Math.hypot(x-bx,y-by)<6)continue;
      tiles[y*w+x]=R()<0.6?T_HPOOL:T_HSHALLOW;
    }
  }else if(spec.style==='cinder'){
    for(let k=0;k<4;k++){
      const ang=k*TAU/4+0.4,dist=Math.round(bossR*0.62);
      const x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
      if(away(x,y)>0.4)continue;
      disk(x,y,2,T_CLAVA,false);
    }
    for(let k=0;k<6;k++){
      const ang=R()*TAU,dist=Math.round(bossR*0.45);
      const x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
      if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x]||away(x,y)>0.5)continue;
      tiles[y*w+x]=T_CEGG;
    }
  }else{
    for(let y=by-bossR;y<=by+bossR;y++)for(let x=bx-bossR;x<=bx+bossR;x++){
      const d=Math.hypot(x-bx,y-by);
      if(d>bossR*0.62&&d<bossR*0.62+1.4&&!spine[y*w+x]&&x>1&&y>1&&x<w-2&&y<h-2)tiles[y*w+x]=T_VRUNE;
    }
    for(let k=0;k<6;k++){
      const ang=k*TAU/6,dist=Math.round(bossR*0.78);
      const x=bx+Math.round(Math.cos(ang)*dist),y=by+Math.round(Math.sin(ang)*dist);
      if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x]||away(x,y)>0.55)continue;
      tiles[y*w+x]=T_VPILLAR;
    }
  }
  function dressTemplate(id,c){
    const cx=c.x,cy=c.y;
    function put(x,y,t){
      if(x<=1||y<=1||x>=w-2||y>=h-2)return;
      if(Math.max(Math.abs(x-cx),Math.abs(y-cy))<2)return;
      const i=y*w+x;if(spine[i]||tiles[i]===spec.fill)return;
      tiles[i]=t;
    }
    if(id==='flood'){
      for(const o of [[-4,-3],[4,-2],[-3,4],[5,3]])disk(cx+o[0],cy+o[1],1,T_HCLEAR,false);
      put(cx-4,cy,T_HPOOL);put(cx+4,cy+2,T_HPOOL);put(cx,cy+5,T_HPOOL);put(cx+2,cy-5,T_HPOOL);
    }else if(id==='roots'){
      for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++){
        if(((x+y)&1)===0&&Math.abs(x-cx)>1&&Math.abs(y-cy)>1)put(x,y,T_HROOT);
      }
    }else if(id==='ritual'){
      for(let k=0;k<6;k++){const ang=k/6*TAU;put(cx+Math.round(Math.cos(ang)*4),cy+Math.round(Math.sin(ang)*4),T_HTOTEM);}
      disk(cx,cy,2,T_HCLEAR,false);
    }else if(id==='corridor'){
      put(cx-6,cy-3,T_HSHALLOW);put(cx+6,cy+3,T_HSHALLOW);put(cx,cy-4,T_HTOTEM);put(cx-5,cy+4,T_HROOT);
    }else if(id==='ruins'){
      for(const o of [[-4,-4],[-3,-4],[4,-4],[3,-4],[-4,4],[-3,4],[4,4],[3,4]])put(cx+o[0],cy+o[1],T_HWALL);
      put(cx+3,cy-1,T_HCAUL);
    }else if(id==='honey'){
      put(cx+5,cy-2,T_CEGG);put(cx-5,cy+3,T_CROCK);put(cx,cy+6,T_CASH);
    }else if(id==='river'){
      for(let x=cx-7;x<=cx+7;x++){
        if(Math.abs(x-cx)<2||Math.abs(x-(cx-5))<1)continue;
        put(x,cy,T_CLAVA);put(x,cy+1,T_CLAVA);
      }
    }else if(id==='eggs'){
      for(let k=0;k<8;k++){const ang=(k+0.5)/8*TAU;put(cx+Math.round(Math.cos(ang)*4),cy+Math.round(Math.sin(ang)*4),T_CEGG);}
    }else if(id==='tunnels'){
      put(cx+3,cy+1,T_CROCK);put(cx-2,cy-3,T_CASH);
    }else if(id==='cavern'){
      put(cx+3,cy+2,T_CROCK);put(cx+4,cy+2,T_CROCK);put(cx-3,cy-2,T_CASH);put(cx+5,cy-1,T_CLAVA);put(cx-4,cy+1,T_CLAVA);
    }
  }
  for(let i=0;i<tree.cells.length;i++){
    if(i===tree.boss)continue;
    const c=centers[i];
    if(roomTpl[i]){dressTemplate(roomTpl[i],c);continue;}
    for(let n=0;n<5;n++){
      const x=c.x+((R()*9)|0)-4,y=c.y+((R()*9)|0)-4;
      if(x<=1||y<=1||x>=w-2||y>=h-2)continue;
      const id=y*w+x;
      if(tiles[id]!==floor||spine[id])continue;
      if(Math.abs(x-c.x)+Math.abs(y-c.y)<2)continue;
      const roll=R();
      if(spec.hazard&&roll<0.34)tiles[id]=spec.hazard;
      else if(roll<0.55)tiles[id]=spec.props[(R()*spec.props.length)|0];
      else if(roll<0.7&&spec.shallow)tiles[id]=spec.shallow;
    }
    if(spec.style==='cinder'){
      for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
        const x=c.x+d[0]*(roomRad+1),y=c.y+d[1]*(roomRad+1);
        if(x<=1||y<=1||x>=w-2||y>=h-2||spine[y*w+x])continue;
        if(tiles[y*w+x]===spec.wall)tiles[y*w+x]=T_CLAVA;
      }
    }
  }
  function walkable(tx,ty){
    if(tx<=0||ty<=0||tx>=w-1||ty>=h-1)return false;
    return !SOLID.has(tiles[ty*w+tx]);
  }
  const startC=centers[0];
  let ex=Math.round(bx+(pdx/plen)*(bossR-3)),ey=Math.round(by+(pdy/plen)*(bossR-3));
  if(!walkable(ex,ey)){ex=bx;ey=by;}
  const seen=new Uint8Array(w*h),stack=[startC.y*w+startC.x];
  if(!walkable(startC.x,startC.y)||!walkable(bx,by))return null;
  seen[startC.y*w+startC.x]=1;
  while(stack.length){
    const i=stack.pop(),x=i%w,y=(i/w)|0;
    for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+d[0],ny=y+d[1];
      if(!walkable(nx,ny))continue;
      const j=ny*w+nx;
      if(seen[j])continue;
      seen[j]=1;stack.push(j);
    }
  }
  function reached(tx,ty){return tx>0&&ty>0&&tx<w&&ty<h&&seen[ty*w+tx]===1;}
  if(!reached(bx,by)||!reached(ex,ey))return null;
  for(let i=0;i<centers.length;i++)if(i!==tree.boss&&!reached(centers[i].x,centers[i].y))return null;
  function pix(tx,ty){return {x:(tx+0.5)*TS,y:(ty+0.5)*TS};}
  function findSpot(cx,cy,avoid){
    for(let r=0;r<8;r++){
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        if(r&&Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const x=cx+dx,y=cy+dy;
        if(!walkable(x,y)||!reached(x,y))continue;
        if(spine[y*w+x]&&r<2)continue;
        const p=pix(x,y);let bad=false;
        for(const a of avoid)if(Math.hypot(p.x-a.x,p.y-a.y)<18)bad=true;
        if(!bad)return p;
      }
    }
    return walkable(cx,cy)?pix(cx,cy):null;
  }
  const spawn=pix(startC.x,startC.y),anchor=pix(bx,by),exit=pix(ex,ey);
  const rooms=[];
  for(let i=0;i<tree.cells.length;i++){
    const c=i===tree.boss?{x:bx,y:by}:centers[i];
    const role=i===0?'start':i===tree.boss?'boss':'path';
    const rad=i===tree.boss?bossR:(roomRadAt[i]||roomRad)+1;
    rooms.push({cx:tree.cells[i].x,cy:tree.cells[i].y,role,tpl:roomTpl[i]||'',x0:c.x-rad,y0:c.y-rad,x1:c.x+rad+1,y1:c.y+rad+1,links:[],enc:'',ix:i});
  }
  for(let i=1;i<tree.cells.length;i++){
    const p=tree.parent[i];
    rooms[i].links.push(p);rooms[p].links.push(i);
    if(i!==tree.boss&&rooms[i].role==='path')rooms[i].role='side';
  }
  const chain=[];
  for(let i=tree.boss;i>=0;i=tree.parent[i])chain.push(i);
  chain.reverse();
  for(const i of chain)if(i!==tree.boss&&i!==0)rooms[i].role='path';
  const dist=new Array(rooms.length).fill(-1),queue=[0];
  dist[0]=0;
  for(let qi=0;qi<queue.length;qi++){
    const i=queue[qi];
    for(const j of rooms[i].links)if(dist[j]<0){dist[j]=dist[i]+1;queue.push(j);}
  }
  let maxD=-1,ties=0,bossD=-1;
  for(let i=0;i<rooms.length;i++){
    if(dist[i]<0)return null;
    if(dist[i]>maxD){maxD=dist[i];ties=1;}
    else if(dist[i]===maxD)ties++;
    if(rooms[i].role==='boss')bossD=dist[i];
  }
  if(bossD!==maxD||ties!==1)return null;
  const encounters=[],chests=[],taken=[spawn,anchor,exit];
  function place(type,room){
    const c=room.role==='boss'?{x:bx,y:by}:centers[room.ix];
    const p=findSpot(c.x,c.y,taken);
    if(!p)return false;
    encounters.push({type,x:p.x,y:p.y});taken.push(p);return true;
  }
  const sideRooms=rooms.filter(r=>r.role==='side'||r.role==='path');
  if(sideRooms.length<3)return null;
  const chestRoom=sideRooms[0],miniRoom=sideRooms[1];
  chestRoom.role='chest';
  const cp=findSpot(centers[chestRoom.ix].x,centers[chestRoom.ix].y,taken);
  if(!cp)return null;
  chests.push({x:cp.x,y:cp.y,open:false});taken.push(cp);
  miniRoom.role='mini';miniRoom.enc='mini';
  for(const [type,n] of spec.rooms.mini)for(let k=0;k<n;k++)if(!place(type,miniRoom))return null;
  const kinds=['swarm','turrets','pack','mixed'];
  for(const room of rooms){
    if(room.role!=='path'&&room.role!=='side')continue;
    const themed=room.tpl&&spec.rooms[room.tpl];
    const kind=themed?room.tpl:kinds[(R()*kinds.length)|0];
    room.enc=kind;
    for(const [type,n] of (themed||spec.rooms[kind]))for(let k=0;k<n;k++)if(!place(type,room))return null;
  }
  if(encounters.length<6)return null;
  let x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(tiles[y*w+x]!==spec.fill){
    if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;
  }
  x0=Math.max(0,x0-2);y0=Math.max(0,y0-2);x1=Math.min(w-1,x1+2);y1=Math.min(h-1,y1+2);
  const nw=x1-x0+1,nh=y1-y0+1,nt=new Uint8Array(nw*nh);
  nt.fill(spec.fill);
  for(let y=0;y<nh;y++)for(let x=0;x<nw;x++)nt[y*nw+x]=tiles[(y+y0)*w+(x+x0)];
  const sh=o=>{o.x-=x0*TS;o.y-=y0*TS;};
  sh(spawn);sh(anchor);sh(exit);
  encounters.forEach(sh);chests.forEach(sh);
  for(const r of rooms){r.x0-=x0;r.y0-=y0;r.x1-=x0;r.y1-=y0;}
  let hash=0;
  for(let i=0;i<nt.length;i+=7)hash=Math.imul(hash,33)+nt[i]|0;
  const pathN=chain.length,sideN=rooms.length-pathN;
  const sig=rooms.map(r=>r.cx+','+r.cy+':'+r.role+':'+r.enc+':'+(r.tpl||'')).join('|')+'#'+(hash>>>0);
  return {w:nw,h:nh,tiles:nt,rooms,pathN,sideN,spawn,anchor,exit,encounters,chests,sig,bossDist:bossD,maxDist:maxD,connected:true,bossR,style:spec.style};
}
function tryDen(R,spec){
  const tree=growDenTree(R,spec);
  if(!tree)return null;
  return carveDen(R,spec,tree);
}
function fallbackDen(R,spec){
  const cols=spec.cols,rows=spec.rows,cells=[],parent=[];
  const need=spec.minDepth+1;
  let x=0,y=1,dir=1;
  while(cells.length<need&&y<rows-1){
    cells.push({x,y});
    parent.push(cells.length===1?-1:cells.length-2);
    const nx=x+dir;
    if(nx<0||nx>=cols){y+=1;dir=-dir;}
    else x=nx;
  }
  if(cells.length<need)return null;
  const boss=need-1;
  if(y+1<rows){
    cells.push({x:cells[2].x,y:cells[2].y+1});parent.push(2);
    const k=Math.min(5,boss-1);
    cells.push({x:cells[k].x,y:Math.min(rows-1,cells[k].y+1)});parent.push(k);
  }
  const depth=parent.map((p,i)=>p<0?0:0);
  for(let i=1;i<cells.length;i++)depth[i]=depth[parent[i]]+1;
  return carveDen(R,spec,{cells,parent,boss,depth,max:depth[boss]});
}
function layoutDen(id,seed){
  const spec=DEN_SPEC[id];
  if(!spec)return null;
  const base=seed|0;
  for(let attempt=0;attempt<16;attempt++){
    const L=tryDen(mulberry((base+Math.imul(attempt+1,0x9E3779B9))|0),spec);
    if(L)return L;
  }
  return fallbackDen(mulberry(base^(spec.salt|0)),spec);
}
function genDen(id,seed){
  if(seed==null)seed=(Math.random()*0x7fffffff)|0;
  seed|=0;
  const d=DUNGEONS[id];
  const L=layoutDen(id,seed);
  if(!L)return null;
  const wd=mkWorld(L.w,L.h);
  wd.isDungeon=true;wd.dungeonId=id;wd.dname=d.name;wd.theme=d.theme;
  wd.tiles.set(L.tiles);
  const fill=DEN_SPEC[id].fill;
  for(let i=0;i<wd.zone.length;i++)wd.zone[i]=L.tiles[i]===fill||L.tiles[i]===T_VVOID?-1:0;
  wd.spawn=L.spawn;wd.exit=L.exit;wd.exitOpen=false;wd.anchor=L.anchor;
  wd.beacons=[];wd.encounters=L.encounters;wd.lootChests=L.chests;wd.rooms=L.rooms;
  wd.layoutSig=L.sig;wd.seed=seed;wd.pathRooms=L.pathN;wd.roomCount=L.rooms.length;
  renderWorld(wd);
  return wd;
}
function auditDens(n){
  n=n||40;
  const out={};
  for(const id in DEN_SPEC){
    const fails=[];let prev='';
    const counts={path:0,rooms:0};
    for(let s=1;s<=n;s++){
      const L=layoutDen(id,s);
      if(!L){fails.push(s+':none');continue;}
      if(L.sig===prev)fails.push(s+':dup');
      prev=L.sig;
      counts.path+=L.pathN;counts.rooms+=L.rooms.length;
      if(L.pathN<DEN_SPEC[id].minDepth)fails.push(s+':path '+L.pathN);
      if(!L.connected||L.bossDist!==L.maxDist)fails.push(s+':reach');
      const bad=p=>{const tx=Math.floor(p.x/TS),ty=Math.floor(p.y/TS);if(tx<0||ty<0||tx>=L.w||ty>=L.h)return true;return SOLID.has(L.tiles[ty*L.w+tx]);};
      if(bad(L.spawn)||bad(L.anchor)||bad(L.exit))fails.push(s+':anchor');
      for(const e of L.encounters)if(bad(e)){fails.push(s+':enemy');break;}
      if(L.encounters.length<6)fails.push(s+':few '+L.encounters.length);
      const seen=new Set(L.encounters.map(e=>e.type));
      if(seen.size<3)fails.push(s+':roster '+seen.size);
    }
    out[id]={n,ok:!fails.length,failCount:fails.length,fails:fails.slice(0,6),avgPath:Math.round(counts.path/n),avgRooms:Math.round(counts.rooms/n)};
  }
  return out;
}

/* ---------------- Serpent's Coil ---------------- */
const COIL_PITCH=16,COIL_PAD=16,COIL_COLS=4,COIL_ROWS=3;
function tryCoil(R){
  const before=5+((R()*3)|0);
  const shapes=['round','hall','cross','diamond','gallery','alcove','oct'];
  const cells=[{x:1,y:1}],occ={'1,1':1};
  let x=1,y=1,guard=0;
  const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
  while(cells.length<before+1&&guard++<80){
    const opts=[];
    for(const d of dirs){
      const nx=x+d[0],ny=y+d[1];
      if(nx<0||ny<0||nx>=COIL_COLS||ny>=COIL_ROWS||occ[nx+','+ny])continue;
      opts.push([nx,ny,d]);
    }
    if(!opts.length)return null;
    const last=cells.length===before;
    let pick=opts[(R()*opts.length)|0];
    if(last){
      const edge=opts.filter(o=>o[0]===0||o[1]===0||o[0]===COIL_COLS-1||o[1]===COIL_ROWS-1);
      if(edge.length)pick=edge[(R()*edge.length)|0];
    }
    x=pick[0];y=pick[1];occ[x+','+y]=1;
    cells.push({x,y,boss:cells.length===before});
  }
  if(cells.length!==before+1)return null;
  cells[cells.length-1].boss=true;
  const used={};let prev='';
  for(let i=0;i<cells.length-1;i++){
    const opts=shapes.filter(s=>s!==prev).sort((a,b)=>((used[a]||0)-(used[b]||0))||(R()<0.5?-1:1));
    const s=opts[0];cells[i].shape=s;used[s]=(used[s]||0)+1;prev=s;
  }
  if(Object.keys(used).length<3)return null;
  const w=COIL_PAD*2+COIL_COLS*COIL_PITCH,h=COIL_PAD*2+COIL_ROWS*COIL_PITCH;
  if(w*h>96*96)return null;
  const tiles=new Uint8Array(w*h);tiles.fill(T_SWALL);
  function set(x,y,t){if(x>1&&y>1&&x<w-2&&y<h-2)tiles[y*w+x]=t;}
  function disk(cx,cy,rad,t){for(let yy=cy-rad;yy<=cy+rad;yy++)for(let xx=cx-rad;xx<=cx+rad;xx++)if((xx-cx)*(xx-cx)+(yy-cy)*(yy-cy)<=rad*rad)set(xx,yy,t);}
  function carveShape(shape,cx,cy){
    if(shape==='round'){disk(cx,cy,5,T_SFLOOR);return;}
    if(shape==='hall'){for(let yy=cy-3;yy<=cy+3;yy++)for(let xx=cx-5;xx<=cx+5;xx++)set(xx,yy,T_SFLOOR);return;}
    if(shape==='cross'){
      for(let yy=cy-2;yy<=cy+2;yy++)for(let xx=cx-5;xx<=cx+5;xx++)set(xx,yy,T_SFLOOR);
      for(let yy=cy-5;yy<=cy+5;yy++)for(let xx=cx-2;xx<=cx+2;xx++)set(xx,yy,T_SFLOOR);
      return;
    }
    if(shape==='diamond'){for(let yy=cy-5;yy<=cy+5;yy++)for(let xx=cx-5;xx<=cx+5;xx++)if(Math.abs(xx-cx)+Math.abs(yy-cy)<=5)set(xx,yy,T_SFLOOR);return;}
    if(shape==='gallery'){
      for(let yy=cy-4;yy<=cy+4;yy++)for(let xx=cx-5;xx<=cx+5;xx++)set(xx,yy,T_SFLOOR);
      set(cx-3,cy-2,T_SWALL);set(cx+3,cy+2,T_SWALL);
      return;
    }
    if(shape==='alcove'){
      for(let yy=cy-3;yy<=cy+3;yy++)for(let xx=cx-4;xx<=cx+4;xx++)set(xx,yy,T_SFLOOR);
      disk(cx,cy-4,2,T_SFLOOR);disk(cx,cy+4,2,T_SFLOOR);
      return;
    }
    for(let yy=cy-5;yy<=cy+5;yy++)for(let xx=cx-5;xx<=cx+5;xx++){
      const ax=Math.abs(xx-cx),ay=Math.abs(yy-cy);
      if(ax+ay<=6&&ax<=5&&ay<=5)set(xx,yy,T_SFLOOR);
    }
  }
  const centers=[];
  for(let i=0;i<cells.length;i++){
    const c=cells[i];
    let cx=COIL_PAD+c.x*COIL_PITCH+((COIL_PITCH/2)|0);
    let cy=COIL_PAD+c.y*COIL_PITCH+((COIL_PITCH/2)|0);
    if(c.boss){
      const p=cells[i-1];
      const dx=Math.sign(c.x-p.x),dy=Math.sign(c.y-p.y);
      cx+=dx*6;cy+=dy*6;
      disk(cx,cy,12,T_SFLOOR);
      for(let a=0;a<18;a++){
        const ang=a/18*Math.PI*2;
        const jx=cx+Math.round(Math.cos(ang)*10),jy=cy+Math.round(Math.sin(ang)*10);
        if(jx>1&&jy>1&&jx<w-2&&jy<h-2&&tiles[jy*w+jx]===T_SFLOOR&&(a%2===0))tiles[jy*w+jx]=T_SJADE;
      }
    }else carveShape(c.shape,cx,cy);
    centers.push({x:cx,y:cy});
  }
  const breaks=[];
  function floorish(t){return t===T_SFLOOR||t===T_SJADE;}
  for(let i=0;i<cells.length-1;i++){
    const a=centers[i],b=centers[i+1];
    const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
    if(!dx&&!dy)return null;
    let x=a.x,y=a.y,steps=0;
    while(steps++<40&&floorish(tiles[(y+dy)*w+(x+dx)])){x+=dx;y+=dy;}
    const x1=x,y1=y;
    x=b.x;y=b.y;steps=0;
    while(steps++<40&&floorish(tiles[(y-dy)*w+(x-dx)])){x-=dx;y-=dy;}
    const span=Math.abs((x-x1)*dx+(y-y1)*dy);
    if(span<2||span>12)return null;
    const px=-dy,py=dx,band=[];
    for(let s=1;s<span;s++){
      const ux=x1+dx*s,uy=y1+dy*s;
      for(let k=-1;k<=1;k++){
        const tx=ux+px*k,ty=uy+py*k;
        if(tx<=1||ty<=1||tx>=w-2||ty>=h-2)return null;
        if(tiles[ty*w+tx]!==T_SWALL&&tiles[ty*w+tx]!==T_SBREAK)return null;
        band.push({x:tx,y:ty});
      }
    }
    const seen={},uniq=[];
    for(const t of band){const k=t.x+','+t.y;if(seen[k])continue;seen[k]=1;uniq.push(t);tiles[t.y*w+t.x]=T_SBREAK;}
    if(uniq.length<6)return null;
    let sx=0,sy=0;for(const t of uniq){sx+=t.x;sy+=t.y;}
    breaks.push({tiles:uniq,x:(sx/uniq.length+0.5)*TS,y:(sy/uniq.length+0.5)*TS});
  }
  if(breaks.length!==cells.length-1)return null;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
    if((xx===0||yy===0||xx===w-1||yy===h-1)&&tiles[yy*w+xx]!==T_SWALL)return null;
    if((xx<2||yy<2||xx>w-3||yy>h-3)&&tiles[yy*w+xx]===T_SBREAK)return null;
  }
  function reach(block){
    const seen=new Uint8Array(w*h),sx=centers[0].x,sy=centers[0].y;
    if(!floorish(tiles[sy*w+sx]))return false;
    const st=[sy*w+sx];seen[sy*w+sx]=1;
    const bx=centers[centers.length-1].x,by=centers[centers.length-1].y;let boss=false;
    while(st.length){
      const i=st.pop(),xx=i%w,yy=(i/w)|0;
      if(xx===bx&&yy===by)boss=true;
      for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=xx+d[0],ny=yy+d[1];
        if(nx<=0||ny<=0||nx>=w-1||ny>=h-1)continue;
        const t=tiles[ny*w+nx];
        if(t===T_SWALL)continue;
        if(block&&t===T_SBREAK)continue;
        if(!floorish(t)&&t!==T_SBREAK)continue;
        const j=ny*w+nx;if(seen[j])continue;seen[j]=1;st.push(j);
      }
    }
    return boss;
  }
  if(reach(true)||!reach(false))return null;
  const rooms=centers.map((c,i)=>({x0:c.x-7,y0:c.y-7,x1:c.x+8,y1:c.y+8,role:cells[i].boss?'boss':(i?'path':'start'),shape:cells[i].shape||'arena',seen:false}));
  const spawn={x:(centers[0].x+0.5)*TS,y:(centers[0].y+0.5)*TS};
  const last=centers[centers.length-1],prevC=centers[centers.length-2];
  const anchor={x:(last.x+0.5)*TS,y:(last.y+0.5)*TS};
  const exit={x:((last.x*0.62+prevC.x*0.38)+0.5)*TS,y:((last.y*0.62+prevC.y*0.38)+0.5)*TS};
  const packs=[
    [['cobraspitter',1]],
    [['viper',2]],
    [['naga',1],['cobraspitter',1]],
    [['clutch',1],['hatchling',1]],
    [['constrictor',1]],
    [['viper',1],['naga',1]],
    [['cobraspitter',1],['constrictor',1]]
  ];
  const encounters=[],taken=[spawn,anchor,exit];
  function openAt(px,py){
    const tx=Math.floor(px/TS),ty=Math.floor(py/TS);
    if(tx<=1||ty<=1||tx>=w-2||ty>=h-2)return false;
    return floorish(tiles[ty*w+tx]);
  }
  function place(type,c){
    for(let n=0;n<24;n++){
      const ang=R()*Math.PI*2,dist=2+R()*4.5;
      const p={x:(c.x+Math.cos(ang)*dist+0.5)*TS,y:(c.y+Math.sin(ang)*dist+0.5)*TS};
      if(!openAt(p.x,p.y))continue;
      let bad=false;for(const a of taken)if(Math.hypot(p.x-a.x,p.y-a.y)<16)bad=true;
      if(bad)continue;
      encounters.push({type,x:p.x,y:p.y});taken.push(p);return true;
    }
    return false;
  }
  for(let i=0;i<centers.length-1;i++){
    const pack=packs[i%packs.length];
    for(const [type,n] of pack)for(let k=0;k<n;k++)if(!place(type,centers[i]))return null;
  }
  const chests=[];
  if(centers.length>3){
    const c=centers[2];
    const cp={x:(c.x+0.5)*TS+10,y:(c.y+0.5)*TS};
    if(openAt(cp.x,cp.y))chests.push({x:cp.x,y:cp.y,open:false});
  }
  let hash=0;for(let i=0;i<tiles.length;i+=11)hash=Math.imul(hash,33)+tiles[i]|0;
  const sig=cells.map(c=>c.x+','+c.y+':'+(c.shape||'boss')).join('|')+'#'+(hash>>>0);
  return {w,h,tiles,rooms,pathN:before,roomCount:rooms.length,spawn,anchor,exit,encounters,chests,breaks,sig,connected:true};
}
function layoutCoil(seed){
  const base=seed|0;
  for(let attempt=0;attempt<24;attempt++){
    const L=tryCoil(mulberry(((base+Math.imul(attempt+1,0x9E3779B9))^0xc011)|0));
    if(L)return L;
  }
  return null;
}
function genCoil(seed){
  if(seed==null)seed=(Math.random()*0x7fffffff)|0;
  seed|=0;
  const L=layoutCoil(seed);
  if(!L)return null;
  const wd=mkWorld(L.w,L.h);
  const d=DUNGEONS.coil;
  wd.isDungeon=true;wd.dungeonId='coil';wd.dname=d.name;wd.theme='coil';
  wd.tiles.set(L.tiles);
  for(let i=0;i<wd.zone.length;i++)wd.zone[i]=L.tiles[i]===T_SWALL||L.tiles[i]===T_SBREAK?-1:0;
  wd.spawn=L.spawn;wd.exit=L.exit;wd.exitOpen=false;wd.anchor=L.anchor;
  wd.beacons=[];wd.encounters=L.encounters;wd.lootChests=L.chests;wd.rooms=L.rooms;
  wd.layoutSig=L.sig;wd.seed=seed;wd.pathRooms=L.pathN;wd.roomCount=L.roomCount;
  wd.breaks=L.breaks.map((b,i)=>({id:i,hp:2200,max:2200,tiles:b.tiles,x:b.x,y:b.y,dead:false}));
  wd.breakAt={};
  for(const seg of wd.breaks)for(const t of seg.tiles)wd.breakAt[t.x+','+t.y]=seg;
  renderWorld(wd);
  return wd;
}
function auditCoil(n){
  n=n||24;const fails=[];let prev='',shapes=0,rooms=0;
  for(let s=1;s<=n;s++){
    const L=layoutCoil(s);
    if(!L){fails.push(s+':none');continue;}
    if(L.sig===prev)fails.push(s+':dup');
    prev=L.sig;
    if(L.pathN<5||L.pathN>7)fails.push(s+':rooms '+L.pathN);
    if(L.breaks.length!==L.pathN)fails.push(s+':seals '+L.breaks.length);
    const kinds=new Set(L.rooms.filter(r=>r.role!=='boss').map(r=>r.shape));
    shapes+=kinds.size;rooms+=L.roomCount;
    if(kinds.size<3)fails.push(s+':shapes '+kinds.size);
    let border=0,seal=0;
    for(let y=0;y<L.h;y++)for(let x=0;x<L.w;x++){
      const t=L.tiles[y*L.w+x];
      if((x===0||y===0||x===L.w-1||y===L.h-1)&&t!==T_SWALL)border++;
      if(t===T_SBREAK)seal++;
    }
    if(border)fails.push(s+':border');
    if(!seal)fails.push(s+':noseal');
    const types=new Set(L.encounters.map(e=>e.type));
    if(types.size<4)fails.push(s+':roster '+types.size);
  }
  return {n,ok:!fails.length,failCount:fails.length,fails:fails.slice(0,6),avgShapes:Math.round(shapes/Math.max(1,n-fails.length)),avgRooms:Math.round(rooms/Math.max(1,n))};
}

/* ---------------- Throne of Ruin ---------------- */
function genThrone(){
  const w=70,h=78,wd=mkWorld(w,h);
  const d=DUNGEONS.throne;
  wd.isDungeon=true;wd.dungeonId='throne';wd.dname=d.name;wd.theme='throne';
  wd.tiles.fill(T_MWALL);
  wd.mkName={};
  const cx=35,cy=32,R=25;
  function set(x,y,t){if(x>1&&y>1&&x<w-2&&y<h-2)wd.tiles[y*w+x]=t;}
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=R*R)set(x,y,T_MFLOOR);
  }
  for(let y=cy+6;y<h-3;y++)for(let x=cx-4;x<=cx+3;x++)set(x,y,T_MFLOOR);
  const riftIn=R-3.2;
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    if(wd.tiles[y*w+x]!==T_MFLOOR)continue;
    const dist=Math.hypot(x-cx,y-cy);
    if(dist>riftIn&&dist<=R+0.4&&Math.abs(x-cx)>2)wd.tiles[y*w+x]=T_MRIFT;
  }
  for(let y=cy-R+3;y<=cy-R+11;y++)for(let x=cx-8;x<=cx+7;x++){
    if(wd.tiles[y*w+x]===T_MFLOOR)wd.tiles[y*w+x]=T_MDAIS;
  }
  const tx0=cx-2,ty0=cy-R+4;
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    set(tx0+c,ty0+r,T_MTHRONE);
    wd.mkName[(tx0+c)+','+(ty0+r)]='throne'+r+c;
  }
  for(let y=ty0+5;y<h-5;y++){
    for(let x=cx-2;x<=cx+1;x++){
      const t=wd.tiles[y*w+x];
      if(t===T_MFLOOR||t===T_MDAIS||t===T_MRIFT)wd.tiles[y*w+x]=y===h-6?T_MEND:T_MCARPET;
    }
  }
  set(cx-6,ty0+1,T_MBRAZIER);set(cx+5,ty0+1,T_MBRAZIER);
  const pillars=[];
  for(let i=0;i<8;i++){
    const a=i*TAU/8+TAU/16;
    const px=Math.round(cx+Math.cos(a)*12),py=Math.round(cy+Math.sin(a)*12);
    if(wd.tiles[py*w+px]===T_MFLOOR){wd.tiles[py*w+px]=T_MPILLAR;pillars.push({x:px,y:py});}
  }
  const pylons=[];
  for(const a of [Math.PI*0.25,Math.PI*0.75,Math.PI*1.25,Math.PI*1.75]){
    let px=Math.round(cx+Math.cos(a)*(R-6)),py=Math.round(cy+Math.sin(a)*(R-6));
    if(wd.tiles[py*w+px]===T_MWALL||wd.tiles[py*w+px]===T_MRIFT){
      px=Math.round(cx+Math.cos(a)*(R-8));py=Math.round(cy+Math.sin(a)*(R-8));
    }
    wd.tiles[py*w+px]=T_MPYLON;
    pylons.push({x:px,y:py,hp:8000,max:8000,dead:false});
  }
  for(let i=0;i<wd.zone.length;i++)wd.zone[i]=wd.tiles[i]===T_MWALL?-1:0;
  const hall={x:(cx+0.5)*TS,y:(cy+0.5)*TS};
  const throne={x:(tx0+2.5)*TS,y:(ty0+3.2)*TS};
  wd.hall=hall;wd.throne=throne;wd.cxTile=cx;wd.cyTile=cy;wd.hallR=R;
  wd.riftReach=riftIn;wd.riftSafe=12;wd.pillars=pillars;wd.pylons=pylons;
  wd.spawn={x:(cx+0.5)*TS,y:(h-6.5)*TS};
  wd.exit={x:(cx+0.5)*TS,y:(h-8.5)*TS};
  wd.exitOpen=false;
  wd.anchor={x:throne.x,y:throne.y};
  wd.beacons=[];
  wd.rooms=[{x0:1,y0:1,x1:w-1,y1:h-1,role:'boss',seen:false}];
  wd.lootChests=[];
  const kinds=['shardguard','crystalcaster','royalhound','crownsentry','shardling','shardguard'];
  wd.encounters=kinds.map((type,i)=>({type,x:(cx-3.2+i*1.3)*TS,y:(h-16)*TS}));
  wd.layoutSig='throne';wd.seed=1;wd.pathRooms=1;wd.roomCount=1;
  renderWorld(wd);
  return wd;
}
function refreshDungeon(wd){
  if(!wd)return;
  wd.canvas=null;wd.chunks=null;wd.voidChunks=null;
  renderWorld(wd);
}

/* ---------------- classes & items ---------------- */
const STATK=['hp','mp','att','def','spd','dex','vit','wis'];
const STATN={hp:'HP',mp:'MP',att:'ATT',def:'DEF',spd:'SPD',dex:'DEX',vit:'VIT',wis:'WIS'};
const CLASSES={
  wizard:{name:'Wizard',spr:'wizard',w:'staff',a:'robe',ability:'Ember Nova',cost:35,col:'#ff8a3a',
    desc:['Twin fire bolts, fragile robes.','Ember Nova: a blast that weakens.'],
    base:{hp:120,mp:120,att:14,def:0,spd:11,dex:12,vit:8,wis:13},gain:{hp:[18,26],mp:[8,14],att:[1,2],def:[0,0],spd:[0,1],dex:[1,2],vit:[0,1],wis:[1,2]},
    // Glass cannon: high ATT / MP / WIS, low HP and DEF. Cap budget ~481.
    max:{hp:650,mp:460,att:75,def:15,spd:50,dex:62,vit:32,wis:75}},
  archer:{name:'Archer',spr:'archer',w:'bow',a:'leather',ability:'Thorn Volley',cost:30,col:'#b8ff6a',
    desc:['Long-range piercing arrows.','Thorn Volley: fan that slows.'],
    base:{hp:140,mp:90,att:12,def:2,spd:13,dex:11,vit:10,wis:10},gain:{hp:[20,28],mp:[5,10],att:[1,2],def:[0,1],spd:[0,2],dex:[0,2],vit:[0,1],wis:[0,1]},
    // Archer: high DEX and SPD, middle HP. Cap budget ~488.
    max:{hp:740,mp:310,att:62,def:28,spd:75,dex:75,vit:42,wis:42}},
  knight:{name:'Knight',spr:'knight',w:'sword',a:'heavy',ability:'Aegis Slam',cost:30,col:'#9fd0ff',
    desc:['Short heavy blade, thick plate.','Aegis Slam: stun + shield.'],
    base:{hp:200,mp:70,att:12,def:7,spd:10,dex:10,vit:14,wis:7},gain:{hp:[24,32],mp:[4,8],att:[1,2],def:[0,1],spd:[0,1],dex:[0,2],vit:[1,2],wis:[0,1]},
    // Tank: high HP / DEF / VIT, lower SPD and MP. Cap budget ~491.
    max:{hp:960,mp:250,att:55,def:42,spd:40,dex:55,vit:75,wis:36}},
  priest:{name:'Priest',spr:'priest',w:'wand',a:'robe',ability:'Healing Tome',cost:45,col:'#ffe9a0',
    desc:['Long piercing wand, white robes.','Healing Tome: restore health.'],
    base:{hp:130,mp:110,att:12,def:1,spd:11,dex:12,vit:10,wis:15},gain:{hp:[18,26],mp:[7,12],att:[0,2],def:[0,1],spd:[0,1],dex:[0,2],vit:[0,1],wis:[1,2]},
    // Healer: high WIS and MP, modest ATT, robe defense. Cap budget sits with the caster.
    max:{hp:670,mp:385,att:55,def:25,spd:55,dex:55,vit:40,wis:75}},
  warrior:{name:'Warrior',spr:'warrior',w:'sword',a:'heavy',ability:'Berserk Helm',cost:40,col:'#ff5a3a',
    desc:['Heavy blade and a battle helm.','Berserk Helm: a burst of Dexterity.'],
    base:{hp:180,mp:80,att:15,def:5,spd:12,dex:13,vit:12,wis:8},gain:{hp:[22,30],mp:[4,8],att:[1,2],def:[0,1],spd:[0,1],dex:[1,2],vit:[1,2],wis:[0,1]},
    // Bruiser: high ATT and DEX, less HP and DEF than the knight.
    max:{hp:800,mp:252,att:75,def:30,spd:50,dex:70,vit:60,wis:40}},
  rogue:{name:'Rogue',spr:'rogue',w:'dagger',a:'leather',ability:'Shadow Cloak',cost:45,col:'#8fd16a',
    desc:['Fast dagger, light leathers.','Shadow Cloak: turn invisible.'],
    base:{hp:150,mp:100,att:13,def:2,spd:15,dex:14,vit:10,wis:10},gain:{hp:[20,28],mp:[5,10],att:[1,2],def:[0,1],spd:[1,2],dex:[1,2],vit:[0,1],wis:[0,1]},
    // Skirmisher: high SPD and DEX, medium range, light armor.
    max:{hp:720,mp:300,att:60,def:22,spd:75,dex:75,vit:40,wis:45}}
};
const CLASSKEYS=['wizard','archer','knight','priest','warrior','rogue'];
const TIERCOL=['#cfcfcf','#cfcfcf','#9fe07a','#9fe07a','#6ab8ff','#6ab8ff','#d68cff','#ffb347','#ff5577'];
const TPRE=['Splintered','Iron','Runed','Ashen','Starforged','Voidglass','Sunsteel','Mythic'];
const WNOUN={staff:'Staff',bow:'Bow',sword:'Blade',wand:'Wand',dagger:'Dagger'},ANOUN={robe:'Robe',leather:'Jerkin',heavy:'Plate'};
const UTNAME={staff:'Hollow Crown Staff',bow:'Kingsbane Bow',sword:"Morvane's Edge",wand:'Hollow Wand',dagger:'Hollow Fang'};
let itemId=1;
function mkWeapon(w,t){
  const it={id:itemId++,kind:'weapon',w,tier:t,name:t>7?UTNAME[w]:TPRE[t]+' '+WNOUN[w]};
  if(w==='staff')Object.assign(it,{dmin:14+t*7,dmax:26+t*10,shots:2,spread:0,par:3,range:105,speed:180,pierce:false,rate:1,r:2.5});
  if(w==='bow')Object.assign(it,{dmin:20+t*8,dmax:32+t*11,shots:t>=4?3:1,spread:9,par:0,range:150,speed:230,pierce:true,rate:0.85,r:2});
  if(w==='sword')Object.assign(it,{dmin:34+t*10,dmax:52+t*13,shots:1,spread:0,par:0,range:58,speed:170,pierce:false,rate:1.05,r:4.5});
  // Wands: one long piercing bolt, like a RotMG wand. Damage stays under the staff's pair of shots.
  if(w==='wand')Object.assign(it,{dmin:24+t*8,dmax:42+t*11,shots:1,spread:0,par:0,range:136,speed:210,pierce:true,rate:1.15,r:2.3});
  // Daggers: one fast shot, high variance, range between sword and bow.
  if(w==='dagger')Object.assign(it,{dmin:18+t*7,dmax:48+t*13,shots:1,spread:0,par:0,range:80,speed:240,pierce:false,rate:1.25,r:2.4});
  if(t>7){
    if(w==='staff')Object.assign(it,{dmin:78,dmax:112,shots:3,spread:7,par:0});
    if(w==='bow')Object.assign(it,{dmin:72,dmax:104,shots:3,spread:12,range:170});
    if(w==='sword')Object.assign(it,{dmin:110,dmax:150,shots:3,spread:22});
    if(w==='wand')Object.assign(it,{dmin:96,dmax:132,shots:2,spread:8,range:148});
    if(w==='dagger')Object.assign(it,{dmin:80,dmax:150,shots:2,spread:10,range:88});
  }
  const look=GEAR[w];
  it.col=t>7?look.utShot:look.shot[t];
  it.shot=t>7?look.utShape:'dot';
  if(t>7){
    if(w==='staff')it.fx={weak:3};
    if(w==='bow')it.fx={slow:2.5};
    if(w==='sword')it.fx={para:1};
    if(w==='wand')it.fx={weak:2.5};
    if(w==='dagger')it.fx={slow:1.5};
  }else if(w==='bow'&&t>=4)it.fx={slow:t>=6?2:1.5};
  else if(w==='staff'&&t>=5)it.fx={weak:2};
  else if(w==='sword'&&t>=6)it.fx={stun:0.6};
  else if(w==='wand'&&t>=5)it.fx={weak:1.6};
  else if(w==='dagger'&&t>=6)it.fx={slow:1.2};
  return it;
}
const TESTNAME={staff:'Godslayer Staff',bow:'Godslayer Bow',sword:'Godslayer Blade',wand:'Godslayer Wand',dagger:'Godslayer Dagger'};
function mkTestWeapon(w){
  const it=mkWeapon(w,8);
  it.name=TESTNAME[w];
  it.tier=9;
  it.test=true;
  it.lethal=true;
  it.dmin=10000000;
  it.dmax=10000000;
  it.shots=1;
  it.spread=0;
  it.pierce=true;
  // 3x the old 0.2. Dex still scales this, and the bullet pool stays comfortable.
  it.rate=0.6;
  it.range=w==='sword'?72:w==='dagger'?88:140;
  it.r=w==='sword'?5:3.5;
  it.col='#fff6c0';
  it.shot='star';
  it.fx=null;
  return it;
}
function isTestItem(it){return !!(it&&(it.test||it.lethal||(it.name&&it.name.indexOf('Godslayer')>=0)));}
function mkArmor(a,t){
  const it={id:itemId++,kind:'armor',a,tier:t,name:t>7?'Hollow '+ANOUN[a]:TPRE[Math.min(t,7)]+' '+ANOUN[a],def:0,hp:0,mp:0};
  if(a==='robe'){it.def=2+t*2;it.mp=t*8;}
  if(a==='leather'){it.def=4+Math.round(t*2.5);it.hp=t*4;}
  if(a==='heavy'){it.def=7+t*3;it.hp=t*10;}
  return it;
}
const RING_NOUN={hp:'Health',mp:'Mana',att:'Attack',def:'Defense',spd:'Speed',dex:'Dexterity',vit:'Vitality',wis:'Wisdom'};
const RING_ADJ=['Minor','','Greater','Superior','Paramount','Exalted','Unbound','Mythic'];
const RING_UT={hp:'Ring of the Undying',mp:'Ring of the Archmage',att:'Ring of the Warlord',def:'Ring of the Bastion',spd:'Ring of the Gale',dex:'Ring of the Viper',vit:'Ring of the Phoenix',wis:'Ring of Second Sight'};
const RING_FLAT=[1,2,3,4,4,5,6,7];
function ringName(stat,tier){
  if(tier>7)return RING_UT[stat]||'Ring';
  const adj=RING_ADJ[tier]||'',noun=RING_NOUN[stat]||'Power';
  return adj?('Ring of '+adj+' '+noun):('Ring of '+noun);
}
function ringBonus(stat,tier){
  if(stat==='hp'||stat==='mp')return tier>7?100:(tier+1)*10;
  return tier>7?8:RING_FLAT[clamp(tier|0,0,7)];
}
function primaryRingStat(st){
  let best='hp',score=-1;
  if(st&&typeof st==='object'){
    for(const k of STATK){
      const v=+st[k]||0;if(v<=0)continue;
      const s=(k==='hp'||k==='mp')?v/10:v;
      if(s>score){score=s;best=k;}
    }
  }
  return best;
}
function mkRing(t,stat){
  if(stat&&typeof stat==='object')stat=primaryRingStat(stat);
  if(!stat||!RING_NOUN[stat])stat=pick(STATK);
  let tier=t|0;
  if(tier>7)tier=7;
  tier=clamp(tier,0,7);
  return {id:itemId++,kind:'ring',tier,stat,name:ringName(stat,tier),st:{[stat]:ringBonus(stat,tier)}};
}
const ABIL_NOUN={wizard:'Spellbook',archer:'Quiver',knight:'Shield',priest:'Tome',warrior:'Helm',rogue:'Cloak'};
const ABIL_SPR={wizard:'spell',archer:'quiver',knight:'shield',priest:'tome',warrior:'helm',rogue:'cloak'};
const ABIL_MAX=5;
// T5 matches the old T7. The six steps are the old 0–7 curve squeezed onto T0–T5. UT stays at the old T8.
const ABIL_POWER=[8,16,25,33,42,50];
const ABIL_HEAL=[50,84,117,151,184,218];
const ABIL_DEX=[12,18,23,29,34,40];
const ABIL_BDUR=[3,3.6,4.3,4.9,5.5,6.2];
const ABIL_CLOAK=[3,3.6,4.1,4.7,5.2,5.8];
const ABIL_CUT=[0,3,6,8,11,14];
function abilIx(tier){return clamp(tier|0,0,ABIL_MAX);}
function abilityPower(tier){return (tier|0)>7?56:ABIL_POWER[abilIx(tier)];}
function tomeHeal(tier){return (tier|0)>7?242:ABIL_HEAL[abilIx(tier)];}
function berserkStats(tier){return (tier|0)>7?{dex:44,dur:6.6}:{dex:ABIL_DEX[abilIx(tier)],dur:ABIL_BDUR[abilIx(tier)]};}
function cloakDur(tier){return (tier|0)>7?6.2:ABIL_CLOAK[abilIx(tier)];}
function abilAmp(tier){return (tier|0)>7?2.2:1+abilIx(tier)*0.21;}
function abilCut(tier){return (tier|0)>7?16:ABIL_CUT[abilIx(tier)];}
function mkAbility(cls,t){
  const noun=ABIL_NOUN[cls]||'Spellbook';
  let tier=t|0;
  const ut=tier>7;
  if(!ut)tier=clamp(tier,0,ABIL_MAX);
  const it={id:itemId++,kind:'ability',cls,tier,name:ut?'Hollow '+noun:TPRE[tier]+' '+noun,power:abilityPower(tier)};
  if(cls==='wizard')it.fx={weak:ut?4:3};
  if(cls==='archer')it.fx={slow:ut?4:3};
  if(cls==='knight')it.fx={stun:ut?3:2.5,bossStun:ut?1.2:1};
  if(cls==='priest')it.heal=tomeHeal(tier);
  if(cls==='warrior'){const b=berserkStats(tier);it.dex=b.dex;it.dur=b.dur;}
  if(cls==='rogue')it.dur=cloakDur(tier);
  return it;
}
function mkVoidBlade(){
  const it=mkWeapon('sword',7);
  Object.assign(it,{tier:8,name:'Void Blade',dungeonUt:true,utSource:'sanctum',sprId:'voidblade',dmin:76,dmax:110,shots:3,spread:8,par:0,pierce:true,range:72,speed:198,rate:1.05,r:3.2,wave:7,col:'#d070ff',shot:'void',fx:null});
  return it;
}
function mkVineBow(){
  const it=mkWeapon('bow',5);
  Object.assign(it,{tier:8,name:'Vine Bow',dungeonUt:true,utSource:'hexmire',sprId:'vinebow',dmin:60,dmax:88,shots:3,spread:15,par:0,pierce:true,range:144,speed:220,rate:0.82,r:2.2,col:'#8fd16a',shot:'leaf',fx:{slow:2.2}});
  return it;
}
function mkSerpentWand(){
  const it=mkWeapon('wand',7);
  Object.assign(it,{tier:8,name:'Serpent Wand',dungeonUt:true,utSource:'coil',sprId:'serpentwand',dmin:86,dmax:120,shots:2,spread:0,par:0,pierce:true,range:150,speed:196,rate:1.02,r:2.6,col:'#7dce4a',shot:'venom',helix:true,fx:{poison:2.4,pdmg:36}});
  return it;
}
function mkMagmaStaff(){
  const it=mkWeapon('staff',6);
  Object.assign(it,{tier:8,name:'Magma Staff',dungeonUt:true,utSource:'cinderhive',sprId:'magmastaff',dmin:62,dmax:92,shots:2,spread:6,par:0,pierce:false,range:102,speed:188,rate:1,r:2.7,col:'#ff6a18',shot:'ring',fx:null,
    splash:{dmin:34,dmax:52,range:46,speed:108,r:4.4,shape:'ring',col:'#ffd34a'}});
  return it;
}
const POT_COL={hp:'#ff5c7a',mp:'#6aa6ff',att:'#b028d0',def:'#9aa0b0',spd:'#3cb43a',dex:'#ff7a12',vit:'#8a0c18',wis:'#10c0c0',life:'#ff3a4a',mana:'#3a7aff',mastery:'#ffd34a'};
const ELIXIR_NAME={hp:'Life',mp:'Mind',att:'Fury',def:'Stone',spd:'Wind',dex:'Grace',vit:'Vigor',wis:'Insight'};
// Stat elixirs use their own brew. Life/Mind are not the same bottles as the HP/MP draughts.
const ELIXIR_POT={hp:'life',mp:'mana',att:'att',def:'def',spd:'spd',dex:'dex',vit:'vit',wis:'wis'};
function mkElixirOf(k){return {id:itemId++,kind:'elixir',tier:6,stat:k,name:'Elixir of '+ELIXIR_NAME[k]};}
function mkElixir(){return mkElixirOf(pick(STATK));}
function mkPot(k){return {id:itemId++,kind:k,tier:0,name:k==='hp'?'Healing Draught':'Mana Draught'};}
function mkMastery(){return {id:itemId++,kind:'mastery',tier:8,name:'Potion of Mastery'};}
function isMastery(it){return !!(it&&(it.kind==='mastery'||it.name==='Potion of Mastery'));}
function mkBeaconKey(){return {id:itemId++,kind:'beaconkey',tier:8,name:'Beacon Key'};}
function mkDungeonKey(id){
  const d=DUNGEONS[id]||DUNGEONS.tideclaw;
  return {id:itemId++,kind:'dungeonkey',dungeon:d.id,tier:4,name:d.keyName};
}
function mkTidepearl(){
  return {id:itemId++,kind:'ring',tier:8,name:'Tidepearl',st:{hp:20,spd:2,def:1},immune:['slow'],dungeonUt:true,utSource:'tideclaw',spr:'tidepearl'};
}
function isDungeonUt(it){return !!(it&&(it.dungeonUt||it.name==='Tidepearl'));}
function itemSpr(it){
  if(!it)return null;
  if(it.spr&&SPR[it.spr])return SPR[it.spr];
  if(it.kind==='dungeonkey'){const d=DUNGEONS[it.dungeon];return (d&&SPR[d.keySpr])||SPR.keyTide;}
  if(it.sprId&&GEARSPR[it.sprId])return GEARSPR[it.sprId];
  if(it.kind==='weapon'&&it.test)return gearSpr(it.w,'test');
  if(it.kind==='weapon')return gearSpr(it.w,it.tier);
  if(it.kind==='armor')return gearSpr(it.a,it.tier);
  if(it.kind==='ability')return gearSpr(ABIL_SPR[it.cls]||'spell',it.tier);
  if(it.kind==='ring')return gearSpr(it.stat&&it.stat!=='hp'?'ring_'+it.stat:'ring',it.tier);
  if(it.kind==='beaconkey')return SPR.key;
  if(it.kind==='hp'||it.kind==='mp')return SPR.pots[it.kind];
  if(it.kind==='mastery')return SPR.pots.mastery;
  if(it.kind==='elixir')return SPR.pots[ELIXIR_POT[it.stat]]||SPR.pots.att;
  return SPR[it.kind]||null;
}
function isUTGear(it){return !!(it&&!it.test&&it.tier>7&&(it.kind==='weapon'||it.kind==='ability'||it.kind==='armor'||it.kind==='ring'));}
function tierLabel(it){if(it.test)return 'TST';if(it.kind==='dungeonkey')return 'KEY';if(it.kind==='mastery')return 'MAX';if(it.kind==='hp'||it.kind==='mp')return '';if(it.kind==='elixir')return '★';return it.tier>7?'UT':'T'+it.tier;}
function itemColor(it){return it&&(it.test||it.kind==='mastery')?'#ffe9a0':it&&it.kind==='dungeonkey'?'#7ee0c8':it&&it.kind==='elixir'?(POT_COL[ELIXIR_POT[it.stat]]||'#d68cff'):TIERCOL[Math.min(it?it.tier:0,8)];}
function secText(n){const v=Math.round(n*10)/10;return (v%1)?v.toFixed(1):String(v);}
function fxLines(fx,how){
  if(!fx)return [];
  const L=[],say=(key,label)=>{
    if(!fx[key])return;
    const sec=secText(fx[key]);
    if(how==='shot')L.push('Shots inflict '+label+' for '+sec+'s');
    else{
      let s='On hit: '+label+' '+sec+'s';
      if(key==='stun'&&fx.bossStun)s+=' ('+secText(fx.bossStun)+'s on bosses)';
      L.push(s);
    }
  };
  say('slow','Slowed');say('stun','Stunned');say('para','Paralyzed');say('weak','Weakened');say('poison','Poisoned');
  return L;
}
function itemLines(it){
  const L=[];
  if(it.test)L.push('Test weapon — one hit fells anything');
  if(it.kind==='weapon'){L.push('Damage '+(it.lethal?'fatal':it.dmin+'-'+it.dmax)+(it.shots>1?' x'+it.shots:''));L.push('Range '+Math.round(it.range/TS)+' tiles'+(it.pierce?' · pierces':''));}
  if(it.kind==='weapon'&&it.wave)L.push('Shots weave');
  if(it.kind==='weapon'&&it.helix)L.push('Two shots coil in a double helix');
  if(it.kind==='weapon'&&it.splash)L.push('Also fires a short molten splash');
  if(it.kind==='weapon'&&it.fx)for(const l of fxLines(it.fx,'shot'))L.push(l);
  if(it.kind==='armor'){L.push('+'+it.def+' DEF'+(it.hp?'  +'+it.hp+' HP':'')+(it.mp?'  +'+it.mp+' MP':''));}
  if(it.kind==='ring'){
    const st=it.st||{},parts=Object.keys(st).filter(k=>st[k]).map(k=>'+'+st[k]+' '+STATN[k]);
    if(parts.length)L.push(parts.join('  '));
    if(it.stat&&RING_NOUN[it.stat]&&!it.dungeonUt)L.push(RING_NOUN[it.stat]+' ring');
  }
  if(it.immune&&it.immune.length)L.push('Immune to '+it.immune.map(k=>({slow:'Slowed',stun:'Stunned',para:'Paralyzed',weak:'Weakened',poison:'Poisoned'}[k]||k)).join(', '));
  if(it.kind==='ability'){
    const C=CLASSES[it.cls];
    if(it.cls==='priest'){L.push('Healing Tome');L.push('Heal '+tomeHeal(it.tier)+' HP');}
    else if(it.cls==='warrior'){const b=berserkStats(it.tier);L.push('Berserk: +'+b.dex+' DEX for '+secText(b.dur)+'s');}
    else if(it.cls==='rogue')L.push('Invisible for '+secText(cloakDur(it.tier))+'s');
    else {L.push(C?C.ability:'Ability');L.push('Power '+abilityPower(it.tier)+(it.tier?' · stronger cast':''));}
  }
  if(it.kind==='ability'&&it.fx)for(const l of fxLines(it.fx,it.cls==='archer'?'shot':'hit'))L.push(l);
  if(it.kind==='elixir'){L.push('Drink: permanently +'+((it.stat==='hp'||it.stat==='mp')?10:1)+' '+STATN[it.stat]+' (to the class cap)');}
  if(it.kind==='mastery')L.push('Drink: raise every stat to this class\'s maximum');
  if(it.kind==='hp')L.push('Restores 120 HP');if(it.kind==='mp')L.push('Restores 100 MP');
  if(it.kind==='beaconkey')L.push('Use: unlock every region beacon');
  if(it.kind==='dungeonkey'){const d=DUNGEONS[it.dungeon];L.push('Use: open a '+(d?d.name:'dungeon')+' portal');if(d&&d.lore)L.push(d.lore);}
  return L;
}
let CATALOG=null;
function tagItem(it,group){it.group=group;return it;}
function itemCatalog(){
  if(CATALOG)return CATALOG;
  const items=[];
  const weapons=[['wizard','staff'],['archer','bow'],['knight','sword'],['priest','wand'],['rogue','dagger']];
  for(const [g,w] of weapons)for(let t=0;t<=8;t++)items.push(tagItem(mkWeapon(w,t),g));
  items.push(tagItem(mkVineBow(),'archer'),tagItem(mkMagmaStaff(),'wizard'),tagItem(mkVoidBlade(),'knight'));
  for(const g of CLASSKEYS){
    for(let t=0;t<=ABIL_MAX;t++)items.push(tagItem(mkAbility(g,t),g));
    items.push(tagItem(mkAbility(g,8),g));
  }
  items.push(tagItem(mkSerpentWand(),'priest'));
  const arms=[['wizard','robe'],['archer','leather'],['knight','heavy']];
  for(const [g,a] of arms)for(let t=0;t<=8;t++)items.push(tagItem(mkArmor(a,t),g));
  for(const k of STATK)for(let t=0;t<=7;t++)items.push(tagItem(mkRing(t,k),'rings'));
  items.push(tagItem(mkPot('hp'),'all'),tagItem(mkPot('mp'),'all'));
  for(const k of STATK)items.push(tagItem(mkElixirOf(k),'all'));
  items.push(tagItem(mkMastery(),'pots'));
  items.push(tagItem(mkBeaconKey(),'all'));
  for(const id in DUNGEONS)items.push(tagItem(mkDungeonKey(id),'keys'));
  for(const w of ['staff','bow','sword'])items.push(tagItem(mkTestWeapon(w),'test'));
  CATALOG=items;
  return items;
}
let chestTab='all',chestPage=0,chestNear=false;
function filteredChest(){
  const all=itemCatalog();
  if(chestTab==='test')return all.filter(it=>it.test);
  if(chestTab==='keys')return all.filter(it=>it.group==='keys');
  const list=all.filter(it=>!it.test&&it.group!=='keys');
  if(chestTab==='all')return list;
  if(chestTab==='pots')return list.filter(it=>it.kind==='hp'||it.kind==='mp'||it.kind==='elixir'||it.kind==='mastery');
  if(chestTab==='rings')return list.filter(it=>it.kind==='ring');
  return list.filter(it=>chestShows(it,chestTab));
}
function chestShows(it,tab){
  if(!it)return false;
  if(it.group===tab||it.group==='all')return true;
  const C=CLASSES[tab];
  if(!C)return false;
  if(it.kind==='weapon')return it.w===C.w;
  if(it.kind==='armor')return it.a===C.a;
  if(it.kind==='ability')return it.cls===tab;
  return false;
}
function classLocked(it){
  if(!it)return false;
  if(it.kind==='weapon'||it.kind==='armor'||it.kind==='ability')return !canEquip(it);
  return false;
}
function cloneItem(it){
  const c=JSON.parse(JSON.stringify(it));
  delete c.group;c.id=itemId++;
  return c;
}
function canEquip(it){if(!it||!P)return false;const C=CLASSES[P.cls];if(it.kind==='weapon')return it.w===C.w;if(it.kind==='armor')return it.a===C.a;if(it.kind==='ability')return it.cls===P.cls;return it.kind==='ring';}
function isUpgrade(it){if(!canEquip(it))return false;const cur=P.eq[it.kind];return !cur||it.tier>cur.tier;}

/* ---------------- enemies ---------------- */
const EN={
  // Shore: slow, single, easy-to-sidestep shots.
  crab:{name:'Shellsnapper',spr:'crab',hp:42,def:0,spd:11,xp:6,r:4,aggro:76,ai:'wander',pats:[{t:'aim',cd:2.5,n:1,spd:38,dmg:5,r:3.2,col:'#ffd27a',life:2.5}]},
  imp:{name:'Dune Imp',spr:'imp',hp:32,def:0,spd:16,xp:8,r:4,aggro:82,ai:'keep',keep:62,pats:[{t:'aim',cd:2.3,n:1,spd:44,dmg:5,r:3,col:'#ff9a4a',life:2.3}]},
  gull:{name:'Salt Gull',spr:'gull',hp:28,def:0,spd:30,xp:7,r:3.4,aggro:88,ai:'orbit',keep:74,pats:[{t:'aim',cd:2.15,n:1,spd:56,dmg:4,r:2.4,col:'#f4f7fb',life:1.8}]},
  slime:{name:'Brine Slime',spr:'slime',hp:56,def:1,spd:10,xp:8,r:4.2,aggro:70,ai:'wander',pats:[{t:'aim',cd:2.45,n:1,spd:34,dmg:6,r:3.6,col:'#8ee060',life:2.4,slow:1.6}]},
  hermit:{name:'Hermit Crab',spr:'hermit',hp:50,def:2,spd:15,xp:9,r:4,aggro:72,ai:'charge',keep:14,pats:[{t:'aim',cd:2.05,n:2,sp:11,spd:44,dmg:6,r:2.8,col:'#ffb070',life:1.7}]},
  jelly:{name:'Drift Jelly',spr:'jelly',hp:36,def:0,spd:15,xp:7,r:3.6,aggro:80,ai:'chase',pats:[{t:'aim',cd:2.55,n:1,spd:32,dmg:5,r:3.2,col:'#7ee0c8',life:2.5,slow:1.3}]},
  // Greenmarch: small fans and a slow ring, plus packs that close in.
  wolf:{name:'Briar Hound',spr:'wolf',hp:150,def:1,spd:30,xp:20,r:4,ai:'charge',keep:14,pats:[{t:'aim',cd:1.25,n:2,sp:12,spd:86,dmg:14,r:2.6,col:'#ffe04a',life:0.85}]},
  hexer:{name:'Mire Hexer',spr:'hexer',hp:190,def:2,spd:18,xp:26,r:4,ai:'keep',keep:72,pats:[{t:'aim',cd:1.4,n:1,spd:92,dmg:16,r:3,col:'#d8a0ff',life:1.35,para:1.2},{t:'ring',cd:3.5,n:6,spd:52,dmg:12,r:3,col:'#b46aff',life:2.2}]},
  dire:{name:'Dire Wolf',spr:'dire',hp:175,def:2,spd:36,xp:24,r:4.2,ai:'charge',keep:16,pats:[{t:'aim',cd:1.05,n:2,sp:8,spd:100,dmg:15,r:2.6,col:'#ff6040',life:0.8}]},
  treant:{name:'Briar Treant',spr:'treant',hp:270,def:5,spd:9,xp:32,r:5.2,ai:'wander',pats:[{t:'ring',cd:2.9,n:8,spd:46,dmg:12,r:3.1,col:'#7fd06a',life:2.3,slow:2.2},{t:'aim',cd:2.3,n:1,spd:70,dmg:14,r:3.2,col:'#c6a15a',life:1.8}]},
  bandit:{name:'Road Bandit',spr:'bandit',hp:145,def:1,spd:26,xp:22,r:4,ai:'orbit',keep:80,pats:[{t:'aim',cd:1.25,n:1,spd:128,dmg:15,r:2.4,col:'#e8d8a0',life:1.15,slow:1.2}]},
  moss:{name:'Moss Lurker',spr:'moss',hp:210,def:3,spd:18,xp:26,r:4.4,ai:'chase',pats:[{t:'aim',cd:1.55,n:3,sp:12,spd:72,dmg:13,r:2.8,col:'#9fe07a',life:1.5,weak:2}]},
  // Ashen Wilds: shotguns and spirals.
  ogre:{name:'Cragmaw Ogre',spr:'ogre',hp:520,def:6,spd:20,xp:64,r:5,ai:'charge',keep:40,pats:[{t:'aim',cd:1.7,n:5,sp:13,spd:100,dmg:26,r:3.4,col:'#7eb6ff',life:1.25,slow:2}]},
  wisp:{name:'Gloamwisp',spr:'wisp',hp:420,def:4,spd:32,xp:58,r:4,ai:'orbit',keep:72,pats:[{t:'spiral',cd:0.18,arms:2,rot:0.4,spd:78,dmg:22,r:2.6,col:'#c6d67a',life:2.1,burst:1.5,rest:1.8,weak:2.5}]},
  cinder:{name:'Cinderling',spr:'cinder',hp:340,def:3,spd:32,xp:52,r:3.8,ai:'orbit',keep:66,pats:[{t:'spiral',cd:0.28,arms:2,rot:0.36,spd:82,dmg:18,r:2.5,col:'#ff6a28',life:1.9,burst:1.3,rest:1.5,weak:1.6}]},
  wraith:{name:'Ash Wraith',spr:'wraith',hp:310,def:2,spd:26,xp:50,r:4,ai:'wander',pats:[{t:'aim',cd:1.15,n:1,spd:108,dmg:20,r:2.8,col:'#c8c0d0',life:1.5,weak:2.4},{t:'ring',cd:3.2,n:8,spd:58,dmg:16,r:2.8,col:'#ff9a3a',life:2}]},
  beetle:{name:'Magma Beetle',spr:'beetle',hp:490,def:8,spd:16,xp:62,r:4.6,ai:'charge',keep:22,pats:[{t:'aim',cd:1.5,n:4,sp:14,spd:92,dmg:24,r:3.2,col:'#ffb060',life:1.2,slow:1.8}]},
  hound:{name:'Ember Hound',spr:'hound',hp:370,def:4,spd:38,xp:56,r:4,ai:'chase',pats:[{t:'aim',cd:0.9,n:2,sp:9,spd:118,dmg:21,r:2.6,col:'#ff7030',life:0.9}]},
  // Godlands gods. Class sprites draw at 10px; 16px god art (canvas 18) at 20/18 is twice that.
  // Radii are the old hitboxes times 20/64.8, the same shrink as the sprite.
  eye:{name:'Watcher Eye',spr:'eye',hp:3840,def:14,spd:16,xp:240,r:3.1,scale:20/18,god:true,ai:'keep',keep:96,pats:[{t:'ring',cd:1.8,n:16,spd:96,dmg:42,r:3.4,col:'#7eb6ff',life:2.3,slow:2},{t:'aim',cd:0.7,n:5,sp:7,spd:150,dmg:36,r:2.4,col:'#ffffff',life:1.15}]},
  colossus:{name:'Starborn Colossus',spr:'colossus',hp:5280,def:20,spd:12,xp:280,r:3.7,scale:20/18,god:true,ai:'charge',keep:56,pats:[{t:'ring',cd:1.35,n:14,spd:72,dmg:52,r:4.8,col:'#7af0ff',life:2.6,alt:1},{t:'aim',cd:1.8,n:7,sp:8,spd:120,dmg:46,r:3.2,col:'#ffe14a',life:1.4,stun:0.5}]},
  oracle:{name:'Pale Oracle',spr:'oracle',hp:3360,def:10,spd:20,xp:220,r:3.1,scale:20/18,god:true,ai:'orbit',keep:88,pats:[{t:'spiral',cd:0.16,arms:3,rot:0.32,spd:84,dmg:34,r:2.8,col:'#e8e0ff',life:2.2,burst:1.6,rest:1.2},{t:'ring',cd:2.4,n:18,spd:64,dmg:40,r:3.2,col:'#ffe14a',life:2.4},{t:'aim',cd:2.8,n:1,spd:70,dmg:28,r:3.4,col:'#d090ff',life:2.2,para:1.4}]},
  saint:{name:'Glass Saint',spr:'saint',hp:3720,def:12,spd:15,xp:230,r:3.1,scale:20/18,god:true,ai:'keep',keep:78,pats:[{t:'aim',cd:0.42,n:1,spd:168,dmg:38,r:2.6,col:'#d8fff8',life:1.35},{t:'ring',cd:2.6,n:20,spd:80,dmg:44,r:3.4,col:'#c6d67a',life:2.2,alt:1,weak:2}]},
  wyrm:{name:'Marble Wyrm',spr:'wyrm',hp:4320,def:16,spd:18,xp:250,r:3.4,scale:20/18,god:true,ai:'keep',keep:70,pats:[{t:'aim',cd:1.15,n:6,sp:11,spd:130,dmg:40,r:3,col:'#9ec0ff',life:1.3,slow:1.5},{t:'spiral',cd:0.22,arms:2,rot:-0.45,spd:70,dmg:36,r:3.2,col:'#7af0ff',life:2.3,burst:1.4,rest:1.5}]},
  titan:{name:'Solar Titan',spr:'titan',hp:4680,def:18,spd:13,xp:265,r:3.7,scale:20/18,god:true,ai:'charge',keep:50,pats:[{t:'ring',cd:1.6,n:12,spd:68,dmg:48,r:4.2,col:'#ffd34a',life:2.4,stun:0.45},{t:'aim',cd:1.5,n:5,sp:9,spd:110,dmg:44,r:3.2,col:'#ff6a28',life:1.4}]},
  voidkeeper:{name:'Void Keeper',spr:'voidkeeper',hp:3240,def:10,spd:22,xp:225,r:3.1,scale:20/18,god:true,ai:'orbit',keep:92,pats:[{t:'spiral',cd:0.2,arms:3,rot:-0.28,spd:78,dmg:32,r:2.7,col:'#c46aff',life:2.1,burst:1.4,rest:1.3},{t:'aim',cd:2.6,n:1,spd:64,dmg:30,r:3.4,col:'#ff4ad0',life:2.2,para:1.3}]},
  idol:{name:'Marble Idol',spr:'idol',hp:5520,def:22,spd:8,xp:275,r:3.7,scale:20/18,god:true,ai:'wander',pats:[{t:'ring',cd:2.1,n:16,spd:60,dmg:50,r:3.6,col:'#e8e4dc',life:2.6,slow:2.2,alt:1},{t:'aim',cd:1.9,n:3,sp:8,spd:90,dmg:42,r:3.4,col:'#ffd34a',life:1.8,weak:2}]},
  serpent:{name:'Crown Serpent',spr:'serpent',hp:4200,def:14,spd:24,xp:255,r:3.4,scale:20/18,god:true,ai:'chase',pats:[{t:'aim',cd:1.05,n:6,sp:10,spd:124,dmg:40,r:2.9,col:'#b6e060',life:1.25,slow:1.6},{t:'ring',cd:2.8,n:10,spd:70,dmg:38,r:3.2,col:'#ffd34a',life:2.2}]},
  pincer:{name:'Pincerling',spr:'pincer',hp:48,def:0,spd:14,xp:8,r:3.6,aggro:70,ai:'wander',pats:[{t:'aim',cd:2.3,n:1,spd:46,dmg:6,r:2.8,col:'#ffb070',life:2.1}]},
  barnacle:{name:'Barnacle Spit',spr:'barnacle',hp:70,def:2,spd:0,xp:10,r:4,aggro:96,ai:'keep',keep:1,pats:[{t:'aim',cd:2.6,n:1,spd:40,dmg:7,r:3.2,col:'#7ee0c8',life:2.5,slow:2}]},
  shellguard:{name:'Shellguard',spr:'shellguard',hp:130,def:2,spd:13,xp:16,r:5,aggro:78,ai:'keep',keep:46,pats:[{t:'aim',cd:1.8,n:3,sp:14,spd:54,dmg:8,r:3,col:'#ff7a4a',life:1.6}]},
  tidematron:{name:'Tide Matron',spr:'tidematron',hp:380,def:4,spd:16,xp:55,r:7,aggro:96,ai:'chase',mini:true,pats:[{t:'aim',cd:1.35,n:3,sp:14,spd:68,dmg:9,r:3,col:'#ffb070',life:1.6},{t:'ring',cd:2.7,n:8,spd:46,dmg:8,r:3.1,col:'#7ee0c8',life:2.2,slow:2},{t:'summon',cd:9,type:'pincer',n:2,cap:20}]},
  heximp:{name:'Hex Imp',spr:'heximp',hp:160,def:1,spd:22,xp:34,r:3.6,aggro:90,ai:'orbit',keep:64,pats:[{t:'aim',cd:1.35,n:2,sp:10,spd:96,dmg:14,r:2.6,col:'#d8a0ff',life:1.3}]},
  bogtoad:{name:'Bog Toad',spr:'bogtoad',hp:250,def:3,spd:14,xp:40,r:4.4,aggro:84,ai:'chase',pats:[{t:'aim',cd:1.7,n:1,spd:70,dmg:16,r:3.4,col:'#8fd16a',life:1.8,slow:1.8}]},
  cursetreant:{name:'Cursed Treant',spr:'cursetreant',hp:440,def:6,spd:8,xp:58,r:5.4,aggro:88,ai:'wander',pats:[{t:'ring',cd:2.6,n:8,spd:48,dmg:14,r:3.2,col:'#7fd06a',life:2.2,slow:2},{t:'aim',cd:2.1,n:1,spd:64,dmg:16,r:3.2,col:'#c46aff',life:1.7,weak:2}]},
  hextotem:{name:'Hex Totem',spr:'hextotem',hp:210,def:2,spd:0,xp:36,r:4,aggro:110,ai:'keep',keep:1,pats:[{t:'aim',cd:1.9,n:1,spd:78,dmg:15,r:3,col:'#b46aff',life:1.8,para:1.1}]},
  mirebat:{name:'Mire Bat',spr:'mirebat',hp:130,def:0,spd:30,xp:30,r:3.4,aggro:96,ai:'orbit',keep:70,pats:[{t:'aim',cd:1.15,n:1,spd:110,dmg:12,r:2.4,col:'#9a40e0',life:1.15}]},
  hivedrone:{name:'Hive Drone',spr:'hivedrone',hp:420,def:4,spd:28,xp:78,r:3.8,aggro:100,ai:'chase',pats:[{t:'aim',cd:1.05,n:2,sp:8,spd:120,dmg:24,r:2.6,col:'#ffb060',life:1.05}]},
  ashlarva:{name:'Ash Larva',spr:'ashlarva',hp:560,def:8,spd:12,xp:86,r:4.6,aggro:90,ai:'charge',keep:18,pats:[{t:'aim',cd:1.6,n:3,sp:12,spd:80,dmg:22,r:3.2,col:'#ff8a3a',life:1.4,slow:1.6}]},
  lavaspit:{name:'Lava Spitter',spr:'lavaspit',hp:380,def:3,spd:0,xp:80,r:4.2,aggro:120,ai:'keep',keep:1,pats:[{t:'aim',cd:1.45,n:4,sp:14,spd:100,dmg:26,r:3,col:'#ff5a28',life:1.25}]},
  cindermite:{name:'Cinder Mite',spr:'cindermite',hp:240,def:2,spd:32,xp:64,r:3.2,aggro:96,ai:'orbit',keep:58,pats:[{t:'aim',cd:0.9,n:1,spd:130,dmg:20,r:2.3,col:'#ffd34a',life:0.9}]},
  broodguard:{name:'Brood Guard',spr:'broodguard',hp:720,def:10,spd:16,xp:110,r:5.2,aggro:100,ai:'keep',keep:48,pats:[{t:'aim',cd:1.4,n:5,sp:12,spd:96,dmg:28,r:3.2,col:'#ff7030',life:1.2},{t:'ring',cd:3.2,n:8,spd:52,dmg:22,r:3.2,col:'#ffb060',life:2}]},
  acolyte:{name:'Void Acolyte',spr:'acolyte',hp:4600,def:12,spd:20,xp:240,r:4.6,aggro:130,ai:'orbit',keep:84,pats:[{t:'spiral',cd:0.22,arms:2,rot:0.3,spd:86,dmg:40,r:2.7,col:'#c46aff',life:1.8,burst:1.3,rest:1.1},{t:'aim',cd:1.8,n:1,spd:70,dmg:36,r:3.2,col:'#ff4ad0',life:1.8,para:1.1}]},
  starwisp:{name:'Star Wisp',spr:'starwisp',hp:2800,def:6,spd:34,xp:200,r:3.6,aggro:140,ai:'orbit',keep:90,pats:[{t:'aim',cd:0.85,n:2,sp:8,spd:150,dmg:38,r:2.4,col:'#e8e0ff',life:1.05}]},
  runeguard:{name:'Rune Guard',spr:'runeguard',hp:6400,def:18,spd:14,xp:280,r:5.4,aggro:120,ai:'keep',keep:56,pats:[{t:'ring',cd:2.2,n:12,spd:64,dmg:46,r:3.4,col:'#b48cff',life:2.2,slow:1.6},{t:'aim',cd:1.3,n:3,sp:8,spd:110,dmg:42,r:3,col:'#ffffff',life:1.2}]},
  eclipser:{name:'Eclipse Seer',spr:'eclipser',hp:3800,def:10,spd:16,xp:230,r:4.4,aggro:140,ai:'keep',keep:96,pats:[{t:'aim',cd:1.6,n:1,spd:72,dmg:40,r:3.4,col:'#d090ff',life:2,para:1.3},{t:'spiral',cd:0.2,arms:3,rot:-0.26,spd:74,dmg:36,r:2.6,col:'#9a6aff',life:1.9,burst:1.2,rest:1.2}]},
  voidshade:{name:'Void Shade',spr:'voidshade',hp:3200,def:8,spd:26,xp:220,r:4,aggro:130,ai:'chase',pats:[{t:'aim',cd:1.05,n:3,sp:9,spd:128,dmg:40,r:2.6,col:'#ff4ad0',life:1.15,weak:1.8}]},
  tideclaw:{name:'Old Tideclaw',spr:'tideclaw',hp:1100,def:3,spd:20,xp:160,r:11,scale:34*2.2/26,ai:'boss',boss:true,dungeonBoss:true,phaseCol:'#ffb070',phaseLines:['Old Tideclaw burrows. The tide turns.','Old Tideclaw rears both claws!'],
    phases:[
      {above:0.62,pats:[{t:'aim',cd:1.55,n:3,sp:16,spd:72,dmg:9,r:3.1,col:'#ffb070',life:1.7},{t:'aim',cd:2.7,n:1,spd:48,dmg:7,r:3.6,col:'#7ee0c8',life:2.4,slow:2}]},
      {above:0.32,pats:[{t:'ring',cd:2.15,n:10,spd:46,dmg:8,r:3.2,col:'#7ee0c8',life:2.5,slow:2.2},{t:'aim',cd:1.25,n:4,sp:12,spd:86,dmg:10,r:3,col:'#ff7a4a',life:1.5},{t:'summon',cd:8,type:'pincer',n:2,cap:16}]},
      {above:0,pats:[{t:'spiral',cd:0.2,arms:2,rot:0.34,spd:62,dmg:9,r:2.8,col:'#e25a32',life:2,burst:1.5,rest:1.05,weak:2},{t:'aim',cd:2.5,n:1,spd:74,dmg:12,r:3.5,col:'#d090ff',life:2.1,para:1.3},{t:'ring',cd:2.5,n:8,spd:42,dmg:11,r:3.3,col:'#ffd27a',life:2.3,slow:2}]}]},
  hexmatron:{name:'Hex Matriarch',spr:'hexmatron',hp:3600,def:6,spd:16,xp:460,r:12,scale:34*2.15/26,aggro:180,orbit:48,ai:'boss',boss:true,dungeonBoss:true,phaseCol:'#c48aff',phaseLines:['The hollow answers the Matriarch.','She unbinds every name in the mire.'],
    phases:[
      {above:0.66,pats:[{t:'aim',cd:1.35,n:3,sp:12,spd:88,dmg:16,r:3,col:'#d8a0ff',life:1.5},{t:'aim',cd:2.4,n:1,spd:60,dmg:14,r:3.4,col:'#8fd16a',life:2,slow:1.8}]},
      {above:0.34,pats:[{t:'ring',cd:2,n:12,spd:52,dmg:15,r:3.1,col:'#b46aff',life:2.2,weak:1.8},{t:'aim',cd:1.15,n:4,sp:10,spd:100,dmg:18,r:2.8,col:'#fff04a',life:1.3},{t:'summon',cd:8,type:'heximp',n:2,cap:22}]},
      {above:0,pats:[{t:'spiral',cd:0.18,arms:3,rot:0.3,spd:70,dmg:16,r:2.7,col:'#9a40e0',life:1.9,burst:1.4,rest:0.9,para:1},{t:'ring',cd:2.3,n:10,spd:46,dmg:18,r:3.2,col:'#8fd16a',life:2.2,slow:2},{t:'aim',cd:2.2,n:1,spd:68,dmg:20,r:3.4,col:'#ff4ad0',life:1.8,para:1.2}]}]},
  broodqueen:{name:'Magma Brood Queen',spr:'broodqueen',hp:11000,def:14,spd:14,xp:1200,r:14,scale:34*2.15/26,aggro:210,orbit:62,ai:'boss',boss:true,dungeonBoss:true,phaseCol:'#ff8a3a',phaseLines:['The hive wakes around her.','The Queen splits the chamber open.'],
    phases:[
      {above:0.68,pats:[{t:'aim',cd:1.25,n:5,sp:12,spd:110,dmg:30,r:3.2,col:'#ff8a3a',life:1.25},{t:'spiral',cd:0.24,arms:2,rot:0.28,spd:72,dmg:24,r:2.8,col:'#ffd34a',life:1.8,burst:1.2,rest:1.1}]},
      {above:0.34,pats:[{t:'ring',cd:1.7,n:14,spd:64,dmg:28,r:3.3,col:'#ff5a28',life:2,slow:1.5},{t:'aim',cd:1,n:4,sp:9,spd:130,dmg:34,r:2.8,col:'#ffb060',life:1.1},{t:'summon',cd:7.5,type:'hivedrone',n:2,cap:24}]},
      {above:0,pats:[{t:'spiral',cd:0.14,arms:3,rot:0.34,spd:86,dmg:30,r:2.8,col:'#ff3a18',life:1.7,burst:1.5,rest:0.75},{t:'spiral',cd:0.14,arms:3,rot:-0.28,spd:70,dmg:26,r:3,col:'#ffd34a',life:1.8,burst:1.5,rest:0.75},{t:'ring',cd:2.1,n:16,spd:58,dmg:36,r:3.6,col:'#ff8a3a',life:2.1},{t:'summon',cd:9,type:'ashlarva',n:1,cap:24}]}]},
  archon:{name:'Void Archon',spr:'archon',hp:32000,def:22,spd:16,xp:2800,r:16,scale:34*2.2/26,aggro:280,orbit:84,ai:'boss',boss:true,dungeonBoss:true,phaseCol:'#d0a0ff',phaseLines:['The sanctum forgets the sky.','The Archon speaks in collapsing stars.'],
    phases:[
      {above:0.7,pats:[{t:'spiral',cd:0.16,arms:4,rot:0.22,spd:90,dmg:48,r:2.8,col:'#d8c8ff',life:1.9,burst:1.5,rest:0.85},{t:'aim',cd:1.3,n:3,sp:7,spd:150,dmg:52,r:2.6,col:'#ffffff',life:1.15}]},
      {above:0.38,pats:[{t:'ring',cd:1.55,n:18,spd:72,dmg:50,r:3.2,col:'#c46aff',life:2.1,alt:1},{t:'aim',cd:2.1,n:1,spd:68,dmg:46,r:3.6,col:'#ff4ad0',life:2,para:1.2},{t:'summon',cd:8,type:'acolyte',n:1,cap:18}]},
      {above:0,pats:[{t:'spiral',cd:0.12,arms:3,rot:0.3,spd:100,dmg:54,r:2.7,col:'#e8e0ff',life:1.7,burst:1.35,rest:0.6},{t:'spiral',cd:0.12,arms:3,rot:-0.3,spd:84,dmg:50,r:2.9,col:'#ff4ad0',life:1.8,burst:1.35,rest:0.6},{t:'ring',cd:1.9,n:16,spd:60,dmg:62,r:3.8,col:'#9a6aff',life:2.2,weak:1.6},{t:'aim',cd:0.95,n:5,sp:6,spd:160,dmg:56,r:2.5,col:'#ffffff',life:1},{t:'summon',cd:10,type:'starwisp',n:2,cap:20}]}]},
  cobraspitter:{name:'Cobra Spitter',spr:'cobraspitter',hp:3600,def:10,spd:16,xp:220,r:4.4,aggro:130,ai:'keep',keep:88,pats:[{t:'aim',cd:1.25,n:5,sp:12,spd:120,dmg:40,r:2.8,col:'#7dce4a',life:1.3,poison:1.8,pdmg:22}]},
  viper:{name:'Dash Viper',spr:'viper',hp:2800,def:8,spd:36,xp:200,r:3.8,aggro:140,ai:'dash',keep:18,pats:[{t:'aim',cd:0.85,n:2,sp:8,spd:150,dmg:36,r:2.4,col:'#ff8a28',life:0.9,poison:1.2,pdmg:16}]},
  naga:{name:'Naga Guard',spr:'naga',hp:5600,def:16,spd:14,xp:260,r:5.2,aggro:120,ai:'keep',keep:52,pats:[{t:'aim',cd:1.2,n:3,sp:8,spd:112,dmg:44,r:3,col:'#ffd34a',life:1.2},{t:'ring',cd:2.6,n:10,spd:58,dmg:40,r:3.2,col:'#3d8a28',life:2}]},
  clutch:{name:'Snake Egg Clutch',spr:'clutch',hp:1800,def:4,spd:0,xp:160,r:4.6,aggro:110,ai:'keep',keep:1,pats:[{t:'summon',cd:4.5,type:'hatchling',n:2,cap:18}]},
  constrictor:{name:'Coiled Constrictor',spr:'constrictor',hp:4800,def:14,spd:12,xp:240,r:6,aggro:110,ai:'chase',pats:[{t:'ring',cd:2.2,n:12,spd:52,dmg:42,r:3.4,col:'#5aaa38',life:2.2,slow:1.6},{t:'aim',cd:1.5,n:1,spd:80,dmg:46,r:3.6,col:'#c6e070',life:1.6}]},
  hatchling:{name:'Serpent Hatchling',spr:'hatchling',hp:900,def:2,spd:28,xp:40,r:2.8,aggro:120,ai:'chase',pats:[{t:'aim',cd:1.1,n:1,spd:130,dmg:22,r:2.2,col:'#b6e060',life:0.9}]},
  ouroboros:{name:'Serpent King',spr:'ourohead',hp:34000,def:20,spd:28,xp:2800,r:9,scale:25/26,aggro:280,orbit:78,ai:'boss',boss:true,dungeonBoss:true,serpent:true,segments:14,phaseCol:'#7dce4a',phaseLines:['The coil tightens.','The body answers.','The eggs split.'],
    phases:[
      {above:0.75,pats:[{t:'aim',cd:1.15,n:7,sp:11,spd:130,dmg:48,r:2.8,col:'#7dce4a',life:1.35,poison:2,pdmg:24},{t:'aim',cd:2.4,n:3,sp:6,spd:90,dmg:44,r:3.2,col:'#ffd34a',life:1.8}]},
      {above:0.5,pats:[{t:'aim',cd:0.9,n:5,sp:14,spd:150,dmg:50,r:2.6,col:'#c6e070',life:1.1,poison:1.6,pdmg:20}]},
      {above:0.25,pats:[{t:'segs',cd:1.35,n:8,every:2,spd:70,dmg:42,r:2.8,col:'#3d8a28',life:1.8},{t:'aim',cd:1.6,n:4,sp:8,spd:120,dmg:48,r:2.6,col:'#ffd34a',life:1.2}]},
      {above:0,pats:[{t:'summon',cd:6.5,type:'hatchling',n:3,cap:16},{t:'aim',cd:1,n:6,sp:10,spd:140,dmg:52,r:2.7,col:'#7dce4a',life:1.2,poison:2.2,pdmg:26},{t:'ring',cd:2.2,n:14,spd:64,dmg:46,r:3.2,col:'#e0c060',life:2}]}]},
  king:{name:'Morvane, the Hollow Guard',spr:'king',hp:60000,def:20,spd:16,xp:3000,r:12,scale:34*2.2/26,ai:'boss',boss:true,
    phases:[
      {above:0.66,pats:[{t:'spiral',cd:0.11,arms:4,rot:0.21,spd:80,dmg:48,r:3,col:'#c46aff',life:2.6},{t:'aim',cd:2,n:5,sp:10,spd:110,dmg:52,r:4,col:'#ffd34a',life:2}]},
      {above:0.33,pats:[{t:'ring',cd:1.2,n:24,spd:70,dmg:50,r:3.5,col:'#ff4a8a',life:3,alt:1},{t:'aim',cd:0.7,n:3,sp:6,spd:160,dmg:45,r:2.5,col:'#ffffff',life:1.6},{t:'summon',cd:10,type:'oracle',n:1}]},
      {above:0,pats:[{t:'spiral',cd:0.09,arms:3,rot:0.26,spd:90,dmg:52,r:3,col:'#c46aff',life:2.4},{t:'spiral',cd:0.09,arms:3,rot:-0.26,spd:90,dmg:52,r:3,col:'#ff4a8a',life:2.4},{t:'ring',cd:2.2,n:12,spd:45,dmg:65,r:6,col:'#ffd34a',life:4}]}]},
  saltwyrm:{name:'Saltwyrm',short:'Saltwyrm',spr:'saltwyrm',hp:5600,def:8,spd:18,xp:420,r:13,scale:34*2.3/26,event:true,zone:0,portal:'tideclaw',phaseCol:'#7ee0c8',
    announce:'A Saltwyrm surfaces in the Saltmarsh!',fall:'The Saltwyrm sinks',
    ai:'orbit',keep:86,pats:[{t:'ring',cd:2.1,n:12,spd:58,dmg:14,r:3.2,col:'#7ee0c8',life:2.2,slow:2},{t:'aim',cd:1.45,n:3,sp:14,spd:86,dmg:16,r:3,col:'#ffb070',life:1.5}]},
  briarstag:{name:'Briar Stag',short:'Briar Stag',spr:'briarstag',hp:9800,def:12,spd:26,xp:720,r:13,scale:34*2.3/26,event:true,zone:1,portal:'hexmire',phaseCol:'#8fd16a',
    announce:'The Briar Stag walks the Greenmarch!',fall:'The Briar Stag falls',
    ai:'charge',keep:36,pats:[{t:'aim',cd:1.3,n:4,sp:10,spd:110,dmg:22,r:2.8,col:'#c6e070',life:1.2},{t:'spiral',cd:0.22,arms:2,rot:0.3,spd:64,dmg:16,r:2.8,col:'#3d8a28',life:1.8,burst:1.3,rest:1.2,slow:1.6},{t:'summon',cd:8,type:'wolf',n:1,cap:10}]},
  ashphoenix:{name:'Ash Phoenix',short:'Ash Phoenix',spr:'ashphoenix',hp:15000,def:14,spd:30,xp:1100,r:13,scale:34*2.3/26,event:true,zone:2,portal:'cinderhive',phaseCol:'#ff8a3a',
    announce:'An Ash Phoenix rises over the Ashen Wilds!',fall:'The Ash Phoenix burns out',
    ai:'dash',keep:20,pats:[{t:'spiral',cd:0.16,arms:3,rot:0.34,spd:92,dmg:28,r:2.7,col:'#ff6a28',life:1.7,burst:1.4,rest:0.9},{t:'ring',cd:2.2,n:14,spd:70,dmg:26,r:3.2,col:'#ffd34a',life:2,weak:1.6},{t:'aim',cd:1.5,n:3,sp:8,spd:140,dmg:30,r:2.6,col:'#fff0c0',life:1.1}]},
  marblesphinx:{name:'Marble Sphinx',short:'Sphinx',spr:'marblesphinx',hp:24000,def:20,spd:16,xp:1600,r:14,scale:34*2.3/26,event:true,zone:3,portal:['sanctum','coil'],phaseCol:'#e8e0ff',
    announce:'A Marble Sphinx wakes in the Godlands!',fall:'The Marble Sphinx stills',
    ai:'keep',keep:92,pats:[{t:'ring',cd:1.7,n:16,spd:72,dmg:42,r:3.4,col:'#e8e4dc',life:2.2,alt:1},{t:'aim',cd:1.15,n:5,sp:7,spd:130,dmg:40,r:2.8,col:'#ffd34a',life:1.25,stun:0.4},{t:'spiral',cd:0.18,arms:3,rot:-0.28,spd:80,dmg:36,r:2.8,col:'#c6b8ff',life:1.9,burst:1.3,rest:1.1}]},
  drownedcaptain:{name:'Drowned Captain',short:'Captain',spr:'drownedcaptain',hp:7600,def:10,spd:16,xp:560,r:13,scale:34*2.3/26,event:true,zone:0,portal:'tideclaw',phaseCol:'#5aa8ff',
    announce:'A Drowned Captain haunts the Saltmarsh!',fall:'The Drowned Captain slips under',
    ai:'keep',keep:78,pats:[{t:'aim',cd:1.35,n:3,sp:12,spd:96,dmg:18,r:2.8,col:'#7ee0c8',life:1.4,slow:1.8},{t:'ring',cd:2.3,n:12,spd:54,dmg:16,r:3.1,col:'#5aa8ff',life:2.1},{t:'aim',cd:2.8,n:1,spd:70,dmg:20,r:3.4,col:'#ffd34a',life:1.8}]},
  eldertreant:{name:'Elder Treant',short:'Elder Treant',spr:'eldertreant',hp:12200,def:13,spd:12,xp:880,r:14,scale:34*2.3/26,event:true,zone:1,portal:'hexmire',phaseCol:'#ffd040',
    announce:'An Elder Treant wakes in the Greenmarch!',fall:'The Elder Treant takes root',
    ai:'wander',pats:[{t:'aim',cd:1.45,n:5,sp:16,spd:78,dmg:24,r:3.2,col:'#c4a06a',life:1.5,slow:1.6},{t:'ring',cd:2.2,n:12,spd:50,dmg:20,r:3.3,col:'#7ad048',life:2.2,slow:2},{t:'summon',cd:9,type:'treant',n:1,cap:12}]},
  obsidiangolem:{name:'Obsidian Golem',short:'Golem',spr:'obsidiangolem',hp:19000,def:17,spd:14,xp:1300,r:14,scale:34*2.3/26,event:true,zone:2,portal:'cinderhive',phaseCol:'#ff9a2a',
    announce:'An Obsidian Golem climbs out of the Ashen Wilds!',fall:'The Obsidian Golem cracks apart',
    ai:'charge',keep:40,pats:[{t:'aim',cd:1.5,n:4,sp:10,spd:100,dmg:34,r:3.4,col:'#ff8a2a',life:1.3},{t:'ring',cd:2,n:14,spd:62,dmg:30,r:3.4,col:'#ffd060',life:2.1},{t:'spiral',cd:0.2,arms:2,rot:0.28,spd:74,dmg:26,r:2.8,col:'#ff5a18',life:1.7,burst:1.2,rest:1.1}]},
  fallenseraph:{name:'Fallen Seraph',short:'Seraph',spr:'fallenseraph',hp:28000,def:22,spd:20,xp:1900,r:14,scale:34*2.3/26,event:true,zone:3,portal:['sanctum','coil'],phaseCol:'#fff2c0',
    announce:'A Fallen Seraph descends on the Godlands!',fall:'The Fallen Seraph goes still',
    ai:'orbit',keep:90,pats:[{t:'aim',cd:0.95,n:1,spd:168,dmg:46,r:2.6,col:'#fff6c0',life:1.15},{t:'gap',cd:1.6,n:18,gap:4,rot:0.35,spd:78,dmg:42,r:3,col:'#ff4fa8',life:2},{t:'spiral',cd:0.16,arms:3,rot:-0.26,spd:84,dmg:38,r:2.7,col:'#ffe9a0',life:1.8,burst:1.2,rest:0.9}]},
  shardguard:{name:'Shardguard',spr:'shardguard',hp:920,def:6,spd:18,xp:40,r:5,aggro:120,ai:'keep',keep:48,pats:[{t:'aim',cd:1.25,n:3,sp:10,spd:110,dmg:22,r:2.6,col:'#ff4fa8',life:1.2}]},
  crystalcaster:{name:'Crystal Caster',spr:'crystalcaster',hp:760,def:4,spd:14,xp:42,r:5,aggro:140,ai:'orbit',keep:72,pats:[{t:'aim',cd:1.4,n:2,sp:8,spd:120,dmg:20,r:2.5,col:'#c46aff',life:1.3},{t:'spiral',cd:0.28,arms:2,rot:0.3,spd:64,dmg:16,r:2.4,col:'#ffb8cc',life:1.6,burst:1,rest:1.2}]},
  royalhound:{name:'Royal Hound',spr:'royalhound',hp:680,def:3,spd:32,xp:36,r:4.4,aggro:130,ai:'chase',pats:[{t:'aim',cd:0.95,n:2,sp:8,spd:130,dmg:18,r:2.4,col:'#ffd34a',life:0.9}]},
  crownsentry:{name:'Crown Sentry',spr:'crownsentry',hp:840,def:8,spd:0,xp:44,r:4.6,aggro:150,ai:'keep',keep:1,pats:[{t:'aim',cd:1.5,n:4,sp:12,spd:100,dmg:22,r:2.8,col:'#ffd34a',life:1.3},{t:'ring',cd:2.8,n:8,spd:52,dmg:16,r:2.8,col:'#ff4fa8',life:1.8}]},
  shardling:{name:'Shardling',spr:'shardling',hp:420,def:2,spd:22,xp:24,r:3.6,aggro:110,ai:'chase',pats:[{t:'aim',cd:1.1,n:1,spd:120,dmg:14,r:2.2,col:'#ff4fa8',life:1}]},
  kingsguard:{name:'Kingsguard',spr:'kingsguard',hp:4200,def:14,spd:16,xp:180,r:5,scale:16/18,aggro:140,ai:'keep',keep:46,pats:[{t:'aim',cd:1.15,n:3,sp:8,spd:120,dmg:28,r:2.8,col:'#ffd34a',life:1.2},{t:'ring',cd:2.4,n:10,spd:58,dmg:24,r:3,col:'#ff4fa8',life:1.8}]},
  shardherald:{name:'Shard Herald',spr:'shardherald',hp:4800,def:12,spd:15,xp:200,r:5,scale:16/18,aggro:160,ai:'orbit',keep:70,pats:[{t:'aim',cd:1.3,n:2,sp:6,spd:130,dmg:26,r:2.6,col:'#c46aff',life:1.25},{t:'spiral',cd:0.22,arms:2,rot:0.32,spd:72,dmg:22,r:2.5,col:'#ffb8cc',life:1.6,burst:1.1,rest:1}]},
  crownwarden:{name:'Crown Warden',spr:'kingsguard',hp:8000,def:16,spd:15,xp:240,r:5,scale:16/18,aggro:200,ai:'keep',keep:42,pats:[{t:'aim',cd:1.05,n:4,sp:9,spd:124,dmg:32,r:2.9,col:'#ffd34a',life:1.15},{t:'ring',cd:2.2,n:12,spd:60,dmg:28,r:3.1,col:'#ff4fa8',life:1.9}]},
  megaking:{name:'Mega King',spr:'megaking_p1',hp:120000,def:28,spd:18,xp:8000,r:5,scale:32/34,aggro:420,orbit:48,ai:'boss',boss:true,dungeonBoss:true,mega:true,phaseCol:'#ff4fa8',
    phaseLines:['The Hollow Crown walks.','The court answers. The pylons wake.','The throne crumbles. The rift closes in.','The last crown splits.'],
    phases:[
      {above:1,pats:[]},
      {above:0.7,pats:[]},
      {above:0.45,pats:[]},
      {above:0.2,pats:[]},
      {above:0,pats:[]}
    ]}
};
let eid=1;
function spawnEnemy(wd,type,x,y,zone,elite){
  const d=EN[type];const hpm=elite?4:1;
  const e={id:eid++,type,d,x,y,ax:x,ay:y,homeX:x,homeY:y,zone,elite,hp:d.hp*hpm,maxhp:d.hp*hpm,dmgMul:elite?1.25:1,cd:[],cyc:[],spin:[],stun:0,slow:0,para:0,weak:0,poison:0,poisonDmg:0,poisonAcc:0,ccLock:0,dir:Math.random()*TAU,wt:0,phase:-1,flash:0,alt:0,bob:Math.random()*6,trail:[],segs:[],coil:0,atkPose:0,atkHold:0};
  const pats=d.pats||d.phases[0].pats;
  e.pats=elite?pats.concat([{t:'ring',cd:2.6,n:12,spd:65,dmg:pats[0].dmg,r:3,col:'#ffd34a',life:2}]):pats;
  resetPats(e);
  e.name=elite?['Tidecaller','Briar Alpha','Ash Tyrant','Ascended'][zone]+' ('+d.name+')':d.name;
  wd.enemies.push(e);return e;
}
function resetPats(e){e.cd=e.pats.map(p=>Math.random()*p.cd+0.3);e.cyc=e.pats.map(()=>Math.random()*2);e.spin=e.pats.map(()=>Math.random()*TAU);}

/* ---------------- pools ---------------- */
const EBMAX=2400,PBMAX=400,PTMAX=700,DNMAX=90;
const EB=[],PB=[],PT=[],DN=[];
for(let i=0;i<EBMAX;i++)EB.push({x:0,y:0,vx:0,vy:0,ang:0,spd:0,life:0,dmg:0,r:2,spr:null,fx:null,from:''});
for(let i=0;i<PBMAX;i++)PB.push({x:0,y:0,vx:0,vy:0,life:0,dmg:0,r:2,spr:null,pierce:false,hits:[],fx:null,col:'#fff',shape:'dot'});
for(let i=0;i<PTMAX;i++)PT.push({x:0,y:0,vx:0,vy:0,t:0,col:'#fff',s:1});
for(let i=0;i<DNMAX;i++)DN.push({x:0,y:0,t:0,txt:'',col:'#fff'});
let ebN=0,pbN=0,ptN=0,dnN=0,shotsFired=0;
function normFx(src){
  if(!src)return null;
  if(typeof src==='number')return src>0?{slow:src}:null;
  const o={};
  if(src.slow)o.slow=src.slow;
  if(src.stun)o.stun=src.stun;
  if(src.para)o.para=src.para;
  if(src.weak)o.weak=src.weak;
  if(src.poison)o.poison=src.poison;
  if(src.pdmg)o.pdmg=src.pdmg;
  if(src.bossStun)o.bossStun=src.bossStun;
  if(src.force)o.force=true;
  return (o.slow||o.stun||o.para||o.weak||o.poison)?o:null;
}
function resists(ent,name){
  if(!ent||ent!==P)return false;
  const r=P.eq&&P.eq.ring;
  return !!(r&&r.immune&&r.immune.indexOf(name)>=0);
}
function applyFx(ent,fx){
  if(!fx||!ent)return;
  const boss=!!(ent.d&&(ent.d.boss||ent.d.god));
  if(fx.slow&&!resists(ent,'slow'))ent.slow=Math.max(ent.slow||0,fx.slow);
  if(fx.weak&&!resists(ent,'weak'))ent.weak=Math.max(ent.weak||0,fx.weak);
  if(fx.poison){ent.poison=Math.max(ent.poison||0,fx.poison);ent.poisonDmg=fx.pdmg||ent.poisonDmg||28;}
  let stun=fx.stun||0,para=fx.para||0;
  if(boss){
    if(stun)stun=fx.bossStun!=null?fx.bossStun:Math.min(stun,0.4);
    if(para)para=Math.min(para,0.45);
  }
  if((stun||para)&&!fx.force&&ent.ccLock>time){stun=0;para=0;}
  if(stun&&!resists(ent,'stun')){ent.stun=Math.max(ent.stun||0,stun);ent.ccLock=time+stun+1.5;}
  if(para&&!resists(ent,'para')){ent.para=Math.max(ent.para||0,para);ent.ccLock=time+para+1.5;}
}
function addEB(x,y,a,spd,dmg,r,life,col,fx,from){if(ebN>=EBMAX)return;const b=EB[ebN++];b.x=x;b.y=y;b.ang=a;b.spd=spd;b.vx=Math.cos(a)*spd;b.vy=Math.sin(a)*spd;b.life=life;b.dmg=dmg;b.r=r;b.spr=bulletSpr(col,r);b.fx=normFx(fx);b.from=from;b.ox=x;b.oy=y;b.age=0;b.wave=0;b.wph=0;}
function addPB(x,y,a,spd,dmg,r,life,col,pierce,fx,shape,lethal,extra){if(pbN>=PBMAX)return;const b=PB[pbN++];b.x=x;b.y=y;b.vx=Math.cos(a)*spd;b.vy=Math.sin(a)*spd;b.life=life;b.dmg=dmg;b.r=r;b.shape=shape||'dot';b.col=col;b.spr=bulletSpr(col,r,b.shape);b.pierce=pierce;b.hits.length=0;b.fx=normFx(fx);b.lethal=!!lethal;b.ox=x;b.oy=y;b.age=0;b.wave=extra&&extra.wave||0;b.wph=extra&&extra.wph||0;b.helix=extra&&extra.helix||0;b.spin=extra&&extra.spin||1;}
function stepShot(b,dt){
  if(b.helix){
    b.age+=dt;
    const spd=Math.hypot(b.vx,b.vy)||1,ux=b.vx/spd,uy=b.vy/spd,dist=spd*b.age;
    const side=(b.spin||1)*Math.sin(b.age*14)*7.5;
    b.x=b.ox+ux*dist+(-uy)*side;
    b.y=b.oy+uy*dist+ux*side;
  }else if(b.wave){
    b.age+=dt;
    const spd=Math.hypot(b.vx,b.vy)||1;
    const dist=spd*b.age,off=Math.sin(b.age*9+(b.wph||0))*b.wave;
    b.x=b.ox+(b.vx/spd)*dist+(-b.vy/spd)*off;
    b.y=b.oy+(b.vy/spd)*dist+(b.vx/spd)*off;
  }else{b.x+=b.vx*dt;b.y+=b.vy*dt;}
}
function bulletBlocked(wd,x,y){if(lairSolid(wd,x,y))return true;const t=tileAt(wd,x,y);return t!==T_WATER&&SOLID.has(t);}
function hurtBreak(wd,x,y,dmg){
  if(!wd||!wd.breakAt)return false;
  const tx=Math.floor(x/TS),ty=Math.floor(y/TS);
  if(tileAt(wd,x,y)!==T_SBREAK)return false;
  const seg=wd.breakAt[tx+','+ty];
  if(!seg||seg.dead)return false;
  seg.hp-=Math.max(1,Math.round(dmg||1));
  if(seg.hp>0)return true;
  seg.hp=0;seg.dead=true;
  for(const t of seg.tiles){
    if(t.x>0&&t.y>0&&t.x<wd.w-1&&t.y<wd.h-1)wd.tiles[t.y*wd.w+t.x]=T_SFLOOR;
    wd.zone[t.y*wd.w+t.x]=0;
    delete wd.breakAt[t.x+','+t.y];
  }
  addPT(seg.x,seg.y,'#c6a15a',22,50,2);
  wd.canvas=null;wd.chunks=null;wd.voidChunks=null;
  renderWorld(wd);
  return true;
}
function segmentBlocked(wd,x0,y0,x1,y1){
  const dist=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(dist/4));
  for(let s=1;s<=steps;s++){
    const x=x0+(x1-x0)*s/steps,y=y0+(y1-y0)*s/steps;
    if(bulletBlocked(wd,x,y))return {x,y};
  }
  return null;
}
function fireWeapon(w){
  if(!w||!P)return 0;
  P.atkHold=0.16;
  const am=attMul();
  if(w.helix){
    for(let i=0;i<2;i++)addPB(P.x,P.y,P.aim,w.speed,rand(w.dmin,w.dmax)*am,w.r,w.range/w.speed,w.col,true,w.fx,w.shot||'venom',!!w.lethal,{helix:1,spin:i?-1:1,wph:0});
    shotsFired++;
    return 2;
  }
  const n=w.shots||1;
  for(let i=0;i<n;i++){
    const o=i-(n-1)/2;
    const a=P.aim+o*(w.spread||0)*Math.PI/180;
    const px=-Math.sin(P.aim)*o*(w.par||0),py=Math.cos(P.aim)*o*(w.par||0);
    const extra=w.wave?{wave:w.wave,wph:i*1.7}:null;
    addPB(P.x+px,P.y+py,a,w.speed,rand(w.dmin,w.dmax)*am,w.r,w.range/w.speed,w.col,w.pierce,w.fx,w.shot,!!w.lethal,extra);
  }
  if(w.splash){
    const s=w.splash;
    addPB(P.x,P.y,P.aim,s.speed,rand(s.dmin,s.dmax)*am,s.r,s.range/s.speed,s.col||'#ff8a3a',false,null,s.shape||'ring',false,null);
  }
  shotsFired++;
  return n+(w.splash?1:0);
}
function addPT(x,y,col,n,sp,s){for(let i=0;i<n;i++){if(ptN>=PTMAX)return;const p=PT[ptN++];const a=Math.random()*TAU,v=rand(0.3,1)*sp;p.x=x;p.y=y;p.vx=Math.cos(a)*v;p.vy=Math.sin(a)*v;p.t=rand(0.3,0.7);p.col=col;p.s=s||1;}}
function addDN(x,y,txt,col){if(dnN>=DNMAX){for(let i=0;i<DNMAX-1;i++){const t=DN[i];DN[i]=DN[i+1];DN[i+1]=t;}dnN--;}const d=DN[dnN++];d.x=x+rand(-3,3);d.y=y-6;d.t=0.8;d.txt=txt;d.col=col;}
const FX=[];
function addFX(x,y,r0,r1,dur,col){FX.push({x,y,r0,r1,t:0,dur,col});}

/* ---------------- state ---------------- */
let state='title',P=null,world=null,hub=null,realm=null,vault=null,dungeon=null,toasts=[],deathInfo=null,spawnT=0,saveT=0,questT=0,quest=null,time=0;
const input={move:{id:null,ox:0,oy:0,x:0,y:0},aim:{id:null,ox:0,oy:0,x:0,y:0},mouse:{x:0,y:0,down:false,active:false},keys:{}};
let uiRects=[],layoutC={play:{x:0,y:0,w:1,h:1},panel:{x:0,y:0,w:0,h:1},portrait:false};
let ptr=null,heldTip=null;
let roster=null,activeSlot=null,titleMode='roster',confirmSlot=-1;
const SAVEK='shardwild_save_v1',RUNSK='shardwild_runs_v1',CHARSK='shardwild_chars_v1',VAULTK='shardwild_vault_v1';
const SLOTN=8,VAULT_N=4,VAULT_SLOTS=8;
// Safe storage: Android Chrome opening a local file (content://) throws SecurityError on any localStorage access.
const store=(()=>{let ls=null;try{ls=window.localStorage;const k='__sw_t';ls.setItem(k,'1');ls.removeItem(k);}catch(e){ls=null;}
  const mem={};return {persistent:!!ls,
  get(k){try{if(ls)return ls.getItem(k);}catch(e){}return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null;},
  set(k,v){mem[k]=v;try{if(ls)ls.setItem(k,v);}catch(e){}},
  del(k){delete mem[k];try{if(ls)ls.removeItem(k);}catch(e){}}};})();
const AUDIOK='shardwild_audio_v1';
function createAudio(){
  let ctx=null,master=null,comp=null,sfxBus=null,musicBus=null,noiseBuf=null;
  let unlocked=false,sfxOn=true,musicOn=true,voices=0,played=0,notes=0;
  let musicTime=0,musicStep=0,drone=null,droneG=null,droneMood=null;
  const cool={},MAXV=12;
  try{
    const raw=JSON.parse(store.get(AUDIOK));
    if(raw&&typeof raw==='object'){
      if(typeof raw.sfx==='boolean')sfxOn=raw.sfx;
      if(typeof raw.music==='boolean')musicOn=raw.music;
    }
  }catch(e){}
  function save(){try{store.set(AUDIOK,JSON.stringify({sfx:sfxOn,music:musicOn}));}catch(e){}}
  function unlock(){
    if(unlocked){if(ctx&&ctx.state==='suspended'){const p=ctx.resume();if(p&&p.catch)p.catch(function(){});}return;}
    unlocked=true;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    try{
      ctx=new AC();
      master=ctx.createGain();master.gain.value=0.8;
      comp=ctx.createDynamicsCompressor();
      comp.threshold.value=-18;comp.knee.value=10;comp.ratio.value=5;comp.attack.value=0.003;comp.release.value=0.12;
      sfxBus=ctx.createGain();sfxBus.gain.value=sfxOn?1:0;
      musicBus=ctx.createGain();musicBus.gain.value=musicOn?0.42:0;
      sfxBus.connect(comp);musicBus.connect(comp);comp.connect(master);master.connect(ctx.destination);
      const len=Math.floor(ctx.sampleRate*0.25);
      noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);
      const d=noiseBuf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
      const p=ctx.resume();if(p&&p.catch)p.catch(function(){});
    }catch(e){ctx=null;}
  }
  function apply(){
    if(!ctx)return;
    const now=ctx.currentTime;
    sfxBus.gain.setTargetAtTime(sfxOn?1:0,now,0.02);
    musicBus.gain.setTargetAtTime(musicOn?0.42:0,now,0.05);
  }
  function ready(){
    if(!unlocked||!sfxOn||!ctx)return false;
    if(ctx.state==='suspended'){const p=ctx.resume();if(p&&p.catch)p.catch(function(){});}
    return voices<MAXV;
  }
  function can(id,ms){const n=performance.now();if(cool[id]&&n<cool[id])return false;cool[id]=n+ms;return true;}
  function blip(freq,dur,type,gain,slide,when){
    if(!ready())return;
    try{
      const t0=ctx.currentTime+(when||0);
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type||'sine';
      o.frequency.setValueAtTime(Math.max(40,freq),t0);
      if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),t0+dur);
      g.gain.setValueAtTime(gain==null?0.05:gain,t0);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+Math.max(0.02,dur));
      o.connect(g);g.connect(sfxBus);
      o.start(t0);o.stop(t0+dur+0.03);
      voices++;played++;
      o.onended=function(){voices=Math.max(0,voices-1);};
    }catch(e){}
  }
  function crackle(dur,freq,q,gain,when){
    if(!ready()||!noiseBuf)return;
    try{
      const t0=ctx.currentTime+(when||0);
      const src=ctx.createBufferSource();src.buffer=noiseBuf;
      const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=freq||800;f.Q.value=q||0.7;
      const g=ctx.createGain();
      g.gain.setValueAtTime(gain==null?0.05:gain,t0);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
      src.connect(f);f.connect(g);g.connect(sfxBus);
      src.start(t0);src.stop(t0+dur);
      voices++;played++;
      src.onended=function(){voices=Math.max(0,voices-1);};
    }catch(e){}
  }
  function shoot(cls){
    if(!ready()||!can('shoot',75))return;
    if(cls==='archer'){blip(1480,0.045,'triangle',0.045,880);blip(2100,0.03,'sine',0.02,null,0.02);}
    else if(cls==='rogue'){blip(1680,0.035,'triangle',0.04,1100);blip(2200,0.02,'sine',0.018,null,0.015);}
    else if(cls==='knight'||cls==='warrior'){blip(cls==='warrior'?280:230,0.09,'sawtooth',0.055,70);crackle(0.05,280,0.6,0.035);}
    else if(cls==='priest'){blip(880,0.06,'sine',0.04,1320);blip(1320,0.05,'sine',0.025,null,0.03);}
    else{crackle(0.06,920,0.7,0.06);blip(640,0.07,'sine',0.04,240);}
  }
  function hit(){if(!ready()||!can('hit',48))return;crackle(0.028,1700,0.55,0.03);}
  function kill(boss){
    if(!ready())return;
    if(boss){blip(130,0.42,'sawtooth',0.07,48);crackle(0.32,180,0.4,0.06);blip(80,0.48,'square',0.04,40,0.06);return;}
    if(!can('ekill',90))return;
    crackle(0.08,620,0.8,0.045);blip(420,0.12,'square',0.04,110);
  }
  function hurt(){if(!ready()||!can('hurt',140))return;blip(170,0.12,'sawtooth',0.065,60);crackle(0.07,140,0.5,0.04);}
  function low(){blip(680,0.08,'sine',0.035);blip(500,0.1,'sine',0.032,null,0.12);}
  function ability(cls){
    if(!ready()||!can('ab',180))return;
    if(cls==='archer'){for(let i=0;i<5;i++)blip(900+i*150,0.04,'triangle',0.038,null,i*0.028);}
    else if(cls==='knight'){blip(90,0.16,'sine',0.07,48);crackle(0.12,110,0.4,0.06);}
    else if(cls==='warrior'){blip(140,0.12,'sawtooth',0.06,70);blip(220,0.1,'square',0.04,null,0.04);}
    else if(cls==='priest'){blip(520,0.12,'sine',0.05,880);blip(780,0.14,'sine',0.04,null,0.06);}
    else if(cls==='rogue'){blip(240,0.08,'sine',0.04,90);blip(180,0.12,'triangle',0.03,null,0.05);}
    else{crackle(0.18,420,0.5,0.06);blip(300,0.2,'sine',0.045,920);}
  }
  function potion(){if(!ready()||!can('pot',120))return;blip(520,0.07,'sine',0.048,780);blip(800,0.09,'sine',0.042,1120,0.08);}
  function drop(best,ut){
    if(!ready())return;
    const special=!!ut||best==='white';
    if(!special&&!can('drop',90))return;
    if(special){blip(1046,0.16,'sine',0.06,null,0);blip(1318,0.18,'sine',0.05,null,0.07);blip(1568,0.2,'sine',0.05,null,0.14);blip(2093,0.26,'sine',0.045,null,0.21);}
    else if(best==='cyan'){blip(784,0.12,'sine',0.05,null,0);blip(988,0.14,'sine',0.045,null,0.08);blip(1318,0.16,'sine',0.04,null,0.15);}
    else{blip(660,0.08,'sine',0.045,null,0);blip(880,0.1,'sine',0.035,null,0.06);}
  }
  function pickup(){if(!ready()||!can('pick',50))return;blip(880,0.06,'sine',0.045,1320);}
  function equip(){if(!ready()||!can('eq',50))return;blip(660,0.07,'triangle',0.048);blip(990,0.09,'triangle',0.04,null,0.06);}
  function level(){[523,659,784,1046].forEach(function(f,i){blip(f,0.12,'triangle',0.055,null,i*0.07);});}
  function beacon(){if(!ready())return;blip(988,0.12,'sine',0.048);blip(1480,0.16,'sine',0.04,null,0.08);}
  function teleport(){if(!ready())return;blip(420,0.18,'sine',0.048,1400);blip(1680,0.1,'sine',0.03,null,0.1);}
  function portal(){if(!ready())return;crackle(0.22,180,0.4,0.05);blip(196,0.24,'sine',0.038);blip(247,0.24,'sine',0.03,null,0.02);blip(330,0.26,'sine',0.032,null,0.04);}
  function roar(){if(!ready()||!can('roar',400))return;blip(100,0.45,'sawtooth',0.065,42);crackle(0.36,90,0.35,0.055);blip(70,0.32,'square',0.035,40,0.08);}
  function phase(){if(!ready())return;blip(185,0.2,'sawtooth',0.055);blip(196,0.2,'square',0.035,null,0.01);crackle(0.22,140,0.4,0.05);blip(90,0.28,'sine',0.04,48,0.05);}
  function death(){[392,349,311,220].forEach(function(f,i){blip(f,0.22,'sawtooth',0.055,Math.max(40,f*0.65),i*0.16);});crackle(0.35,100,0.3,0.04,0.08);}
  function click(){blip(880,0.05,'square',0.04,1320);}
  const MELODY={
    haven:[262,330,392,330,294,392,440,330],
    realm:[220,262,196,247,175,233,196,165],
    boss:[156,185,147,175,139,165,131,156],
    burrow:[880,698,587,523,466,587,440,349],
    burrowBoss:[784,659,523,466,392,523,349,311],
    hex:[196,233,175,220,147,196,165,247],
    hexBoss:[185,220,147,175,139,165,123,196],
    cinder:[220,185,247,165,196,147,233,139],
    cinderBoss:[247,196,165,220,147,185,131,165],
    sanctum:[392,494,587,494,440,587,659,523],
    sanctumBoss:[349,440,523,659,392,523,784,349],
    coil:[392,440,466,440,392,349,330,349,392,466,523,466],
    coilBoss:[330,349,392,349,311,294,330,392,349,311,294,262],
    throne:[220,262,196,247,311,247,196,165],
    throneBoss:[156,196,147,185,139,175,123,156]
  };
  const DRONE={haven:131,realm:110,boss:73,burrow:55,burrowBoss:41,hex:49,hexBoss:40,cinder:55,cinderBoss:36,sanctum:98,sanctumBoss:65,coil:73,coilBoss:55,throne:82,throneBoss:49};
  const MSTEP={haven:0.62,realm:0.46,boss:0.18,burrow:0.68,burrowBoss:0.46,hex:0.64,hexBoss:0.4,cinder:0.17,cinderBoss:0.11,sanctum:0.56,sanctumBoss:0.32,coil:0.42,coilBoss:0.3,throne:0.4,throneBoss:0.22};
  const DRONE_G={boss:0.02,burrowBoss:0.016,burrow:0.011,hexBoss:0.018,hex:0.012,cinderBoss:0.024,cinder:0.015,sanctumBoss:0.02,sanctum:0.011,haven:0.012,realm:0.012,coil:0.016,coilBoss:0.022,throne:0.014,throneBoss:0.024};
  function mood(){
    if(layoutC.portrait||state!=='play'||!P||!world||!musicOn)return 'none';
    if(world.isDungeon){
      const den=DUNGEONS[world.dungeonId]||DUNGEONS.tideclaw;
      const hear=den.bossHear||200;
      if(world.boss&&P&&Math.hypot(world.boss.x-P.x,world.boss.y-P.y)<hear)return den.musicBoss||'burrowBoss';
      return den.music||'burrow';
    }
    if(!peaceful()&&world.boss&&Math.hypot(world.boss.x-P.x,world.boss.y-P.y)<340)return 'boss';
    return peaceful()?'haven':'realm';
  }
  function updateDrone(m){
    if(!ctx)return;
    if(m==='none'){if(droneG)droneG.gain.setTargetAtTime(0.0001,ctx.currentTime,0.08);droneMood=null;return;}
    if(!drone){
      drone=ctx.createOscillator();droneG=ctx.createGain();drone.type='sine';droneG.gain.value=0.0001;
      drone.connect(droneG);droneG.connect(musicBus);drone.start();
    }
    if(droneMood!==m){drone.frequency.setTargetAtTime(DRONE[m]||110,ctx.currentTime,0.4);droneMood=m;}
    droneG.gain.setTargetAtTime(DRONE_G[m]||0.012,ctx.currentTime,0.25);
  }
  function musicTone(freq,when,dur,type,gain,slide){
    if(!ctx)return;
    try{
      const o=ctx.createOscillator(),gn=ctx.createGain();
      o.type=type||'sine';
      const f0=Math.max(30,freq);
      o.frequency.setValueAtTime(f0,when);
      if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),when+Math.max(0.02,dur));
      gn.gain.setValueAtTime(0.0001,when);
      gn.gain.exponentialRampToValueAtTime(Math.max(0.0002,gain),when+0.015);
      gn.gain.exponentialRampToValueAtTime(0.0001,when+Math.max(0.03,dur));
      o.connect(gn);gn.connect(musicBus);
      o.start(when);o.stop(when+dur+0.03);
      notes++;
    }catch(e){}
  }
  function dripTick(when,gain){
    if(!ctx||!noiseBuf)return;
    try{
      const src=ctx.createBufferSource();src.buffer=noiseBuf;
      const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=1600;f.Q.value=0.7;
      const gn=ctx.createGain();
      gn.gain.setValueAtTime(gain,when);
      gn.gain.exponentialRampToValueAtTime(0.0001,when+0.045);
      src.connect(f);f.connect(gn);gn.connect(musicBus);
      src.start(when);src.stop(when+0.05);
    }catch(e){}
  }
  function noiseHit(when,gain,freq,dur,type){
    if(!ctx||!noiseBuf)return;
    try{
      const src=ctx.createBufferSource();src.buffer=noiseBuf;
      const f=ctx.createBiquadFilter();f.type=type||'lowpass';f.frequency.value=freq||180;f.Q.value=0.7;
      const gn=ctx.createGain();
      gn.gain.setValueAtTime(gain,when);
      gn.gain.exponentialRampToValueAtTime(0.0001,when+dur);
      src.connect(f);f.connect(gn);gn.connect(musicBus);
      src.start(when);src.stop(when+dur+0.02);
    }catch(e){}
  }
  function scheduleHex(m,t){
    const boss=m==='hexBoss';
    const seq=MELODY[m],i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,boss?0.32:0.42,'triangle',boss?0.02:0.012,f*0.7);
    if(i%2===0)musicTone(f*1.5,t+0.08,0.18,'sine',boss?0.01:0.006);
    if(i%3===0){
      musicTone(boss?55:62,t,0.16,'square',boss?0.02:0.012,40);
      noiseHit(t,boss?0.04:0.02,220,0.08,'bandpass');
    }
  }
  function scheduleCinder(m,t){
    const boss=m==='cinderBoss';
    const seq=MELODY[m],i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,0.08,'sawtooth',boss?0.018:0.011,f*0.55);
    noiseHit(t,boss?0.055:0.032,i%2?900:160,i%2?0.04:0.07,i%2?'highpass':'lowpass');
    if(boss&&i%4===0)musicTone(49,t,0.12,'square',0.02,36);
  }
  function scheduleSanctum(m,t){
    const boss=m==='sanctumBoss';
    const seq=MELODY[m],i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,boss?0.46:0.62,'sine',boss?0.016:0.011);
    musicTone(f*1.5,t+0.02,boss?0.4:0.5,'sine',boss?0.008:0.005);
    if(i%2===0)musicTone(f*2,t+0.04,0.35,'sine',boss?0.006:0.0035);
    if(boss)musicTone(f/2,t,0.4,'triangle',0.01);
  }
  function scheduleCoil(m,t){
    const boss=m==='coilBoss';
    const seq=MELODY[m],i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,boss?0.34:0.46,'square',boss?0.011:0.008,f*1.012);
    musicTone(f,t+0.02,boss?0.4:0.5,'triangle',boss?0.009:0.006);
    if(i%2===0)noiseHit(t,boss?0.05:0.034,160,0.08,'lowpass');
    if(i%4===2)noiseHit(t+0.04,boss?0.028:0.02,980,0.04,'highpass');
  }
  function scheduleBurrow(m,t,step){
    const boss=m==='burrowBoss';
    const seq=MELODY[m],i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,boss?0.22:0.28,'sine',boss?0.02:0.014,f*0.62);
    if(i%2===1)musicTone(f*1.5,t+0.05,0.09,'sine',boss?0.01:0.007,Math.min(1800,f*2.4));
    if(i%4===0){
      musicTone(boss?62:73,t,0.12,'sine',boss?0.03:0.02,40);
      dripTick(t,boss?0.04:0.025);
    }else if(boss&&i%2===0)dripTick(t+0.02,0.02);
  }
  function scheduleHaven(t){
    const seq=MELODY.haven,i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,0.7,'sine',0.012);
    musicTone(f*1.25,t+0.04,0.55,'sine',0.006);
    if(i%2===0)musicTone(f*1.5,t+0.08,0.4,'triangle',0.004);
    if(i%4===0)musicTone(392,t+0.12,0.28,'sine',0.005);
  }
  function scheduleRealm(t){
    const seq=MELODY.realm,i=musicStep%seq.length,f=seq[i];
    musicStep++;
    musicTone(f,t,0.42,'triangle',0.011);
    musicTone(f*1.5,t+0.03,0.32,'sine',0.005);
    if(i%4===0)musicTone(f/2,t,0.36,'sine',0.008);
    if(i%4===2)noiseHit(t,0.012,240,0.05,'lowpass');
  }
  function schedule(m){
    if(!ctx||m==='none'){musicTime=0;return;}
    const now=ctx.currentTime;
    if(!musicTime||musicTime<now)musicTime=now+0.04;
    const step=MSTEP[m];let guard=0;
    while(musicTime<now+0.25&&guard++<6){
      if(m==='burrow'||m==='burrowBoss')scheduleBurrow(m,musicTime,step);
      else if(m==='hex'||m==='hexBoss')scheduleHex(m,musicTime);
      else if(m==='cinder'||m==='cinderBoss')scheduleCinder(m,musicTime);
      else if(m==='sanctum'||m==='sanctumBoss')scheduleSanctum(m,musicTime);
      else if(m==='coil'||m==='coilBoss')scheduleCoil(m,musicTime);
      else if(m==='haven')scheduleHaven(musicTime);
      else if(m==='realm')scheduleRealm(musicTime);
      else{
        const seq=MELODY[m],f=seq[musicStep%seq.length];musicStep++;
        try{
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type=m==='boss'?'sawtooth':'triangle';
          o.frequency.setValueAtTime(f,musicTime);
          const peak=m==='boss'?0.03:0.02;
          g.gain.setValueAtTime(0.0001,musicTime);
          g.gain.exponentialRampToValueAtTime(peak,musicTime+0.03);
          g.gain.exponentialRampToValueAtTime(0.0001,musicTime+step*0.9);
          o.connect(g);g.connect(musicBus);
          o.start(musicTime);o.stop(musicTime+step*0.92);
          notes++;
        }catch(e){}
      }
      musicTime+=step;
    }
  }
  function tick(){
    if(!unlocked||!ctx)return;
    try{
      if(ctx.state==='suspended'&&(sfxOn||musicOn)){const p=ctx.resume();if(p&&p.catch)p.catch(function(){});}
      const m=mood();
      updateDrone(m);schedule(m);
      if(state==='play'&&P&&sfxOn&&P.hp>0){
        const max=eff('hp');
        if(max>0&&P.hp/max<0.28&&can('low',1100))low();
      }
    }catch(e){}
  }
  function cycle(){
    if(sfxOn&&musicOn){musicOn=false;toast('Music off','#9fe0ff');}
    else if(sfxOn){click();sfxOn=false;musicOn=false;toast('Sound off','#aaa');}
    else{sfxOn=true;musicOn=true;toast('Sound and music on','#ffd34a');click();}
    apply();save();
    if(sfxOn&&ctx&&ctx.state==='suspended'){const p=ctx.resume();if(p&&p.catch)p.catch(function(){});}
  }
  return {unlock:unlock,tick:tick,cycle:cycle,shoot:shoot,hit:hit,kill:kill,hurt:hurt,ability:ability,potion:potion,drop:drop,pickup:pickup,equip:equip,level:level,beacon:beacon,teleport:teleport,portal:portal,roar:roar,phase:phase,death:death,
    get unlocked(){return unlocked;},get sfxOn(){return sfxOn;},get musicOn(){return musicOn;},get mood(){return mood();},
    get played(){return played;},get notes(){return notes;},
    state:function(){return ctx?ctx.state:'none';}};
}
const AUD=createAudio();
function loadRuns(){try{return JSON.parse(store.get(RUNSK))||[];}catch(e){return [];}}
function loadSave(){try{return JSON.parse(store.get(SAVEK));}catch(e){return null;}}
function toast(t,col){toasts.push({t,col:col||'#fff',life:2.6});if(toasts.length>4)toasts.shift();}
const CLASS_OLD={pyro:'wizard',strider:'archer',bulwark:'knight'};
function canonCls(k){return CLASS_OLD[k]||k;}
function migrateItem(it){
  if(!it||typeof it!=='object')return false;
  let changed=false;
  if(it.cls&&CLASS_OLD[it.cls]){it.cls=CLASS_OLD[it.cls];changed=true;}
  if(it.kind==='ability'&&typeof it.name==='string'){
    if(/ Codex$/.test(it.name)){it.name=it.name.replace(/ Codex$/,' Spellbook');changed=true;}
    else if(/ Seal$/.test(it.name)){it.name=it.name.replace(/ Seal$/,' Shield');changed=true;}
  }
  if(it.kind==='ability'&&!(it.tier>7)&&!it.dungeonUt){
    const tier=clamp(it.tier|0,0,ABIL_MAX);
    const noun=ABIL_NOUN[it.cls]||'Spellbook';
    const name=TPRE[tier]+' '+noun;
    const power=abilityPower(tier);
    if((it.tier|0)!==tier||it.name!==name||it.power!==power){
      it.tier=tier;it.name=name;it.power=power;
      if(it.cls==='wizard')it.fx={weak:3};
      if(it.cls==='archer')it.fx={slow:3};
      if(it.cls==='knight')it.fx={stun:2.5,bossStun:1};
      if(it.cls==='priest')it.heal=tomeHeal(tier);
      if(it.cls==='warrior'){const b=berserkStats(tier);it.dex=b.dex;it.dur=b.dur;}
      if(it.cls==='rogue')it.dur=cloakDur(tier);
      changed=true;
    }
  }
  if(it.kind==='ring'){
    const legacy=it.dungeonUt||it.spr==='tidepearl'||it.name==='Tidepearl';
    if(legacy){
      if(!it.st||typeof it.st!=='object'){it.st={hp:20,spd:2,def:1};changed=true;}
    }else{
      let tier=clamp(it.tier|0,0,8);
      let stat=(it.stat&&RING_NOUN[it.stat])?it.stat:null;
      if(!stat){for(const k of STATK)if(RING_UT[k]===it.name)stat=k;}
      if(!stat)stat=primaryRingStat(it.st);
      const retired=tier>7||STATK.some(k=>RING_UT[k]===it.name);
      if(retired)tier=7;
      if(retired||!it.stat||!RING_NOUN[it.stat]){
        it.tier=tier;it.stat=stat;it.name=ringName(stat,tier);it.st={[stat]:ringBonus(stat,tier)};
        changed=true;
      }else if(!it.st||typeof it.st!=='object'||!it.st[it.stat]||(it.tier|0)>7){
        it.tier=clamp(it.tier|0,0,7);
        it.name=ringName(it.stat,it.tier);
        it.st={[it.stat]:ringBonus(it.stat,it.tier)};
        changed=true;
      }
    }
  }
  return changed;
}
function migrateChar(s){
  if(!s||typeof s!=='object')return false;
  let changed=false;
  if(s.cls&&CLASS_OLD[s.cls]){s.cls=CLASS_OLD[s.cls];changed=true;}
  if(s.eq)for(const k in s.eq)if(migrateItem(s.eq[k]))changed=true;
  if(Array.isArray(s.inv))for(const it of s.inv)if(migrateItem(it))changed=true;
  return changed;
}
function blankRoster(){return {active:null,slots:Array.from({length:SLOTN},()=>null)};}
function persistRoster(){try{store.set(CHARSK,JSON.stringify(roster));}catch(e){}}
function freshVault(){const chests=[];for(let i=0;i<VAULT_N;i++)chests.push(Array.from({length:VAULT_SLOTS},()=>null));return {chests};}
let vaultData=null;
function loadVault(){
  if(vaultData)return vaultData;
  let parsed=null;
  try{parsed=JSON.parse(store.get(VAULTK));}catch(e){}
  const data=freshVault();
  let migrated=false;
  if(parsed&&Array.isArray(parsed.chests)){
    for(let i=0;i<VAULT_N;i++){
      const src=parsed.chests[i];
      if(!Array.isArray(src))continue;
      for(let s=0;s<VAULT_SLOTS;s++){
        data.chests[i][s]=src[s]||null;
        if(data.chests[i][s]&&migrateItem(data.chests[i][s]))migrated=true;
      }
    }
  }
  vaultData=data;
  if(migrated)saveVault();
  return data;
}
function saveVault(){try{store.set(VAULTK,JSON.stringify(loadVault()));}catch(e){}}
function ensureRoster(){
  if(roster)return roster;
  roster=blankRoster();
  let parsed=null;
  try{parsed=JSON.parse(store.get(CHARSK));}catch(e){}
  if(parsed&&Array.isArray(parsed.slots)){
    let migrated=false;
    for(let i=0;i<SLOTN;i++){
      const s=parsed.slots[i]||null;
      if(s&&migrateChar(s))migrated=true;
      roster.slots[i]=s;
    }
    roster.active=(parsed.active!=null&&roster.slots[parsed.active])?parsed.active:roster.slots.findIndex(Boolean);
    if(roster.active<0)roster.active=null;
    if(migrated)persistRoster();
    return roster;
  }
  const old=loadSave();
  if(old)migrateChar(old);
  if(old&&old.cls&&CLASSES[old.cls]){roster.slots[0]=old;roster.active=0;persistRoster();}
  return roster;
}
function slotCount(){const r=ensureRoster();let n=0;for(const s of r.slots)if(s)n++;return n;}

function newPlayer(k){const C=CLASSES[k];return {cls:k,lvl:1,xp:0,xpTotal:0,stats:Object.assign({},C.base),x:0,y:0,hp:C.base.hp,mp:C.base.mp,
  eq:{weapon:mkWeapon(C.w,0),ability:mkAbility(k,0),armor:mkArmor(C.a,0),ring:null},inv:[mkPot('hp'),null,null,null,null,null,null,null],hpPots:2,mpPots:2,
  fireCd:0,abCd:0,slow:0,stun:0,para:0,weak:0,poison:0,poisonDmg:0,poisonAcc:0,ccLock:0,berserk:0,berserkDex:0,invis:0,invuln:0,face:1,moving:false,firing:false,atkHold:0,aim:-Math.PI/2,kills:0,eliteKills:0,bossKills:0,elixirs:0,potsUsed:0,time:0,maxZone:0,seed:(Math.random()*1e9)|0,auto:false,beacons:[],seen:[],explored:{}};}
function eff(k){let v=P.stats[k];const a=P.eq.armor,r=P.eq.ring;if(a){if(k==='def')v+=a.def;if(k==='hp')v+=a.hp;if(k==='mp')v+=a.mp;}if(r&&r.st&&r.st[k])v+=r.st[k];if(k==='dex'&&P.berserk>0)v+=(P.berserkDex|0);return v;}
function statCap(cls,k){const C=CLASSES[cls||(P&&P.cls)];return C&&C.max&&C.max[k]!=null?C.max[k]:9999;}
function statMaxed(k){return !!(P&&P.stats[k]>=statCap(P.cls,k));}
const attMul=()=>{
  const a=eff('att');
  // v25 slope through the Godlands band, then a shallower slope so 75 ATT does not run away.
  const shaped=a<=45?a*0.025:45*0.025+(a-45)*0.012;
  return (0.5+shaped)*(P&&P.weak>0?0.5:1);
};
const need=l=>Math.round(25*Math.pow(l,1.5));
function noteItemId(it){if(it&&it.id>=itemId)itemId=it.id+1;}
function bumpItemIds(){
  if(P){for(const it of [P.eq&&P.eq.weapon,P.eq&&P.eq.ability,P.eq&&P.eq.armor,P.eq&&P.eq.ring,...(P.inv||[])])noteItemId(it);}
  for(const c of loadVault().chests)for(const it of c)noteItemId(it);
  for(const s of ensureRoster().slots){if(!s)continue;if(s.eq)for(const k in s.eq)noteItemId(s.eq[k]);if(s.inv)for(const it of s.inv)noteItemId(it);}
}
function saveGame(){
  if(!P||state!=='play'||activeSlot==null)return;
  try{
    const o=Object.assign({},P);
    const r=ensureRoster();
    r.slots[activeSlot]=o;
    r.active=activeSlot;
    persistRoster();
    store.set(SAVEK,JSON.stringify(o));
  }catch(e){}
}
function hydrate(s){
  migrateChar(s);
  P=Object.assign(newPlayer(s.cls),s);
  if(!P.eq)P.eq={};if(!P.eq.weapon)P.eq.weapon=mkWeapon(CLASSES[P.cls].w,0);if(!P.eq.ability)P.eq.ability=mkAbility(P.cls,0);if(!P.eq.armor)P.eq.armor=mkArmor(CLASSES[P.cls].a,0);if(!('ring' in P.eq))P.eq.ring=null;
  if(!Array.isArray(P.inv))P.inv=[];while(P.inv.length<8)P.inv.push(null);P.inv.length=8;
  if(!Array.isArray(P.beacons))P.beacons=[];if(!Array.isArray(P.seen))P.seen=[];if(!P.explored||typeof P.explored!=='object')P.explored={};
  if(P.stun==null)P.stun=0;if(P.para==null)P.para=0;if(P.weak==null)P.weak=0;if(P.ccLock==null)P.ccLock=0;if(P.slow==null)P.slow=0;
  if(P.berserk==null)P.berserk=0;if(P.berserkDex==null)P.berserkDex=0;if(P.invis==null)P.invis=0;
  if(P.poison==null)P.poison=0;if(P.poisonDmg==null)P.poisonDmg=0;if(P.poisonAcc==null)P.poisonAcc=0;
  bumpItemIds();
}
function openCharSelect(){
  // Character select is the Haven, the same way RotMG only allows it from the Nexus.
  // Death draws its own button and does not come through here.
  if(state==='play'&&(!world||!world.isHub))return;
  if(state==='play')saveGame();
  mapOpen=false;ptr=null;heldTip=null;
  input.move.id=null;input.aim.id=null;input.mouse.down=false;
  titleMode='roster';confirmSlot=-1;state='title';
}
function deleteCharacter(i){
  const r=ensureRoster();
  const s=r.slots[i];
  if(!s){titleMode='roster';return;}
  r.slots[i]=null;
  if(r.active===i||activeSlot===i){
    const next=r.slots.findIndex(Boolean);
    r.active=next>=0?next:null;
    activeSlot=r.active;
    if(next>=0)store.set(SAVEK,JSON.stringify(r.slots[next]));
    else store.del(SAVEK);
  }
  persistRoster();
  confirmSlot=-1;titleMode='roster';
  toast('Deleted Lv '+s.lvl+' '+((CLASSES[s.cls]&&CLASSES[s.cls].name)||'hero'),'#ff8a8a');
}

function startNew(k){
  const r=ensureRoster();
  const i=r.slots.findIndex(s=>!s);
  if(i<0){toast('All '+SLOTN+' hero slots are full','#ff8a8a');titleMode='roster';return;}
  activeSlot=i;
  P=newPlayer(k);
  r.active=i;
  realm=null;
  state='play';
  titleMode='roster';
  enterHub();
  toast('Welcome to the Haven, '+CLASSES[k].name+'!','#ffd34a');
  toast('Stand on the portal and tap Enter','#9fe0ff');
  saveGame();
}
function continueGame(slotIndex){
  const r=ensureRoster();
  let i=slotIndex;
  if(i==null||typeof i!=='number')i=(r.active!=null&&r.slots[r.active])?r.active:r.slots.findIndex(Boolean);
  const s=r.slots[i];
  if(!s||!s.cls||!CLASSES[s.cls])return;
  activeSlot=i;r.active=i;
  hydrate(s);
  realm=null;
  state='play';
  titleMode='roster';
  enterHub();
  persistRoster();
  toast('Welcome back. Lv '+P.lvl+' '+CLASSES[P.cls].name,'#ffd34a');
}
function clearBullets(){ebN=0;pbN=0;ptN=0;FX.length=0;}
function peaceful(){return !!(world&&(world.isHub||world.isVault));}
function enterHub(){if(!hub)hub=genHub();world=hub;P.x=hub.spawn.x;P.y=hub.spawn.y;clearBullets();saveGame();}
function enterVault(){
  if(!vault)vault=genVault();
  world=vault;P.x=vault.spawn.x;P.y=vault.spawn.y;clearBullets();
  AUD.portal();toast('Entered the Vault','#7dffe0');saveGame();
}
function leaveVault(){
  enterHub();
  if(hub&&hub.vault){P.x=hub.vault.x;P.y=hub.vault.y+20;}
  toast('Returned to the Haven','#ffd34a');saveGame();
}
function beaconClear(wd,x,y,rad){for(const b of (wd&&wd.beacons)||[])if(Math.hypot(x-b.x,y-b.y)<rad)return false;return true;}
function enterRealm(){
  if(!realm){
    realm=genRealm(P.seed);
    const n=clamp((P&&P.realmClear)|0,0,8);
    realm.clearKills=n;
    if(n>=8)spawnBoss(realm);
  }
  world=realm;clearBullets();
  for(let i=0;i<400;i++){const a=Math.random()*TAU,r=realm.w*TS/2*rand(0.78,0.86);const x=realm.cx+Math.cos(a)*r,y=realm.cy+Math.sin(a)*r;
    if(!solidBox(realm,x,y,4)&&zoneAt(realm,x,y)===0&&beaconClear(realm,x,y,36)){P.x=x;P.y=y;break;}}
  realm.entry={x:P.x,y:P.y};
  if(!P.seen)P.seen=[];if(P.seen.indexOf('r:entry')<0)P.seen.push('r:entry');
  realm.enemies=realm.enemies.filter(e=>e.d.boss);
  toast('Entered the Shardwild — the shore is quiet, the center is not','#ffd34a');
  AUD.portal();
}
function spawnBoss(wd){wd.boss=spawnEnemy(wd,'king',wd.cx,wd.cy,3,false);AUD.roar();}
function enterDungeon(id,seed){
  const d=DUNGEONS[id]||DUNGEONS.tideclaw;
  dungeon=d.theme==='tide'?genTideclaw(seed):d.theme==='coil'?genCoil(seed):d.theme==='throne'?genThrone():genDen(d.id,seed);
  if(!dungeon){toast('The portal collapses','#ff8a8a');return;}
  world=dungeon;
  P.x=dungeon.spawn.x;P.y=dungeon.spawn.y;
  clearBullets();
  for(const s of dungeon.encounters||[])spawnEnemy(dungeon,s.type,s.x,s.y,0,false);
  dungeon.boss=spawnEnemy(dungeon,d.boss||'tideclaw',dungeon.anchor.x,dungeon.anchor.y,0,false);
  if(d.id==='throne')setupMega(dungeon);
  quest=null;questT=0;
  revealDungeonRoom();
  AUD.portal();
  toast('Entered '+d.name,d.col||'#ffb070');
  if(d.lore)toast(d.lore,d.loreCol||'#d8d0ea');
  saveGame();
}

/* ---------------- gameplay ---------------- */
function moveEnt(o,dx,dy,r){
  if(!solidBox(world,o.x+dx,o.y,r))o.x+=dx;else dx=0;
  if(!solidBox(world,o.x,o.y+dy,r))o.y+=dy;else dy=0;
  return dx!==0||dy!==0;
}
function gainXP(n){
  P.xpTotal+=n;if(P.lvl>=20)return;P.xp+=n;
  while(P.lvl<20&&P.xp>=need(P.lvl)){P.xp-=need(P.lvl);P.lvl++;const C=CLASSES[P.cls];for(const k of STATK){P.stats[k]=Math.min(statCap(P.cls,k),P.stats[k]+irand(C.gain[k][0],C.gain[k][1]));}
    P.hp=eff('hp');P.mp=eff('mp');toast('LEVEL UP! Lv '+P.lvl+(P.lvl===20?' (MAX)':''),'#ffd34a');addFX(P.x,P.y,2,30,0.6,'#ffd34a');addPT(P.x,P.y,'#ffd34a',24,60);AUD.level();}
  if(P.lvl>=20)P.xp=0;
}
function dmgEnemy(e,raw,isAb,lethal){
  AUD.hit();
  if(e.shield){e.flash=0.05;addDN(e.x,e.y-e.d.r,'SHIELD',e.d.phaseCol||'#c46aff');return;}
  if(lethal||raw>=1000000){e.hp=0;e.flash=0.08;addDN(e.x,e.y-e.d.r,'SLAIN','#ffe9a0');killEnemy(e);return;}
  const dmg=Math.max(Math.round(raw*0.15),Math.round(raw-e.d.def));e.hp-=dmg;e.flash=0.08;addDN(e.x,e.y-e.d.r,''+dmg,isAb?'#ffd34a':'#ffffff');
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  if(e.dead)return;e.dead=true;const wd=world;
  const i=wd.enemies.indexOf(e);if(i>=0)wd.enemies.splice(i,1);
  addPT(e.x,e.y,e.d.boss?'#c46aff':'#ff5a5a',e.d.boss?80:12,e.d.boss?90:45,e.d.boss?2:1);
  AUD.kill(!!e.d.boss);
  gainXP(e.d.xp*(e.elite?5:1));P.kills++;
  if(e.elite){P.eliteKills++;toast('Defeated '+e.name.split(' (')[0]+'!','#ffd34a');}
  if(e.type==='clutch'){
    for(let k=0;k<2;k++)spawnEnemy(wd,'hatchling',e.x+rand(-16,16),e.y+rand(-16,16),e.zone,false);
  }
  if(e.d.dungeonBoss){
    wd.boss=null;wd.exitOpen=true;
    const den=DUNGEONS[wd.dungeonId]||DUNGEONS.tideclaw;
    toast(den.fallLine||'OLD TIDECLAW FALLS',den.col||'#ffb070');
    toast('A way back to the Haven opens','#7ee0c8');
    addFX(e.x,e.y,4,70,1,den.col||'#ffb070');
    const items=e.type==='megaking'?megaLoot():dungeonLoot(true);
    if(items.length){spawnLootBag(e.x,e.y,items,180);playDropSound(items);}
    return;
  }
  if(e.warden&&wd.theme==='throne'&&wd.boss&&wd.boss.mkPhase===1){
    if(!wd.enemies.some(o=>o.warden&&o!==e))breakMegaShield(wd.boss);
  }
  if(e.d.event){
    if(e.lair)e.lair.busy=false;
    if(wd===realm)noteRealmClear();
    toast(e.d.fall||(e.name+' is slain'),e.d.phaseCol||'#ffd34a');
    const items=eventLoot(e);
    if(items.length){spawnLootBag(e.x,e.y,items,160);playDropSound(items);}
    if(Math.random()<0.4){
      const gate=e.d.portal;
      const id=Array.isArray(gate)?gate[(Math.random()*gate.length)|0]:gate;
      if(id)openDungeonPortal(wd,e.x,e.y,id);
    }
    addFX(e.x,e.y,6,80,1.1,e.d.phaseCol||'#ffd34a');
    return;
  }
  if(e.d.boss){
    P.bossKills++;wd.boss=null;
    if(wd===realm){wd.clearKills=0;if(P)P.realmClear=0;}
    toast('MORVANE HAS FALLEN!','#ff5577');
    toast('A portal to the Throne of Ruin tears open','#ffd34a');
    addFX(e.x,e.y,4,90,1.2,'#c46aff');
    openDungeonPortal(wd,e.x,e.y,'throne');
  }
  if(wd.isDungeon){
    const items=dungeonLoot(false);
    if(items.length){spawnLootBag(e.x,e.y,items,90);playDropSound(items);}
    return;
  }
  if(!wd.isHub&&!wd.isVault){
    const portal=rollPortal(e.type);
    if(portal)openDungeonPortal(wd,e.x,e.y,portal);
  }
  rollLoot(e);
}
// Shore T0–T2, Greenmarch T1–T4, Ashen T3–T6, Godlands T5–T7. Elites shift up one tier. No UT here.
// Potion of Mastery is test-chest only and must never appear in these rolls.
const LOOT_SPAN=[[0,2],[1,4],[3,6],[5,7]];
const GEAR_W=['staff','bow','sword','wand','dagger'];
const GEAR_UT_W=['staff','bow','sword'];
const GEAR_A=['robe','leather','heavy'];
function tierSpan(zone,elite){
  const z=clamp(zone|0,0,3);
  let lo=LOOT_SPAN[z][0],hi=LOOT_SPAN[z][1];
  if(elite){lo=Math.min(7,lo+1);hi=Math.min(7,hi+1);}
  return [lo,hi];
}
function rollTier(lo,hi){
  let sum=0;const w=[];
  for(let t=lo;t<=hi;t++){const v=hi-t+1;w.push(v);sum+=v;}
  let r=Math.random()*sum;
  for(let i=0,t=lo;t<=hi;t++,i++){r-=w[i];if(r<=0)return t;}
  return lo;
}
function randomGear(tier){
  tier=clamp(tier|0,0,8);
  if(tier>7){
    const r=Math.random();
    if(r<0.44)return mkWeapon(pick(GEAR_UT_W),tier);
    if(r<0.72)return mkArmor(pick(GEAR_A),tier);
    return mkAbility(pick(CLASSKEYS),tier);
  }
  const k=Math.random();
  if(k<0.34)return mkWeapon(pick(GEAR_W),tier);
  if(k<0.56)return mkArmor(pick(GEAR_A),tier);
  if(k<0.78)return mkAbility(pick(CLASSKEYS),Math.min(ABIL_MAX,tier));
  return mkRing(tier);
}
// Signature god pots. Life and the healing draught stay off this table.
// Mana is the Mind elixir (stat mp). The Void Keeper shares it with the Oracle; the Idol shares Defense with the Saint.
const GOD_POT={eye:'wis',colossus:'vit',oracle:'mp',saint:'def',wyrm:'spd',titan:'att',serpent:'dex',voidkeeper:'mp',idol:'def'};
const GOD_POT_P=0.2;
function lootItemsFor(e){
  const items=[];
  const z=clamp(e.zone|0,0,3);
  const godPot=!e.boss&&e.type&&GOD_POT[e.type];
  if(e.boss){
    const n=Math.random()<0.5?3:2;
    for(let i=0;i<n;i++)items.push(randomGear(rollTier(6,7)));
    const solid=it=>(it.kind==='weapon'||it.kind==='armor'||it.kind==='ring')&&(it.tier|0)>=6&&(it.tier|0)<=7;
    if(!items.some(solid)){
      const t=rollTier(6,7),r=Math.random();
      items[0]=r<0.5?mkWeapon(pick(GEAR_W),t):r<0.75?mkArmor(pick(GEAR_A),t):mkRing(t);
    }
    items.push(mkElixir(),mkElixir());
    if(Math.random()<0.75)items.push(mkPot('hp'));
    if(Math.random()<0.55)items.push(mkPot('mp'));
    return items.filter(it=>!isMastery(it)&&!isTestItem(it)&&!isDungeonUt(it)&&it.kind!=='dungeonkey');
  }
  const gearP=e.elite?0.88:(0.22+z*0.04);
  if(Math.random()<gearP){
    const span=tierSpan(z,!!e.elite);
    const n=e.elite&&Math.random()<0.4?2:1;
    for(let i=0;i<n;i++)items.push(randomGear(rollTier(span[0],span[1])));
  }
  if(godPot){
    if(Math.random()<GOD_POT_P)items.push(mkElixirOf(godPot));
  }else{
    if(Math.random()<(e.elite?0.62:0.14))items.push(mkPot('hp'));
    if(Math.random()<(e.elite?0.42:0.09))items.push(mkPot('mp'));
    if(e.elite&&z>=2&&Math.random()<0.35)items.push(mkElixir());
  }
  return items.filter(it=>!isMastery(it)&&!isTestItem(it)&&!isDungeonUt(it)&&it.kind!=='dungeonkey');
}
function hollowUt(){
  const roll=Math.random();
  if(roll<0.42)return mkWeapon(pick(['staff','bow','sword','wand','dagger']),8);
  if(roll<0.70)return mkArmor(pick(GEAR_A),8);
  return mkAbility(pick(CLASSKEYS),8);
}
function megaLoot(){
  const items=[];
  const r=Math.random();
  if(r<0.46)items.push(mkWeapon(pick(GEAR_W),7));
  else if(r<0.74)items.push(mkArmor(pick(GEAR_A),7));
  else items.push(mkRing(7));
  items.push(mkElixir(),mkElixir());
  if(Math.random()<0.8)items.push(mkPot('hp'));
  if(Math.random()<0.6)items.push(mkPot('mp'));
  if(Math.random()<0.4)items.push(hollowUt());
  return items.filter(it=>it&&!isMastery(it)&&!isTestItem(it)&&!isDungeonUt(it)&&it.kind!=='dungeonkey');
}
function eventLoot(e){
  const z=clamp((e.d&&e.d.zone!=null?e.d.zone:e.zone)|0,0,3);
  const span=[[2,4],[3,5],[5,7],[6,7]][z];
  const items=[];
  const n=Math.random()<0.45?3:2;
  for(let i=0;i<n;i++)items.push(randomGear(rollTier(span[0],span[1])));
  items.push(mkElixir());
  if(Math.random()<0.7)items.push(mkPot('hp'));
  if(Math.random()<0.5)items.push(mkPot('mp'));
  if(z>=2&&Math.random()<0.4)items.push(mkElixir());
  return items.filter(it=>it&&!isMastery(it)&&!isTestItem(it)&&!isDungeonUt(it)&&it.kind!=='dungeonkey'&&(it.tier|0)<=7);
}
function rollPortal(type){
  for(const id in DUNGEONS){
    const d=DUNGEONS[id];
    if(type===d.enemy&&Math.random()<d.portalRate)return id;
  }
  return null;
}
function openDungeonPortal(wd,x,y,id){
  const d=DUNGEONS[id];if(!d||!wd)return null;
  if(!wd.portals)wd.portals=[];
  const p={id,name:d.name,dungeon:id,x,y,t:60,delay:0.45};
  wd.portals.push(p);
  toast(d.name+' portal opened','#7ee0c8');
  return p;
}
function activeDungeon(id){
  return DUNGEONS[id||(world&&world.isDungeon&&world.dungeonId)||'tideclaw']||DUNGEONS.tideclaw;
}
function dungeonLoot(boss,id){
  const d=activeDungeon(id),L=d.loot,items=[];
  if(boss){
    const n=Math.random()<L.bossHi?L.bossN[1]:L.bossN[0];
    for(let i=0;i<n;i++)items.push(randomGear(rollTier(L.bossTier[0],L.bossTier[1])));
    if(Math.random()<L.hp)items.push(mkPot('hp'));
    if(Math.random()<L.mp)items.push(mkPot('mp'));
    if(L.elixir&&Math.random()<L.elixir)items.push(mkElixir());
    if(L.elixir2&&Math.random()<L.elixir2)items.push(mkElixir());
    if(d.utName&&Math.random()<L.ut){const ut=makeDungeonUt(d.id);if(ut)items.push(ut);}
    if(L.key&&Math.random()<L.key)items.push(mkDungeonKey(d.id));
  }else if(Math.random()<L.minP){
    items.push(randomGear(rollTier(L.minTier[0],L.minTier[1])));
    if(Math.random()<L.minHp)items.push(mkPot('hp'));
  }
  return items.filter(it=>it&&!isTestItem(it)&&!isMastery(it));
}
function makeDungeonUt(id){
  if(id==='tideclaw')return mkTidepearl();
  if(id==='hexmire')return mkVineBow();
  if(id==='cinderhive')return mkMagmaStaff();
  if(id==='sanctum')return mkVoidBlade();
  if(id==='coil')return mkSerpentWand();
  return null;
}
function tideChestLoot(){
  const L=activeDungeon().loot;
  const items=[randomGear(rollTier(L.chest[0],L.chest[1]))];
  if(Math.random()<L.chestHp)items.push(mkPot('hp'));
  return items.filter(it=>it&&!isTestItem(it)&&!isMastery(it)&&!isDungeonUt(it)&&it.kind!=='dungeonkey');
}
const BAG_RANK={brown:0,pink:1,purple:2,blue:3,cyan:4,white:5};
function itemBagColor(it){
  if(!it)return 'brown';
  if(isMastery(it))return 'white';
  if(it.tier>7)return 'white';
  if(it.kind==='elixir')return 'cyan';
  const t=it.tier|0;
  if(t>=6)return 'blue';
  if(t>=4)return 'purple';
  if(t>=2)return 'pink';
  return 'brown';
}
function bagColor(items){
  let best='brown';
  for(const it of items){const c=itemBagColor(it);if(BAG_RANK[c]>BAG_RANK[best])best=c;}
  return best;
}
function spawnLootBag(x,y,items,life){
  if(!world||!items||!items.length)return null;
  const bag={x,y,items,t:life,col:bagColor(items)};
  world.bags.push(bag);
  return bag;
}
function playDropSound(items){
  if(!items||!items.length)return;
  if(items.some(it=>it.tier>7)){AUD.drop('white',true);toast('A white bag dropped!','#ffffff');return;}
  if(items.some(it=>it.tier>=6)){AUD.drop('cyan',false);return;}
  AUD.drop(bagColor(items),false);
}
function rollLoot(e){
  const items=lootItemsFor({zone:e.zone,elite:!!e.elite,boss:!!(e.d&&e.d.boss),type:e.type});
  if(!items.length)return;
  spawnLootBag(e.x,e.y,items,90);
  playDropSound(items);
  if(/loot/.test(location.hash))console.log('loot',e.type||'',items.map(it=>it.name+' '+(it.tier>7?'UT':'T'+it.tier)).join(', '));
}
function simLoot(n){
  n=n||500;
  const regions=[
    {name:'Saltmarsh Shore',zone:0},
    {name:'Greenmarch',zone:1},
    {name:'Ashen Wilds',zone:2},
    {name:'Godlands',zone:3}];
  function summarize(rolls){
    const gear={};for(let t=0;t<=8;t++)gear[t]=0;
    let empty=0,potOnly=0,withGear=0,ut=0,elixirs=0,pots=0,hpPots=0,lifeElixirs=0,rings=0,testN=0,mastery=0,dungeonUt=0,keys=0,abilityBad=0;
    const elixirStats={};
    const weapons={staff:0,bow:0,sword:0,wand:0,dagger:0},armors={robe:0,leather:0,heavy:0},abilities={wizard:0,archer:0,knight:0,priest:0,warrior:0,rogue:0};
    let gearN=0;
    for(const items of rolls){
      const gs=items.filter(it=>it.kind==='weapon'||it.kind==='armor'||it.kind==='ability'||it.kind==='ring');
      if(!items.length)empty++;
      else if(!gs.length)potOnly++;
      else withGear++;
      for(const it of items){
        if(isMastery(it))mastery++;
        if(isDungeonUt(it))dungeonUt++;
        if(it.kind==='dungeonkey'){keys++;continue;}
        if(isTestItem(it))testN++;
        if(it.kind==='hp'||it.kind==='mp'){pots++;if(it.kind==='hp')hpPots++;}
        else if(it.kind==='elixir'){elixirs++;elixirStats[it.stat]=(elixirStats[it.stat]||0)+1;if(it.stat==='hp')lifeElixirs++;}
        else if(it.kind==='weapon'||it.kind==='armor'||it.kind==='ability'||it.kind==='ring'){
          const capped=it.kind==='ability'&&(it.tier|0)<=5;
          if(!capped){gear[it.tier]=(gear[it.tier]||0)+1;gearN++;if(it.tier>7)ut++;}
          if(it.kind==='weapon')weapons[it.w]++;
          else if(it.kind==='armor')armors[it.a]++;
          else if(it.kind==='ability'){abilities[it.cls]++;if((it.tier|0)>5&&(it.tier|0)<=7)abilityBad++;}
          else rings++;
        }
      }
    }
    return {n:rolls.length,empty,potOnly,withGear,ut,elixirs,pots,hpPots,lifeElixirs,elixirStats,gear,gearN,weapons,armors,abilities,rings,test:testN,mastery,dungeonUt,keys,abilityBad};
  }
  const out={per:n,regions:[],boss:null,utOutsideBoss:0,testDrops:0,mastery:0,dungeonUtOutside:0,keysOutside:0};
  for(const reg of regions){
    const normal=[],elite=[];
    const types=ZONES[reg.zone].types;
    for(let i=0;i<n;i++){
      const type=types[i%types.length];
      normal.push(lootItemsFor({zone:reg.zone,elite:false,boss:false,type}));
      elite.push(lootItemsFor({zone:reg.zone,elite:true,boss:false,type}));
    }
    const ns=summarize(normal),es=summarize(elite);
    out.utOutsideBoss+=ns.ut+es.ut;
    out.testDrops+=ns.test+es.test;
    out.mastery+=ns.mastery+es.mastery;
    out.dungeonUtOutside+=ns.dungeonUt+es.dungeonUt;
    out.keysOutside+=ns.keys+es.keys;
    const span=tierSpan(reg.zone,false),espan=tierSpan(reg.zone,true);
    out.regions.push({name:reg.name,zone:reg.zone,span,eliteSpan:espan,normal:ns,elite:es});
  }
  const boss=[];
  let bossSolid=0;
  for(let i=0;i<n;i++){
    const items=lootItemsFor({zone:3,elite:false,boss:true});
    boss.push(items);
    if(items.some(it=>(it.kind==='weapon'||it.kind==='armor'||it.kind==='ability'||it.kind==='ring')&&it.tier>=6&&it.tier<=7))bossSolid++;
  }
  out.boss=summarize(boss);
  out.bossSolid=bossSolid;
  out.testDrops+=out.boss.test;
  out.mastery+=out.boss.mastery;
  out.dungeonUtOutside+=out.boss.dungeonUt;
  out.keysOutside+=out.boss.keys;
  const portalTypes=Object.keys(EN);
  out.portalByType={};
  for(const t of portalTypes){let c=0;for(let i=0;i<n;i++)if(rollPortal(t))c++;out.portalByType[t]=c;}
  // Each realm enemy rolls its region's band. UT stays on bosses (and the dungeon boss).
  out.enemyBands=[];
  for(const reg of regions){
    for(const type of ZONES[reg.zone].types){
      const rolls=[];
      for(let i=0;i<n;i++)rolls.push(lootItemsFor({zone:reg.zone,elite:false,boss:false,type}));
      const s=summarize(rolls);
      const port=Object.keys(DUNGEONS).map(id=>DUNGEONS[id]).find(d=>d.enemy===type)||null;
      out.enemyBands.push({type,name:EN[type].name,zone:reg.zone,region:reg.name,ai:EN[type].ai,god:!!EN[type].god,span:tierSpan(reg.zone,false),ut:s.ut,gear:s.gear,test:s.test,mastery:s.mastery,dungeonUt:s.dungeonUt,keys:s.keys,n:s.n,godPot:GOD_POT[type]||null,elixirStats:s.elixirStats,hpPots:s.hpPots,lifeElixirs:s.lifeElixirs,elixirs:s.elixirs,portalRate:port?port.portalRate:0,portal:port?port.name:null});
    }
  }
  const dBoss=[],dMin=[];
  let dGear=0;
  for(let i=0;i<n;i++){
    const b=dungeonLoot(true),m=dungeonLoot(false);
    dBoss.push(b);dMin.push(m);
    if(b.some(it=>!isDungeonUt(it)&&(it.kind==='weapon'||it.kind==='armor'||it.kind==='ability'||it.kind==='ring')&&it.tier>=2&&it.tier<=4))dGear++;
  }
  const bs=summarize(dBoss),ms=summarize(dMin);
  out.dungeon={boss:bs,minion:ms,bossGear:dGear,utName:'Tidepearl',enemy:'crab',portalRate:DUNGEONS.tideclaw.portalRate};
  out.testDrops+=bs.test+ms.test;
  out.mastery+=bs.mastery+ms.mastery;
  const mega=[];
  let megaT7=0;
  for(let i=0;i<n;i++){
    const items=megaLoot();
    mega.push(items);
    if(items.some(it=>(it.kind==='weapon'||it.kind==='armor'||it.kind==='ring')&&(it.tier|0)===7))megaT7++;
  }
  out.mega=summarize(mega);
  out.megaT7=megaT7;
  return out;
}
function potCount(k){let n=k==='hp'?P.hpPots:P.mpPots;for(const it of P.inv)if(it&&it.kind===k)n++;return n;}
function drinkHP(){if(P.hp>=eff('hp')-0.01)return;if(P.hpPots>0){P.hpPots--;P.potsUsed++;P.hp=Math.min(eff('hp'),P.hp+120);addPT(P.x,P.y,'#ff4a6a',14,30);addDN(P.x,P.y,'+120','#5aff7a');AUD.potion();return;}const i=P.inv.findIndex(it=>it&&it.kind==='hp');if(i>=0)drinkRef({area:'inv',i});}
function drinkMP(){if(P.mp>=eff('mp')-0.01)return;if(P.mpPots>0){P.mpPots--;P.potsUsed++;P.mp=Math.min(eff('mp'),P.mp+100);addPT(P.x,P.y,'#4a8aff',14,30);AUD.potion();return;}const i=P.inv.findIndex(it=>it&&it.kind==='mp');if(i>=0)drinkRef({area:'inv',i});}
function aimDist(){if(input.mouse.active){const p=w2s(P.x,P.y);return Math.min(95,Math.hypot(input.mouse.x-p.x,input.mouse.y-p.y)*DPR/S);}return 70;}
function abCost(){const ab=P&&P.eq&&P.eq.ability;return Math.max(18,CLASSES[P.cls].cost-abilCut((ab&&ab.tier)||0));}
function useAbility(){
  const C=CLASSES[P.cls];const ab=P.eq.ability;if(!ab){toast('No ability equipped','#ff8a8a');P.abCd=0.4;return;}
  if(P.stun>0){toast('Stunned','#ffd34a');P.abCd=0.25;return;}
  if(P.abCd>0)return;const cost=abCost();if(P.mp<cost){toast('Not enough MP','#6aa0ff');P.abCd=0.4;return;}
  P.mp-=cost;P.abCd=0.6;AUD.ability(P.cls);const am=attMul()*abilAmp(ab.tier),a=P.aim;
  const fx=normFx(ab.fx);
  if(P.cls==='wizard'){const d=aimDist(),tx=P.x+Math.cos(a)*d,ty=P.y+Math.sin(a)*d;addFX(tx,ty,3,30,0.4,'#ff8a3a');addPT(tx,ty,'#ff8a3a',30,70);
    const hit=fx?Object.assign({force:true},fx):null;
    for(const e of world.enemies.slice())if(Math.hypot(e.x-tx,e.y-ty)<30+e.d.r){if(hit)applyFx(e,hit);dmgEnemy(e,(90+P.lvl*12)*am,true);}}
  if(P.cls==='archer'){for(let i=0;i<7;i++)addPB(P.x,P.y,a+(i-3)*0.09,220,(55+P.lvl*7)*am,3.5,0.8,'#7aff4a',true,fx||{slow:3});}
  if(P.cls==='knight'){P.invuln=1.5;addFX(P.x,P.y,4,46,0.45,'#9fd0ff');const hit=Object.assign({force:true},fx||{stun:2.5,bossStun:1});
    for(const e of world.enemies.slice())if(Math.hypot(e.x-P.x,e.y-P.y)<46+e.d.r){applyFx(e,hit);dmgEnemy(e,(45+P.lvl*6)*am,true);}}
  if(P.cls==='priest'){
    const heal=tomeHeal(ab.tier);
    P.hp=Math.min(eff('hp'),P.hp+heal);
    addFX(P.x,P.y,4,28,0.45,'#ffe9a0');addPT(P.x,P.y,'#fff6c0',18,40);addDN(P.x,P.y,'+'+heal,'#5aff7a');
  }
  if(P.cls==='warrior'){
    const b=berserkStats(ab.tier);
    P.berserk=b.dur;P.berserkDex=b.dex;
    addFX(P.x,P.y,4,32,0.4,'#ff5a3a');addPT(P.x,P.y,'#ff8a3a',16,50);toast('Berserk +'+b.dex+' DEX','#ff8a3a');
  }
  if(P.cls==='rogue'){
    P.invis=cloakDur(ab.tier);
    addFX(P.x,P.y,3,22,0.35,'#d0d4e8');toast('Invisible','#d0d4e8');
  }
}
function hurtPlayer(dmg,from){
  if(P.invuln>0)return;const d=Math.max(Math.round(dmg*0.15),Math.round(dmg-eff('def')));P.hp-=d;addDN(P.x,P.y,'-'+d,'#ff4a4a');P.hurt=0.12;AUD.hurt();
  if(P.hp<=0){P.hp=0;die(from);}
}
function fameCalc(){
  const base=Math.floor(P.xpTotal/15);const L=[['Base fame (XP)',base]];
  if(P.lvl>=20)L.push(['Seasoned (reached Lv 20)',Math.max(50,Math.round(base*0.2))]);
  if(P.kills>=100)L.push(['Slayer (100+ kills)',Math.round(base*0.1)]);
  if(P.eliteKills)L.push(['Elite Hunter x'+P.eliteKills,P.eliteKills*15]);
  if(P.bossKills)L.push(['Kingslayer x'+P.bossKills,P.bossKills*400]);
  if(P.elixirs)L.push(['Alchemist x'+P.elixirs,P.elixirs*10]);
  if(P.potsUsed===0&&P.lvl>=10)L.push(['Iron Will (no potions)',Math.round(base*0.15)]);
  const mins=Math.floor(P.time/60);if(mins)L.push(['Endurance ('+mins+' min)',mins*3]);
  return {lines:L,total:L.reduce((s,l)=>s+l[1],0)};
}
function die(from){
  const f=fameCalc();const runs=loadRuns();const run={cls:P.cls,lvl:P.lvl,fame:f.total,kills:P.kills,by:from||'the wilds',date:new Date().toISOString().slice(0,10)};
  runs.push(run);runs.sort((a,b)=>b.fame-a.fame);const best=runs[0]===run;
  store.set(RUNSK,JSON.stringify(runs.slice(0,10)));
  const r=ensureRoster();
  if(activeSlot!=null)r.slots[activeSlot]=null;
  const next=r.slots.findIndex(Boolean);
  r.active=next>=0?next:null;activeSlot=r.active;
  persistRoster();
  if(next>=0)store.set(SAVEK,JSON.stringify(r.slots[next]));else store.del(SAVEK);
  deathInfo={f,run,best,t:0};state='dead';titleMode='roster';ptr=null;addPT(P.x,P.y,'#ff4a4a',40,60,2);AUD.death();
}
function nearBag(){
  let b=null,bd=18;
  for(const g of world.bags){
    const d=Math.hypot(g.x-P.x,g.y-P.y);
    if(d<18&&(d<bd-0.05||Math.abs(d-bd)<0.05)){bd=d;b=g;}
  }
  return b;
}
function removeBag(b){const k=world.bags.indexOf(b);if(k>=0)world.bags.splice(k,1);}
function vaultSlots(i){const v=loadVault();return v.chests[i]||null;}
function readItem(ref){
  if(!ref||!P)return null;
  if(ref.area==='inv')return P.inv[ref.i]||null;
  if(ref.area==='eq')return P.eq[ref.slot]||null;
  if(ref.area==='bag'){const b=ref.bag;if(!b||!world||world.bags.indexOf(b)<0)return null;return b.items[ref.i]||null;}
  if(ref.area==='chest'){if(!nearChest())return null;return filteredChest()[ref.i]||null;}
  if(ref.area==='vault'){const c=nearVaultChest();if(!c||c.i!==ref.chest)return null;const slots=vaultSlots(ref.chest);return slots?slots[ref.i]||null:null;}
  return null;
}
function writeItem(ref,it){
  if(!ref||ref.area==='chest')return;
  if(ref.area==='inv'){P.inv[ref.i]=it||null;return;}
  if(ref.area==='eq'){P.eq[ref.slot]=it||null;return;}
  if(ref.area==='vault'){const slots=vaultSlots(ref.chest);if(!slots||ref.i<0||ref.i>=slots.length)return;slots[ref.i]=it||null;saveVault();return;}
  if(ref.area==='bag'){const b=ref.bag;if(!b||world.bags.indexOf(b)<0)return;
    if(it){if(ref.i>=b.items.length)b.items.push(it);else b.items[ref.i]=it;}
    else if(ref.i<b.items.length){b.items.splice(ref.i,1);if(!b.items.length)removeBag(b);}}
}
function slotAccepts(ref,it){
  if(!it||!ref)return false;
  if(ref.area==='inv'||ref.area==='bag'||ref.area==='vault')return true;
  if(ref.area==='eq')return it.kind===ref.slot&&canEquip(it);
  return false;
}
function clampVitals(){if(!P)return;P.hp=Math.min(P.hp,eff('hp'));P.mp=Math.min(P.mp,eff('mp'));}
function equipRef(ref){
  const src=readItem(ref);if(!src)return false;
  if(!canEquip(src)){toast('Your class cannot use that','#ff8a8a');return false;}
  const fromChest=ref.area==='chest';
  const it=fromChest?cloneItem(src):src;
  const old=P.eq[it.kind]||null;
  if(fromChest){
    if(old){const s=P.inv.indexOf(null);if(s<0){toast('Inventory full','#ff8a8a');return false;}P.eq[it.kind]=it;P.inv[s]=old;}
    else P.eq[it.kind]=it;
  }else{P.eq[it.kind]=it;writeItem(ref,old);}
  clampVitals();
  if(resists(P,'slow'))P.slow=0;
  toast('Equipped '+it.name,itemColor(it));AUD.equip();saveGame();return true;
}
function moveToFirstEmpty(ref){
  const src=readItem(ref);if(!src)return false;
  const fromChest=ref.area==='chest';
  const it=fromChest?cloneItem(src):src;
  const s=P.inv.indexOf(null);
  if(s<0){
    if((it.kind==='hp'||it.kind==='mp')&&potCount(it.kind)<9&&(it.kind==='hp'?P.hpPots:P.mpPots)<9){
      if(it.kind==='hp')P.hpPots++;else P.mpPots++;if(!fromChest)writeItem(ref,null);toast('Got '+it.name);AUD.pickup();saveGame();return true;}
    toast('Inventory full','#ff8a8a');return false;}
  if(!fromChest)writeItem(ref,null);
  P.inv[s]=it;
  toast('Got '+it.name+(tierLabel(it)?' ['+tierLabel(it)+']':''),itemColor(it));AUD.pickup();saveGame();return true;
}
function depositVault(ref,chest){
  const it=readItem(ref);if(!it||!chest)return false;
  const slots=vaultSlots(chest.i);if(!slots)return false;
  const s=slots.indexOf(null);
  if(s<0){toast('Chest full','#ff8a8a');return false;}
  writeItem(ref,null);slots[s]=it;saveVault();clampVitals();
  toast('Stored '+it.name,'#7dffe0');AUD.drop('cyan',false);saveGame();return true;
}
const POT_FX=POT_COL;
function raiseStat(k,gain){
  const cap=statCap(P.cls,k);
  if(P.stats[k]>=cap)return 0;
  const next=Math.min(cap,P.stats[k]+gain);
  const got=next-P.stats[k];
  P.stats[k]=next;
  return got;
}
function drinkRef(ref){
  const it=readItem(ref);if(!it)return false;
  const fromChest=ref.area==='chest';
  if(it.kind==='hp'){if(P.hp>=eff('hp')-0.01){toast('Already at full health');return false;}if(!fromChest)writeItem(ref,null);P.hp=Math.min(eff('hp'),P.hp+120);P.potsUsed++;addPT(P.x,P.y,'#ef243c',14,30);addDN(P.x,P.y,'+120','#5aff7a');AUD.potion();return true;}
  if(it.kind==='mp'){if(P.mp>=eff('mp')-0.01){toast('Already at full mana');return false;}if(!fromChest)writeItem(ref,null);P.mp=Math.min(eff('mp'),P.mp+100);P.potsUsed++;addPT(P.x,P.y,'#2f6bff',14,30);AUD.potion();return true;}
  if(it.kind==='elixir'){
    const k=it.stat,gain=(k==='hp'||k==='mp')?10:1,got=raiseStat(k,gain);
    if(!got){toast(STATN[k]+' maxed','#ffd34a');return false;}
    P.elixirs++;if(!fromChest)writeItem(ref,null);
    toast('Drank '+it.name,'#d68cff');addPT(P.x,P.y,POT_FX[ELIXIR_POT[k]]||'#d020d0',20,40);AUD.potion();return true;
  }
  if(it.kind==='mastery'){
    let raised=false;
    for(const k of STATK)if(raiseStat(k,statCap(P.cls,k)))raised=true;
    if(!raised){toast('Already maxed','#ffd34a');return false;}
    if(!fromChest)writeItem(ref,null);
    P.elixirs++;P.hp=eff('hp');P.mp=eff('mp');
    toast('Every stat is maxed','#ffd34a');addPT(P.x,P.y,POT_FX.mastery,28,50);addFX(P.x,P.y,4,36,0.6,'#ffd34a');AUD.potion();return true;
  }
  return false;
}
function nearOpenBag(){
  let b=null,bd=18;
  if(!world||!P)return null;
  for(const g of world.bags){
    if(!g.items||g.items.length>=8)continue;
    const d=Math.hypot(g.x-P.x,g.y-P.y);
    if(d<bd){bd=d;b=g;}
  }
  return b;
}
function dropIntoBag(ref,bag){
  const it=readItem(ref);if(!it||!bag)return false;
  if(bag.items.length>=8){toast('Bag full','#ff8a8a');return false;}
  writeItem(ref,null);bag.items.push(it);bag.col=bagColor(bag.items);bag.t=Math.max(bag.t,60);
  clampVitals();toast('Dropped '+it.name);playDropSound([it]);return true;
}
function dropOnGround(ref){
  const it=readItem(ref);
  if(!it||!P||!world||!ref||ref.area==='chest'||ref.area==='bag'||ref.area==='vault')return false;
  const dest=nearOpenBag();
  if(dest){
    writeItem(ref,null);dest.items.push(it);dest.col=bagColor(dest.items);dest.t=Math.max(dest.t,60+Math.random()*30);
    clampVitals();toast('Dropped '+it.name);playDropSound([it]);
    return true;
  }
  writeItem(ref,null);
  spawnLootBag(P.x,P.y,[it],60+Math.random()*30);
  clampVitals();toast('Dropped '+it.name);playDropSound([it]);
  return true;
}
function tapRef(ref){
  const it=readItem(ref);if(!it)return;
  if(it.kind==='beaconkey'){
    if(ref.area==='chest'||ref.area==='bag'||ref.area==='vault'){moveToFirstEmpty(ref);return;}
    unlockAllBeacons();writeItem(ref,null);saveGame();return;
  }
  if(it.kind==='dungeonkey'){
    if(ref.area==='chest'||ref.area==='bag'||ref.area==='vault'){moveToFirstEmpty(ref);return;}
    if(!world||world.isHub||world.isVault||world.isDungeon||world!==realm){toast('Use this key in the Shardwild','#ffb347');return;}
    openDungeonPortal(world,P.x,P.y,it.dungeon||'tideclaw');
    writeItem(ref,null);saveGame();return;
  }
  if(it.kind==='hp'||it.kind==='mp'||it.kind==='elixir'||it.kind==='mastery'){
    if(ref.area==='bag'||ref.area==='chest'||ref.area==='vault'){moveToFirstEmpty(ref);return;}
    drinkRef(ref);saveGame();return;
  }
  if(ref.area==='eq')return;
  if(canEquip(it)&&isUpgrade(it)){equipRef(ref);return;}
  if(ref.area==='bag'||ref.area==='chest'||ref.area==='vault'){moveToFirstEmpty(ref);return;}
  if(ref.area==='inv'){
    const v=nearVaultChest();
    if(v){depositVault(ref,v);return;}
    const bag=nearBag();
    if(bag){dropIntoBag(ref,bag);return;}
    if(canEquip(it)){equipRef(ref);return;}
    toast('Your class cannot use that','#ff8a8a');
  }
}
function dragMove(src,dst){
  if(!src||!dst)return;
  if(src.area===dst.area&&src.i===dst.i&&src.slot===dst.slot&&src.bag===dst.bag&&src.chest===dst.chest)return;
  if(dst.area==='chest')return;
  const raw=readItem(src);if(!raw)return;
  const fromChest=src.area==='chest';
  const a=fromChest?cloneItem(raw):raw;
  if(dst.area==='bag'&&dst.bag&&dst.i>=dst.bag.items.length){
    if(!slotAccepts(dst,a))return;
    if(dst.bag.items.length>=8){toast('Bag full','#ff8a8a');return;}
    if(!fromChest)writeItem(src,null);
    if(world.bags.indexOf(dst.bag)>=0)dst.bag.items.push(a);saveGame();return;
  }
  if(!slotAccepts(dst,a)){toast('That does not fit there','#ff8a8a');return;}
  const b=readItem(dst);
  if(!b){writeItem(dst,a);if(!fromChest)writeItem(src,null);clampVitals();saveGame();return;}
  if(fromChest){
    const empty=P.inv.indexOf(null);
    if(empty<0){toast('Inventory full','#ff8a8a');return;}
    P.inv[empty]=b;writeItem(dst,a);clampVitals();saveGame();return;
  }
  if(!slotAccepts(src,b)){toast('Cannot swap those','#ff8a8a');return;}
  writeItem(src,b);writeItem(dst,a);clampVitals();saveGame();
}
function takeFirstBag(){const bag=nearBag();if(bag&&bag.items.length)tapRef({area:'bag',i:0,bag});}
function nearChest(){
  if(!world||!world.chest||!P||world.isVault)return null;
  return Math.hypot(world.chest.x-P.x,world.chest.y-P.y)<22?world.chest:null;
}
function nearVaultChest(){
  if(!world||!world.isVault||!world.chests||!P)return null;
  let best=null,bd=14;
  for(const c of world.chests){
    const d=Math.hypot(c.x-P.x,c.y-P.y);
    if(d<bd){bd=d;best=c;}
  }
  return best;
}
function touchChest(){
  const on=!!nearChest();
  if(on&&!chestNear&&P){chestTab=P.cls;chestPage=0;}
  chestNear=on;
}
const BEACON_SAFE=12*TS;
const BEACON_ALL=['shore','green','ashen','star'];
let mapOpen=false,tpFlash=0;
function beaconUnlocked(id){return !!(P&&P.beacons&&P.beacons.indexOf(id)>=0);}
function unlockBeacon(b){
  if(!P||!b||beaconUnlocked(b.id))return;
  P.beacons.push(b.id);
  toast('Beacon unlocked: '+b.name,'#7af0ff');
  AUD.beacon();
  saveGame();
}
function unlockAllBeacons(){
  if(!P)return;
  if(!Array.isArray(P.beacons))P.beacons=[];
  let n=0;
  for(const id of BEACON_ALL)if(P.beacons.indexOf(id)<0){P.beacons.push(id);n++;}
  toast(n?'All beacons unlocked':'Beacons already unlocked','#7af0ff');
  if(n)AUD.beacon();
  saveGame();
}
function inBeaconSafe(x,y){
  const list=world&&world.beacons;if(!list)return false;
  for(const b of list){const dx=x-b.x,dy=y-b.y;if(dx*dx+dy*dy<BEACON_SAFE*BEACON_SAFE)return true;}
  return false;
}
function shoveOffBeacons(e){
  if(!world||!world.beacons||e.d.boss)return;
  for(const b of world.beacons){
    let dx=e.x-b.x,dy=e.y-b.y,d=Math.hypot(dx,dy);
    if(d>=BEACON_SAFE)continue;
    if(d<0.5){dx=1;dy=0;d=1;}
    const dist=BEACON_SAFE-d+1;
    if(!moveEnt(e,dx/d*dist,dy/d*dist,e.d.r*0.6))moveEnt(e,-dy/d*dist,dx/d*dist,e.d.r*0.6);
  }
}
function openMap(){
  if(state!=='play'||layoutC.portrait)return;
  mapOpen=true;input.move.id=null;input.aim.id=null;input.mouse.down=false;ptr=null;heldTip=null;
}
function closeMap(){mapOpen=false;ptr=null;input.move.id=null;input.aim.id=null;input.mouse.down=false;}
function teleportBeacon(b){
  if(!b||!P)return;
  if(!beaconUnlocked(b.id)){toast('That beacon is locked. Walk up to the pillar.','#aaa');return;}
  if(b.place==='hub'){if(!hub)hub=genHub();if(world!==hub){world=hub;clearBullets();}}
  else{
    if(!realm){realm=genRealm(P.seed);spawnBoss(realm);}
    if(world!==realm){world=realm;clearBullets();}
  }
  P.x=b.x;P.y=b.y;P.invuln=Math.max(P.invuln,3.5);tpFlash=1;mapOpen=false;
  input.move.id=null;input.aim.id=null;input.mouse.down=false;ptr=null;ebN=0;
  if(world.enemies)for(const e of world.enemies)shoveOffBeacons(e);
  addFX(b.x,b.y,6,36,0.7,'#7af0ff');addPT(b.x,b.y,'#7af0ff',18,50);
  AUD.teleport();
  toast('Warped to '+b.name,'#7af0ff');
  saveGame();
}
function explorePrefix(){
  if(!world)return 'r:';
  if(world.isVault)return 'v:';
  if(world.isHub)return 'h:';
  if(world.isDungeon)return 'd:';
  return 'r:';
}
function worldPOIs(){
  if(!world)return [];
  if(world.isDungeon){
    const list=[];
    if(world.boss){const den=DUNGEONS[world.dungeonId]||DUNGEONS.tideclaw;list.push({id:'d:boss',x:world.boss.x,y:world.boss.y,name:(EN[den.boss]&&EN[den.boss].name)||'Old Tideclaw',boss:true,always:true,dungeon:true});}
    if(world.exitOpen&&world.exit)list.push({id:'d:exit',x:world.exit.x,y:world.exit.y,name:'Haven',always:true});
    return list;
  }
  if(world.isVault){
    const list=[];
    if(world.portal)list.push({id:'v:exit',x:world.portal.x,y:world.portal.y,name:'Exit'});
    for(const c of world.chests||[])list.push({id:'v:chest'+c.i,x:c.x,y:c.y,name:'Chest '+(c.i+1)});
    return list;
  }
  if(world.isHub){
    const c=world.chest,f=world.fountain,p=world.portal,v=world.vault;
    const list=[];
    if(p)list.push({id:'h:portal',x:p.x,y:p.y,name:'Portal'});
    if(v)list.push({id:'h:vault',x:v.x,y:v.y,name:'Vault'});
    if(f)list.push({id:'h:fountain',x:f.x,y:f.y,name:'Fountain'});
    if(c)list.push({id:'h:chest',x:c.x,y:c.y,name:'Test Chest'});
    return list;
  }
  const list=[];
  if(world.boss)list.push({id:'r:boss',x:world.boss.x,y:world.boss.y,name:'Hollow Guard',boss:true,always:true});
  if(world.entry)list.push({id:'r:entry',x:world.entry.x,y:world.entry.y,name:'Shore Entry'});
  for(const lm of world.landmarks||[])list.push({id:lm.id,x:lm.x,y:lm.y,name:lm.name});
  for(const p of world.portals||[])list.push({id:'r:port'+Math.round(p.x)+','+Math.round(p.y),x:p.x,y:p.y,name:p.name,always:true,portal:true});
  return list;
}
function poiSeen(id){return !!(P&&P.seen&&P.seen.indexOf(id)>=0);}
function revealDungeonRoom(){
  if(!P||!world||!world.isDungeon||!world.rooms)return;
  if(!P.explored||typeof P.explored!=='object')P.explored={};
  const tx=P.x/TS,ty=P.y/TS,CELL=16;
  for(const r of world.rooms){
    if(r.seen||tx<r.x0||ty<r.y0||tx>=r.x1||ty>=r.y1)continue;
    r.seen=true;
    for(let y=r.y0;y<r.y1;y++)for(let x=r.x0;x<r.x1;x++)P.explored['d:'+Math.floor(x/CELL)+','+Math.floor(y/CELL)]=1;
    return;
  }
}
function noteDiscoveries(){
  if(!P||!world)return;
  if(!Array.isArray(P.seen))P.seen=[];
  if(!P.explored||typeof P.explored!=='object')P.explored={};
  const prefix=explorePrefix();
  const CELL=16;
  P.explored[prefix+Math.floor(P.x/TS/CELL)+','+Math.floor(P.y/TS/CELL)]=1;
  revealDungeonRoom();
  for(const poi of worldPOIs()){
    if(poi.always||poi.boss)continue;
    if(Math.hypot(poi.x-P.x,poi.y-P.y)<30&&P.seen.indexOf(poi.id)<0){P.seen.push(poi.id);toast('Discovered '+poi.name,'#ffe9a0');}
  }
  for(const b of world.beacons||[])if(Math.hypot(P.x-b.x,P.y-b.y)<18)unlockBeacon(b);
}

function update(dt){
  if(layoutC.portrait){mapOpen=false;return;}
  if(mapOpen){
    if(P)P.invuln=Math.max(P.invuln,0.35);
    if(tpFlash>0)tpFlash=Math.max(0,tpFlash-dt*1.3);
    return;
  }
  if(ptr&&ptr.ref&&!ptr.dragged&&performance.now()-ptr.t0>450)ptr.tip=true;
  if(heldTip&&(performance.now()>heldTip.until||!readItem(heldTip.ref)))heldTip=null;
  time+=dt;
  for(const t of toasts)t.life-=dt;toasts=toasts.filter(t=>t.life>0);
  if(state==='dead'){deathInfo.t+=dt;updateParticles(dt);return;}
  if(state!=='play')return;
  const inRealm=world===realm;
  if(inRealm)P.time+=dt;
  // movement
  let mx=0,my=0;const K=input.keys;
  if(K.KeyA||K.ArrowLeft)mx-=1;if(K.KeyD||K.ArrowRight)mx+=1;if(K.KeyW||K.ArrowUp)my-=1;if(K.KeyS||K.ArrowDown)my+=1;
  if(input.move.id!==null){const R=layoutC.stickR;mx=(input.move.x-input.move.ox)/R;my=(input.move.y-input.move.oy)/R;}
  let ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;ml=1;}
  if(ml<0.12){mx=my=0;ml=0;}
  if(P.stun>0||P.para>0){mx=my=0;ml=0;}
  const sp=(35+eff('spd')*1.8)*(P.slow>0?0.5:1);
  P.moving=ml>0;if(mx)P.face=mx>0?1:-1;
  moveEnt(P,mx*sp*dt,my*sp*dt,3);
  // aim & fire
  let firing=false;
  if(input.aim.id!==null){const ax=input.aim.x-input.aim.ox,ay=input.aim.y-input.aim.oy;if(Math.hypot(ax,ay)>layoutC.stickR*0.25){P.aim=Math.atan2(ay,ax);firing=true;}}
  else if(input.mouse.active&&!ptr){const p=w2s(P.x,P.y);P.aim=Math.atan2(input.mouse.y-p.y,input.mouse.x-p.x);firing=input.mouse.down;}
  if(!firing&&P.auto&&!peaceful()){let best=null,bd=115;for(const e of world.enemies){const d=Math.hypot(e.x-P.x,e.y-P.y);if(d<bd){bd=d;best=e;}}if(best){P.aim=Math.atan2(best.y-P.y,best.x-P.x);firing=true;}}
  if(K.Space)firing=firing||false;
  if(P.stun>0||P.para>0)firing=false;
  P.firing=firing;
  if(firing&&!mx)P.face=Math.cos(P.aim)>=0?1:-1;
  P.fireCd-=dt;
  const w=P.eq.weapon;
  if(firing&&w&&P.fireCd<=0){
    const rate=(1.5+eff('dex')*0.05)*w.rate;P.fireCd=1/rate;
    fireWeapon(w);
    AUD.shoot(P.cls);
  }
  // regen & timers
  P.hp=Math.min(eff('hp'),P.hp+(1+eff('vit')*0.15)*dt);P.mp=Math.min(eff('mp'),P.mp+(1+eff('wis')*0.15)*dt);
  P.abCd-=dt;P.slow=Math.max(0,P.slow-dt);P.stun=Math.max(0,P.stun-dt);P.para=Math.max(0,P.para-dt);P.weak=Math.max(0,P.weak-dt);P.berserk=Math.max(0,P.berserk-dt);P.invis=Math.max(0,P.invis-dt);P.invuln-=dt;if(P.hurt)P.hurt-=dt;if(P.atkHold>0)P.atkHold=Math.max(0,P.atkHold-dt);
  if(P.poison>0){P.poison=Math.max(0,P.poison-dt);P.poisonAcc=(P.poisonAcc||0)+dt;if(P.poisonAcc>=0.45){P.poisonAcc-=0.45;hurtPlayer(Math.max(8,Math.round((P.poisonDmg||28)*0.35)),'venom');}}
  if(tpFlash>0)tpFlash=Math.max(0,tpFlash-dt*1.3);
  touchChest();noteDiscoveries();
  if(world.isHub){
    if(Math.hypot(P.x-world.fountain.x,P.y-world.fountain.y)<22){P.hp=Math.min(eff('hp'),P.hp+150*dt);P.mp=Math.min(eff('mp'),P.mp+150*dt);}
  }else if(world.isDungeon){
    const gt=tileAt(world,P.x,P.y);
    if(gt===T_HSHALLOW)P.slow=Math.max(P.slow,0.45);
    for(const c of world.lootChests||[]){
      if(c.open||Math.hypot(P.x-c.x,P.y-c.y)>=16)continue;
      c.open=true;
      const items=tideChestLoot();
      if(items.length){spawnLootBag(c.x,c.y,items,120);playDropSound(items);}
      const theme=world.theme;
      toast(theme==='hex'?'A hexed chest cracks open':theme==='cinder'?'A hive cache splits':theme==='sanctum'?'A rune coffer opens':theme==='coil'?'A jade coffer cracks open':theme==='throne'?'A royal coffer cracks open':'A tide chest cracks open','#ffd34a');
    }
    if(world.theme==='throne'&&tileAt(world,P.x,P.y)===T_MRIFT){
      P.riftAcc=(P.riftAcc||0)+dt;
      if(P.riftAcc>=0.4){P.riftAcc=0;hurtPlayer(26,'the rift');}
    }
  }else if(!world.isVault){
    const z=zoneAt(world,P.x,P.y);if(z>P.maxZone){P.maxZone=z;toast('Now entering '+ZONES[z].name,ZONES[z].col);}
    spawner(dt);
    tickEvents(dt);
    if(world.portals){
      for(let i=world.portals.length-1;i>=0;i--){
        const p=world.portals[i];
        p.t-=dt;p.delay-=dt;
        if(p.t<=0)world.portals.splice(i,1);
      }
    }
  }
  updateEnemies(dt);
  updateBullets(dt);
  for(let i=world.bags.length-1;i>=0;i--){world.bags[i].t-=dt;if(world.bags[i].t<=0)world.bags.splice(i,1);}
  updateParticles(dt);
  questT-=dt;if(questT<=0){questT=0.5;findQuest();}
  saveT-=dt;if(saveT<=0){saveT=10;saveGame();}
}
function inSafe(x,y){const e=world&&world.entry;if(!e)return false;return Math.hypot(x-e.x,y-e.y)<ENTRY_SAFE;}
const EVENT_ORDER=['saltwyrm','drownedcaptain','briarstag','eldertreant','ashphoenix','obsidiangolem','marblesphinx','fallenseraph'];
function clearPct(k){const p=clamp(k|0,0,8)/8*100;return Math.abs(p-Math.round(p))<0.05?String(Math.round(p)):p.toFixed(1);}
function noteRealmClear(){
  if(!realm)return;
  const n=Math.min(8,(realm.clearKills||0)+1);
  realm.clearKills=n;
  if(P)P.realmClear=n;
  if(n>=8&&!realm.boss){
    spawnBoss(realm);
    toast('The Shardwild is cleared. Morvane, the Hollow Guard rises!','#c46aff');
    if(toasts.length)toasts[toasts.length-1].life=4.6;
    AUD.roar();
  }
}
function tickEvents(dt){
  const wd=world;
  if(!wd||wd!==realm)return;
  wd.eventT=(wd.eventT==null?100:wd.eventT)-dt;
  if(wd.eventT>0)return;
  wd.eventT=rand(80,120);
  if(wd.enemies.some(e=>e.d.event))return;
  const ix=(wd.eventIx||0)%EVENT_ORDER.length;
  wd.eventIx=ix+1;
  const type=EVENT_ORDER[ix];
  const d=EN[type];
  if(!d)return;
  const z=d.zone|0;
  const spots=(wd.lairs||[]).filter(l=>l.event===type&&!l.busy);
  let x,y,spot=null;
  if(spots.length){
    spot=pick(spots);
    x=spot.x;y=spot.y;
  }else{
    const dd=[0.84,0.62,0.40,0.18][z];
    let found=false;
    for(let n=0;n<24&&!found;n++){
      const a=Math.random()*TAU;
      const rad=dd*(wd.w/2)*TS+rand(-50,50);
      x=wd.cx+Math.cos(a)*rad;y=wd.cy+Math.sin(a)*rad;
      if(zoneAt(wd,x,y)!==z||solidBox(wd,x,y,10))continue;
      if(Math.hypot(x-P.x,y-P.y)<160)continue;
      if(inSafe(x,y)||inBeaconSafe(x,y))continue;
      found=true;
    }
    if(!found)return;
  }
  if(Math.hypot(x-P.x,y-P.y)<40)return;
  const e=spawnEnemy(wd,type,x,y,z,false);
  e.homeX=x;e.homeY=y;
  if(spot){spot.busy=true;e.lair=spot;}
  toast(d.announce,d.phaseCol||'#ffd34a');
  toasts[toasts.length-1].life=4.4;
  AUD.roar();
}
function zoneCount(z){let n=0;for(const e of world.enemies)if(!e.d.boss&&!e.d.event&&e.zone===z)n++;return n;}
function spawner(dt){
  const wd=world;spawnT-=dt;
  const far=Math.max(VW,VH)*0.9+100;
  for(let i=wd.enemies.length-1;i>=0;i--){const e=wd.enemies[i];if(!e.d.boss&&!e.d.event&&Math.hypot(e.x-P.x,e.y-P.y)>far)wd.enemies.splice(i,1);}
  const z=zoneAt(wd,P.x,P.y);if(z<0)return;
  const cfg=SPAWN_CFG[z];
  if(inSafe(P.x,P.y)||inBeaconSafe(P.x,P.y)){spawnT=Math.max(spawnT,cfg.every);return;}
  if(spawnT>0)return;
  spawnT=cfg.every*(0.85+Math.random()*0.3);
  let alive=0;for(const e of wd.enemies)if(!e.d.boss&&!e.d.event)alive++;
  if(alive>=58||zoneCount(z)>=cfg.cap)return;
  for(let t=0;t<8;t++){
    const a=Math.random()*TAU,dist=rand(cfg.dist[0],cfg.dist[1]);
    const x=P.x+Math.cos(a)*dist,y=P.y+Math.sin(a)*dist;
    if(solidBox(wd,x,y,5))continue;
    if(zoneAt(wd,x,y)!==z)continue;
    if(wd.cx!=null&&Math.hypot(x-wd.cx,y-wd.cy)<22*TS)continue;
    if(inSafe(x,y)||inBeaconSafe(x,y))continue;
    const type=pick(ZONES[z].types);
    const n=irand(cfg.n[0],cfg.n[1]);
    let spawned=0;
    for(let k=0;k<n&&zoneCount(z)<cfg.cap;k++){
      const spread=n>2?22:16;
      const ex=x+rand(-spread,spread),ey=y+rand(-spread,spread);
      if(solidBox(wd,ex,ey,4)||inSafe(ex,ey)||inBeaconSafe(ex,ey)||zoneAt(wd,ex,ey)!==z)continue;
      spawnEnemy(wd,type,ex,ey,z,k===0&&cfg.elite>0&&Math.random()<cfg.elite);
      spawned++;
    }
    if(spawned)break;
  }
}
function shoot(e,p,ang,i){
  const dm=e.dmgMul*(e.weak>0?0.5:1),nm=e.name;
  if(p.t!=='summon'){e.atkPose=3;e.atkHold=ATK_FIRE;}
  if(p.t==='aim'){const n=p.n||1,sp=(p.sp||0)*Math.PI/180;for(let k=0;k<n;k++)addEB(e.x,e.y,ang+(k-(n-1)/2)*sp,p.spd,p.dmg*dm,p.r,p.life,p.col,p,nm);}
  else if(p.t==='ring'){let off=0;if(p.alt){e.alt^=1;off=e.alt*Math.PI/p.n;}for(let k=0;k<p.n;k++)addEB(e.x,e.y,off+k*TAU/p.n,p.spd,p.dmg*dm,p.r,p.life,p.col,p,nm);}
  else if(p.t==='spiral'){e.spin[i]+=p.rot;for(let k=0;k<p.arms;k++)addEB(e.x,e.y,e.spin[i]+k*TAU/p.arms,p.spd,p.dmg*dm,p.r,p.life,p.col,p,nm);}
  else if(p.t==='summon'){const cap=p.cap||12;if(world.enemies.length<cap)for(let k=0;k<p.n;k++)spawnEnemy(world,p.type,e.x+rand(-28,28),e.y+rand(-28,28),e.zone,false);}
  else if(p.t==='segs'&&e.segs){const every=p.every||2;for(const s of e.segs){if((s.i%every)!==(e.alt%every))continue;for(let k=0;k<p.n;k++)addEB(s.x,s.y,k*TAU/p.n,p.spd,p.dmg*dm,p.r,p.life,p.col,p,nm);}e.alt^=1;}
  else if(p.t==='gap'){
    e.spin[i]=(e.spin[i]||0)+(p.rot||0.2);
    const n=p.n||18,gap=p.gap||4,start=((e.spin[i]*n/TAU)%n+n)%n;
    for(let k=0;k<n;k++){
      const rel=(k-start+n)%n;
      if(rel<gap)continue;
      addEB(e.x,e.y,k*TAU/n,p.spd,p.dmg*dm,p.r,p.life,p.col,p,nm);
    }
  }
  else if(p.t==='crown')throwCrown(e,ang,p,dm);
}
const LEASH_MARGIN=4*TS;
const LEASH_DESPAWN=18*TS;
function leashMode(e){
  if(!world||world.isHub||world.isVault||world.isDungeon||e.zone==null||e.zone<0)return 'free';
  if(e.homeX==null){e.homeX=e.ax;e.homeY=e.ay;}
  if(zoneAt(world,e.x,e.y)===e.zone){e.homeX=e.x;e.homeY=e.y;return 'home';}
  const dist=Math.hypot(e.x-e.homeX,e.y-e.homeY);
  if(dist<=LEASH_MARGIN)return 'margin';
  if(!e.d.boss&&!e.d.event&&dist>=LEASH_DESPAWN)return 'despawn';
  return 'return';
}
function despawnLeashed(e){
  e.dead=true;
  const i=world.enemies.indexOf(e);
  if(i>=0)world.enemies.splice(i,1);
}
function stepSerpent(e){
  if(!e.trail)e.trail=[];
  const last=e.trail[e.trail.length-1];
  // v25 dropped a point every 3px under a ~16px segment. The 25px body keeps that gap-to-width ratio.
  if(!last||Math.hypot(e.x-last.x,e.y-last.y)>4.7)e.trail.push({x:e.x,y:e.y});
  const n=e.d.segments||12,gap=3,cap=n*gap+8;
  if(e.trail.length>cap)e.trail.splice(0,e.trail.length-cap);
  e.segs=[];
  for(let i=0;i<n;i++){
    const idx=e.trail.length-1-(i+1)*gap;
    const p=idx>=0?e.trail[idx]:(e.trail[0]||{x:e.x,y:e.y});
    const last=i===n-1;
    e.segs.push({i,x:p.x,y:p.y,r:last?5:i<5?8:i<9?7:6});
  }
}
function throwCrown(e,ang,dmg){
  addEB(e.x,e.y,ang,78,dmg,4,2.4,'#ffd34a',null,e.name);
  if(!ebN)return;
  const b=EB[ebN-1];
  b.crown=1;b.ox=e.x;b.oy=e.y;b.ang=ang;b.spd=78;b.age=0;b.r=4;
  b.spr=bulletSpr('#ffd34a',4,'crown');
  e.atkPose=3;e.atkHold=ATK_FIRE;
}
function fireGapAt(e,x,y,n,gap,rot,spd,dmg,col){
  e.gapSpin=(e.gapSpin||0)+rot;
  const start=((e.gapSpin*n/TAU)%n+n)%n;
  for(let k=0;k<n;k++){
    if(((k-start)%n+n)%n<gap)continue;
    addEB(x,y,e.gapSpin+k*TAU/n,spd,dmg,2.7,1.75,col,null,e.name);
  }
  e.atkPose=3;e.atkHold=0.12;
}
function megaSpr(phase){return phase<=2?'megaking_p1':phase===3?'megaking_p2':phase===4?'megaking_p3':'megaking_p4';}
function breakMegaShield(e){
  if(!e||!e.shield)return;
  e.shield=false;
  if(e.mkPhase===1){
    e.mkPhase=2;e.sprName='megaking_p1';
    toast('The wardens fall. The Mega King walks.','#ffd34a');
  }else toast('The pylons shatter. The shield breaks.','#ff4fa8');
  AUD.phase();
  addFX(e.x,e.y,6,36,0.55,'#ffd34a');
}
function collapsePillars(wd){
  if(!wd||wd.pillarsDown)return;
  wd.pillarsDown=true;
  for(const p of wd.pillars||[]){
    if(p.y>0&&p.x>0&&wd.tiles[p.y*wd.w+p.x]===T_MPILLAR)wd.tiles[p.y*wd.w+p.x]=T_MBROKEN;
  }
  refreshDungeon(wd);
}
function creepRift(wd,dt){
  if(!wd||wd.riftReach==null||wd.riftReach<=wd.riftSafe)return;
  wd.riftT=(wd.riftT==null?0.4:wd.riftT)-dt;
  if(wd.riftT>0)return;
  wd.riftT=1.15;
  wd.riftReach=Math.max(wd.riftSafe,wd.riftReach-0.9);
  const cx=wd.cxTile,cy=wd.cyTile,R=wd.hallR;
  let changed=false;
  for(let y=2;y<wd.h-2;y++)for(let x=2;x<wd.w-2;x++){
    const t=wd.tiles[y*wd.w+x];
    if(t===T_MWALL||t===T_MPILLAR||t===T_MPYLON||t===T_MRIFT)continue;
    if(Math.abs(x-cx)<=2)continue;
    const dist=Math.hypot(x-cx,y-cy);
    if(dist>wd.riftReach&&dist<=R+0.8){wd.tiles[y*wd.w+x]=T_MRIFT;changed=true;}
  }
  if(changed)refreshDungeon(wd);
}
function stepPylons(e,dt){
  const wd=world;if(!wd||e.mkPhase!==3)return;
  let alive=0;
  for(const p of wd.pylons||[]){
    if(p.dead)continue;
    alive++;
    p.spin=(p.spin||Math.random()*TAU)+dt*0.85;
    p.cd=(p.cd||0.2)-dt;
    if(p.cd>0)continue;
    p.cd=0.24;
    const n=16,gap=4,ox=(p.x+0.5)*TS,oy=(p.y+0.5)*TS;
    const start=Math.floor(((p.spin*n/TAU)%n+n)%n);
    for(let k=0;k<n;k++){
      if(((k-start)%n+n)%n<gap)continue;
      addEB(ox,oy,p.spin*0.2+k*TAU/n,66,62,2.6,2.15,'#ff4fa8',null,'Shard Pylon');
    }
  }
  if(!alive&&e.shield)breakMegaShield(e);
}
function spawnCourt(e){
  const wd=world;if(!wd||!wd.hall)return;
  let n=0;for(const o of wd.enemies)if(!o.d.boss&&!o.warden)n++;
  if(n>12)return;
  const type=pick(['shardguard','crystalcaster','royalhound','shardherald']);
  const a=Math.random()*TAU,rad=78+Math.random()*36;
  const x=wd.hall.x+Math.cos(a)*rad,y=wd.hall.y+Math.sin(a)*rad;
  if(solidBox(wd,x,y,6))return;
  spawnEnemy(wd,type,x,y,0,false);
}
function megaAttack(e,dt){
  if(!e.acd)e.acd={spiral:0.3,aim:1,crown:2.2,ring:0.4,summon:3,ghost:0.4};
  const ang=Math.atan2(P.y-e.y,P.x-e.x);
  const dm=e.dmgMul*(e.weak>0?0.5:1);
  const tick=(key,cd)=>{e.acd[key]-=dt;if(e.acd[key]>0)return false;e.acd[key]=cd;return true;};
  if(e.mkPhase===2){
    e.spT=(e.spT||0)+dt;
    if((e.spT%1.9)<1.15&&tick('spiral',0.14)){
      e.spinA=(e.spinA||0)+0.32;e.spinB=(e.spinB||0)-0.32;
      addEB(e.x,e.y,e.spinA,76,64*dm,2.5,1.7,'#c46aff',null,e.name);
      addEB(e.x,e.y,e.spinA+Math.PI,76,64*dm,2.5,1.7,'#c46aff',null,e.name);
      addEB(e.x,e.y,e.spinB,76,64*dm,2.5,1.7,'#ff4fa8',null,e.name);
      addEB(e.x,e.y,e.spinB+Math.PI,76,64*dm,2.5,1.7,'#ff4fa8',null,e.name);
      e.atkPose=3;e.atkHold=0.1;
    }
    if(e.acd.crown<0.32)e.atkPose=2;
    if(tick('aim',1.65)){
      for(let k=0;k<5;k++)addEB(e.x,e.y,ang+(k-2)*0.16,124,72*dm,2.6,1.3,'#ffd34a',null,e.name);
    }
    if(tick('crown',4.6))throwCrown(e,ang,76*dm);
  }else if(e.mkPhase===3){
    stepPylons(e,dt);
    if(!e.shield){
      if(tick('ring',1.45))fireGapAt(e,e.x,e.y,18,4,0.42,60,68*dm,'#ffd34a');
      if(tick('aim',1.8))for(let k=0;k<3;k++)addEB(e.x,e.y,ang+(k-1)*0.14,118,70*dm,2.6,1.25,'#ffb8cc',null,e.name);
      if(tick('summon',7.2))spawnCourt(e);
    }
  }else if(e.mkPhase===4){
    if(tick('ring',0.82))fireGapAt(e,e.x,e.y,22,5,0.62,92,74*dm,'#ff4fa8');
    if(tick('aim',1.35))for(let k=0;k<3;k++)addEB(e.x,e.y,ang+(k-1)*0.18,136,70*dm,2.5,1.1,'#ffffff',null,e.name);
  }else if(e.mkPhase===5){
    const spots=[{x:e.x,y:e.y}].concat(e.ghosts||[]);
    if(tick('ghost',0.72)){
      for(const s of spots){
        fireGapAt(e,s.x,s.y,14,4,0.5,86,74*dm,'#ffb8cc');
        addEB(s.x,s.y,Math.atan2(P.y-s.y,P.x-s.x),146,78*dm,2.5,1.05,'#ffd34a',null,e.name);
      }
    }
  }
}
function stepGhosts(e,hall){
  const base=time*0.32;
  const slots=[0,1,2].map(i=>{const a=base+i*TAU/3;return {x:hall.x+Math.cos(a)*56,y:hall.y+Math.sin(a)*44};});
  if(e.slot==null)e.slot=0;
  e.ghostT=(e.ghostT||0)+0;
  e.swap=(e.swap||0);
  if((e.swapT=(e.swapT||0)+1)>0){}
  e.gx=slots[e.slot].x;e.gy=slots[e.slot].y;
  e.ghosts=slots.filter((_,i)=>i!==e.slot);
  return slots;
}
function stepMega(e,dt){
  const wd=world;
  if(e.mkPhase==null){e.mkPhase=1;e.shield=true;e.sprName='megaking_p1';}
  const frac=e.hp/Math.max(1,e.maxhp);
  let phase=e.mkPhase;
  if(phase>=2&&phase<3&&frac<=0.7)phase=3;
  else if(phase>=2&&phase<4&&frac<=0.45)phase=4;
  else if(phase>=2&&phase<5&&frac<=0.2)phase=5;
  if(phase!==e.mkPhase){
    e.mkPhase=phase;e.sprName=megaSpr(phase);
    if(phase===3){e.shield=true;toast(e.d.phaseLines[1],e.d.phaseCol);AUD.phase();}
    if(phase===4){e.shield=false;collapsePillars(wd);toast(e.d.phaseLines[2],e.d.phaseCol);AUD.phase();}
    if(phase===5){e.shield=false;e.slot=0;e.swapT=0;toast(e.d.phaseLines[3],e.d.phaseCol);AUD.phase();}
  }
  e.sprName=megaSpr(e.mkPhase);
  const hall=wd&&wd.hall?wd.hall:{x:e.ax,y:e.ay};
  const throne=wd&&wd.throne?wd.throne:{x:e.ax,y:e.ay};
  let tx=hall.x,ty=hall.y,sp=e.d.spd;
  if(e.mkPhase===1||e.mkPhase===3){tx=throne.x;ty=throne.y-6;}
  else if(e.mkPhase===2){const a=time*0.5;tx=hall.x+Math.cos(a)*52;ty=hall.y+Math.sin(a*1.13)*40;}
  else if(e.mkPhase===4){creepRift(wd,dt);const a=time*0.72;tx=hall.x+Math.cos(a)*28;ty=hall.y+Math.sin(a)*28;}
  else{
    e.swapT=(e.swapT||0)+dt;
    if(e.swapT>5.4){e.swapT=0;e.slot=((e.slot||0)+1+((Math.random()*2)|0))%3;addFX(e.x,e.y,3,10,0.25,'#ffd34a');}
    stepGhosts(e,hall);
    tx=e.gx;ty=e.gy;sp=e.d.spd*1.1;
  }
  if(e.mkPhase>1)megaAttack(e,dt);
  return {x:tx-e.x,y:ty-e.y,sp:sp};
}
function setupMega(wd){
  const king=wd.boss;
  if(!king)return;
  king.mkPhase=1;king.shield=true;king.sprName='megaking_p1';king.phase=-1;
  const hall=wd.hall,throne=wd.throne;
  king.x=throne.x;king.y=throne.y;king.ax=throne.x;king.ay=throne.y;
  for(const p of wd.pylons||[]){
    const dx=hall.x-(p.x+0.5)*TS,dy=hall.y-(p.y+0.5)*TS,len=Math.hypot(dx,dy)||1;
    const w=spawnEnemy(wd,'crownwarden',(p.x+0.5)*TS+dx/len*22,(p.y+0.5)*TS+dy/len*22,0,false);
    w.warden=true;w.homeX=w.x;w.homeY=w.y;
  }
}
function hurtPylon(wd,x,y,dmg){
  if(!wd||!wd.pylons||!wd.boss||wd.boss.mkPhase!==3)return false;
  const tx=Math.floor(x/TS),ty=Math.floor(y/TS);
  if(tileAt(wd,x,y)!==T_MPYLON)return false;
  const p=wd.pylons.find(o=>o.x===tx&&o.y===ty&&!o.dead);
  if(!p)return false;
  p.hp-=Math.max(1,Math.round(dmg||1));
  addPT(x,y,'#ffd34a',3,16);
  if(p.hp>0)return true;
  p.hp=0;p.dead=true;
  wd.tiles[ty*wd.w+tx]=T_MBROKEN;
  addPT((tx+0.5)*TS,(ty+0.5)*TS,'#ff4fa8',16,36);
  refreshDungeon(wd);
  if(wd.boss&&wd.pylons.every(o=>o.dead))breakMegaShield(wd.boss);
  return true;
}
function updateEnemies(dt){
  for(const e of world.enemies.slice()){
    if(e.dead)continue;
    const dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy)||1;const d0=e.d;
    e.flash-=dt;e.slow=Math.max(0,e.slow-dt);e.stun=Math.max(0,e.stun-dt);e.para=Math.max(0,e.para-dt);e.weak=Math.max(0,e.weak-dt);if(e.atkHold>0)e.atkHold=Math.max(0,e.atkHold-dt);
    if(e.poison>0){
      e.poison=Math.max(0,e.poison-dt);e.poisonAcc=(e.poisonAcc||0)+dt;
      if(e.poisonAcc>=0.45){e.poisonAcc-=0.45;dmgEnemy(e,e.poisonDmg||28,false);if(e.dead)continue;}
    }
    if(e.stun>0||e.para>0){if(d0.serpent)stepSerpent(e);continue;}
    const leash=leashMode(e);
    if(leash==='despawn'){despawnLeashed(e);continue;}
    let sp=d0.spd*(e.slow>0?0.45:1),vx=0,vy=0;
    const aggro=d0.aggro||(d0.boss?150:108);
    const returning=leash==='return';
    if(returning){
      const lx=e.homeX-e.x,ly=e.homeY-e.y,ld=Math.hypot(lx,ly)||1;
      vx=lx/ld*sp;vy=ly/ld*sp;
    }else if(d0.ai==='dash'){
      e.dash=(e.dash==null?rand(0.4,1.1):e.dash)-dt;
      if(e.dash<=0){e.dash=rand(1.1,1.8);e.dashLeft=0.32;}
      if(e.dashLeft>0){e.dashLeft-=dt;vx=dx/d*sp*2.6;vy=dy/d*sp*2.6;}
      else{vx=dx/d*sp*0.45;vy=dy/d*sp*0.45;}
    }else if(d0.ai==='boss'){
      if(!d0.mega){
      const f=e.hp/e.maxhp;let ph=0;while(ph<d0.phases.length-1&&f<=d0.phases[ph].above)ph++;
      if(ph!==e.phase){
        const prev=e.phase;e.phase=ph;e.pats=d0.phases[ph].pats;resetPats(e);
        if(ph>0){
          if(d0.phaseLines&&d0.phaseLines[ph-1])toast(d0.phaseLines[ph-1],d0.phaseCol||'#ffb070');
          else if(!d0.dungeonBoss)toast(ph===1?'Morvane: "You dare wound the Guard?"':'Morvane: "THE CROWN STILL DEMANDS YOUR SOUL!"','#c46aff');
        }
        if(prev>=0&&ph>prev)AUD.phase();
      }
      }
      if(d0.serpent){
        e.slither=(e.slither||0)+dt;
        if(e.phase===1){
          e.coil=(e.coil||0)+dt;
          if(e.coil<0.85){const a=e.slither*5.2;vx=e.ax+Math.cos(a)*16-e.x;vy=e.ay+Math.sin(a)*16-e.y;sp*=0.8;}
          else if(e.coil<1.35){vx=P.x-e.x;vy=P.y-e.y;sp*=2.8;}
          else e.coil=0;
        }else{
          const a=e.slither*0.85,rad=d0.orbit||78;
          vx=e.ax+Math.cos(a)*rad-e.x;vy=e.ay+Math.sin(a*0.82)*rad*0.72-e.y;
        }
      }else if(d0.mega){
        const mv=stepMega(e,dt,d);
        vx=mv.x;vy=mv.y;sp=mv.sp==null?sp:mv.sp;
      }else if(d0.dungeonBoss){const rad=d0.orbit||42,a=time*(d0.orbit>60?0.7:0.95);vx=e.ax+Math.cos(a)*rad-e.x;vy=e.ay+Math.sin(a*1.35)*(rad*0.43)-e.y;}
      else{const a=time*0.4;vx=world.cx+Math.cos(a)*22-e.x;vy=world.cy+Math.sin(a*1.3)*16-e.y;}
      const l=Math.hypot(vx,vy)||1;const s=Math.min(sp,l*2);vx=vx/l*s;vy=vy/l*s;
    }else if(P.invis>0){
      e.wt-=dt;if(e.wt<=0){e.wt=rand(1,2.4);e.dir=Math.random()*TAU;}
      vx=Math.cos(e.dir)*sp*0.35;vy=Math.sin(e.dir)*sp*0.35;
    }else if(d<aggro*1.3){
      if(d0.ai==='wander'){e.wt-=dt;if(e.wt<=0){e.wt=rand(1,2.5);e.dir=Math.atan2(dy,dx)+rand(-1.5,1.5);}vx=Math.cos(e.dir)*sp;vy=Math.sin(e.dir)*sp;}
      else if(d0.ai==='charge'){if(d>d0.keep){vx=dx/d*sp;vy=dy/d*sp;}}
      else if(d0.ai==='keep'){const s=d>d0.keep+10?1:d<d0.keep-10?-1:0;vx=dx/d*sp*s-dy/d*sp*0.5*Math.sin(time+e.id);vy=dy/d*sp*s+dx/d*sp*0.5*Math.sin(time+e.id);}
      else if(d0.ai==='orbit'){const s=d>d0.keep?0.7:-0.4;vx=dx/d*sp*s-dy/d*sp;vy=dy/d*sp*s+dx/d*sp;}
      else if(d0.ai==='chase'){vx=dx/d*sp;vy=dy/d*sp;}
    }else{e.wt-=dt;if(e.wt<=0){e.wt=rand(1,3);e.dir=Math.random()*TAU;}vx=Math.cos(e.dir)*sp*0.4;vy=Math.sin(e.dir)*sp*0.4;}
    if(!moveEnt(e,vx*dt,vy*dt,d0.r*0.6)&&(vx||vy))e.dir=Math.random()*TAU;
    if(d0.serpent)stepSerpent(e);
    shoveOffBeacons(e);
    if(returning){if(!(e.atkHold>0))e.atkPose=0;continue;}
    if(d0.mega)continue;
    if(d<aggro&&!peaceful()&&!(P.invis>0)){
      armAttack(e);
      const ang=Math.atan2(dy,dx);
      for(let i=0;i<e.pats.length;i++){const p=e.pats[i];
        if(p.burst){e.cyc[i]=(e.cyc[i]+dt)%(p.burst+p.rest);if(e.cyc[i]>p.burst)continue;}
        e.cd[i]-=dt;if(e.cd[i]<=0){e.cd[i]+=p.cd*(p.t==='spiral'?1:rand(0.85,1.15));if(e.cd[i]<0)e.cd[i]=p.cd;shoot(e,p,ang,i);}}
    }else if(!(e.atkHold>0))e.atkPose=0;
  }
}
function updateBullets(dt){
  const wd=world;
  for(let i=ebN-1;i>=0;i--){const b=EB[i];const x0=b.x,y0=b.y;
    if(b.crown){
      b.age=(b.age||0)+dt;
      const outT=1.05,backT=1.15;
      let dist=b.spd*Math.min(b.age,outT);
      if(b.age>outT)dist=b.spd*outT-b.spd*(b.age-outT);
      if(dist<0)dist=0;
      b.x=b.ox+Math.cos(b.ang)*dist;b.y=b.oy+Math.sin(b.ang)*dist;
      b.life-=dt;
    }else stepShot(b,dt);
    if(!b.crown)b.life-=dt;
    let kill=b.life<=0||(b.crown&&b.age>2.3);
    const wall=segmentBlocked(wd,x0,y0,b.x,b.y);
    if(wall){b.x=wall.x;b.y=wall.y;kill=true;addPT(b.x,b.y,'#d8d0ea',2,18);}
    if(!kill){const dx=b.x-P.x,dy=b.y-P.y,rr=b.r+2.5;if(dx*dx+dy*dy<rr*rr){if(P.invuln<=0){applyFx(P,b.fx);hurtPlayer(b.dmg,b.from);}kill=true;if(state!=='play')return;}}
    if(kill){const l=EB[--ebN];EB[i]=l;EB[ebN]=b;}}
  const en=wd.enemies;
  for(let i=pbN-1;i>=0;i--){const b=PB[i];const x0=b.x,y0=b.y;stepShot(b,dt);b.life-=dt;
    const wall=segmentBlocked(wd,x0,y0,b.x,b.y);
    let kill=b.life<=0||!!wall;
    if(wall){b.x=wall.x;b.y=wall.y;}
    if(wall){hurtBreak(wd,wall.x,wall.y,b.dmg);hurtPylon(wd,wall.x,wall.y,b.dmg);}
    if(!kill)for(let j=0;j<en.length;j++){const e=en[j];
      let hit=false;const dx=b.x-e.x,dy=b.y-e.y,rr=b.r+e.d.r*(e.elite?1.4:1);
      if(dx*dx+dy*dy<rr*rr)hit=true;
      else if(e.segs){for(const s of e.segs){const sx=b.x-s.x,sy=b.y-s.y,sr=b.r+s.r;if(sx*sx+sy*sy<sr*sr){hit=true;break;}}}
      if(!hit)continue;
      if(b.pierce){if(b.hits.indexOf(e.id)>=0)continue;b.hits.push(e.id);}
      if(b.fx)applyFx(e,b.fx);dmgEnemy(e,b.dmg,false,!!b.lethal);if(!b.pierce||b.lethal){kill=true;break;}}
    if(kill){addPT(b.x,b.y,'#fff',1,15);const l=PB[--pbN];PB[i]=l;PB[pbN]=b;}
  }
}
function updateParticles(dt){
  for(let i=ptN-1;i>=0;i--){const p=PT[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.92;p.vy*=0.92;p.t-=dt;if(p.t<=0){const l=PT[--ptN];PT[i]=l;PT[ptN]=p;}}
  for(let i=dnN-1;i>=0;i--){const d=DN[i];d.t-=dt;d.y-=14*dt;if(d.t<=0){const l=DN[--dnN];DN[i]=l;DN[dnN]=d;}}
  for(let i=FX.length-1;i>=0;i--){FX[i].t+=dt;if(FX[i].t>=FX[i].dur)FX.splice(i,1);}
}
function findQuest(){
  quest=null;
  if(world.isDungeon){
    if(world.exitOpen&&world.exit)quest={x:world.exit.x,y:world.exit.y,label:'Haven'};
    else if(world.boss){const den=DUNGEONS[world.dungeonId]||DUNGEONS.tideclaw;quest={x:world.boss.x,y:world.boss.y,label:(EN[den.boss]&&EN[den.boss].name)||'Old Tideclaw'};}
    return;
  }
  if(world.isVault&&world.portal){quest={x:world.portal.x,y:world.portal.y,label:'Exit'};return;}
  if(world.isHub){quest={x:world.portal.x,y:world.portal.y,label:'Portal'};return;}
  let ev=null,ed=1e9;
  for(const e of world.enemies){if(!e.d.event)continue;const d=Math.hypot(e.x-P.x,e.y-P.y);if(d<ed){ed=d;ev=e;}}
  if(ev){quest={x:ev.x,y:ev.y,label:ev.d.short||ev.name,event:true,spr:ev.d.spr};return;}
  if(P.lvl>=15&&world.boss){quest={x:world.boss.x,y:world.boss.y,label:'Hollow Guard'};return;}
  const want=Math.min(3,Math.floor((P.lvl-1)/5));let best=null,bd=1e9;
  for(const e of world.enemies){if(!e.elite||e.zone<want)continue;const d=Math.hypot(e.x-P.x,e.y-P.y);if(d<bd){bd=d;best=e;}}
  if(best)quest={x:best.x,y:best.y,label:'Elite'};
  else{const r=world.w*TS/2*[0.82,0.63,0.41,0.15][want];const a=Math.atan2(P.y-world.cy,P.x-world.cx);if(Math.abs(Math.hypot(P.x-world.cx,P.y-world.cy)-r)>40)quest={x:world.cx+Math.cos(a)*r,y:world.cy+Math.sin(a)*r,label:ZONES[want].name};}
}

/* ---------------- rendering ---------------- */
let camX=0,camY=0,safe={l:0,r:0,t:0,b:0},fps=60,showFps=/fps/.test(location.hash);
function w2s(x,y){return {x:(x-camX)*S/DPR,y:(y-camY)*S/DPR};}
function layout(){
  const portrait=H>W;
  const u=clamp(Math.min(W,H)/9,32,48);
  let panelW=0;
  if(!portrait){
    panelW=Math.round(clamp(Math.min(W*0.34,Math.max(188,H*0.56)),176,230));
    if(W-panelW<320)panelW=Math.max(160,Math.round(W*0.36));
  }
  const play={x:0,y:0,w:Math.max(1,W-panelW),h:H};
  const panel={x:play.w,y:0,w:panelW,h:H};
  const stickR=u*1.05;
  const edge=12;
  const moveAnchor={x:safe.l+stickR+edge,y:H-safe.b-stickR-edge};
  // Aim stick sits at the bottom-right of the playfield, just left of the inventory.
  const aimAnchor={x:play.x+play.w-stickR-edge,y:H-safe.b-stickR-edge};
  const havenR=Math.round(clamp(u*0.9,36,44));
  const gap=14;
  const haven={x:aimAnchor.x,y:aimAnchor.y-stickR-havenR-gap,r:havenR};
  // Ability stays in the right thumb's reach, left of the stick so it does not cover Haven.
  const ab={x:aimAnchor.x-stickR-u*0.56-gap,y:aimAnchor.y-u*0.08,r:u*0.56};
  haven.x=clamp(haven.x,play.x+haven.r+edge,play.x+play.w-haven.r-edge);
  haven.y=clamp(haven.y,haven.r+edge,aimAnchor.y-stickR-haven.r-gap);
  ab.x=clamp(ab.x,play.x+ab.r+edge,haven.x-haven.r-ab.r-gap);
  ab.y=clamp(ab.y,ab.r+edge,H-ab.r-edge);
  const mm=Math.round(clamp(Math.min(play.w,play.h)*0.2,64,108));
  layoutC={u,stickR,play,panel,moveAnchor,aimAnchor,haven,ab,mm,portrait,panelW};
}
function measureSafe(){const d=document.createElement('div');d.style.cssText='position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';document.body.appendChild(d);const s=getComputedStyle(d);safe={t:parseFloat(s.paddingTop)||0,r:parseFloat(s.paddingRight)||0,b:parseFloat(s.paddingBottom)||0,l:parseFloat(s.paddingLeft)||0};d.remove();}
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);cv.style.width=W+'px';cv.style.height=H+'px';
  measureSafe();layout();
  const pw=Math.max(1,layoutC.play.w*DPR),ph=Math.max(1,layoutC.play.h*DPR);
  S=Math.max(2,Math.floor(Math.min(pw,ph)/170));VW=pw/S;VH=ph/S;
  if(layoutC.portrait){input.move.id=null;input.aim.id=null;input.mouse.down=false;ptr=null;mapOpen=false;}
}
function addRect(x,y,w,h,fn,kind,extra){const r={x,y,w,h,fn,kind:kind||'button'};if(extra)Object.assign(r,extra);uiRects.push(r);}
function txt(s,x,y,size,col,align,shadow){font(size);ctx.textAlign=align||'left';ctx.textBaseline='middle';if(shadow!==false){ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillText(s,x+1,y+1);}ctx.fillStyle=col||'#fff';ctx.fillText(s,x,y);}
function panel(x,y,w,h,a){ctx.fillStyle='rgba(16,12,28,'+(a||0.88)+')';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#5a4a8a';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);}
function drawSpr(s,x,y,w,h,flip){ctx.imageSmoothingEnabled=false;ctx.drawImage(flip?s.f:s.c,Math.round(x),Math.round(y),w,h);}
function foeScale(e){
  if(e.d.scale)return e.d.scale;
  const base=e.d.boss?2.2:(e.elite?1.5:1);
  const s=SPR[e.d.spr];
  return base*(s&&s.fit?s.fit:1);
}
function armAttack(e){
  if(e.atkHold>0)return;
  let wind=false;
  const pats=e.pats||[];
  for(let i=0;i<pats.length;i++){
    const p=pats[i];
    if(!p||p.t==='summon')continue;
    let until=e.cd[i];
    if(p.burst){
      const cyc=e.cyc[i]||0;
      if(cyc>p.burst)until=(p.burst+p.rest-cyc)+(e.cd[i]||0);
    }
    if(until>0&&until<=ATK_WIND)wind=true;
  }
  e.atkPose=wind?2:0;
}
function spriteFrame(e){
  const s=SPR[e.sprName||e.d.spr];
  if(!s||!s.frames)return s;
  let fi=0;
  if(e.atkHold>0)fi=3;
  else if(e.atkPose===2)fi=2;
  else fi=Math.floor((time*2+e.bob)%2);
  return s.frames[fi]||s;
}
function playerSprite(){
  const s=SPR[CLASSES[P.cls].spr];
  if(!s||!s.frames)return s;
  let fi=0;
  if(P.atkHold>0)fi=4;
  else if(P.firing)fi=3;
  else if(P.moving)fi=1+((time*6|0)%2);
  return s.frames[fi]||s;
}

function drawGate(g,a){
  const left=a.x-a.w/2,span=a.w,base=a.y-1;
  g.fillStyle='#4a3424';
  g.fillRect(left-2,base-4,6,16);
  g.fillRect(left+span-4,base-4,6,16);
  g.fillStyle='#d4bc90';
  g.fillRect(left-2,base-4,6,2);
  g.fillRect(left+span-4,base-4,6,2);
  for(let i=0;i<10;i++){
    const t=i/9;
    const x=left+2+(span-10)*t;
    const y=base-4-Math.sin(t*Math.PI)*11;
    g.fillStyle='#7a5838';
    g.fillRect(x|0,y|0,5,4);
    g.fillStyle='#c4a070';
    g.fillRect(x|0,y|0,5,1);
  }
}
function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;uiRects=[];
  if(layoutC.portrait){drawRotateOverlay();return;}
  if(state==='title'){drawTitle();return;}
  const play=layoutC.play;
  const ox=Math.round((P.x-VW/2)*S),oy=Math.round((P.y-VH/2)*S);camX=ox/S;camY=oy/S;
  ctx.fillStyle='#0c0a14';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,Math.max(1,play.w*DPR),Math.max(1,play.h*DPR));ctx.clip();
  ctx.fillStyle=(world&&world.isHub)?'#4e8a3c':peaceful()?'#120f1c':(world&&world.isDungeon)?'#040605':'#264ea0';ctx.fillRect(0,0,play.w*DPR+2,play.h*DPR+2);
  ctx.setTransform(S,0,0,S,-ox,-oy);
  if(world&&(world.isDungeon||world.isHub))drawDungeonVoid(world);
  drawTerrain(world);
  const x0=camX-16,y0=camY-16,x1=camX+VW+16,y1=camY+VH+16;
  const labels=[];
  if(world.isHub){
    for(const a of world.arches||[])drawGate(ctx,a);
    const p=world.portal;for(let i=4;i>=1;i--){ctx.fillStyle=['#2a1a5a','#5a3ad0','#9a6aff','#e0d0ff'][i-1];ctx.beginPath();ctx.arc(p.x,p.y,i*2.2+Math.sin(time*4+i)*0.8,0,TAU);ctx.fill();}
    labels.push([p.x,p.y-14,'Shardwild Portal','#c9b0ff']);
    const f=world.fountain;const fs=SPR.fountain;drawSpr(fs,f.x-9,f.y-8,fs.w,fs.h);labels.push([f.x,f.y-14,'Healing Fountain','#9fe0ff']);
    labels.push([world.spawn.x,world.spawn.y+14,'The Haven','#ffd34a']);
    for(const d of world.dress||[]){
      const s=SPR[d.k];if(!s)continue;
      if(d.x<x0-16||d.x>x1+16||d.y<y0-16||d.y>y1+16)continue;
      if(d.k==='torch'){
        ctx.globalAlpha=0.16+0.06*Math.sin(time*6+d.x);
        ctx.fillStyle='#ffb060';
        ctx.beginPath();ctx.arc(d.x,d.y-6,16,0,TAU);ctx.fill();
        ctx.globalAlpha=0.82+0.18*Math.sin(time*7+d.x);
      }
      drawSpr(s,d.x-s.w/2,d.y-s.h,s.w,s.h);
      ctx.globalAlpha=1;
    }
    const ch=world.chest;
    if(ch){
      const bob=Math.sin(time*2)*0.6,s=SPR.chest;
      drawSpr(s,ch.x-9,ch.y-11+bob,18,16);
      labels.push([ch.x,ch.y-18,'TEST CHEST','#ffb347']);
    }
    const vp=world.vault;
    if(vp){
      for(let i=4;i>=1;i--){ctx.fillStyle=['#12302c','#1a6a58','#3ad0a0','#e8fff4'][i-1];ctx.beginPath();ctx.arc(vp.x,vp.y,i*2.1+Math.sin(time*3+i)*0.7,0,TAU);ctx.fill();}
      labels.push([vp.x,vp.y-14,'Vault','#7dffe0']);
    }
  }
  if(world.isVault){
    const p=world.portal;
    if(p){for(let i=4;i>=1;i--){ctx.fillStyle=['#3a3010','#a07820','#ffd34a','#fff6c8'][i-1];ctx.beginPath();ctx.arc(p.x,p.y,i*2.1+Math.sin(time*3+i)*0.7,0,TAU);ctx.fill();}labels.push([p.x,p.y-14,'Haven Exit','#ffd34a']);}
    for(const c of world.chests||[]){
      const bob=Math.sin(time*2+c.i)*0.6;
      drawSpr(SPR.chest,c.x-9,c.y-11+bob,18,16);
      labels.push([c.x,c.y-16,'Chest '+(c.i+1),'#e7c98a']);
    }
    labels.push([world.spawn.x,world.spawn.y+16,'The Vault','#7dffe0']);
  }
  if(world.isDungeon){
    if(world.exitOpen&&world.exit){
      const p=world.exit;
      for(let i=4;i>=1;i--){ctx.fillStyle=['#3a3010','#a07820','#ffd34a','#fff6c8'][i-1];ctx.beginPath();ctx.arc(p.x,p.y,i*2.2+Math.sin(time*3+i)*0.7,0,TAU);ctx.fill();}
      labels.push([p.x,p.y-16,'Haven','#ffd34a']);
    }
    labels.push([world.spawn.x,world.spawn.y+16,world.dname||'Dungeon','#ffb070']);
    for(const c of world.lootChests||[]){
      if(c.open||c.x<x0-16||c.x>x1+16||c.y<y0-16||c.y>y1+16)continue;
      const bob=Math.sin(time*2)*0.5;
      drawSpr(SPR.chest,c.x-9,c.y-11+bob,18,16);
    }
  }
  for(const p of world.portals||[]){
    if(p.x<x0-20||p.x>x1+20||p.y<y0-24||p.y>y1+20)continue;
    const den=DUNGEONS[p.dungeon]||DUNGEONS.tideclaw;
    const glow=den.theme==='hex'?['#1a1028','#6a2fa0','#8fd16a','#e8ffc0']:den.theme==='cinder'?['#2a1008','#c04018','#ffd34a','#fff0c0']:den.theme==='sanctum'?['#100818','#6a38a8','#e8e0ff','#ffffff']:den.theme==='coil'?['#142010','#2a6a28','#d0b050','#e8ffc0']:['#3a2018','#c45a30','#7ee0c8','#fff1dc'];
    for(let i=4;i>=1;i--){ctx.fillStyle=glow[i-1];ctx.beginPath();ctx.arc(p.x,p.y,i*2.3+Math.sin(time*4+i)*0.8,0,TAU);ctx.fill();}
    const ps=SPR[den.portalSpr];if(ps)drawSpr(ps,p.x-ps.w/2,p.y-ps.h/2,ps.w,ps.h);
    labels.push([p.x,p.y-16,p.name,den.col||'#7ee0c8']);
    if(P&&den.lore&&Math.hypot(P.x-p.x,P.y-p.y)<36)labels.push([p.x,p.y-28,den.lore,den.loreCol||'#d8d0ea']);
  }
  for(const b of world.beacons||[]){
    if(b.x<x0-24||b.x>x1+24||b.y<y0-30||b.y>y1+24)continue;
    const on=beaconUnlocked(b.id);
    const pulse=0.5+0.5*Math.sin(time*3+b.x*0.02);
    ctx.globalAlpha=on?0.28+0.18*pulse:0.14;
    ctx.fillStyle=on?'#7af0ff':'#9aa';
    ctx.beginPath();ctx.ellipse(b.x,b.y+4,8,3.2,0,0,TAU);ctx.fill();
    ctx.globalAlpha=on?0.22+0.16*pulse:0.1;
    ctx.fillRect(b.x-3,b.y-36,6,40);
    ctx.globalAlpha=on?0.75+0.25*pulse:0.35;
    ctx.fillStyle=on?'#e9fbff':'#ddd';
    ctx.fillRect(b.x-1,b.y-34,2,26);
    ctx.globalAlpha=on?1:0.5;
    const s=SPR.beacon;drawSpr(s,b.x-s.w/2,b.y-10,s.w,s.h);
    ctx.globalAlpha=1;
    labels.push([b.x,b.y-42,on?'Beacon: '+b.name:'Locked beacon',on?'#bff6ff':'#c8c8d8']);
  }
  for(const b of world.bags){if(b.x<x0||b.x>x1||b.y<y0||b.y>y1)continue;const s=SPR.bags[b.col]||SPR.bags.brown;ctx.globalAlpha=b.t<10&&(time*6|0)%2?0.4:1;const bob=Math.sin(time*3)*0.6;drawSpr(s,b.x-s.w/2,b.y-s.h/2+bob,s.w,s.h);}
  ctx.globalAlpha=1;
  if(world.breaks){
    for(const seg of world.breaks){
      if(seg.dead||seg.x<x0-20||seg.x>x1+20||seg.y<y0-20||seg.y>y1+20)continue;
      const f=clamp(seg.hp/seg.max,0,1),bw=34;
      ctx.fillStyle='#140c08';ctx.fillRect(seg.x-bw/2-1,seg.y-20,bw+2,7);
      ctx.fillStyle=f>0.55?'#ffe14a':f>0.25?'#ff8a28':'#ff3050';
      ctx.fillRect(seg.x-bw/2,seg.y-19,Math.max(1,bw*f),5);
      const cracks=Math.ceil((1-f)*5);
      ctx.strokeStyle='rgba(20,12,8,.9)';ctx.lineWidth=1;
      for(let i=0;i<cracks;i++){
        const t=seg.tiles[(i*3)%seg.tiles.length];if(!t)continue;
        ctx.beginPath();ctx.moveTo(t.x*TS+1,t.y*TS+2);ctx.lineTo(t.x*TS+6,t.y*TS+6);ctx.stroke();
      }
    }
  }
  for(const e of world.enemies){if(e.x<x0-80||e.x>x1+80||e.y<y0-80||e.y>y1+80)continue;
    if(e.segs&&SPR.serpent_body16){
      for(let i=e.segs.length-1;i>=0;i--){
        const last=i===e.segs.length-1;
        const key=last?'serpent_tail':i<5?'serpent_body16':i<9?'serpent_body14':'serpent_body12';
        const sp=SPR[key];if(!sp)continue;
        const s=e.segs[i];
        drawSpr(sp,Math.round(s.x-sp.w/2),Math.round(s.y-sp.h/2),sp.w,sp.h,i&1);
      }
    }
    if(e.ghosts&&SPR.megaking_ghost){
      const gs=SPR.megaking_ghost,gsc=foeScale(e),gw=gs.w*gsc,gh=gs.h*gsc;
      ctx.save();ctx.globalAlpha=0.55;
      for(const c of e.ghosts){
        if(c.x<x0-80||c.x>x1+80||c.y<y0-80||c.y>y1+80)continue;
        drawSpr(gs,Math.round(c.x-gw/2),Math.round(c.y-gh/2),gw,gh,P.x<c.x);
      }
      ctx.restore();
    }
    const base=SPR[e.sprName||e.d.spr];if(!base)continue;const s=spriteFrame(e)||base;const sc=foeScale(e),w=s.w*sc,h=s.h*sc;
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(e.x-w*0.35,e.y+h*0.4,w*0.7,2);
    if(e.d.god){ctx.globalAlpha=0.35;ctx.fillStyle='#ffd34a';ctx.beginPath();ctx.arc(e.x,e.y,e.d.r+2+Math.sin(time*3+e.id)*0.6,0,TAU);ctx.fill();ctx.globalAlpha=1;}
    if(e.flash>0)ctx.globalAlpha=0.55;drawSpr(s,Math.round(e.x-w/2),Math.round(e.y-h/2),w,h,P.x<e.x);ctx.globalAlpha=1;
    if(e.shield){
      ctx.save();
      const pulse=0.5+0.5*Math.sin(time*3);
      ctx.globalAlpha=0.16+0.08*pulse;
      ctx.fillStyle='#c46aff';
      ctx.beginPath();ctx.arc(e.x,e.y-2,17,0,TAU);ctx.fill();
      ctx.globalAlpha=0.9;
      ctx.strokeStyle=pulse>0.5?'#fff6c0':'#ffd34a';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(e.x,e.y-2,17,0,TAU);ctx.stroke();
      ctx.restore();
    }
    if(e.mkPhase===5){
      ctx.fillStyle='#fff6c0';
      const gx=e.x,gy=e.y-h*0.38+(Math.sin(time*8)*0.6);
      ctx.fillRect(gx-1,gy,2,2);ctx.fillRect(gx,gy-2,1,1);
    }
    drawStatusPips(e.x-6,e.y-h/2-6,e);
    if(e.hp<e.maxhp&&!e.d.boss){const bw=Math.max(12,Math.round(e.d.r*1.6));ctx.fillStyle='#200';ctx.fillRect(e.x-bw/2,e.y+h/2+1,bw,2);ctx.fillStyle=e.d.god?'#ffd34a':e.elite?'#ffd34a':'#e8304a';ctx.fillRect(e.x-bw/2,e.y+h/2+1,bw*e.hp/e.maxhp,2);}
    if(e.elite||e.d.boss||e.d.god||e.d.event)labels.push([e.x,e.y-h/2-5,e.d.boss?e.name:e.name.split(' (')[0],e.d.event?(e.d.phaseCol||'#7ee0c8'):e.d.boss?'#e0b0ff':e.d.god?'#ffe9a0':'#ffd34a']);
  }
  // player
  {const s=playerSprite();
   ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(P.x-4,P.y+4,8,2);
   if(P.invis>0)ctx.globalAlpha=0.28+0.08*Math.sin(time*8);
   else if(P.hurt>0&&(time*30|0)%2)ctx.globalAlpha=0.5;
   drawSpr(s,Math.round(P.x-5),Math.round(P.y-6),s.w,s.h,P.face<0);ctx.globalAlpha=1;
   if(P.invuln>0){ctx.strokeStyle='rgba(159,208,255,.9)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(P.x,P.y-1,8+Math.sin(time*10),0,TAU);ctx.stroke();}
   drawStatusPips(P.x-6,P.y-12,P);
  }
  for(let i=0;i<pbN;i++){const b=PB[i];const c=b.spr;ctx.drawImage(c,b.x-c.width/2,b.y-c.height/2);}
  for(let i=0;i<ebN;i++){const b=EB[i];if(b.x<x0||b.x>x1||b.y<y0||b.y>y1)continue;const c=b.spr;ctx.drawImage(c,b.x-c.width/2,b.y-c.height/2);}
  for(let i=0;i<ptN;i++){const p=PT[i];ctx.fillStyle=p.col;ctx.fillRect(p.x,p.y,p.s,p.s);}
  for(const f of FX){const k=f.t/f.dur;ctx.globalAlpha=1-k;ctx.strokeStyle=f.col;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,f.r0+(f.r1-f.r0)*k,0,TAU);ctx.stroke();}
  ctx.globalAlpha=1;
  ctx.restore();
  // screen space — world labels stay inside the playfield, left of the inventory panel
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.beginPath();ctx.rect(0,0,play.w,play.h);ctx.clip();
  for(const l of labels){const p=w2s(l[0],l[1]);txt(l[2],p.x,p.y,11,l[3],'center');}
  for(let i=0;i<dnN;i++){const d=DN[i];const p=w2s(d.x,d.y);ctx.globalAlpha=Math.min(1,d.t*2);txt(d.txt,p.x,p.y,12,d.col,'center');}
  ctx.restore();ctx.globalAlpha=1;
  drawHUD();
  if(mapOpen&&state==='play')drawBigMap();
  if(tpFlash>0){ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='rgba(232,250,255,'+Math.min(0.82,tpFlash)+')';ctx.fillRect(0,0,W,H);}
  if(state==='dead')drawDeath();
  if(showFps)txt(fps.toFixed(0)+' fps · '+ebN+'/'+pbN,play.w*0.5,play.h-12,11,'#0f0','center');
}
function statusEntries(o){
  const L=[];
  if(!o)return L;
  if(o.berserk>0)L.push({name:'Berserk',sub:'+'+((o.berserkDex|0))+' DEX',col:'#ff8a3a',t:o.berserk});
  if(o.invis>0)L.push({name:'Invisible',sub:'',col:'#d8dce8',t:o.invis});
  if(o.stun>0)L.push({name:'Stunned',sub:'',col:'#ffd34a',t:o.stun});
  if(o.para>0)L.push({name:'Paralyzed',sub:'',col:'#b46aff',t:o.para});
  if(o.slow>0)L.push({name:'Slowed',sub:'',col:'#6aa0ff',t:o.slow});
  if(o.weak>0)L.push({name:'Weakened',sub:'',col:'#c6d67a',t:o.weak});
  if(o.poison>0)L.push({name:'Poisoned',sub:'',col:'#7dce4a',t:o.poison});
  return L;
}
function drawStatusPips(x,y,o){
  const marks=[];
  if(o.berserk>0)marks.push('#ff8a3a');
  if(o.invis>0)marks.push('#f4f6ff');
  if(o.stun>0)marks.push('#ffd34a');
  if(o.para>0)marks.push('#b46aff');
  if(o.slow>0)marks.push('#6aa0ff');
  if(o.weak>0)marks.push('#c6d67a');
  if(o.poison>0)marks.push('#7dce4a');
  for(let i=0;i<marks.length;i++){ctx.fillStyle='#120c18';ctx.fillRect(x+i*5,y,4,4);ctx.fillStyle=marks[i];ctx.fillRect(x+i*5+1,y+1,2,2);}
}
function drawStatusTooltip(x,y,maxW){
  const rows=statusEntries(P);
  if(!rows.length)return y;
  const h=8+rows.length*14;
  panel(x,y,maxW,h,0.94);
  rows.forEach((s,i)=>{
    const label=s.name+(s.sub?' '+s.sub:'')+' '+secText(s.t)+'s';
    fitTxt(label,x+8,y+12+i*14,11,s.col,maxW-16);
  });
  addRect(x,y,maxW,h,null,'label',{tag:'status-tip'});
  return y+h+4;
}
function bar(x,y,w,h,f,col,label){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x,y,w,h);ctx.fillStyle=col;ctx.fillRect(x+1,y+1,Math.max(0,(w-2)*clamp(f,0,1)),h-2);if(label)txt(label,x+w/2,y+h/2+1,Math.min(11,h),'#fff','center');}
function drawAudioBtn(x,y,r){
  const sfx=AUD.sfxOn,mus=AUD.musicOn;
  const col=!sfx?'#6a6678':mus?'#ffd34a':'#9fe0ff';
  ctx.fillStyle='rgba(16,12,28,.8)';
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(x,y,r-1.5,0,TAU);ctx.stroke();
  const k=r/14;
  ctx.fillStyle=col;
  ctx.fillRect(x-5*k,y-2.2*k,3.2*k,4.4*k);
  ctx.beginPath();
  ctx.moveTo(x-2*k,y-2.2*k);ctx.lineTo(x+2.4*k,y-5.2*k);ctx.lineTo(x+2.4*k,y+5.2*k);ctx.lineTo(x-2*k,y+2.2*k);
  ctx.closePath();ctx.fill();
  if(sfx){
    ctx.strokeStyle=col;ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(x+2.2*k,y,4.2*k,-0.8,0.8);ctx.stroke();
    if(mus){ctx.beginPath();ctx.arc(x+2.2*k,y,6.4*k,-0.7,0.7);ctx.stroke();}
  }else{
    ctx.strokeStyle='#ff5a6a';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-4*k,y-5*k);ctx.lineTo(x+6*k,y+5*k);ctx.stroke();
  }
  addRect(x-r,y-r,r*2,r*2,()=>AUD.cycle(),'button',{tag:'audio'});
}
function circBtn(b,label,sub,col,fn,dim,extra){
  ctx.globalAlpha=dim?0.45:0.9;ctx.fillStyle='rgba(16,12,28,.7)';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(b.x,b.y,b.r-2,0,TAU);ctx.stroke();ctx.globalAlpha=1;
  txt(label,b.x,b.y-(sub?b.r*0.18:0),Math.max(13,b.r*0.5),'#fff','center');if(sub)txt(sub,b.x,b.y+b.r*0.4,Math.max(10,b.r*0.34),col,'center');
  addRect(b.x-b.r,b.y-b.r,b.r*2,b.r*2,fn,'button',extra);
}
function sqBtn(x,y,w,h,label,col,fn,extra){ctx.fillStyle='rgba(16,12,28,.8)';ctx.fillRect(x,y,w,h);ctx.strokeStyle=col||'#8a7ad0';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);fitTxt(label,x+w/2,y+h/2+1,Math.min(14,Math.max(11,h*0.36)),col||'#fff',w-8,'center');addRect(x,y,w,h,fn,'button',extra);}
function softBtn(x,y,w,h,label,col,fn,extra){ctx.fillStyle='rgba(16,12,28,.45)';ctx.fillRect(x,y,w,h);ctx.strokeStyle=col||'#6a6078';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);fitTxt(label,x+w/2,y+h/2+1,11,col||'#c8b8c8',w-6,'center');addRect(x,y,w,h,fn,'button',extra||null);}
function miniBtn(x,y,w,h,label,col,fn,extra){
  ctx.fillStyle='rgba(16,12,28,.88)';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=col||'#8a7ad0';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);
  fitTxt(label,x+w/2,y+h/2+1,11,col||'#fff',w-6,'center');
  addRect(x,y,w,h,fn,'button',extra||null);
}
function plate(s,x,y,size,col){
  font(size);const tw=Math.min(ctx.measureText(s).width+8,168);
  ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(x-tw/2,y-7,tw,14);
  fitTxt(s,x,y,size,col,tw-4,'center');
}
function fitTxt(s,x,y,size,col,maxW,align){let n=size;font(n);while(n>8&&ctx.measureText(s).width>maxW){n-=1;font(n);}txt(s,x,y,n,col,align||'left');}
function drawGhost(x,y,col){ctx.save();ctx.globalAlpha=0.2;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,layoutC.stickR,0,TAU);ctx.stroke();ctx.globalAlpha=0.28;ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,layoutC.stickR*0.36,0,TAU);ctx.fill();ctx.restore();}
function slotHot(x,y,s){return !!(ptr&&ptr.dragged&&ptr.x>=x&&ptr.x<=x+s&&ptr.y>=y&&ptr.y<=y+s);}
function drawTooltip(it,ref,at){
  const lines=itemLines(it);
  const canDrop=!!(ref&&(ref.area==='inv'||ref.area==='eq'));
  const sp=itemSpr(it);
  const w=Math.min(240,Math.max(176,layoutC.play.w*0.48)),h=40+lines.length*14+(canDrop?32:8);
  let x=layoutC.panel.x-w-8,y=clamp((at&&at.y!=null?at.y:H/2)-24,8,H-h-8);
  if(x<8)x=8;
  panel(x,y,w,h,0.96);
  if(sp)drawItemIcon(sp,x+6,y+6,32);
  fitTxt(it.name+(tierLabel(it)?'  ['+tierLabel(it)+']':''),x+(sp?42:8),y+16,12,itemColor(it),w-(sp?50:16));
  lines.forEach((l,i)=>fitTxt(l,x+8,y+40+i*14,11,'#ddd',w-16));
  if(canDrop)miniBtn(x+8,y+h-30,w-16,24,'Drop','#ffb347',()=>{dropOnGround(ref);heldTip=null;},{tag:'drop-item'});
}
function drawStatBlock(x,y,inner){
  const rows=[STATK.slice(0,2),STATK.slice(2,5),STATK.slice(5)];
  for(const row of rows){
    const labels=row.map(k=>{
      const cap=statCap(P.cls,k),maxed=P.stats[k]>=cap;
      return {k,s:STATN[k]+' '+P.stats[k]+'/'+cap,col:maxed?'#ffd34a':'#d7d0ea',maxed};
    });
    let size=10,gap=6;
    const widthAt=n=>{font(n);return labels.reduce((w,l)=>w+ctx.measureText(l.s).width,0)+gap*(labels.length-1);};
    while(size>8&&widthAt(size)>inner)size--;
    font(size);
    let cx=x;
    for(const l of labels){
      const tw=ctx.measureText(l.s).width;
      txt(l.s,cx,y,size,l.col,'left');
      addRect(cx,y-6,Math.max(8,tw),12,null,'label',{tag:'stat',stat:l.k,maxed:l.maxed});
      cx+=tw+gap;
    }
    y+=13;
  }
  return y+2;
}
function drawSidePanel(){
  const Pnl=layoutC.panel;if(Pnl.w<80)return;
  // Registered before the slots. Hit testing walks newest-first, so a slot wins over this backdrop.
  // (The old loot popup did the opposite and swallowed every tap.)
  addRect(Pnl.x,Pnl.y,Pnl.w,Pnl.h,null,'panel');
  ctx.fillStyle='rgba(12,10,22,0.96)';ctx.fillRect(Pnl.x,Pnl.y,Pnl.w,Pnl.h);
  ctx.fillStyle='#6a5aaa';ctx.fillRect(Pnl.x,Pnl.y,2,Pnl.h);
  const pad=7,inner=Pnl.w-pad*2,gap=4,x0=Pnl.x+pad;
  const vchest=nearVaultChest();
  const chest=vchest?null:nearChest();
  const bag=(chest||vchest)?null:nearBag();
  const bagN=bag?Math.min(8,bag.items.length+(bag.items.length<8?1:0)):0;
  const bagRows=bag?Math.ceil(bagN/4):0;
  const chestRows=chest?2:0;
  const vaultRows=vchest?2:0;
  const rows=3+bagRows+chestRows+vaultRows;
  const reserve=(bag?18:0)+(chest?96:0)+(vchest?40:0);
  const headerH=36;
  let slot=Math.floor(Math.min((inner-3*gap)/4,(Pnl.h-136-headerH-reserve-rows*gap)/rows));
  slot=clamp(slot,18,chest?40:46);
  let y=Pnl.y+8;
  const C=CLASSES[P.cls];
  const z=world.isDungeon?{name:world.dname||'Dungeon',col:'#ffb070'}:world.isVault?{name:'The Vault',col:'#7dffe0'}:world.isHub?{name:'The Haven',col:'#ffd34a'}:(ZONES[Math.max(0,zoneAt(world,P.x,P.y))]||{name:'',col:'#fff'});
  fitTxt('Lv '+P.lvl+' '+C.name,x0,y+6,12,'#ffd34a',inner);y+=16;
  fitTxt(z.name+'   Fame '+fameCalc().total,x0,y+5,10,z.col,inner);y+=14;
  bar(x0,y,inner,13,P.hp/Math.max(1,eff('hp')),'#e8304a',Math.ceil(P.hp)+'/'+eff('hp'));y+=15;
  bar(x0,y,inner,11,P.mp/Math.max(1,eff('mp')),'#3a7aff',Math.floor(P.mp)+'/'+eff('mp'));y+=13;
  bar(x0,y,inner,5,P.lvl>=20?1:P.xp/Math.max(1,need(P.lvl)),P.lvl>=20?'#ffb347':'#5aff7a');y+=8;
  y=drawStatusTooltip(x0,y,inner);
  y=drawStatBlock(x0,y,inner);
  const eqs=[['weapon','wpn'],['ability','abl'],['armor','arm'],['ring','rng']];
  const sxAt=i=>x0+(i%4)*(slot+gap);
  fitTxt('Equipped',x0,y+5,10,'#e0b060',inner);
  addRect(x0,y,inner,12,null,'label',{tag:'equipped-header'});
  y+=13;
  for(let i=0;i<4;i++){const ix=sxAt(i),it=P.eq[eqs[i][0]];drawSlot(ix,y,slot,it,slotHot(ix,y,slot),eqs[i][1],false,true);addRect(ix,y,slot,slot,null,'slot',{ref:{area:'eq',slot:eqs[i][0]},item:it});}
  y+=slot+5;
  ctx.strokeStyle='#6a5430';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+inner,y);ctx.stroke();
  y+=5;
  fitTxt('Inventory',x0,y+5,10,'#c9b0ff',inner);
  addRect(x0,y,inner,12,null,'label',{tag:'inventory-header'});
  y+=13;
  for(let i=0;i<8;i++){const ix=sxAt(i),iy=y+Math.floor(i/4)*(slot+gap),it=P.inv[i];drawSlot(ix,iy,slot,it,slotHot(ix,iy,slot));addRect(ix,iy,slot,slot,null,'slot',{ref:{area:'inv',i},item:it});}
  y+=2*(slot+gap)+4;
  if(vchest){drawVaultPanel(Pnl,inner,gap,x0,y,slot,vchest);return;}
  if(chest){drawChestPanel(Pnl,inner,gap,x0,y,slot);return;}
  if(bag){
    fitTxt('Loot',x0,y+5,11,'#e6d7a0',inner);y+=13;
    for(let i=0;i<bagN;i++){const ix=sxAt(i),iy=y+Math.floor(i/4)*(slot+gap),it=i<bag.items.length?bag.items[i]:null;
      drawSlot(ix,iy,slot,it,slotHot(ix,iy,slot),it?null:'+');
      addRect(ix,iy,slot,slot,null,'slot',{ref:{area:'bag',i,bag},item:it});}
  }
}
const arrowCache={};
function arrowCanvas(key,i,pulse){
  const A=EVENT_ARROW,id=key+'|'+i+'|'+(pulse?1:0);
  const hit=arrowCache[id];if(hit)return hit;
  const dir=A.dirs[i]||A.dirs[0],rows=pulse?dir.pulse:dir.idle,pal=A.pals[key]||A.pals.biome;
  const c=document.createElement('canvas');c.width=rows[0].length;c.height=rows.length;
  const g=c.getContext('2d');
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
    const ch=rows[y][x];
    if(ch&&ch!=='.'&&pal[ch]){g.fillStyle=pal[ch];g.fillRect(x,y,1,1);}
  }
  arrowCache[id]=c;return c;
}
function drawEventArrow(ax,ay,a,questIsEvent,spr,label,dist){
  if(typeof EVENT_ARROW==='undefined')return;
  const key=questIsEvent&&EVENT_ARROW.pals[spr]?spr:'biome';
  const i=Math.round(a/(Math.PI/4))&7;
  const pulse=questIsEvent&&((time*2)%1)<0.35;
  const can=arrowCanvas(key,i,pulse);
  const px=hudArtPx();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(can,Math.round(ax-can.width*px/2),Math.round(ay-can.height*px/2),can.width*px,can.height*px);
  const text=(label||'')+(questIsEvent?'  '+Math.round(dist/TS)+'m':'');
  txt(text,ax,ay+can.height*px/2+5,9,(EVENT_ARROW.label&&EVENT_ARROW.label[key])||'#ff9ecf','center');
}
function hudArtPx(){
  // Half the world pixel scale, so the clear bar and quest arrow stay small HUD marks.
  return Math.max(1,Math.round(S/DPR/2));
}
let clearBarCache={k:-1,c:null};
function clearBarCanvas(kills){
  const k=clamp(kills|0,0,8);
  if(clearBarCache.k===k&&clearBarCache.c)return clearBarCache.c;
  const c=CLEAR_BAR.toCanvas(120,k/8);
  clearBarCache={k,c};
  return c;
}
function drawClearBar(play){
  if(!world||world!==realm||typeof CLEAR_BAR==='undefined')return 0;
  const kills=realm.clearKills||0,can=clearBarCanvas(kills);
  const px=hudArtPx();
  const dw=can.width*px,dh=can.height*px;
  const x=Math.round(play.x+(play.w-dw)/2),y=Math.max(3,Math.round(3*px));
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(can,x,y,dw,dh);
  txt('Shardwild cleared: '+clearPct(kills)+'%',play.x+play.w/2,y+dh+6,9,'#ffd6ec','center');
  return y+dh+12;
}
function drawHUD(){
  const L=layoutC,u=L.u,C=CLASSES[P.cls],play=L.play;
  if(input.move.id===null)drawGhost(L.moveAnchor.x,L.moveAnchor.y,'#9fe0ff');
  if(input.aim.id===null)drawGhost(L.aimAnchor.x,L.aimAnchor.y,'#ff8a3a');
  const m=L.mm,mx=play.x+8+safe.l,my=8+safe.t;
  ctx.fillStyle='#000';ctx.fillRect(mx-2,my-2,m+4,m+4);
  if(peaceful()){ctx.drawImage(world.mini,mx,my+m*0.1,m,m*0.8);}
  else{const span=70,tx=P.x/TS-span/2,ty=P.y/TS-span/2;ctx.fillStyle=world.isDungeon?'#101412':'#264ea0';ctx.fillRect(mx,my,m,m);
    const s0x=Math.max(0,tx),s0y=Math.max(0,ty),s1x=Math.min(world.w,tx+span),s1y=Math.min(world.h,ty+span);
    if(s1x>s0x&&s1y>s0y)ctx.drawImage(world.mini,s0x,s0y,s1x-s0x,s1y-s0y,mx+(s0x-tx)*m/span,my+(s0y-ty)*m/span,(s1x-s0x)*m/span,(s1y-s0y)*m/span);
    const k=m/span/TS;
    for(const e of world.enemies){const ex=mx+(e.x-P.x)*k+m/2,ey=my+(e.y-P.y)*k+m/2;if(ex<mx||ey<my||ex>mx+m||ey>my+m)continue;ctx.fillStyle=e.d.event?'#7ee0c8':e.d.boss?'#e040ff':e.d.god?'#ffe9a0':e.elite?'#ffd34a':'#ff3030';const s=e.d.event||e.d.boss?5:e.d.god?4:e.elite?4:2;ctx.fillRect(ex-s/2,ey-s/2,s,s);}
    for(const b of world.bags){const ex=mx+(b.x-P.x)*k+m/2,ey=my+(b.y-P.y)*k+m/2;if(ex<mx||ey<my||ex>mx+m||ey>my+m)continue;ctx.fillStyle='#fff';ctx.fillRect(ex-1,ey-1,2,2);}
    for(const p of world.portals||[]){const ex=mx+(p.x-P.x)*k+m/2,ey=my+(p.y-P.y)*k+m/2;if(ex<mx||ey<my||ex>mx+m||ey>my+m)continue;ctx.fillStyle='#7ee0c8';ctx.fillRect(ex-2,ey-2,4,4);}
    if(world.isDungeon&&P&&P.explored){
      ctx.save();
      ctx.beginPath();ctx.rect(mx,my,m,m);ctx.clip();
      const k=m/span;
      drawMapFog(mx-tx*k,my-ty*k,world.w*k,world.h*k);
      ctx.restore();
    }
  }
  if(world.beacons){
    for(const b of world.beacons){
      let ex,ey;
      if(world.isHub){ex=mx+(b.x/TS)/world.w*m;ey=my+m*0.1+(b.y/TS)/world.h*m*0.8;}
      else{const span=70,k=m/span/TS;ex=mx+(b.x-P.x)*k+m/2;ey=my+(b.y-P.y)*k+m/2;if(ex<mx||ey<my||ex>mx+m||ey>my+m)continue;}
      ctx.fillStyle=beaconUnlocked(b.id)?'#7af0ff':'#8a8a98';ctx.fillRect(ex-2,ey-2,4,4);
    }
  }
  ctx.fillStyle='#ffff60';ctx.fillRect(mx+m/2-2,my+m/2-2,4,4);
  ctx.strokeStyle='#ffe9a0';ctx.lineWidth=1;ctx.strokeRect(mx+m-7,my+m-7,5,5);
  addRect(mx-2,my-2,m+4,m+4,()=>openMap(),'button',{tag:'minimap'});
  const sb=Math.round(clamp(u*0.4,16,24)),bx=Math.min(mx+m+sb+12,play.x+play.w-sb-6);
  circBtn({x:bx,y:my+sb,r:sb},'AUTO',null,P.auto?'#5aff7a':'#666',()=>{P.auto=!P.auto;toast('Auto-aim '+(P.auto?'ON':'OFF'));},{tag:'auto'});
  if(world.isHub)sqBtn(bx-sb,my+sb*3.2,Math.max(72,sb*3.6),40,'Heroes','#c9b0ff',openCharSelect,{tag:'char-select'});
  drawAudioBtn(mx+Math.max(12,sb*0.85), my+m+Math.max(12,sb*0.85)+5, Math.max(12,Math.round(sb*0.85)));
  const cost=abCost();
  circBtn(L.ab,(C.ability.split(' ')[1]||C.ability),cost+' MP',C.col,useAbility,P.mp<cost||!P.eq.ability,{tag:'ability'});
  circBtn(L.haven,'⌂',null,'#ffd34a',()=>{if(!world.isHub){enterHub();toast('Returned to the Haven','#ffd34a');}},false,{tag:'haven'});
  for(const k of ['move','aim']){const s=input[k];if(s.id===null)continue;ctx.globalAlpha=0.35;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.ox,s.oy,L.stickR,0,TAU);ctx.fill();
    let dx=s.x-s.ox,dy=s.y-s.oy;const l=Math.hypot(dx,dy);if(l>L.stickR){dx*=L.stickR/l;dy*=L.stickR/l;}ctx.globalAlpha=0.75;ctx.fillStyle=k==='aim'?'#ff8a3a':'#9fe0ff';ctx.beginPath();ctx.arc(s.ox+dx,s.oy+dy,L.stickR*0.45,0,TAU);ctx.fill();ctx.globalAlpha=1;}
  if(input.move.id===null&&input.aim.id===null&&!input.mouse.active&&P.time<25&&state==='play'){ctx.globalAlpha=0.55+0.2*Math.sin(time*3);txt('◀ move',play.x+play.w*0.22,H-safe.b-16,12,'#9fe0ff','center');const hintX=L.haven?Math.min(L.aimAnchor.x,L.haven.x-L.haven.r-40):L.aimAnchor.x;txt('aim + fire ▶',hintX,H-safe.b-16,12,'#ff8a3a','center');ctx.globalAlpha=1;}
  if(quest){const p=w2s(quest.x,quest.y);const hb=L.haven;const left=play.x+18,top=my+m+Math.max(12,sb)*2+10,right=hb?hb.x-hb.r-12:play.x+play.w-18,bot=play.h-18;
    if(p.x<left||p.y<top||p.x>right||p.y>bot){const c=w2s(P.x,P.y),a=Math.atan2(p.y-c.y,p.x-c.x);const rx=Math.min(play.w,play.h)*0.3;let ax=clamp(c.x+Math.cos(a)*rx,left,right),ay=clamp(c.y+Math.sin(a)*rx,top,bot);
      drawEventArrow(ax,ay,a,!!quest.event,quest.spr||'biome',quest.label,Math.hypot(quest.x-P.x,quest.y-P.y));}}
  const bs=world.boss;if(bs&&Math.hypot(bs.x-P.x,bs.y-P.y)<240){const w=Math.min(280,play.w*0.55),bx2=play.x+(play.w-w)/2,by=my+m+18;txt(bs.name,play.x+play.w/2,by-10,12,'#e0b0ff','center');bar(bx2,by,w,12,bs.hp/bs.maxhp,'#c46aff',null);}
  let nearEv=null,nearD=260;
  for(const e of world.enemies){if(!e.d.event)continue;const d=Math.hypot(e.x-P.x,e.y-P.y);if(d<nearD){nearD=d;nearEv=e;}}
  if(nearEv){const w=Math.min(300,play.w*0.6),bx2=play.x+(play.w-w)/2,by=my+m+(bs&&Math.hypot(bs.x-P.x,bs.y-P.y)<240?40:18);txt(nearEv.name,play.x+play.w/2,by-10,12,nearEv.d.phaseCol||'#ffd34a','center');bar(bx2,by,w,12,nearEv.hp/nearEv.maxhp,nearEv.d.phaseCol||'#ffd34a',null);}
  const barBottom=drawClearBar(play);
  const evs=world.enemies.filter(e=>e.d.event);
  if(evs.length){const banner=evs.map(e=>e.d.short||e.name).join('  ·  ');ctx.fillStyle='rgba(20,12,8,.72)';const bw=Math.min(play.w-16,Math.max(160,banner.length*8+28));const by=Math.max(my+4,barBottom+2);ctx.fillRect(play.x+(play.w-bw)/2,by,bw,18);txt('EVENT  '+banner,play.x+play.w/2,by+9,11,'#ffe9a0','center',false);}
  let ty2=my+m+28;for(const t of toasts){ctx.globalAlpha=Math.min(1,t.life);fitTxt(t.t,play.x+play.w/2,ty2,13,t.col,Math.max(40,play.w-24),'center');ty2+=16;}ctx.globalAlpha=1;
  drawSidePanel();
  drawEnterButton();
  const tipRef=(ptr&&ptr.tip&&ptr.ref)||(heldTip&&heldTip.ref);
  if(tipRef){const it=readItem(tipRef);if(it)drawTooltip(it,tipRef,(ptr&&ptr.tip)?ptr:heldTip);}
  if(ptr&&ptr.dragged&&ptr.ref){const it=readItem(ptr.ref);const sp=it&&itemSpr(it);if(sp){if(isUTGear(it)){ctx.fillStyle='rgba(140,50,210,.4)';ctx.fillRect(ptr.x-18,ptr.y-42,36,36);}drawItemIcon(sp,ptr.x-18,ptr.y-42,36);}}
}
const PORTAL_REACH=26;
function rectsHit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function portalChoices(){
  if(!P||!world)return [];
  const list=[];
  const add=(x,y,name,col,fn)=>{
    if(x==null||y==null||!name)return;
    const d=Math.hypot(P.x-x,P.y-y);
    if(d>PORTAL_REACH)return;
    list.push({x,y,name,col,fn,d});
  };
  if(world.isHub){
    if(world.portal)add(world.portal.x,world.portal.y,'Shardwild','#c9b0ff',enterRealm);
    if(world.vault)add(world.vault.x,world.vault.y,'Vault','#7dffe0',enterVault);
  }else if(world.isVault){
    if(world.portal)add(world.portal.x,world.portal.y,'Haven','#ffd34a',leaveVault);
  }else if(world.isDungeon){
    if(world.exitOpen&&world.exit)add(world.exit.x,world.exit.y,'Haven','#ffd34a',()=>{enterHub();toast('Returned to the Haven','#ffd34a');});
  }else{
    for(const p of world.portals||[])if(!(p.delay>0)){const den=DUNGEONS[p.dungeon];add(p.x,p.y,p.name,den?(den.theme==='tide'?den.loreCol:den.col):'#7ee0c8',()=>enterDungeon(p.dungeon));}
  }
  list.sort((a,b)=>a.d-b.d||(a.name<b.name?-1:1));
  return list;
}
function drawEnterButton(){
  const list=portalChoices();
  if(!list.length)return;
  const p=list[0],play=layoutC.play,label='Enter '+p.name;
  font(15);
  const bw=clamp(Math.ceil(ctx.measureText(label).width+48),180,Math.min(300,play.w-20));
  const bh=54;
  let x=Math.round(play.x+(play.w-bw)/2),y=Math.round(play.h-safe.b-bh-14);
  const L=layoutC;
  const circ=(c,r)=>c?{x:c.x-r,y:c.y-r,w:r*2,h:r*2}:null;
  const blocks=[circ(L.moveAnchor,L.stickR+4),circ(L.aimAnchor,L.stickR+4),circ(L.haven,L.haven.r+4),circ(L.ab,L.ab.r+4),
    {x:play.x+6+safe.l,y:4,w:(L.mm||70)+12,h:(L.mm||70)+40},
    {x:play.x+play.w-1,y:0,w:Math.max(8,L.panel.w+4),h:H}].filter(Boolean);
  for(let i=0;i<14&&blocks.some(b=>rectsHit({x,y,w:bw,h:bh},b));i++)y-=8;
  if(y<8)y=8;
  x=clamp(x,play.x+6,Math.max(play.x+6,play.x+play.w-bw-6));
  sqBtn(x,y,bw,bh,label,p.col,p.fn,{tag:'portal-enter',label});
}
function drawVaultPanel(Pnl,inner,gap,x0,y0,slot,chest){
  const bottom=Pnl.y+Pnl.h-4;
  let y=y0;
  fitTxt('VAULT CHEST '+(chest.i+1),x0,y+6,12,'#7dffe0',inner);y+=16;
  fitTxt('shared by every hero',x0,y+4,10,'#c8efe4',inner);y+=14;
  const slots=vaultSlots(chest.i)||[];
  let s=slot;
  if(y+2*(s+gap)>bottom)s=clamp(Math.floor((bottom-y-gap)/2),18,slot);
  for(let i=0;i<8;i++){
    const ix=x0+(i%4)*(s+gap),iy=y+Math.floor(i/4)*(s+gap),it=slots[i]||null;
    if(iy+s>bottom+1)break;
    drawSlot(ix,iy,s,it,slotHot(ix,iy,s));
    addRect(ix,iy,s,s,null,'slot',{ref:{area:'vault',i,chest:chest.i},item:it,tag:'vault-slot'});
  }
}
function drawSlot(x,y,s,it,sel,label,dim,equipped){
  const ut=isUTGear(it);
  const test=!!(it&&it.test);
  if(equipped){
    ctx.fillStyle=sel?'#2c2416':'#16120e';ctx.fillRect(x,y,s,s);
    ctx.strokeStyle='#6a4e28';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,s-1,s-1);
    ctx.strokeStyle='#c4a05a';ctx.lineWidth=2;ctx.strokeRect(x+2,y+2,s-4,s-4);
  }else{
    ctx.fillStyle=sel?'#2a241c':'#100e0c';ctx.fillRect(x,y,s,s);
    ctx.strokeStyle='#3a3228';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,s-1,s-1);
  }
  if(test){
    const p=0.5+0.5*Math.sin(time*6);
    ctx.fillStyle='rgba(255,214,80,'+(0.22+0.38*p)+')';
    ctx.fillRect(x+2,y+2,s-4,s-4);
    ctx.strokeStyle=p>0.5?'#fff6c0':'#ff9a1a';
    ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,s-6,s-6);
  }
  if(ut){
    const p=0.5+0.5*Math.sin(time*5);
    ctx.fillStyle='rgba(110,30,180,'+(0.28+0.28*p)+')';
    ctx.fillRect(x+2,y+2,s-4,s-4);
    ctx.strokeStyle=p>0.5?'#ff9adf':'#c46aff';
    ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,s-6,s-6);
  }
  if(it){
    const sp=itemSpr(it);const box=Math.max(8,s-4);
    if(dim){ctx.save();ctx.globalAlpha=0.45;}
    if(sp)drawItemIcon(sp,x+2,y+2,box);
    if(ut){
      const sweep=((time*36)%(s+12))-8;
      ctx.save();
      ctx.beginPath();ctx.rect(x+2,y+2,s-4,s-4);ctx.clip();
      ctx.globalAlpha=dim?0.18:0.4;
      ctx.fillStyle='#f6e8ff';
      ctx.fillRect(x+sweep,y,3,s);
      ctx.restore();
    }
    if(dim)ctx.restore();
    const tl=tierLabel(it);
    if(tl)txt(tl,x+s-1,y+s-3,7,dim?'#8d8b9c':itemColor(it),'right');
  }else if(label)txt(label,x+s/2,y+s/2,Math.max(8,s*0.2),'#5a4a8a','center');
}
function drawChestPanel(Pnl,inner,gap,x0,y0,slot){
  const bottom=Pnl.y+Pnl.h-4;
  let y=y0;
  fitTxt('TEST CHEST',x0,y+6,12,'#ffb347',Math.max(40,inner-70));
  miniBtn(x0+inner-66,y-4,66,16,'Unlock','#7af0ff',()=>unlockAllBeacons(),{tag:'unlock-beacons'});
  y+=14;
  fitTxt('copies · never empties',x0,y+4,10,'#e7c98a',inner);y+=12;
  const tabs=[['wizard','Wizard'],['archer','Archer'],['knight','Knight'],['priest','Priest'],['warrior','Warrior'],['rogue','Rogue'],['all','All'],['pots','Potions'],['rings','Ring'],['keys','Keys'],['test','Test']];
  const tcols=inner>=200?4:3,th=15,trows=Math.ceil(tabs.length/tcols);
  const tw=(inner-(tcols-1)*gap)/tcols;
  for(let i=0;i<tabs.length;i++){
    const t=tabs[i],tx=x0+(i%tcols)*(tw+gap),ty=y+Math.floor(i/tcols)*(th+1);
    const on=chestTab===t[0];
    const col=t[0]==='test'?'#fff6c0':t[0]==='keys'?'#7ee0c8':t[0]==='pots'?'#ff8ac0':t[0]==='rings'?'#e0b050':t[0]==='all'?'#ffd34a':CLASSES[t[0]].col;
    ctx.fillStyle=on?'rgba(78,58,130,.96)':'rgba(26,20,44,.96)';
    ctx.fillRect(tx,ty,tw,th);
    ctx.strokeStyle=on?col:'#3a3058';ctx.lineWidth=2;ctx.strokeRect(tx+1,ty+1,tw-2,th-2);
    fitTxt(t[1],tx+tw/2,ty+th/2+1,11,on?col:'#b7b0c8',tw-8,'center');
    addRect(tx,ty,tw,th,()=>{chestTab=t[0];chestPage=0;},'button',{tag:'chest-tab',tab:t[0]});
  }
  y+=trows*(th+1)+1;
  const bw=36,bh=20;
  let cRows=2;
  let s=slot;
  if(y+bh+4+cRows*(s+gap)>bottom){
    cRows=1;
    s=clamp(Math.floor(bottom-(y+bh+6)),18,slot);
  }
  const pageSize=cRows*4;
  const list=filteredChest();
  const pages=Math.max(1,Math.ceil(list.length/pageSize));
  if(chestPage>=pages)chestPage=pages-1;
  if(chestPage<0)chestPage=0;
  miniBtn(x0,y,bw,bh,'<','#c9b0ff',()=>{chestPage=Math.max(0,chestPage-1);},{tag:'chest-prev'});
  fitTxt((chestPage+1)+' / '+pages,x0+inner/2,y+bh/2,11,'#fff',inner-bw*2-8,'center');
  miniBtn(x0+inner-bw,y,bw,bh,'>','#c9b0ff',()=>{chestPage=Math.min(pages-1,chestPage+1);},{tag:'chest-next'});
  y+=bh+3;
  const start=chestPage*pageSize;
  for(let i=0;i<pageSize;i++){
    const it=list[start+i]||null;
    const ix=x0+(i%4)*(s+gap),iy=y+Math.floor(i/4)*(s+gap);
    if(iy+s>bottom+1)break;
    const dim=!!(it&&classLocked(it));
    drawSlot(ix,iy,s,it,slotHot(ix,iy,s),null,dim);
    if(it)addRect(ix,iy,s,s,null,'slot',{ref:{area:'chest',i:start+i},item:it,tag:'chest-slot'});
  }
}
function drawMapFog(ox,oy,dw,dh){
  if(!world||!P||dw<2||dh<2)return;
  const CELL=16,prefix=explorePrefix();
  const fw=Math.max(1,Math.ceil(world.w/CELL)),fh=Math.max(1,Math.ceil(world.h/CELL));
  if(!world.fog||world.fogW!==fw||world.fogH!==fh){
    world.fog=document.createElement('canvas');
    world.fog.width=fw;world.fog.height=fh;world.fogW=fw;world.fogH=fh;
  }
  const fg=world.fog.getContext('2d');
  const img=fg.createImageData(fw,fh),data=img.data;
  const seen=P.explored||{};
  for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
    let a=0;
    if(!seen[prefix+x+','+y]){
      let edge=false;
      for(let dy=-1;dy<=1&&!edge;dy++)for(let dx=-1;dx<=1;dx++)if(seen[prefix+(x+dx)+','+(y+dy)])edge=true;
      a=edge?(hash2(x*3,y*5)>0.5?64:108):158;
    }
    const i=(y*fw+x)*4;
    data[i]=6;data[i+1]=4;data[i+2]=14;data[i+3]=a;
  }
  fg.putImageData(img,0,0);
  const smooth=ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(world.fog,ox,oy,dw,dh);
  ctx.imageSmoothingEnabled=smooth;
}
function drawBigMap(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='rgba(4,2,10,.82)';ctx.fillRect(0,0,W,H);
  const m=12,x=m,y=m,w=W-m*2,h=H-m*2;
  panel(x,y,w,h,0.98);
  const title=world.isDungeon?(world.dname||'Dungeon'):world.isVault?'The Vault':world.isHub?'The Haven — full map':'Shardwild — full map';
  txt(title,x+12,y+16,15,'#ffd34a','left');
  const denMap=world.isDungeon?(DUNGEONS[world.dungeonId]||DUNGEONS.tideclaw):null;
  const sub=denMap?(denMap.mapBlurb||denMap.blurb):world.isVault?'Storage shared by every hero. The gold portal leaves.':world.isHub?'Purple portal to the Shardwild. Teal portal to the Vault.':'Shore to center. Tap a lit beacon to warp. '+world.w+' tiles across.';
  fitTxt(sub,x+12,y+34,11,'#b7b0d0',w-150);
  const legendW=Math.min(200,Math.max(140,w*0.26));
  const vx=x+8,vy=y+46,vw=w-legendW-22,vh=h-56;
  const sc=Math.min(vw/world.w,vh/world.h);
  const dw=world.w*sc,dh=world.h*sc;
  const ox=vx+(vw-dw)/2,oy=vy+(vh-dh)/2;
  ctx.save();
  ctx.beginPath();ctx.rect(ox,oy,dw,dh);ctx.clip();
  ctx.fillStyle='#061018';ctx.fillRect(ox,oy,dw,dh);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(world.mini,ox,oy,dw,dh);
  drawMapFog(ox,oy,dw,dh);
  ctx.restore();
  ctx.strokeStyle='#5a4a8a';ctx.lineWidth=2;ctx.strokeRect(ox,oy,dw,dh);
  const mxy=(wx,wy)=>({x:ox+(wx/TS)*sc,y:oy+(wy/TS)*sc});
  if(!world.isHub&&!world.isVault&&!world.isDungeon){
    const cc=mxy(world.cx,world.cy);
    const rings=[
      {r:0.30,name:'Godlands',col:'#ff6a8a'},
      {r:0.52,name:'Ashen Wilds',col:'#4fe6ff'},
      {r:0.74,name:'Greenmarch',col:'#7fd06a'},
      {r:0.90,name:'Saltmarsh Shore',col:'#e4ce8c'}];
    rings.forEach((rg,i)=>{
      const rad=rg.r*(world.w/2)*sc;
      ctx.strokeStyle=rg.col;ctx.globalAlpha=0.95;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(cc.x,cc.y,rad,0,TAU);ctx.stroke();ctx.globalAlpha=1;
      const ang=-1.2+i*0.62;
      plate(rg.name,cc.x+Math.cos(ang)*rad*0.62,cc.y+Math.sin(ang)*rad*0.62,11,rg.col);
    });
    ctx.strokeStyle='#e0b0ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cc.x,cc.y,Math.max(4,9*sc),0,TAU);ctx.stroke();
  }
  for(const poi of worldPOIs()){
    if(!(poi.always||poi.boss||poiSeen(poi.id)))continue;
    const p=mxy(poi.x,poi.y);
    if(poi.boss){
      ctx.fillStyle=poi.dungeon?'#ffb070':'#e040ff';ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+5,p.y+4);ctx.lineTo(p.x-5,p.y+4);ctx.closePath();ctx.fill();
      plate(poi.name||(poi.dungeon?'Old Tideclaw':'Hollow Guard'),p.x,p.y-12,10,poi.dungeon?(denMap&&denMap.col)||'#ffb070':'#e0b0ff');
    }else if(poi.portal){
      ctx.fillStyle='#7ee0c8';ctx.beginPath();ctx.arc(p.x,p.y,4,0,TAU);ctx.fill();
      plate(poi.name,p.x,p.y-12,10,'#7ee0c8');
    }else{
      ctx.fillStyle='#ffd34a';ctx.fillRect(p.x-2,p.y-2,5,5);
      plate(poi.name,p.x,p.y+14,10,'#ffe9a0');
    }
  }
  const hits=[];
  for(const b of world.beacons||[]){
    const p=mxy(b.x,b.y),on=beaconUnlocked(b.id);
    ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=on?'#7af0ff':'#6c6a78';ctx.globalAlpha=on?1:0.9;
    ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(7,0);ctx.lineTo(0,8);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();
    if(on){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;
    plate(on?b.name:b.name+' locked',p.x,p.y+16,10,on?'#c8f7ff':'#9a98a8');
    hits.push({x:p.x-18,y:p.y-18,w:36,h:36,b,on,where:'map'});
  }
  const pp=mxy(P.x,P.y);
  ctx.fillStyle='rgba(0,0,0,.9)';ctx.beginPath();ctx.arc(pp.x,pp.y,8,0,TAU);ctx.fill();
  ctx.fillStyle='#ffff60';ctx.beginPath();ctx.arc(pp.x,pp.y,5,0,TAU);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  const lx=x+w-legendW-4,ly=y+48;
  txt('Legend',lx,ly,12,'#ffd34a','left');
  let yy=ly+16;
  const lines=world.isDungeon
    ?[['#ffff60','You'],[denMap.legend[0],denMap.legend[1]],['#ffd34a','Haven exit'],[denMap.legend[2],denMap.legend[3]]]
    :world.isVault
    ?[['#ffff60','You'],['#ffd34a','Exit'],['#e7c98a','Chest'],['#ffe9a0','Discovered']]
    :world.isHub
    ?[['#ffff60','You'],['#c9b0ff','Shardwild portal'],['#7dffe0','Vault'],['#ffd34a','Fountain'],['#e7c98a','Test chest']]
    :[['#ffff60','You'],['#e040ff','Boss'],['#7af0ff','Unlocked beacon'],['#6c6a78','Locked beacon'],['#7ee0c8','Dungeon portal'],['#ffe9a0','Discovered'],['#e4ce8c','Saltmarsh Shore'],['#7fd06a','Greenmarch'],['#4fe6ff','Ashen Wilds'],['#ff6a8a','Godlands']];
  for(const [c,n] of lines){ctx.fillStyle=c;ctx.fillRect(lx,yy-4,8,8);fitTxt(n,lx+12,yy,10,'#ddd',legendW-18);yy+=13;}
  if((world.beacons||[]).length){yy+=4;txt('Beacons',lx,yy,12,'#7af0ff','left');yy+=14;}
  for(const b of world.beacons||[]){
    const on=beaconUnlocked(b.id);
    ctx.fillStyle=on?'rgba(36,70,90,.9)':'rgba(32,30,42,.9)';
    ctx.fillRect(lx,yy-8,legendW-8,18);
    fitTxt((on?'◆ ':'◇ ')+b.name,lx+6,yy,11,on?'#c8f7ff':'#8e8c9a',legendW-16);
    hits.push({x:lx,y:yy-8,w:legendW-8,h:18,b,on,where:'list'});
    yy+=20;
  }
  const cw=70,ch=28,cx0=x+w-cw-8,cy0=y+8;
  ctx.fillStyle='rgba(16,12,28,.92)';ctx.fillRect(cx0,cy0,cw,ch);
  ctx.strokeStyle='#ffd34a';ctx.lineWidth=2;ctx.strokeRect(cx0+1,cy0+1,cw-2,ch-2);
  txt('Close',cx0+cw/2,cy0+ch/2+1,13,'#ffd34a','center');
  addRect(0,0,W,H,()=>closeMap(),'button',{tag:'map-backdrop'});
  addRect(x,y,w,h,null,'panel',{tag:'map-panel'});
  addRect(cx0,cy0,cw,ch,()=>closeMap(),'button',{tag:'map-close'});
  for(const h of hits)addRect(h.x,h.y,h.w,h.h,()=>{if(h.on)teleportBeacon(h.b);else toast('Beacon locked. Walk up to the pillar.','#aaa');},'button',{tag:'beacon',beacon:h.b.id,unlocked:h.on,where:h.where});
}
function drawTitleBackdrop(){
  ctx.fillStyle='#120f1c';ctx.fillRect(0,0,cv.width,cv.height);ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;
  for(let i=0;i<70;i++){const sx=(i*97.3+time*(6+i%5*4))%W,sy=(i*53.7)%H;ctx.fillStyle=i%7?'#3a3060':'#9a8aff';ctx.fillRect(sx,sy,2,2);}
  for(let i=0;i<18;i++){const a=time*0.5+i*TAU/18;const r=40+((time*30+i*13)%Math.max(W,H));ctx.fillStyle=['#ff4a8a','#c46aff','#4fe6ff'][i%3];ctx.globalAlpha=0.25;ctx.beginPath();ctx.arc(W/2+Math.cos(a)*r,H*0.16+Math.sin(a)*r,3,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}
function drawFameLine(){
  const runs=loadRuns();
  if(!store.persistent)txt('Note: this viewer blocks saving — open via a web link to keep progress',W/2,H-safe.b-4-(runs.length?16:14),Math.min(10,W/60),'#ff9a6a','center');
  if(runs.length){const run=runs[0];const y=H-safe.b-16;txt('Hall of Fame',W/2,y,12,'#ffb347','center');
    txt('Best: '+run.fame+' fame · Lv'+run.lvl+' '+(CLASSES[canonCls(run.cls)]?CLASSES[canonCls(run.cls)].name:'')+' · slain by '+run.by,W/2,y+14,10,'#ccc','center');
    return 36;}
  if(!slotCount()||titleMode==='create')txt('WASD move · mouse aim/fire · Space ability · Q/E potions · F loot · R home',W/2,H-safe.b-14,Math.min(11,W/70),'#777','center');
  return 22;
}
function drawClassScreen(canBack){
  drawTitleBackdrop();
  const ts=Math.min(W/7.5,canBack?40:54);
  txt('SHARDWILD',W/2,safe.t+ts*0.7,ts,'#ffd34a','center');
  txt(canBack?'Choose a class. Each hero keeps their own gear.':'a pocket bullet-hell realm · '+GAME_VERSION,W/2,safe.t+ts*1.35,Math.max(11,ts*0.26),'#c9b0ff','center');
  if(canBack)sqBtn(16,safe.t+8,132,44,'← Heroes','#c9b0ff',()=>{titleMode='roster';},{tag:'char-back'});
  const bottom=drawFameLine();
  let top=safe.t+ts*1.7;
  txt('Choose your hero',W/2,top+6,12,'#aaa','center');top+=18;
  const avail=H-top-bottom-safe.b;
  const cols=3,rows=2,gap=8;
  const w=Math.min(210,Math.floor((W-28-(cols-1)*gap)/cols));
  const h=Math.max(78,Math.min(168,Math.floor((avail-(rows-1)*gap)/rows)));
  const x0=Math.round((W-(cols*w+(cols-1)*gap))/2);
  CLASSKEYS.forEach((k,i)=>{const C=CLASSES[k];
    const col=i%cols,row=(i/cols)|0,x=x0+col*(w+gap),y=top+row*(h+gap);
    panel(x,y,w,h,0.9);ctx.strokeStyle=C.col;ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);
    const sp=SPR[C.spr];
    const q=Math.min(w*0.34,h*0.36,56);drawSpr(sp,x+w/2-q/2,y+6,q,q);let ty=y+q+16;
    fitTxt(C.name,x+w/2,ty,14,C.col,w-12,'center');ty+=16;
    C.desc.forEach(d=>{fitTxt(d,x+w/2,ty,11,'#ddd',w-12,'center');ty+=13;});
    txt('HP '+C.base.hp+' MP '+C.base.mp+' DEF '+C.base.def,x+w/2,Math.min(ty+2,y+h-8),10,'#999','center');
    addRect(x,y,w,h,()=>startNew(k),'button',{tag:'class-pick',tab:k});
  });
  drawTitleToasts();
}
function drawConfirmModal(r){
  const s=r.slots[confirmSlot];
  if(!s){titleMode='roster';return;}
  const C=CLASSES[s.cls];
  ctx.fillStyle='rgba(6,4,14,.78)';ctx.fillRect(0,0,W,H);
  addRect(0,0,W,H,()=>{},'button',{tag:'char-backdrop'});
  const pw=Math.min(480,W-24),ph=188,px=(W-pw)/2,py=(H-ph)/2;
  panel(px,py,pw,ph,0.98);
  txt('Delete this hero?',W/2,py+32,18,'#ff8a8a','center');
  txt('Lv '+s.lvl+' '+(C?C.name:'')+' and their gear are gone forever.',W/2,py+60,13,'#ffe0e0','center');
  const bw=(pw-48)/2;
  sqBtn(px+16,py+ph-64,bw,46,'Cancel','#c9b0ff',()=>{titleMode='roster';confirmSlot=-1;},{tag:'char-cancel'});
  sqBtn(px+pw/2+8,py+ph-64,bw,46,'Delete','#ff5a6a',()=>deleteCharacter(confirmSlot),{tag:'char-confirm',slot:confirmSlot});
}
function drawRosterScreen(){
  drawTitleBackdrop();
  const r=ensureRoster();
  txt('SHARDWILD',W/2,safe.t+20,Math.min(34,W/16),'#ffd34a','center');
  txt('Your heroes',W/2,safe.t+40,12,'#c9b0ff','center');
  const bottom=drawFameLine();
  let top=safe.t+50;
  const active=(r.active!=null&&r.slots[r.active])?r.active:r.slots.findIndex(Boolean);
  if(active>=0){
    const s=r.slots[active],C=CLASSES[s.cls];
    sqBtn(W/2-170,top,340,44,'▶ Play Lv '+s.lvl+' '+(C?C.name:''),'#5aff7a',()=>continueGame(active),{tag:'char-continue',slot:active});
    top+=52;
  }
  const cols=4,rows=2,gap=8;
  const cw=Math.floor((W-24-(cols-1)*gap)/cols);
  const ch=Math.min(168,Math.max(112,Math.floor((H-top-bottom-safe.b-8-(rows-1)*gap)/rows)));
  for(let i=0;i<SLOTN;i++){
    const col=i%cols,row=(i/cols)|0;
    const x=12+col*(cw+gap),y=top+row*(ch+gap),s=r.slots[i];
    panel(x,y,cw,ch,0.92);
    if(!s){
      ctx.strokeStyle='#3a3058';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,cw-2,ch-2);
      txt('Empty',x+cw/2,y+Math.max(28,ch*0.36),14,'#8a80a8','center');
      const bw=Math.max(44,Math.min(cw-16,120)),bh=40;
      sqBtn(x+(cw-bw)/2,y+ch-8-bh,bw,bh,'Create','#ffd34a',()=>{titleMode='create';},{tag:'char-new',slot:i});
    }else{
      const C=CLASSES[s.cls]||CLASSES.wizard;
      ctx.strokeStyle=C.col;ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,cw-2,ch-2);
      const pad=6,gap=4,bh=40;
      const rowW=cw-pad*2;
      let delW=Math.round(clamp(rowW*0.32,52,72));
      let playW=rowW-gap-delW;
      const stacked=playW<48;
      if(stacked){playW=rowW;delW=Math.max(44,Math.min(rowW,Math.round(rowW*0.62)));}
      const blockH=stacked?bh*2+gap:bh;
      const by=y+ch-6-blockH;
      const top=y+4,room=Math.max(16,by-6-top);
      const q=Math.max(16,Math.min(48,Math.floor(cw*0.5),room-28));
      const sy=top+Math.max(0,(room-(q+28))/2);
      const sp=SPR[C.spr];
      drawSpr(sp,x+(cw-q)/2,sy,q,q);
      fitTxt(C.name,x+cw/2,Math.min(sy+q+12,by-16),13,C.col,cw-12,'center');
      txt('Lv '+s.lvl,x+cw/2,Math.min(sy+q+26,by-6),12,'#ffe9a0','center');
      sqBtn(x+pad,by,playW,bh,'Play',C.col,()=>continueGame(i),{tag:'char-play',slot:i});
      const dx=stacked?x+(cw-delW)/2:x+pad+playW+gap;
      const dy=stacked?by+bh+gap:by;
      softBtn(dx,dy,delW,bh,'Delete','#a88898',()=>{confirmSlot=i;titleMode='confirm';},{tag:'char-delete',slot:i});
    }
  }
  if(titleMode==='confirm')drawConfirmModal(r);
  else drawTitleToasts();
}
function drawTitleToasts(){
  let y=H-safe.b-36;ctx.globalAlpha=1;
  for(const t of toasts){ctx.globalAlpha=Math.min(1,t.life);fitTxt(t.t,W/2,y,13,t.col,W-24,'center');y-=16;}
  ctx.globalAlpha=1;
}
function drawTitle(){
  const n=slotCount();
  if(titleMode==='confirm'&&n){drawRosterScreen();return;}
  if(titleMode==='create'||!n){drawClassScreen(n>0);return;}
  drawRosterScreen();
}
function drawRotateOverlay(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#120f1c';ctx.fillRect(0,0,W,H);
  const cx=W/2,cy=H*0.4;
  ctx.save();ctx.translate(cx-10,cy);ctx.rotate(-0.6);
  ctx.strokeStyle='#ffd34a';ctx.lineWidth=3;ctx.strokeRect(-18,-34,36,68);
  ctx.fillStyle='#ffd34a';ctx.fillRect(-5,26,10,3);ctx.restore();
  ctx.strokeStyle='#c9b0ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx+34,cy,26,-0.2,2.4);ctx.stroke();
  ctx.fillStyle='#c9b0ff';ctx.beginPath();ctx.moveTo(cx+34+22,cy+12);ctx.lineTo(cx+34+8,cy+18);ctx.lineTo(cx+34+14,cy+4);ctx.closePath();ctx.fill();
  txt('Rotate your phone',W/2,cy+86,Math.min(28,W/13),'#ffd34a','center');
  txt('Shardwild plays in landscape',W/2,cy+116,Math.min(16,W/22),'#c9b0ff','center');
}
function drawDeath(){
  const D=deathInfo;ctx.fillStyle='rgba(20,0,10,'+Math.min(0.8,D.t)+')';ctx.fillRect(0,0,W,H);uiRects=[];
  const pw=Math.min(380,W-20),lines=D.f.lines,ph=Math.min(H-16,150+lines.length*16+50),px=(W-pw)/2,py=(H-ph)/2;
  panel(px,py,pw,ph,0.95);let y=py+22;
  txt('YOU HAVE FALLEN',W/2,y,20,'#ff4a6a','center');y+=22;
  txt('Lv '+P.lvl+' '+CLASSES[P.cls].name+' · slain by '+D.run.by,W/2,y,11,'#ddd','center');y+=22;
  for(const l of lines){txt(l[0],px+16,y,11,'#ccc');txt('+'+l[1],px+pw-16,y,11,'#ffb347','right');y+=16;}
  y+=8;txt('Total Fame: '+D.f.total,W/2,y,18,'#ffd34a','center');y+=20;
  if(D.best)txt('★ New best run! ★',W/2,y,12,'#5aff7a','center');
  if(D.t>1)sqBtn(W/2-80,py+ph-44,160,40,'Heroes','#ffd34a',()=>{titleMode='roster';state='title';},{tag:'char-select'});
}

/* ---------------- input ---------------- */
let fsTried=false;
function lockLandscape(){
  try{
    const o=screen.orientation;
    if(o&&typeof o.lock==='function'){
      const p=o.lock('landscape');
      if(p&&typeof p.catch==='function')p.catch(function(){});
    }
  }catch(e){}
}
function tryFS(type){if(fsTried||type==='mouse')return;fsTried=true;
  try{const el=document.documentElement;const f=el.requestFullscreen||el.webkitRequestFullscreen;
    const already=document.fullscreenElement||document.webkitFullscreenElement;
    if(already){lockLandscape();return;}
    if(typeof f==='function'&&document.fullscreenEnabled!==false){const r=f.call(el,{navigationUI:'hide'});
      if(r&&typeof r.then==='function')r.then(function(){lockLandscape();}).catch(function(){});
      else lockLandscape();}}catch(err){}}
document.addEventListener('fullscreenchange',function(){if(document.fullscreenElement)lockLandscape();});
function pickRect(x,y){for(let i=uiRects.length-1;i>=0;i--){const r=uiRects[i];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return r;}return null;}
function inPlay(x,y){const p=layoutC.play;return x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h;}
function safeCall(fn){try{fn();}catch(err){console.error(err);toast('Error: '+(err&&err.message||err),'#ff8a8a');}}
function evXY(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*(W/(r.width||W)),y:(e.clientY-r.top)*(H/(r.height||H))};}
function beginPtr(id,x,y,hit){ptr={id,x,y,sx:x,sy:y,t0:performance.now(),ref:(hit&&hit.kind==='slot'&&hit.item)?hit.ref:null,dragged:false,tip:false};}
function resolvePtr(p){
  if(!p||!p.ref)return;
  if(p.dragged){
    const hit=pickRect(p.x,p.y);
    if(hit&&hit.kind==='slot'){dragMove(p.ref,hit.ref);return;}
    // Released over the playfield: the item leaves the panel and hits the ground.
    if(inPlay(p.x,p.y)&&(p.ref.area==='inv'||p.ref.area==='eq')){dropOnGround(p.ref);return;}
    return;
  }
  if(p.tip||performance.now()-p.t0>=450){
    if(p.ref.area==='inv'||p.ref.area==='eq'||p.ref.area==='bag'||p.ref.area==='chest'||p.ref.area==='vault')heldTip={ref:p.ref,x:p.x,y:p.y,until:performance.now()+6500};
    return;
  }
  tapRef(p.ref);
}
function overHome(x,y){
  const b=layoutC.haven;if(!b)return false;
  return x>=b.x-b.r&&x<=b.x+b.r&&y>=b.y-b.r&&y<=b.y+b.r;
}
function onDown(id,type,x,y,button){
  AUD.unlock();
  if(layoutC.portrait){tryFS(type);return;}
  tryFS(type);
  const hit=pickRect(x,y);
  if(!(hit&&hit.tag==='drop-item'))heldTip=null;
  if(type==='mouse'){
    input.mouse.active=true;input.mouse.x=x;input.mouse.y=y;
    if(hit&&hit.kind==='button'&&hit.fn){safeCall(hit.fn);return;}
    if(hit&&(hit.kind==='slot'||hit.kind==='panel')){beginPtr(id,x,y,hit);return;}
    if(mapOpen)return;
    // A click on the Haven button must not hold-to-fire.
    if(overHome(x,y))return;
    if(state==='play'&&button===0&&inPlay(x,y))input.mouse.down=true;
    return;
  }
  input.mouse.active=false;
  if(hit&&hit.kind==='button'&&hit.fn){safeCall(hit.fn);return;}
  if(hit&&(hit.kind==='slot'||hit.kind==='panel')){beginPtr(id,x,y,hit);return;}
  if(mapOpen)return;
  // The button's square is not an aim-stick origin, so a tap there cannot shoot.
  if(overHome(x,y))return;
  if(state!=='play'||!inPlay(x,y))return;
  const haven=layoutC.haven,ab=layoutC.ab;
  if(haven&&Math.hypot(x-haven.x,y-haven.y)<=haven.r)return;
  if(ab&&Math.hypot(x-ab.x,y-ab.y)<=ab.r)return;
  const mid=layoutC.play.x+layoutC.play.w*0.5;
  const s=x<mid?input.move:input.aim;
  if(s.id===null){s.id=id;s.ox=x;s.oy=y;s.x=x;s.y=y;}
}
function onMove(id,type,x,y){
  if(ptr&&ptr.id===id){
    ptr.x=x;ptr.y=y;
    if(!ptr.dragged&&ptr.ref&&Math.hypot(x-ptr.sx,y-ptr.sy)>14){ptr.dragged=true;ptr.tip=false;}
    if(type==='mouse'){input.mouse.x=x;input.mouse.y=y;}
    return;
  }
  if(type==='mouse'){input.mouse.x=x;input.mouse.y=y;input.mouse.active=true;return;}
  for(const s of [input.move,input.aim])if(s.id===id){s.x=x;s.y=y;
    const R=layoutC.stickR*1.6,dx=s.x-s.ox,dy=s.y-s.oy,l=Math.hypot(dx,dy);if(l>R){s.ox=s.x-dx/l*R;s.oy=s.y-dy/l*R;}}
}
function onUp(id,type){
  if(ptr&&ptr.id===id){const p=ptr;ptr=null;resolvePtr(p);}
  if(type==='mouse'){input.mouse.down=false;return;}
  for(const s of [input.move,input.aim])if(s.id===id)s.id=null;
}
if(window.PointerEvent){
  cv.addEventListener('pointerdown',e=>{if(e.cancelable)e.preventDefault();const p=evXY(e);safeCall(()=>onDown(e.pointerId,e.pointerType||'touch',p.x,p.y,e.button));},{passive:false});
  cv.addEventListener('pointermove',e=>{const p=evXY(e);safeCall(()=>onMove(e.pointerId,e.pointerType||'touch',p.x,p.y));},{passive:false});
  const up=e=>safeCall(()=>onUp(e.pointerId,e.pointerType||'touch'));
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
}else{
  // very old browsers without Pointer Events: use touch + mouse events directly
  const each=(e,f)=>{for(const t of e.changedTouches){const p=evXY(t);safeCall(()=>f(t.identifier,p));}};
  cv.addEventListener('touchstart',e=>{e.preventDefault();each(e,(id,p)=>onDown(id,'touch',p.x,p.y,0));},{passive:false});
  cv.addEventListener('touchmove',e=>{e.preventDefault();each(e,(id,p)=>onMove(id,'touch',p.x,p.y));},{passive:false});
  const tend=e=>{e.preventDefault();each(e,id=>onUp(id,'touch'));};cv.addEventListener('touchend',tend,{passive:false});cv.addEventListener('touchcancel',tend,{passive:false});
  cv.addEventListener('mousedown',e=>{const p=evXY(e);safeCall(()=>onDown('m','mouse',p.x,p.y,e.button));});
  window.addEventListener('mousemove',e=>{const p=evXY(e);safeCall(()=>onMove('m','mouse',p.x,p.y));});
  window.addEventListener('mouseup',()=>onUp('m','mouse'));
}
for(const ev of ['touchmove','gesturestart','dblclick','contextmenu'])document.addEventListener(ev,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
window.addEventListener('keydown',e=>safeCall(()=>{
  AUD.unlock();
  if(layoutC.portrait)return;
  input.keys[e.code]=true;
  if(mapOpen){if(e.code==='Escape'||e.code==='KeyM'||e.code==='Backspace')closeMap();e.preventDefault();return;}
  if(state==='title'){
    if(titleMode==='confirm'){
      if(e.code==='Escape'||e.code==='Backspace'){titleMode='roster';confirmSlot=-1;}
      if(e.code==='Enter')deleteCharacter(confirmSlot);
      return;
    }
    const creating=titleMode==='create'||!slotCount();
    if(creating){
      const i=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'].indexOf(e.code);
      if(i>=0)startNew(CLASSKEYS[i]);
      if((e.code==='Escape'||e.code==='Backspace')&&slotCount())titleMode='roster';
      if(e.code==='Enter'&&slotCount())continueGame();
      return;
    }
    const i=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8'].indexOf(e.code);
    if(i>=0)continueGame(i);
    if(e.code==='Enter')continueGame();
    if(e.code==='KeyN')titleMode='create';
    return;
  }
  if(state==='dead'){if((e.code==='Enter'||e.code==='Space')&&deathInfo.t>1){titleMode='roster';state='title';}return;}
  if(e.code==='Space'){useAbility();e.preventDefault();}
  if(e.code==='KeyQ'||e.code==='Digit1')drinkHP();
  if(e.code==='KeyE'||e.code==='Digit2')drinkMP();
  if((e.code==='KeyR'||e.code==='KeyH')&&world&&!world.isHub){enterHub();toast('Returned to the Haven','#ffd34a');}
  if(e.code==='KeyT'){P.auto=!P.auto;toast('Auto-aim '+(P.auto?'ON':'OFF'));}
  if(e.code==='KeyM')openMap();
  if(e.code==='KeyF')takeFirstBag();
}));
window.addEventListener('keyup',e=>{input.keys[e.code]=false;});
window.addEventListener('blur',()=>{input.keys={};input.mouse.down=false;input.move.id=null;input.aim.id=null;ptr=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame();});
window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,150));

/* ---------------- loop ---------------- */
buildSprites();buildGear();resize();
let last=performance.now();
function frame(t){
  const raw=(t-last)/1000;last=t;const dt=Math.min(0.05,Math.max(0,raw));if(raw>0)fps=fps*0.95+0.05/Math.max(raw,0.001);
  try{update(dt);render();}catch(err){console.error(err);}
  AUD.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function sampleTerrain(){
  const wd=realm;if(!wd)return null;
  const n=wd.w*wd.h,zones={'-1':0,'0':0,'1':0,'2':0,'3':0},tiles={};
  let maxT=0,maxN=0;
  for(let i=0;i<n;i++){
    const z=wd.zone[i];zones[z]=(zones[z]||0)+1;
    const t=wd.tiles[i];tiles[t]=(tiles[t]||0)+1;
    if(tiles[t]>maxN){maxN=tiles[t];maxT=t;}
  }
  const frac={};
  for(const k in zones)frac[k]=zones[k]/n;
  function nearestGround(tx,ty){
    for(let r=0;r<28;r++){
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        if(r&&Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const x=tx+dx,y=ty+dy;
        if(x<0||y<0||x>=wd.w||y>=wd.h)continue;
        if(DECO_SPR[wd.tiles[y*wd.w+x]])continue;
        return {x,y};
      }
    }
    return {x:tx,y:ty};
  }
  const seeds=[[0,0],[wd.w-1,0],[0,wd.h-1],[wd.w-1,wd.h-1],[0,(wd.h/2)|0],[wd.w-1,(wd.h/2)|0],[(wd.w/2)|0,0],[(wd.w/2)|0,wd.h-1]];
  const checks=[];
  for(const [sx,sy] of seeds){
    const p=nearestGround(sx,sy),i=p.y*wd.w+p.x,exp=tileRGB(wd,p.x,p.y,4,4),mexp=minimapRGB(wd,p.x,p.y);
    const x0=Math.floor(p.x/CHUNK)*CHUNK,y0=Math.floor(p.y/CHUNK)*CHUNK;
    const tw=Math.min(CHUNK,wd.w-x0),th=Math.min(CHUNK,wd.h-y0);
    const ch=raster(wd,x0,y0,tw,th);
    const pix=ch.getContext('2d').getImageData((p.x-x0)*TS+4,(p.y-y0)*TS+4,1,1).data;
    const mini=wd.mini.getContext('2d').getImageData(p.x,p.y,1,1).data;
    checks.push({tx:p.x,ty:p.y,tile:wd.tiles[i],zone:wd.zone[i],
      world:[pix[0],pix[1],pix[2]],expect:[exp[0],exp[1],exp[2]],
      mini:[mini[0],mini[1],mini[2]],miniExpect:mexp,
      worldOk:pix[0]===exp[0]&&pix[1]===exp[1]&&pix[2]===exp[2],
      miniOk:mini[0]===mexp[0]&&mini[1]===mexp[1]&&mini[2]===mexp[2]});
  }
  function avgBase(base,limit){
    let r=0,g=0,b=0,reds=0,seen=0;
    for(let i=0;i<n&&seen<limit;i+=17){
      if(tileBase(wd,i,wd.tiles[i])!==base)continue;
      const tx=i%wd.w,ty=(i/wd.w)|0;
      const layers=wtLayers(wd,tx,ty).layers;
      for(let py=0;py<TS;py++)for(let px=0;px<TS;px++){
        const c=wtPixel(layers,px,py);
        r+=c[0];g+=c[1];b+=c[2];
        if(c[0]>160&&c[1]<90&&c[2]<80)reds++;
      }
      seen++;
    }
    const pxn=seen*TS*TS||1;
    return {n:seen,r:r/pxn,g:g/pxn,b:b/pxn,red:reds/pxn};
  }
  const looks={water:avgBase(T_WATER,24),wet:avgBase(T_WET,24),sand:avgBase(T_SAND,24),grass:avgBase(T_GRASS,24),ash:avgBase(T_DARK,200),rock:avgBase(T_ROCK,24)};
  return {w:wd.w,h:wd.h,n,zones,frac,tiles,maxT,maxShare:maxN/n,checks,looks};
}
function previewSheet(mode){
  const kinds=mode==='all'?['sword','bow','staff','shield','quiver','spell','robe','leather','heavy','ring']:['sword','bow','staff'];
  const names={sword:'Sword',bow:'Bow',staff:'Staff',shield:'Shield',quiver:'Quiver',spell:'Spellbook',robe:'Robe',leather:'Leather',heavy:'Plate',ring:'Ring'};
  const scale=8,cell=(8+2)*scale,gap=14,labelH=18,cols=10,nameW=92;
  const bagRow=mode==='all'?cell+labelH+gap:0;
  const c=document.createElement('canvas');
  c.width=nameW+gap+cols*(cell+gap);c.height=28+gap+kinds.length*(cell+labelH+gap)+bagRow;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.fillStyle='#14121a';g.fillRect(0,0,c.width,c.height);
  g.font='bold 14px ui-monospace,Menlo,Consolas,monospace';g.textAlign='left';
  g.fillStyle='#ffd34a';g.fillText('Shardwild '+GAME_VERSION+' items',gap,18);
  g.font='bold 13px ui-monospace,Menlo,Consolas,monospace';
  kinds.forEach((k,row)=>{
    const y=28+gap+row*(cell+labelH+gap);
    g.textAlign='left';g.fillStyle='#d8d0ea';g.fillText(names[k]||k,6,y+cell/2);
    g.textAlign='center';
    for(let t=0;t<cols;t++){
      if(k==='ring'&&t>7)continue;
      const s=t<9?gearSpr(k,t):gearSpr(k,'test');
      if(!s)continue;
      const icon=outlinedIcon(s,scale);
      const x=nameW+t*(cell+gap)+(cell-icon.width)/2;
      g.drawImage(icon,x,y);
      g.fillStyle='#d8d0ea';
      g.fillText(t<8?'T'+t:t===8?'UT':'TST',nameW+t*(cell+gap)+cell/2,y+cell+14);
    }
  });
  if(mode==='all'){
    const y=28+gap+kinds.length*(cell+labelH+gap);
    const names=['brown','pink','purple','cyan','blue','white'];
    names.forEach((name,i)=>{
      const s=SPR.bags[name];
      const x=nameW+i*(cell+gap);
      g.imageSmoothingEnabled=false;
      g.drawImage(s.c,x+(cell-s.w*scale)/2,y+(cell-s.h*scale)/2,s.w*scale,s.h*scale);
      g.fillStyle='#d8d0ea';
      g.fillText(name,x+cell/2,y+cell+14);
    });
    const pearl=outlinedIcon(SPR.tidepearl,scale);
    const px=nameW+7*(cell+gap);
    g.drawImage(pearl,px,y);
    g.fillStyle='#d8d0ea';
    g.fillText('pearl',px+cell/2,y+cell+14);
  }
  return c.toDataURL('image/png');
}
function contactSheet(kind){
  const scale=6,gap=8,labelH=16;
  const gfont='bold 12px ui-monospace,Menlo,Consolas,monospace';
  function board(w,h,draw){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;
    g.fillStyle='#14121a';g.fillRect(0,0,w,h);
    g.font=gfont;g.textAlign='center';
    draw(g);
    return c.toDataURL('image/png');
  }
  if(kind==='foes'){
    const list=[
      ['heximp','Hex Imp'],['bogtoad','Bog Toad'],['cursetreant','Cursed Treant'],['hextotem','Hex Totem'],['mirebat','Mire Bat'],['hexmatron','Hex Matriarch'],
      ['hivedrone','Hive Drone'],['ashlarva','Ash Larva'],['lavaspit','Lava Spitter'],['cindermite','Cinder Mite'],['broodguard','Brood Guard'],['broodqueen','Magma Brood Queen'],
      ['acolyte','Void Acolyte'],['starwisp','Star Wisp'],['runeguard','Rune Guard'],['eclipser','Eclipse Seer'],['voidshade','Void Shade'],['archon','Void Archon'],
      ['king','Morvane, the Hollow Guard']
    ];
    const cell=22*scale,cols=4,rows=Math.ceil(list.length/cols);
    const w=gap+cols*(cell+gap+28),h=36+rows*(cell+labelH+gap);
    return board(w,h,g=>{
      g.fillStyle='#ffd34a';g.textAlign='left';g.fillText('Dungeon roster',gap,18);
      list.forEach((pair,i)=>{
        const s=SPR[pair[0]];if(!s)return;
        const col=i%cols,row=(i/cols)|0;
        const x=gap+col*(cell+gap+28),y=32+row*(cell+labelH+gap);
        const sc=Math.min(scale,Math.floor((cell-8)/Math.max(s.w,s.h)));
        g.imageSmoothingEnabled=false;
        g.drawImage(s.c,x+(cell-s.w*sc)/2,y+(cell-s.h*sc)/2,s.w*sc,s.h*sc);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(pair[1],x+cell/2,y+cell+12);
      });
    });
  }
  if(kind==='bags'){
    const names=['brown','pink','purple','cyan','blue','white'];
    const cell=10*scale;
    const w=gap+names.length*(cell+gap),h=28+cell+labelH;
    return board(w,h,g=>{
      g.fillStyle='#ffd34a';g.textAlign='left';g.fillText('Loot bags',gap,16);
      names.forEach((name,i)=>{
        const s=SPR.bags[name],x=gap+i*(cell+gap);
        g.imageSmoothingEnabled=false;
        g.drawImage(s.c,x+(cell-s.w*scale)/2,24,s.w*scale,s.h*scale);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(name,x+cell/2,24+cell+12);
      });
    });
  }
  if(kind==='rings'){
    const cell=(8+2)*scale,cols=8,rows=STATK.length;
    const nameW=78;
    const w=nameW+gap+cols*(cell+gap),h=28+rows*(cell+labelH+gap);
    return board(w,h,g=>{
      g.fillStyle='#ffd34a';g.textAlign='left';g.fillText('Rings',gap,16);
      g.textAlign='center';g.fillStyle='#d8d0ea';
      for(let t=0;t<cols;t++)g.fillText('T'+t,nameW+t*(cell+gap)+cell/2,28+12);
      STATK.forEach((stat,row)=>{
        const y=28+row*(cell+labelH+gap);
        g.textAlign='left';g.fillStyle='#d8d0ea';g.fillText(RING_NOUN[stat],6,y+cell/2);
        for(let t=0;t<cols;t++){
          const sp=itemSpr(mkRing(t,stat));
          const icon=outlinedIcon(sp,scale);
          g.drawImage(icon,nameW+t*(cell+gap)+(cell-icon.width)/2,y+16);
        }
      });
    });
  }
  const labels=['T0','T1','T2','T3','T4','T5','T6','T7','UT','TST'];
  const cell=(8+2)*scale,cols=labels.length;
  const w=gap+cols*(cell+gap),h=28+cell+labelH;
  return board(w,h,g=>{
    g.fillStyle='#ffd34a';g.textAlign='left';g.fillText('Swords',gap,16);
    g.textAlign='center';
    for(let t=0;t<cols;t++){
      const s=t<9?gearSpr('sword',t):gearSpr('sword','test');
      const icon=outlinedIcon(s,scale);
      const x=gap+t*(cell+gap);
      g.drawImage(icon,x+(cell-icon.width)/2,24);
      g.fillStyle='#d8d0ea';g.fillText(labels[t],x+cell/2,24+cell+12);
    }
  });
}
function renderPlate(kind){
  const scale=6,gap=10,labelH=16;
  const font='bold 13px ui-monospace,Menlo,Consolas,monospace';
  function board(w,h,draw){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;
    g.fillStyle='#14121c';g.fillRect(0,0,w,h);
    g.font=font;draw(g);
    return c.toDataURL('image/png');
  }
  function blit(g,sp,x,y){
    if(!sp)return;
    const icon=sp.id?outlinedIcon(sp,scale):null;
    g.imageSmoothingEnabled=false;
    if(icon)g.drawImage(icon,x,y);
    else g.drawImage(sp.c,x,y,sp.w*scale,sp.h*scale);
  }
  if(kind==='morvane'){
    const s=SPR.king,sc=6;
    return board(Math.max(280,s.w*sc+48),s.h*sc+56,g=>{
      g.fillStyle='#ffd34a';g.fillText('Morvane, the Hollow Guard',12,20);
      g.imageSmoothingEnabled=false;g.drawImage(s.c,24,36,s.w*sc,s.h*sc);
    });
  }
  if(kind==='uts'){
    const pairs=[['Void Blade',mkVoidBlade(),mkWeapon('sword',7)],['Vine Bow',mkVineBow(),mkWeapon('bow',7)],['Magma Staff',mkMagmaStaff(),mkWeapon('staff',7)]];
    const cell=(8+2)*scale;
    return board(280,36+pairs.length*(cell+28),g=>{
      g.fillStyle='#ffd34a';g.fillText('Dungeon UTs beside T7',12,20);
      pairs.forEach((row,i)=>{
        const y=36+i*(cell+28);
        g.fillStyle='#d8d0ea';g.fillText(row[0],12,y+16);
        blit(g,itemSpr(row[1]),150,y);
        g.fillStyle='#aaa';g.fillText('UT',150,y+cell+14);
        blit(g,itemSpr(row[2]),210,y);
        g.fillText('T7',214,y+cell+14);
      });
    });
  }
  if(kind==='gear'){
    const lines=[['Wand',t=>gearSpr('wand',t)],['Dagger',t=>gearSpr('dagger',t)],['Tome',t=>gearSpr('tome',t)],['Helm',t=>gearSpr('helm',t)],['Cloak',t=>gearSpr('cloak',t)]];
    const cell=(8+2)*scale,cols=8,nameW=70;
    return board(nameW+cols*(cell+gap)+gap,36+lines.length*(cell+labelH+gap),g=>{
      g.fillStyle='#ffd34a';g.fillText('Wands, daggers, tomes, helms, cloaks',12,20);
      lines.forEach((line,row)=>{
        const y=36+row*(cell+labelH+gap);
        g.fillStyle='#d8d0ea';g.fillText(line[0],8,y+cell/2);
        for(let t=0;t<cols;t++){
          const sp=line[1](t);if(!sp)continue;
          blit(g,sp,nameW+t*(cell+gap),y);
          g.fillStyle='#aaa';g.textAlign='center';g.fillText('T'+t,nameW+t*(cell+gap)+cell/2,y+cell+12);g.textAlign='left';
        }
      });
    });
  }
  if(kind==='classes'){
    const keys=CLASSKEYS,cell=16*scale;
    return board(keys.length*(cell+16)+16,cell+48,g=>{
      g.fillStyle='#ffd34a';g.fillText('Classes',12,18);
      keys.forEach((k,i)=>{
        const s=SPR[CLASSES[k].spr],x=12+i*(cell+16);
        g.imageSmoothingEnabled=false;g.drawImage(s.c,x+(cell-s.w*scale)/2,28,s.w*scale,s.h*scale);
        g.fillStyle=CLASSES[k].col;g.textAlign='center';g.fillText(CLASSES[k].name,x+cell/2,36+cell);g.textAlign='left';
      });
    });
  }
  if(kind==='staffwand'||kind==='spelltome'||kind==='helms'||kind==='cloaks'){
    const cell=(8+2)*scale,nameW=78;
    const lines=kind==='staffwand'?[['Staff',t=>gearSpr('staff',t)],['Wand',t=>gearSpr('wand',t)]]
      :kind==='spelltome'?[['Spellbook',t=>gearSpr('spell',t)],['Tome',t=>gearSpr('tome',t)]]
      :kind==='helms'?[['Helm',t=>gearSpr('helm',t)]]
      :[['Cloak',t=>gearSpr('cloak',t)]];
    const title=kind==='staffwand'?'Staffs above wands':kind==='spelltome'?'Spellbooks above tomes':kind==='helms'?'Helms':'Cloaks';
    return board(nameW+8*(cell+gap)+gap,36+lines.length*(cell+labelH+gap),g=>{
      g.fillStyle='#ffd34a';g.fillText(title,12,20);
      lines.forEach((line,row)=>{
        const y=32+row*(cell+labelH+gap);
        g.fillStyle='#d8d0ea';g.textAlign='left';g.fillText(line[0],8,y+cell/2);
        for(let t=0;t<8;t++){
          blit(g,line[1](t),nameW+t*(cell+gap),y);
          g.fillStyle='#aaa';g.textAlign='center';g.fillText('T'+t,nameW+t*(cell+gap)+cell/2,y+cell+12);g.textAlign='left';
        }
      });
    });
  }
  if(kind==='abilities'){
    const lines=[['Spellbook',t=>gearSpr('spell',t)],['Quiver',t=>gearSpr('quiver',t)],['Shield',t=>gearSpr('shield',t)],['Tome',t=>gearSpr('tome',t)],['Helm',t=>gearSpr('helm',t)],['Cloak',t=>gearSpr('cloak',t)]];
    const cell=(8+2)*scale,cols=6,nameW=88;
    return board(nameW+cols*(cell+gap)+gap,36+lines.length*(cell+labelH+gap),g=>{
      g.fillStyle='#ffd34a';g.fillText('Abilities T0–T5',12,20);
      lines.forEach((line,row)=>{
        const y=36+row*(cell+labelH+gap);
        g.fillStyle='#d8d0ea';g.fillText(line[0],8,y+cell/2);
        for(let t=0;t<cols;t++){
          blit(g,line[1](t),nameW+t*(cell+gap),y);
          g.fillStyle='#aaa';g.textAlign='center';g.fillText('T'+t,nameW+t*(cell+gap)+cell/2,y+cell+12);g.textAlign='left';
        }
      });
    });
  }
  if(kind==='potions'){
    const keys=[['hp','HP'],['mp','MP'],['def','Defense'],['dex','Dexterity'],['vit','Vitality'],['wis','Wisdom'],['spd','Speed'],['att','Attack'],['life','Life'],['mana','Mana']];
    const cell=(8+2)*scale;
    return board(keys.length*(cell+16)+20,cell+56,g=>{
      g.fillStyle='#ffd34a';g.fillText('HP/MP draughts and stat potions',12,18);
      keys.forEach((pair,i)=>{
        const x=12+i*(cell+16);
        blit(g,SPR.pots[pair[0]],x,30);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(pair[1],x+cell/2,40+cell);g.textAlign='left';
      });
    });
  }
  if(kind==='serpentwand'){
    const cell=(8+2)*scale;
    return board(360,cell+70,g=>{
      g.fillStyle='#ffd34a';g.fillText('Serpent Wand beside the T7 wand',12,20);
      blit(g,itemSpr(mkSerpentWand()),40,36);
      g.fillStyle='#d8d0ea';g.fillText('Serpent Wand',28,36+cell+16);
      blit(g,itemSpr(mkWeapon('wand',7)),200,36);
      g.fillText('T7 Wand',196,36+cell+16);
    });
  }
  if(kind==='serpentfoes'){
    const list=[['cobraspitter','Cobra Spitter'],['viper','Dash Viper'],['naga','Naga Guard'],['clutch','Egg Clutch'],['constrictor','Constrictor'],['hatchling','Hatchling'],['ourohead','Serpent King'],['serpentbody','Body']];
    const cell=20*scale,cols=4;
    return board(gap+cols*(cell+gap),40+2*(cell+labelH+gap),g=>{
      g.fillStyle='#ffd34a';g.textAlign='left';g.fillText("Serpent's Coil roster",12,20);
      list.forEach((pair,i)=>{
        const s=SPR[pair[0]];if(!s)return;
        const col=i%cols,row=(i/cols)|0,x=gap+col*(cell+gap),y=36+row*(cell+labelH+gap);
        const sc=Math.min(scale,Math.floor((cell-8)/Math.max(s.w,s.h)));
        g.imageSmoothingEnabled=false;
        g.drawImage(s.c,x+(cell-s.w*sc)/2,y+(cell-s.h*sc)/2,s.w*sc,s.h*sc);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(pair[1],x+cell/2,y+cell+12);g.textAlign='left';
      });
    });
  }
  if(kind==='pots'){
    const keys=[['life','Life'],['mana','Mana'],['att','Attack'],['def','Defense'],['spd','Speed'],['dex','Dexterity'],['vit','Vitality'],['wis','Wisdom']];
    const cell=(8+2)*scale;
    return board(keys.length*(cell+18)+16,cell+48,g=>{
      g.fillStyle='#ffd34a';g.fillText('Stat potions',12,18);
      keys.forEach((pair,i)=>{
        const x=12+i*(cell+18);
        blit(g,SPR.pots[pair[0]],x,28);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(pair[1],x+cell/2,36+cell);g.textAlign='left';
      });
    });
  }
  return null;
}
function hubOverview(){
  if(!hub)hub=genHub();
  const src=hub.canvas;
  const c=document.createElement('canvas');c.width=src.width;c.height=src.height;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.drawImage(src,0,0);
  for(const a of hub.arches||[])drawGate(g,a);
  const p=hub.portal;
  g.fillStyle='#9a6aff';g.beginPath();g.arc(p.x,p.y,8,0,TAU);g.fill();
  g.fillStyle='#e0d0ff';g.beginPath();g.arc(p.x,p.y,3,0,TAU);g.fill();
  if(SPR.fountain)g.drawImage(SPR.fountain.c,hub.fountain.x-9,hub.fountain.y-8);
  for(const d of hub.dress||[]){
    const s=SPR[d.k];if(!s)continue;
    g.drawImage(s.c,d.x-s.w/2,d.y-s.h);
  }
  if(hub.chest&&SPR.chest)g.drawImage(SPR.chest.c,hub.chest.x-9,hub.chest.y-11,18,16);
  const vp=hub.vault;
  if(vp){g.fillStyle='#3ad0a0';g.beginPath();g.arc(vp.x,vp.y,6,0,TAU);g.fill();}
  return c.toDataURL('image/png');
}
function exportArt(){
  const scale=8,gap=14,cell=(8+2)*scale,label=22,nameW=120;
  function board(w,h,draw){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;
    g.fillStyle='#16141e';g.fillRect(0,0,w,h);
    g.font='bold 18px ui-monospace,Menlo,Consolas,monospace';
    draw(g);return c.toDataURL('image/png');
  }
  function iconAt(g,sp,x,y){
    if(!sp)return;
    g.imageSmoothingEnabled=false;
    if(sp.id){const icon=outlinedIcon(sp,scale);g.drawImage(icon,x+(cell-icon.width)/2,y+(cell-icon.height)/2);}
    else g.drawImage(sp.c,x+(cell-sp.w*scale)/2,y+(cell-sp.h*scale)/2,sp.w*scale,sp.h*scale);
  }
  function tierSheet(title,lines,n){
    const w=nameW+n*(cell+gap)+gap,h=48+lines.length*(cell+label+gap);
    return board(w,h,g=>{
      g.fillStyle='#ffd34a';g.fillText(title,12,24);
      g.font='bold 14px ui-monospace,Menlo,Consolas,monospace';g.textAlign='center';g.fillStyle='#aaa';
      for(let t=0;t<n;t++)g.fillText('T'+t,nameW+t*(cell+gap)+cell/2,44);
      lines.forEach((line,row)=>{
        const y=52+row*(cell+label+gap);
        g.textAlign='left';g.fillStyle='#d8d0ea';g.fillText(line[0],8,y+cell/2);
        for(let t=0;t<n;t++)iconAt(g,line[1](t),nameW+t*(cell+gap),y);
      });
    });
  }
  const weapons=tierSheet('Weapons',[['Staff',t=>gearSpr('staff',t)],['Bow',t=>gearSpr('bow',t)],['Sword',t=>gearSpr('sword',t)],['Wand',t=>gearSpr('wand',t)],['Dagger',t=>gearSpr('dagger',t)]],8);
  const abilities=tierSheet('Abilities',[['Spellbook',t=>gearSpr('spell',t)],['Quiver',t=>gearSpr('quiver',t)],['Shield',t=>gearSpr('shield',t)],['Tome',t=>gearSpr('tome',t)],['Helm',t=>gearSpr('helm',t)],['Cloak',t=>gearSpr('cloak',t)]],6);
  const armors=tierSheet('Armor',[['Robe',t=>gearSpr('robe',t)],['Leather',t=>gearSpr('leather',t)],['Plate',t=>gearSpr('heavy',t)]],8);
  const ringSheet=(()=>{
    const cols=8,rows=STATK.length,w=nameW+cols*(cell+gap)+gap,h=48+rows*(cell+label+gap);
    return board(w,h,g=>{
      g.fillStyle='#ffd34a';g.fillText('Rings',12,24);
      g.font='bold 14px ui-monospace,Menlo,Consolas,monospace';g.textAlign='center';g.fillStyle='#aaa';
      for(let t=0;t<cols;t++)g.fillText('T'+t,nameW+t*(cell+gap)+cell/2,44);
      STATK.forEach((stat,row)=>{
        const y=52+row*(cell+label+gap);
        g.textAlign='left';g.fillStyle='#d8d0ea';g.fillText(RING_NOUN[stat],8,y+cell/2);
        for(let t=0;t<cols;t++)iconAt(g,itemSpr(mkRing(t,stat)),nameW+t*(cell+gap),y);
      });
    });
  })();
  const goods=(()=>{
    const keys=[['Healing','hp'],['Mana','mp'],['Defense','def'],['Dexterity','dex'],['Vitality','vit'],['Wisdom','wis'],['Speed','spd'],['Attack','att'],['Life','life'],['Mana elixir','mana']];
    const bags=['brown','pink','purple','cyan','blue','white'];
    const keyNames=[['Beacon',SPR.key],['Tide',SPR.keyTide],['Hex',SPR.keyHex],['Cinder',SPR.keyCinder],['Void',SPR.keyVoid],['Coil',SPR.keyCoil]];
    const cols=Math.max(keys.length,bags.length,keyNames.length);
    const w=gap+cols*(cell+gap),h=40+3*(cell+label+gap);
    return board(w,h,g=>{
      g.fillStyle='#ffd34a';g.fillText('Potions, keys, bags',12,24);
      g.font='bold 13px ui-monospace,Menlo,Consolas,monospace';
      keys.forEach((pair,i)=>{iconAt(g,SPR.pots[pair[1]],gap+i*(cell+gap),40);g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(pair[0],gap+i*(cell+gap)+cell/2,40+cell+16);});
      keyNames.forEach((pair,i)=>{iconAt(g,pair[1],gap+i*(cell+gap),40+cell+label+gap);g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(pair[0],gap+i*(cell+gap)+cell/2,40+2*(cell)+label+16);});
      bags.forEach((name,i)=>{
        const s=SPR.bags[name];
        g.imageSmoothingEnabled=false;
        g.drawImage(s.c,gap+i*(cell+gap)+(cell-s.w*scale)/2,40+2*(cell+label+gap)+(cell-s.h*scale)/2,s.w*scale,s.h*scale);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(name,gap+i*(cell+gap)+cell/2,40+2*(cell+label+gap)+cell+16);
      });
    });
  })();
  function foeSheet(title,names,zoom){
    const sample=names.map(n=>SPR[n]).filter(Boolean);
    const biggest=sample.reduce((m,s)=>Math.max(m,s.w,s.h),8);
    const sc0=zoom||Math.min(8,Math.floor(200/biggest));
    const fw=Math.max(160,biggest*sc0+24),fh=fw,cols=zoom?5:4,rows=Math.ceil(names.length/cols);
    return board(gap+cols*(fw+gap),48+rows*(fh+28),g=>{
      g.fillStyle='#ffd34a';g.fillText(title,12,24);
      g.font='bold 14px ui-monospace,Menlo,Consolas,monospace';
      names.forEach((name,i)=>{
        const s=SPR[name];if(!s)return;
        const col=i%cols,row=(i/cols)|0,x=gap+col*(fw+gap),y=40+row*(fh+28);
        const sc=zoom||Math.min(8,Math.floor((fw-16)/Math.max(s.w,s.h)));
        g.imageSmoothingEnabled=false;
        g.drawImage(s.c,x+(fw-s.w*sc)/2,y+(fh-s.h*sc)/2,s.w*sc,s.h*sc);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.fillText(name,x+fw/2,y+fh+14);
      });
    });
  }
  const enemies=foeSheet('Enemies, gods, bosses',[
    'crab','imp','gull','slime','hermit','jelly','wolf','hexer','dire','treant','bandit','moss',
    'ogre','wisp','cinder','wraith','beetle','hound','eye','colossus','oracle','saint','wyrm','titan','voidkeeper','idol','serpent',
    'king','tideclaw','hexmatron','broodqueen','archon','ourohead','tidematron','heximp','bogtoad','cursetreant','hivedrone','ashlarva','acolyte','naga','viper'
  ]);
  const events=foeSheet('Realm events',['saltwyrm','briarstag','ashphoenix','marblesphinx']);
  const gods=foeSheet('Godlands gods',['eye','colossus','oracle','saint','wyrm','titan','voidkeeper','idol','serpent','king'],6);
  const bosses=foeSheet('Events and bosses',['saltwyrm','briarstag','ashphoenix','marblesphinx','tideclaw','hexmatron','broodqueen','archon','ourohead','king'],6);
  const heroes=(()=>{
    const keys=CLASSKEYS,fw=160;
    return board(gap+keys.length*(fw+gap),fw+70,g=>{
      g.fillStyle='#ffd34a';g.fillText('Classes',12,24);
      g.font='bold 14px ui-monospace,Menlo,Consolas,monospace';
      keys.forEach((k,i)=>{
        const s=SPR[CLASSES[k].spr],x=gap+i*(fw+gap);
        const sc=Math.min(8,Math.floor((fw-8)/Math.max(s.w,s.h)));
        g.imageSmoothingEnabled=false;
        g.drawImage(s.c,x+(fw-s.w*sc)/2,36,s.w*sc,s.h*sc);
        g.fillStyle=CLASSES[k].col;g.textAlign='center';g.fillText(CLASSES[k].name,x+fw/2,36+s.h*sc+18);
      });
    });
  })();
  return {weapons,abilities,armors,rings:ringSheet,goods,enemies,events,heroes,gods,bosses};
}
function gameScaleSheet(){
  const zoom=4;
  const scaleFor=key=>{
    if(key==='serpentbody'||key==='serpenttail'||(key&&key.indexOf('serpent_')===0))return 1;
    for(const id in EN){const d=EN[id];if(d.spr===key&&d.scale)return d.scale;}
    const sp=SPR[key];
    return sp&&sp.fit?sp.fit:1;
  };
  const groups=[
    ['Gods',['eye','colossus','oracle','saint','wyrm','titan','voidkeeper','idol','serpent']],
    ['Bosses',['tideclaw','hexmatron','broodqueen','archon','ourohead','king']],
    ['Events',['saltwyrm','briarstag','ashphoenix','marblesphinx']],
    ['Serpent',['serpentbody','serpenttail']],
    ['Enemies',Object.keys(window.SHARD_ART.ENEMY_FRAMES)],
    ['Classes',CLASSKEYS.slice()]
  ];
  const minCell={Enemies:96,Serpent:120,Classes:78};
  const measured=groups.map(([title,keys])=>keys.map(key=>{
    const sp=SPR[key];if(!sp)return null;
    const sc=scaleFor(key);
    const dw=sp.w*sc*zoom,dh=sp.h*sc*zoom;
    return {key,sp,sc,dw,dh,w:Math.max(dw,minCell[title]||0),h:dh};
  }).filter(Boolean));
  const gap=16,label=18,titleH=28,pad=12;
  const cols=groups.map((g,i)=>g[0]==='Enemies'?11:g[0]==='Classes'?6:measured[i].length);
  let width=640,height=pad;
  measured.forEach((row,i)=>{
    const c=Math.max(1,cols[i]);
    const rows=Math.ceil(row.length/c);
    let rowW=pad;
    for(let k=0;k<Math.min(c,row.length);k++)rowW+=row[k].w+gap;
    width=Math.max(width,rowW+80);
    let block=titleH;
    for(let r=0;r<rows;r++){
      let mh=0;for(let k=0;k<c&&r*c+k<row.length;k++)mh=Math.max(mh,row[r*c+k].h);
      block+=mh+label+gap;
    }
    height+=block;
  });
  const c=document.createElement('canvas');c.width=Math.ceil(width);c.height=Math.ceil(height);
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.fillStyle='#14121c';g.fillRect(0,0,c.width,c.height);
  g.font='bold 16px ui-monospace,Menlo,Consolas,monospace';
  let y=pad;
  measured.forEach((row,i)=>{
    g.fillStyle='#ffd34a';g.textAlign='left';g.fillText(groups[i][0]+'  ·  game scale',pad,y+16);
    y+=titleH;
    const cN=Math.max(1,cols[i]);
    const rows=Math.ceil(row.length/cN);
    for(let r=0;r<rows;r++){
      const slice=row.slice(r*cN,(r+1)*cN);
      const mh=slice.reduce((m,it)=>Math.max(m,it.h),0);
      let x=pad;
      slice.forEach(it=>{
        g.imageSmoothingEnabled=false;
        g.drawImage(it.sp.c,x+(it.w-it.dw)/2,y+(mh-it.h)/2,it.dw,it.dh);
        g.fillStyle='#d8d0ea';g.textAlign='center';g.font='bold 12px ui-monospace,Menlo,Consolas,monospace';
        g.fillText(it.key,x+it.w/2,y+mh+14);
        x+=it.w+gap;
      });
      y+=mh+label+gap;
    }
  });
  return c.toDataURL('image/png');
}
function classAnimStrip(){
  const zoom=8,gap=10,label=22,pad=14;
  const frames=[{i:0,name:'stand'},{i:1,name:'walk1'},{i:2,name:'walk2'}];
  const cell=10*zoom;
  const c=document.createElement('canvas');
  c.width=pad+CLASSKEYS.length*(frames.length*(cell+6)+gap+28);
  c.height=pad+28+cell+label;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.fillStyle='#14121c';g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#ffd34a';g.font='bold 16px ui-monospace,Menlo,Consolas,monospace';g.textAlign='left';
  g.fillText('Classes  ·  stand, walk1, walk2  ·  side, game scale',pad,18);
  CLASSKEYS.forEach((k,ci)=>{
    const sp=SPR[CLASSES[k].spr];
    const x0=pad+ci*(frames.length*(cell+6)+gap+36);
    frames.forEach((f,fi)=>{
      const fr=sp.frames?sp.frames[f.i]:sp;
      const x=x0+fi*(cell+6);
      g.imageSmoothingEnabled=false;
      g.drawImage(fr.c,x+(cell-fr.w*zoom)/2,32+(cell-fr.h*zoom)/2,fr.w*zoom,fr.h*zoom);
      g.fillStyle='#9a94aa';g.font='11px ui-monospace,Menlo,Consolas,monospace';g.textAlign='center';
      g.fillText(f.name,x+cell/2,32+cell+14);
    });
    g.fillStyle=CLASSES[k].col;g.font='bold 13px ui-monospace,Menlo,Consolas,monospace';
    g.fillText(CLASSES[k].name,x0+frames.length*(cell+6)/2,32+cell+label+8);
  });
  return c.toDataURL('image/png');
}
window.__shardwild={version:GAME_VERSION,get state(){return state;},get P(){return P;},get world(){return world;},startNew,continueGame,enterRealm,enterHub,useAbility,sampleTerrain,get fps(){return fps;},get bullets(){return ebN;},get shots(){return pbN;},previewSheet,contactSheet,renderPlate,exportArt,hubOverview,gameScaleSheet,classAnimStrip,
  teleport(x,y){if(P){P.x=x;P.y=y;}},setInv(){},get invOpen(){return false;},
  get ui(){return uiRects.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,kind:r.kind,tag:r.tag||'',tab:r.tab||'',beacon:r.beacon||'',unlocked:!!r.unlocked,where:r.where||'',slot:r.slot==null?-1:r.slot,stat:r.stat||'',maxed:!!r.maxed,label:r.label||''}));},
  get slots(){return uiRects.filter(r=>r.kind==='slot').map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,area:r.ref.area,i:r.ref.i,slot:r.ref.slot,name:r.item?r.item.name:null,tier:r.item?r.item.tier:null,kind:r.item?r.item.kind:null,stat:r.item?(r.item.stat||r.item.kind||''):'',wep:r.item&&r.item.w?r.item.w:'',dim:!!(r.item&&classLocked(r.item)),tag:r.tag||''}));},
  get layout(){const L=layoutC;return {play:L.play,panel:L.panel,portrait:!!L.portrait,move:L.moveAnchor,aim:L.aimAnchor,haven:L.haven,ab:L.ab,stickR:L.stickR,mm:L.mm};},
  get shotsFired(){return shotsFired;},
  get aiming(){return input.aim.id!==null;},
  get testWeapons(){return ['staff','bow','sword'].map(w=>{const it=mkTestWeapon(w);return {name:it.name,w:w,rate:it.rate,lethal:!!it.lethal,test:!!it.test};});},
  get slotMax(){return SLOTN;},
  get classKeys(){return CLASSKEYS.slice();},
  get statuses(){return P?statusEntries(P).map(s=>({name:s.name,t:s.t,sub:s.sub})):[];},
  get paused(){return !!layoutC.portrait;},get overlay(){return layoutC.portrait?'rotate':null;},
  get mapOpen(){return mapOpen;},get chestOpen(){return !!nearChest();},get flash(){return tpFlash;},
  get place(){return !world?'':world.isVault?'vault':world.isHub?'haven':world.isDungeon?'dungeon':'realm';},
  get vaultOpen(){const c=nearVaultChest();return c?c.i:-1;},
  get vaultItems(){return loadVault().chests.map(c=>c.map(it=>it?it.name:null));},
  get chars(){const r=ensureRoster();return r.slots.map((s,i)=>{const live=i===activeSlot&&P&&state==='play';const src=live?P:s;return src?{cls:src.cls,lvl:src.lvl,inv:(src.inv||[]).map(it=>it&&it.name),weapon:src.eq&&src.eq.weapon?src.eq.weapon.name:null}:null;});},
  get foes(){return world?world.enemies.map((e,i)=>({i,name:e.name,type:e.type,hp:e.hp,max:e.maxhp,boss:!!e.d.boss,dungeonBoss:!!e.d.dungeonBoss,god:!!e.d.god,event:!!e.d.event,x:e.x,y:e.y,r:e.d.r,scale:e.d.scale||1,zone:e.zone,homeX:e.homeX,homeY:e.homeY,slow:e.slow||0,stun:e.stun||0,para:e.para||0,weak:e.weak||0,poison:e.poison||0,segs:e.segs?e.segs.length:0})):[]},
  spawnFoe(type){if(!P||!world)return null;const ang=Math.atan2(-8,46);const e=spawnEnemy(world,type||'colossus',P.x+Math.cos(ang)*42,P.y+Math.sin(ang)*42,3,false);return {name:e.name,hp:e.hp,max:e.maxhp,boss:!!e.d.boss,god:!!e.d.god,scale:e.d.scale||1,r:e.d.r};},
  spawnAt(type,x,y,zone){if(!world)return null;const z=zone==null?zoneAt(world,x,y):zone;const e=spawnEnemy(world,type,x,y,z,false);return {i:world.enemies.indexOf(e),name:e.name,type:e.type,god:!!e.d.god,scale:e.d.scale||1,r:e.d.r,x:e.x,y:e.y,zone:e.zone,homeX:e.homeX,homeY:e.homeY};},
  moveFoe(i,x,y){const e=world&&world.enemies[i];if(!e)return false;e.x=x;e.y=y;return true;},
  clearFoes(){if(!world)return;world.enemies=world.enemies.filter(e=>e.d.boss);ebN=0;},
  pump(n){const steps=n||1;for(let i=0;i<steps;i++)update(0.05);},
  zoneAt(x,y){return world?zoneAt(world,x,y):-1;},
  blocked(x,y){return !world||solidBox(world,x,y,6);},
  openAt(x,y){return !!(world&&!solidBox(world,x,y,3));},
  findLeashPull(){
    if(!world||world.isHub)return null;
    const wd=world,cx=wd.cx,cy=wd.cy;
    function openSeg(x0,y0,x1,y1){
      for(let s=0;s<=8;s++){
        const t=s/8,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;
        if(solidBox(wd,x,y,4))return false;
      }
      return true;
    }
    for(let a=0;a<TAU;a+=0.35){
      let prev=null;
      const reach=wd.w*TS*0.48;
      for(let dist=140;dist<reach;dist+=8){
        const x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist;
        const z=zoneAt(wd,x,y);
        if(z<0||solidBox(wd,x,y,5)){prev=null;continue;}
        if(prev&&prev.z===1&&z===0){
          const hx=prev.x,hy=prev.y;
          const ox=x+Math.cos(a)*48,oy=y+Math.sin(a)*48;
          const fx=ox+Math.cos(a)*48,fy=oy+Math.sin(a)*48;
          const pull=Math.hypot(ox-hx,oy-hy);
          if(pull>LEASH_MARGIN+12&&pull<LEASH_DESPAWN-20&&zoneAt(wd,hx,hy)===1&&zoneAt(wd,ox,oy)!==1&&zoneAt(wd,fx,fy)!==1&&!solidBox(wd,ox,oy,5)&&!solidBox(wd,fx,fy,4)&&openSeg(ox,oy,hx,hy)){
            return {hx,hy,x:ox,y:oy,px:fx,py:fy,homeZone:1,outZone:zoneAt(wd,ox,oy)};
          }
        }
        prev=(z===0||z===1)?{x,y,z}:null;
      }
    }
    return null;
  },
  godInfo(){const z=ZONES[3],c=SPAWN_CFG[3];return {name:z.name,types:z.types.slice(),cap:c.cap,elite:c.elite,kinds:z.types.map(t=>({type:t,name:EN[t].name,god:!!EN[t].god,scale:EN[t].scale||1,r:EN[t].r,hp:EN[t].hp}))};},
  get capTable(){const o={};for(const k of CLASSKEYS)o[k]=Object.assign({},CLASSES[k].max);return o;},
  enterVault,leaveVault,openCharSelect,
  get audio(){return {unlocked:AUD.unlocked,state:AUD.state(),sfx:AUD.sfxOn,music:AUD.musicOn,played:AUD.played,notes:AUD.notes,mood:AUD.mood};},
  get projectiles(){const out=[];for(let i=0;i<pbN;i++)out.push({x:PB[i].x,y:PB[i].y,col:PB[i].col,shape:PB[i].shape,helix:!!PB[i].helix,spin:PB[i].spin||0});return out;},
  spriteInfo(kind,tier){
    const it=(kind==='staff'||kind==='bow'||kind==='sword')?mkWeapon(kind,tier):(kind==='robe'||kind==='leather'||kind==='heavy')?mkArmor(kind,tier):(kind==='ring'||(kind&&kind.indexOf('ring_')===0))?mkRing(tier,kind==='ring'?'hp':kind.slice(5)):mkAbility(kind==='quiver'?'archer':kind==='shield'?'knight':'wizard',tier);
    const s=itemSpr(it);const im=s.c.getContext('2d').getImageData(0,0,s.c.width,s.c.height).data;
    let mask='',r=0,g=0,b=0,n=0,hot=0;
    for(let i=0;i<im.length;i+=4){
      const R=im[i],G=im[i+1],B=im[i+2];
      if(im[i+3]>200&&!(R===13&&G===11&&B===18)){mask+='1';r+=R;g+=G;b+=B;n++;hot=Math.max(hot,Math.max(R,G,B)-Math.min(R,G,B));}
      else mask+='0';
    }
    return {name:it.name,tier:it.tier,col:it.col||null,shot:it.shot||null,mask:mask,n:n,avg:(n?(r/n|0):0)*65536+(n?(g/n|0):0)*256+(n?(b/n|0):0),hot:hot};
  },
  get beacons(){return P&&P.beacons?P.beacons.slice():[];},
  get catalog(){const items=itemCatalog();const test=items.filter(isTestItem);return {n:items.length,weapons:items.filter(i=>i.kind==='weapon').length,abilities:items.filter(i=>i.kind==='ability').length,armors:items.filter(i=>i.kind==='armor').length,rings:items.filter(i=>i.kind==='ring').length,elixirs:items.filter(i=>i.kind==='elixir').length,pots:items.filter(i=>i.kind==='hp'||i.kind==='mp').length,mastery:items.filter(i=>i.kind==='mastery').length,key:items.some(i=>i.kind==='beaconkey'),dungeonKeys:items.filter(i=>i.kind==='dungeonkey').length,test:test.length,testNames:test.map(i=>i.name)};},
  get caps(){return P?Object.assign({},CLASSES[P.cls].max):null;},
  get statText(){if(!P)return [];return STATK.map(k=>{const cap=statCap(P.cls,k);return {k,text:STATN[k]+' '+P.stats[k]+'/'+cap,base:P.stats[k],eff:eff(k),cap,maxed:P.stats[k]>=cap};});},
  get toasts(){return toasts.map(t=>t.t);},
  get sticks(){return {move:input.move.id!==null,aim:input.aim.id!==null,shots:pbN};},
  setStat(k,v){if(P&&STATK.indexOf(k)>=0)P.stats[k]=v;},
  save(){saveGame();},
  get tooltip(){const ref=(ptr&&ptr.tip&&ptr.ref)||(heldTip&&heldTip.ref);if(!ref)return null;const it=readItem(ref);return it?it.name:null;},
  get tooltipLines(){const ref=(ptr&&ptr.tip&&ptr.ref)||(heldTip&&heldTip.ref);if(!ref)return [];const it=readItem(ref);return it?itemLines(it):[];},
  fireOnce(){return P&&P.eq&&P.eq.weapon?fireWeapon(P.eq.weapon):0;},
  debugStatus(fx){if(!P)return;addEB(P.x,P.y,0,0,0,4,0.4,'#d8a0ff',fx,'test');},
  holdKey(code,on){input.keys[code]=!!on;},
  enterDungeon,auditBurrows,auditDens,auditCoil,layoutDen,layoutCoil,genDen,genCoil,genThrone,
  setClear(n){
    n=clamp(n|0,0,8);
    if(P)P.realmClear=n;
    if(realm){
      realm.clearKills=n;
      clearBarCache={k:-1,c:null};
      if(n>=8&&!realm.boss)spawnBoss(realm);
      if(n<8&&realm.boss&&realm.boss.type==='king'){
        realm.enemies=realm.enemies.filter(e=>e!==realm.boss);
        realm.boss=null;
      }
    }
    return {kills:n,pct:clearPct(n),boss:!!(realm&&realm.boss)};
  },
  get clear(){return realm?{kills:realm.clearKills||0,pct:clearPct(realm.clearKills||0)}:null;},
  get lairs(){return realm&&realm.lairs?realm.lairs.map(l=>({event:l.event,x:l.x,y:l.y,zone:l.zone,busy:!!l.busy})):[];},
  setMegaPhase(n){
    if(!world||!world.boss||world.boss.type!=='megaking')return null;
    ebN=0;
    const e=world.boss,phase=clamp(n|0,1,5);
    const frac=[1,0.85,0.58,0.32,0.12][phase-1];
    e.hp=e.maxhp*frac;e.mkPhase=phase;e.sprName=megaSpr(phase);e.shield=phase===1||phase===3;
    e.slot=0;e.swapT=0;
    if(phase>1)world.enemies=world.enemies.filter(o=>!o.warden);
    if(phase>=4)collapsePillars(world);
    if(phase>=4&&world.riftReach!=null){
      world.riftReach=world.riftSafe+1.5;
      world.riftT=0;creepRift(world,1);
    }
    const hall=world.hall||e,throne=world.throne||e;
    if(phase===1||phase===3){e.x=throne.x;e.y=throne.y;}
    else if(phase===5){stepGhosts(e,hall);e.x=e.gx;e.y=e.gy;}
    else{e.x=hall.x;e.y=hall.y;}
    if(phase===2){
      const ang=Math.atan2((P?P.y:e.y+40)-e.y,(P?P.x:e.x+10)-e.x);
      throwCrown(e,ang,76);
      if(ebN)EB[ebN-1].age=0.72;
      for(let k=0;k<5;k++)addEB(e.x,e.y,ang+(k-2)*0.16,40,72,2.6,2.4,'#ffd34a',null,e.name);
    }
    if(phase===3){for(const p of world.pylons||[]){p.dead=false;p.hp=p.max;if(world.tiles[p.y*world.w+p.x]!==T_MWALL)world.tiles[p.y*world.w+p.x]=T_MPYLON;}refreshDungeon(world);stepPylons(e,1);}
    if(phase===4)fireGapAt(e,e.x,e.y,22,5,0.6,40,74,'#ff4fa8');
    if(phase===1){
      if(!world.enemies.some(o=>o.warden))setupMega(world);
      e.shield=true;e.mkPhase=1;e.x=throne.x;e.y=throne.y;
    }
    return {phase:e.mkPhase,hp:e.hp,shield:!!e.shield,spr:e.sprName,ghosts:(e.ghosts||[]).length};
  },
  spawnInfo(){return SPAWN_CFG.map((c,z)=>({name:ZONES[z].name,cap:c.cap,every:c.every,n:c.n.slice(),elite:c.elite,types:ZONES[z].types.slice()}));},
  zoneSpot(z){
    if(!world||world.isHub||world.cx==null)return null;
    const wd=world;
    for(let dist=56;dist<wd.w*TS*0.48;dist+=18){
      for(let k=0;k<20;k++){
        const a=k/20*TAU+dist*0.002;
        const x=wd.cx+Math.cos(a)*dist,y=wd.cy+Math.sin(a)*dist;
        if(zoneAt(wd,x,y)!==z||solidBox(wd,x,y,8))continue;
        if(inSafe(x,y)||inBeaconSafe(x,y))continue;
        if(z===3&&Math.hypot(x-wd.cx,y-wd.cy)<30*TS)continue;
        return {x,y};
      }
    }
    return null;
  },
  setPortals(list){if(!world)return;world.portals=(list||[]).map(p=>({id:'tideclaw',name:p.name||'Tideclaw Burrow',dungeon:p.dungeon||'tideclaw',x:p.x,y:p.y,t:80,delay:0}));},
  makeItem(s){
    if(s==='hp'||s==='mp')return mkPot(s);
    if(!s||typeof s!=='object')return null;
    const k=s.k||s.kind;
    if(k==='weapon')return mkWeapon(s.w||(P?CLASSES[P.cls].w:'staff'),s.t||0);
    if(k==='armor')return mkArmor(s.a||(P?CLASSES[P.cls].a:'robe'),s.t||0);
    if(k==='ability')return mkAbility(s.cls||(P?P.cls:'wizard'),s.t||0);
    if(k==='ring')return mkRing(s.t||0,s.stat);
    if(k==='elixir')return s.stat?mkElixirOf(s.stat):mkElixir();
    if(k==='mastery')return mkMastery();
    if(k==='hp'||k==='mp')return mkPot(k);
    if(k==='beaconkey')return mkBeaconKey();
    if(k==='dungeonkey')return mkDungeonKey(s.dungeon||'tideclaw');
    if(k==='tidepearl')return mkTidepearl();
    if(k==='voidblade')return mkVoidBlade();
    if(k==='vinebow')return mkVineBow();
    if(k==='magmastaff')return mkMagmaStaff();
    if(k==='serpentwand')return mkSerpentWand();
    if(k==='test')return mkTestWeapon(s.w||'sword');
    return null;
  },
  grant(spec){if(!P)return null;const it=this.makeItem(spec);if(!it)return null;const i=P.inv.indexOf(null);if(i<0)return null;P.inv[i]=it;return {i,name:it.name,kind:it.kind,tier:it.tier};},
  clearInv(){if(P)P.inv=[null,null,null,null,null,null,null,null];},
  clearBags(){if(world)world.bags.length=0;},
  get bags(){if(!world)return [];return world.bags.map(b=>({x:b.x,y:b.y,t:b.t,col:b.col,n:b.items.length,items:b.items.map(it=>({name:it.name,tier:it.tier,kind:it.kind,w:it.w||'',a:it.a||'',cls:it.cls||'',stat:it.stat||''}))}));},
  spawnBag(list){if(!P||!world)return [];const items=[];for(const s of list||[]){const it=this.makeItem(s);if(it)items.push(it);}if(!items.length)return [];const b=spawnLootBag(P.x,P.y,items,80);return b.items.map(it=>it.name);},
  simLoot,
  abilityCurve(){const rows=[];for(let t=0;t<=5;t++){const b=berserkStats(t);rows.push({t,power:abilityPower(t),heal:tomeHeal(t),dex:b.dex,bdur:b.dur,cloak:cloakDur(t),amp:Math.round(abilAmp(t)*100)/100,cut:abilCut(t)});}rows.push({t:8,power:abilityPower(8),heal:tomeHeal(8),dex:berserkStats(8).dex,bdur:berserkStats(8).dur,cloak:cloakDur(8),amp:abilAmp(8),cut:abilCut(8)});return rows;},
  breaks(){if(!world||!world.breaks)return [];return world.breaks.map(s=>({id:s.id,hp:s.hp,max:s.max,dead:!!s.dead,x:s.x,y:s.y,n:s.tiles.length}));},
  tile(x,y){return world?tileAt(world,x,y):-1;},
  debugBolt(x,y,ang,player,dmg){if(player)addPB(x,y,ang,220,dmg||500,2.4,0.8,'#b6e060',true,null,'dot',false,null);else addEB(x,y,ang,220,40,2.4,0.8,'#ff4ad0',null,'test');},
  get storagePersistent(){return store.persistent;},kill(){if(state==='play')die('a test dummy');}};
})();
