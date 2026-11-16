/* Shardwild dungeon tiles: hand-drawn 8x8 tile art (Sprites). Built by tiles.py in this folder.
 * Nothing here is wired into the game yet. Rotmg adds it only after Joshua says go.
 *
 * FORMAT: same rows/palette format as mkSprite. One palette per dungeon; '.' = transparent.
 *   Base tiles are fully opaque: wallTop, wallTop2, wallLeft, wallRight, wallFace, wallFace2, wallDeep,
 *   floors[], props{}. Overlays use '.': edges{}, details{}, rims{}. Do NOT use mkSprite for these
 *   (it adds an outline and a 1px pad). Paint them 1:1 into the 8x8 tile (TS=8), the way tileRGB does now.
 *
 * DUNGEON KEYS -> game: tideclaw=DUNGEONS.tideclaw ('tide'), hexmire=hexmire ('hex'),
 *   cinder=cinderhive ('cinder'), void=sanctum ('sanctum'), coil=coil ('coil').
 *
 * HOW THE WALL PIECES FIT (RotMG-style "cube" walls). For a wall tile at (tx,ty), with isWall = same-dungeon wall
 * (BWALL/HWALL/CWALL/VWALL/SWALL/SBREAK; out-of-map counts as wall, as burrowWallAt/denWallAt already do;
 * in the Void Sanctum T_VVOID is NOT wall):
 *   1. South neighbour is NOT wall  -> wallFace (or wallFace2 for ~20% of tiles, by hash). This is the visible
 *      front of the wall: a 1px cap row, a bright lip, then two brick courses and a dark base line.
 *      + edges.edgeN if north is not wall (1-tile-thick wall), + edges.faceEdgeL / faceEdgeR if west/east is not wall.
 *   2. Else, all 8 neighbours are wall -> wallDeep (flat dark rock; big solid masses go quiet like RotMG's black).
 *   3. Else -> wallTop (or wallTop2 ~20%), the cap seen from above, then overlay outlines:
 *      edgeN if N not wall, edgeL if W not wall, edgeR if E not wall,
 *      cornerNW if N&&W wall but NW not, cornerNE likewise, cornerSW if W wall but SW not, cornerSE if E wall but SE not.
 *      (wallLeft/wallRight are just wallTop+edgeL / wallTop+edgeR pre-baked, for convenience.)
 * FLOOR SHADOW: on any non-wall tile (floor, prop or hazard; not the void pit), overlay edges.shadowN if the tile
 *   north is wall, and edges.shadowW if the tile west is wall. This replaces wallLip() (the old 2px lip painted on
 *   the floor below walls) - remove those wallLip calls for dungeon tiles.
 * FLOORS: floors[0] is the plain tile. Suggested random mix by hash2(tx,ty): 55% floors[0], 15% each of the others.
 *   All floor variants share edges so they mix in any order. Floors for Hexmire/Cinder/Void/Coil have a grout line
 *   on the right column and bottom row, so they read as laid stone.
 * DETAILS: transparent decals for ~8-10% of plain floor tiles (hash-picked). Keep them off props/hazards.
 * PROPS: opaque tiles with floors[0] baked behind them, so they drop straight onto the tile id. A name with a
 *   number suffix (pool2, lava2, void2, void3) is an alternate of the same tile; pick by hash so big pools don't
 *   show a repeating grid.
 * RIMS (hazards): for a hazard tile, overlay rims[name].n/s/w/e on each side whose neighbour is NOT the same hazard
 *   (dark inner bank on N/W, light lip on S/E).
 *
 * TILE ID -> PIECE
 *   tideclaw: T_BWALL walls | T_BFLOOR floors | T_BPOOL props.pool(/pool2) + rims.pool | T_BCORAL props.coral |
 *             T_BPEARL props.pearlFloor | T_BROCK props.rock | T_BPLANK props.plank (driftwood) |
 *             T_BCRYST props.crystal | T_BWEED props.weed
 *             -> these five used DECO_SPR sprites (coral/brock/plank/crystal/weed). Drop them from DECO_SPR, or the old
 *                sprite gets drawn on top of the new tile. SPR.coral etc. are not used anywhere else.
 *   hexmire:  T_HWALL walls | T_HFLOOR floors | T_HPOOL props.pool(/pool2)+rims.pool | T_HSHALLOW props.shallow |
 *             T_HCLEAR props.clearing | T_HROOT props.root | T_HTOTEM props.totem | T_HCAUL props.cauldron
 *   cinder:   T_CWALL walls | T_CFLOOR floors | T_CLAVA props.lava(/lava2)+rims.lava | T_CASH props.ash |
 *             T_CEGG props.egg | T_CROCK props.rock
 *   void:     T_VWALL walls | T_VFLOOR floors | T_VRUNE props.rune | T_VPILLAR props.pillar |
 *             T_VVOID props.void(/void2/void3)+rims.void (also good for the outside-the-map fill)
 *   coil:     T_SWALL walls | T_SFLOOR floors | T_SJADE props.jade | T_SBREAK props.breakWall when its south is
 *             not wall (face), else props.breakTop (cracked cap) - treat SBREAK as wall for neighbour checks.
 *
 * WHAT IT REPLACES in game.js (v25): DEN_WALL, denWallPixel, burrowWallPixel, coilWallPixel, the dungeon branches of
 *   wallRGB and wallLip, denGround, burrowFloor, pearlFloor, coilFloor, the T_BPOOL/T_BPEARL branches in groundRGB,
 *   and starFieldPixel for T_VVOID inside the map. Keep the tile ids, TS=8, SOLID and the per-pixel tileRGB approach.
 *   Outside the map (voidRGB/drawDungeonVoid): tide/hex/cinder can use pal.D (the wallDeep colour) fading to black.
 *   The void sanctum can use props.void*, and coil can use the coil wallDeep. minimapRGB keeps working since it samples tileRGB.
 *
 * HELPERS: dtLayers() and dtPixel() at the bottom are standalone (no game globals). They do the selection above and
 * return the RGB for (px,py). Parsed palettes are cached. Use them or copy the logic.
 */
const DUNGEON_TILES={
  tideclaw:{
    pal:{k:"#0c1216",a:"#4d6a6c",b:"#6c8e8a",c:"#36494c",x:"#a6d4c8",L:"#8cb6ac",F:"#40585a",f:"#2e4244",m:"#1a272b",D:"#101a1e",s:"#76583a",t:"#957250",g:"#c69c66",h:"#dab680",i:"#ab8250",j:"#8f6a42",w:"#a8845a",p:"#a2aca6",q:"#5c6866",o:"#e2583a",O:"#ff9c7a",P:"#963222",e:"#f6eedc",n:"#bfae98",u:"#1d6e7e",U:"#3aa2aa",v:"#9ae6dc",V:"#12495a",y:"#a07448",Y:"#664628",z:"#7ee0c8",Z:"#eafff8",G:"#3e9c5a",H:"#226a3c",N:"#dcc6a2",M:"#f0e2c4",r:"#0f3a46",R:"#bfe8dc"},
    wallTop:["bbbbbbba","baaaaaac","baaxaaac","baaaaaac","baaaaaac","baaaabac","baaaaaac","acccccca"],
    wallTop2:["bbbbbbba","baaaaaac","baaaaaac","baacaaac","baaacaac","baaaaaac","baxaaaac","acccccca"],
    wallLeft:["kbbbbbba","kaaaaaac","kaaxaaac","kaaaaaac","kaaaaaac","kaaaabac","kaaaaaac","kcccccca"],
    wallRight:["bbbbbbbk","baaaaaak","baaxaaak","baaaaaak","baaaaaak","baaaabak","baaaaaak","acccccck"],
    wallFace:["aaaaaaaa","LLLLLLLL","FFFFFmFF","ffffffmf","mmffffmm","FFmmFFFF","ffffmmff","kkkkkkkk"],
    wallFace2:["aaaaaaaa","LLLLLLLL","FFeFFmFF","fenfffmf","mmffOomm","FFmoPoFF","ffffmmff","kkkkkkkk"],
    wallDeep:["DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD"],
    edges:{
      edgeN:["kkkkkkkk","........","........","........","........","........","........","........"],
      edgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      edgeR:[".......k",".......k",".......k",".......k",".......k",".......k",".......k",".......k"],
      cornerNW:["k.......","........","........","........","........","........","........","........"],
      cornerNE:[".......k","........","........","........","........","........","........","........"],
      cornerSW:["........","........","........","........","........","........","........","k......."],
      cornerSE:["........","........","........","........","........","........","........",".......k"],
      faceEdgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      faceEdgeR:[".......k",".......k","......mk","......mk","......mk","......mk","......mk",".......k"],
      shadowN:["ssssssss","tttttttt","........","........","........","........","........","........"],
      shadowW:["t.......","t.......","t.......","t.......","t.......","t.......","t.......","t......."]
    },
    floors:[
      ["gggggggg","gggggigg","gggggggg","gihggggg","gggggggg","gggggghg","ggggggig","gggggggg"],
      ["gggggggg","gghhhggg","giiiihgg","gggggggg","gggghhhg","ggggiiii","gggggggg","gggggggg"],
      ["gggggggg","ggggggig","gwwwgggg","wwwwwggg","gwwwwggg","gggggggh","gggggggg","gggigggg"],
      ["gggggggg","ggggggpg","ghggggqg","gggggggg","ggpggggg","ggqgggig","gggggggg","gggggggg"]
    ],
    details:{
      shell:["........","........","...e....","..eee...",".enene..","..nnn...","........","........"],
      fishbone:["........","........",".n.n.n..","eeeeeee.",".n.n.n..","........","........","........"],
      pebbles:["........",".p......",".q...p..",".....q..","........","..p.....","..q.....","........"],
      clam:["........","........","........","...ee...","..enne..","..nnnn..","........","........"],
      crack:["........",".i......","..i.....","..ii....","....i...","....ii..","......i.","........"]
    },
    props:{
      pool:["uuuuuuuu","uuUUuuuu","uuuuuuuu","uuuuuuuu","uuuuuvUu","uuuuuuuu","uuuuuuuu","uuuuuuuu"],
      pool2:["uuuuuuuu","uuuuuuuu","uuuuuuUu","uUuuuuuu","uuuuuuuu","uuuuuuuu","uuuUvuuu","uuuuuuuu"],
      coral:["gggggggg","goggoiOg","goOgoogg","giooogog","gggoPoog","gggoPghg","ggkPPkig","ggkkkkgg"],
      pearlFloor:["NNNNNNNj","NMMNNNNj","NMNNNNNj","NNNNNMNj","NNNNMMNj","NNNNNNNj","NNNNNNNj","jjjjjjjj"],
      rock:["gggggggg","ggkkkkgg","gkpppqkg","kppppqqk","kpqpqqqk","kqqqqqqk","gkkkkkkg","gggggggg"],
      plank:["gggggggg","gggggikk","ggggkkyk","gikkyyYk","gkyyYYkg","kyYYkkhg","kkkkggig","gggggggg"],
      crystal:["gggkgggg","ggkzkigg","ggkZzkgg","gkzZzkgk","gkzzzkkz","kzZzkkZz","kkzzkkzk","gkkkkkkg"],
      weed:["gggggggg","gGgggGgg","gHggGggg","giHgHggG","gGggHgGH","gHGgHgHg","ggHgGHig","ggHggHgg"]
    },
    rims:{
      pool:{
        n:["rrrrrrrr","........","........","........","........","........","........","........"],
        s:["........","........","........","........","........","........","........","RRRRRRRR"],
        w:["r.......","r.......","r.......","r.......","r.......","r.......","r.......","r......."],
        e:[".......R",".......R",".......R",".......R",".......R",".......R",".......R",".......R"]
      }
    }
  },
  hexmire:{
    pal:{k:"#0d120c",a:"#5c6a4e",b:"#7c8c62",c:"#414c38",x:"#79a646",L:"#8fa86a",F:"#4e5644",f:"#3a4134",m:"#1e241c",D:"#0f150f",s:"#1c2716",t:"#29361f",g:"#3f5230",h:"#4a5e3a",i:"#36472c",j:"#2b3a23",G:"#5e9a3a",H:"#3c6e28",e:"#d8d0b8",n:"#9a9078",u:"#183026",U:"#244836",v:"#5f9a6a",V:"#0e1e18",y:"#6e4a2a",Y:"#4a3018",w:"#8a6038",p:"#9a5ad2",P:"#d9b8ff",o:"#2a2826",O:"#4a4642",z:"#6fd04a",Z:"#c8ff8a",N:"#4f6a38",M:"#647e46",r:"#0a1610",R:"#4e7a52",q:"#2f4636"},
    wallTop:["bbbbbbba","bxxaaaac","bxaaaaac","baaaaaac","baaaaxac","baaaxxac","baaaaaac","acccccca"],
    wallTop2:["bbxxbbba","bxxxxaac","baxxaaac","baaaaaac","baacaaac","baaacaac","baaaaaac","acccccca"],
    wallLeft:["kbbbbbba","kxxaaaac","kxaaaaac","kaaaaaac","kaaaaxac","kaaaxxac","kaaaaaac","kcccccca"],
    wallRight:["bbbbbbbk","bxxaaaak","bxaaaaak","baaaaaak","baaaaxak","baaaxxak","baaaaaak","acccccck"],
    wallFace:["aaxaaaaa","LxxLLLxL","FHFmFFHm","fffmfffm","mmmmmmmm","FmFFFmFF","fmfffmff","kkkkkkkk"],
    wallFace2:["axxaaaxa","xHxLLxxL","FHFmFHHm","fHfmfHfm","mmmmmHmm","FmFFFmFF","fmfffmff","kkkkkkkk"],
    wallDeep:["DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD"],
    edges:{
      edgeN:["kkkkkkkk","........","........","........","........","........","........","........"],
      edgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      edgeR:[".......k",".......k",".......k",".......k",".......k",".......k",".......k",".......k"],
      cornerNW:["k.......","........","........","........","........","........","........","........"],
      cornerNE:[".......k","........","........","........","........","........","........","........"],
      cornerSW:["........","........","........","........","........","........","........","k......."],
      cornerSE:["........","........","........","........","........","........","........",".......k"],
      faceEdgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      faceEdgeR:[".......k",".......k","......mk","......mk","......mk","......mk","......mk",".......k"],
      shadowN:["ssssssss","tttttttt","........","........","........","........","........","........"],
      shadowW:["t.......","t.......","t.......","t.......","t.......","t.......","t.......","t......."]
    },
    floors:[
      ["hhhhhhhj","hggggggj","hggggggj","hgggiggj","hggggggj","hggggggj","hggggggj","jjjjjjjj"],
      ["hhhjhhhj","hggjhggj","hggjhggj","hggjhggj","jjjjhggj","hhhjhggj","hggjhgij","jjjjjjjj"],
      ["hhhhhhhj","hggggggj","hgggGggj","jjjjjjjj","hhhhjhhj","hgggjhgj","hgigjhgj","jjjjjjjj"],
      ["hhhhhhhj","hgGGgggj","hGHHGggj","hgGHgggj","hggggggj","hgggggGj","hggggGHj","jjjjjjjj"]
    ],
    details:{
      moss:["........","..G.....",".GHG....","..GHG.G.","...G.GH.",".....G..","........","........"],
      bones:["........","........",".e....e.",".neeeen.",".e....e.","........","........","........"],
      mushroom:["........","........","...pp...","..pPpp..","...nn...","...nn...","........","........"],
      crack:["........",".j......","..j.....","..jj....","....j...","....jj..","......j.","........"],
      reeds:["........","..G..G..","..H.GH..",".GH.H...",".H..H.G.",".H.HH.H.","........","........"]
    },
    props:{
      pool:["uuuuuuuu","uuUuuuuu","uuuuuuuu","uuuuuuuu","uuuuuUuu","uuuuuuuu","uuuuuuuu","uuuuuuuu"],
      pool2:["uuuuuuuu","uuuuuuuu","uuuuuuvu","uuuuuuuu","uvuuuuuu","uuuuuuuu","uuuuUuuu","uuuuuuuu"],
      shallow:["NNNNNNNq","NMNNNNNq","NNNNMNNq","NNNNNNNq","NNNNNNNq","NMNNNNNq","NNNNNNMq","qqqqqqqq"],
      clearing:["MMMMMMMM","MMMGMMMM","MMMMMMMM","MMMMMMGM","MGMMMMMM","MMMMMMMM","MMMMGMMM","MMMMMMMM"],
      root:["hhhhhhhj","hgkkkggj","hkyyykgj","hkyYkykj","hgkkgkyk","hkykgkYk","kyYkggkk","kkkjjjjj"],
      totem:["hhhpphhj","hgpPPpgj","hgkppkgj","hgkyykgj","hgkwYkgj","hgkyykgj","hgkwYkgj","jkkYYkkj"],
      cauldron:["hhhhhhhj","hgzZzzgj","hkzzzZkj","kooooook","kOooooOk","kOoooook","hkoookoj","jkkjjkkj"]
    },
    rims:{
      pool:{
        n:["rrrrrrrr","........","........","........","........","........","........","........"],
        s:["........","........","........","........","........","........","........","RRRRRRRR"],
        w:["r.......","r.......","r.......","r.......","r.......","r.......","r.......","r......."],
        e:[".......R",".......R",".......R",".......R",".......R",".......R",".......R",".......R"]
      }
    }
  },
  cinder:{
    pal:{k:"#0b0807",a:"#45403e",b:"#625a55",c:"#2f2a28",x:"#ff7a2a",L:"#7a6e66",F:"#3a3330",f:"#2a2422",m:"#151110",D:"#0d0a09",s:"#140f0d",t:"#1e1714",g:"#332c29",h:"#433a35",i:"#28221f",j:"#171211",e:"#d84a16",E:"#ff9a3a",u:"#c8401a",U:"#ff7a22",v:"#ffd060",V:"#7a2210",n:"#8a8280",N:"#6e6866",M:"#827a76",y:"#e8b860",Y:"#b07a38",w:"#fff0b0",p:"#5c5450",q:"#3a3432",r:"#4a1a0c",R:"#ffb04a"},
    wallTop:["bbbbbbba","baaaaaac","baaaaaac","baacaaac","baaaaaac","baaaaaac","baaaaaac","acccccca"],
    wallTop2:["bbbbbbba","baaaaaac","baaacaac","baaaacac","baaaacac","baaaaaac","baaaaaac","acccccca"],
    wallLeft:["kbbbbbba","kaaaaaac","kaaaaaac","kaacaaac","kaaaaaac","kaaaaaac","kaaaaaac","kcccccca"],
    wallRight:["bbbbbbbk","baaaaaak","baaaaaak","baacaaak","baaaaaak","baaaaaak","baaaaaak","acccccck"],
    wallFace:["aaaaaaaa","LLLLLLLL","FFmFFFmF","ffmfffmf","ffmfffmf","ffmfffmf","mmmmmmmm","kkkkkkkk"],
    wallFace2:["aaaaaaaa","LLLLLLLL","FFmFFFmF","ffmffEmf","ffmfEemf","ffmfefmf","mmmmemmm","kkkkkkkk"],
    wallDeep:["DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD"],
    edges:{
      edgeN:["kkkkkkkk","........","........","........","........","........","........","........"],
      edgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      edgeR:[".......k",".......k",".......k",".......k",".......k",".......k",".......k",".......k"],
      cornerNW:["k.......","........","........","........","........","........","........","........"],
      cornerNE:[".......k","........","........","........","........","........","........","........"],
      cornerSW:["........","........","........","........","........","........","........","k......."],
      cornerSE:["........","........","........","........","........","........","........",".......k"],
      faceEdgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      faceEdgeR:[".......k",".......k","......mk","......mk","......mk","......mk","......mk",".......k"],
      shadowN:["ssssssss","tttttttt","........","........","........","........","........","........"],
      shadowW:["t.......","t.......","t.......","t.......","t.......","t.......","t.......","t......."]
    },
    floors:[
      ["hhhhhhhj","hggggggj","hggggggj","hgggiggj","hggggggj","hggggggj","hggggggj","jjjjjjjj"],
      ["hhhhjhhj","hgggjhgj","hgggjhgj","hgggjjjj","jjjjhhhj","hhhjhggj","hggjhggj","jjjjjjjj"],
      ["hhhhhhhj","hggggggj","hggggggj","jjjjjjjj","hhhhhhhj","hggrrggj","hggggggj","jjjjjjjj"],
      ["hhhhhhhj","hggigggj","hggggggj","hggggigj","hggggggj","hgiggggj","hggggggj","jjjjjjjj"]
    ],
    details:{
      ember:["........","........","....E...","........","..e.....","........",".....e..","........"],
      crack:["........",".e......","..e.....","..ee....","....E...","....ee..","......e.","........"],
      bones:["........","........",".n....n.",".NnnnnN.",".n....n.","........","........","........"],
      ashpile:["........","........","........","...MM...","..MNNM..",".NNNNNN.","........","........"],
      shards:["........",".p......",".q...p..",".....q..","........","..p.....","..q.....","........"]
    },
    props:{
      lava:["uuuuuuuu","uUUuuuuu","uuuuuuuu","uuuuUvuu","uuuuuuuu","uuuuuuuu","uuUuuuuu","uuuuuuuu"],
      lava2:["uuuuuuuu","uuuuuuUu","uuuuuuuu","uvUuuuuu","uuuuuuuu","uuuuuUUu","uuuuuuuu","uuuuuuuu"],
      ash:["NNNNNNNj","NMNNNNNj","NNNNNMNj","NNNNNNNj","NMNNNNNj","NNNNMNNj","NNNNNNNj","jjjjjjjj"],
      egg:["hhhkkhhj","hgkyykgj","hkywyykj","hkyyyYkj","kyyyyYYk","kYyyyYYk","hkYYYYkj","jjkkkkjj"],
      rock:["hhhhhhhj","hgkkkkgj","hkbbbakj","kbaaaack","kaaaacck","kcccccck","hkkkkkkj","jjjjjjjj"]
    },
    rims:{
      lava:{
        n:["rrrrrrrr","........","........","........","........","........","........","........"],
        s:["........","........","........","........","........","........","........","RRRRRRRR"],
        w:["r.......","r.......","r.......","r.......","r.......","r.......","r.......","r......."],
        e:[".......R",".......R",".......R",".......R",".......R",".......R",".......R",".......R"]
      }
    }
  },
  void:{
    pal:{k:"#06040c",a:"#3a2c58",b:"#55427e",c:"#271d3e",x:"#c48aff",L:"#7a62b0",F:"#2a2044",f:"#1e1734",m:"#110c20",D:"#0a0714",s:"#08060f",t:"#0f0b1c",g:"#191329",h:"#211a36",i:"#140f22",j:"#2c2148",e:"#9a6aff",E:"#e6d6ff",u:"#06040e",U:"#2a1850",v:"#e0e0f4",V:"#8a5ad8",n:"#d6ccb6",N:"#ffd66e",M:"#5a4630",y:"#4a3a74",Y:"#6e58a8",w:"#bfa2ff",r:"#000000",R:"#6a4ab0"},
    wallTop:["bbbbbbba","baaaaaac","baaaaaac","baaaaaac","baaaaaac","baaaaaac","baaaaaac","acccccca"],
    wallTop2:["bbbbbbba","baaaaaac","baaxaaac","baxxxaac","baaxaaac","baaaaaac","baaaaaac","acccccca"],
    wallLeft:["kbbbbbba","kaaaaaac","kaaaaaac","kaaaaaac","kaaaaaac","kaaaaaac","kaaaaaac","kcccccca"],
    wallRight:["bbbbbbbk","baaaaaak","baaaaaak","baaaaaak","baaaaaak","baaaaaak","baaaaaak","acccccck"],
    wallFace:["aaaaaaaa","LLLLLLLL","FFFmFFFm","fffmfffm","mmmmmmmm","FmFFFmFF","fmfffmff","kkkkkkkk"],
    wallFace2:["aaaaaaaa","LLLLLLLL","FFFmFFFm","fxfxfxfm","mmxxxmmm","FmFxFmFF","fmfffmff","kkkkkkkk"],
    wallDeep:["DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD"],
    edges:{
      edgeN:["kkkkkkkk","........","........","........","........","........","........","........"],
      edgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      edgeR:[".......k",".......k",".......k",".......k",".......k",".......k",".......k",".......k"],
      cornerNW:["k.......","........","........","........","........","........","........","........"],
      cornerNE:[".......k","........","........","........","........","........","........","........"],
      cornerSW:["........","........","........","........","........","........","........","k......."],
      cornerSE:["........","........","........","........","........","........","........",".......k"],
      faceEdgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      faceEdgeR:[".......k",".......k","......mk","......mk","......mk","......mk","......mk",".......k"],
      shadowN:["ssssssss","tttttttt","........","........","........","........","........","........"],
      shadowW:["t.......","t.......","t.......","t.......","t.......","t.......","t.......","t......."]
    },
    floors:[
      ["gggggggj","gggggggj","gggggggj","gggggggj","gggggggj","gggggggj","gggggggj","jjjjjjjj"],
      ["gggggggj","ggggghgj","gggggggj","gggggggj","ghgggggj","gggggggj","gggggggj","jjjjjjjj"],
      ["gggggggj","gggggggj","gggggggj","gggegggj","gggggggj","gggggggj","gggggggj","jjjjjjjj"],
      ["gggggggj","giggiggj","ggiigggj","gggigggj","ggggiigj","gggggigj","gggggggj","jjjjjjjj"]
    ],
    details:{
      candle:["........","...N....","...w....","..kEk...","..kEk...","..kEk...",".kkkkk..","........"],
      sparkle:["........","........","....e...","...eEe..","....e...","........","........","........"],
      glyph:["........","........","..eee...","....e...","..eee...","..e.....","........","........"],
      crack:["........",".i......","..i.....","..ii....","....i...","....ii..","......i.","........"],
      chain:["........",".y......","..y.....","...y....","....y...",".....y..","........","........"]
    },
    props:{
      void:["uuuuuuuu","uuuuUuuu","uuuuuuuu","uuuuuuuu","uuuuuuvu","uuuuuuuu","uuuuuuuu","uuuuuuuu"],
      void2:["uuuuuuuu","uuuuuuuu","uVuuuuuu","uuuuuuuu","uuuuuuuu","uuuuUuuu","uuuuuuuu","uuuuuuuu"],
      void3:["uuuuuuuu","uuuuuuuu","uuuuuuuu","uuuvuuuu","uuuuuuuu","uuuuuuuu","uuuuuuUu","uuuuuuuu"],
      rune:["gggggggj","gggegggj","ggeEeggj","geEgEegj","ggeEeggj","gggegggj","gggggggj","jjjjjjjj"],
      pillar:["ggkwwkgj","gkYwwYkj","gkyYYykj","gkkkkkkj","gkyYYykj","gkyYyykj","gkyYyykj","kkkkkkkk"]
    },
    rims:{
      void:{
        n:["rrrrrrrr","........","........","........","........","........","........","........"],
        s:["........","........","........","........","........","........","........","RRRRRRRR"],
        w:["r.......","r.......","r.......","r.......","r.......","r.......","r.......","r......."],
        e:[".......R",".......R",".......R",".......R",".......R",".......R",".......R",".......R"]
      }
    }
  },
  coil:{
    pal:{k:"#0a120c",a:"#2f6a46",b:"#4a9064",c:"#1f4a30",x:"#d8b24a",L:"#e0bc58",F:"#2a5a3c",f:"#1f4630",m:"#10261a",D:"#0c1610",s:"#6a5432",t:"#86693e",g:"#b8955a",h:"#cfac6c",i:"#a0804a",j:"#7a5e34",e:"#2e8a58",E:"#5cc488",y:"#d8b24a",Y:"#9a7a2a",w:"#fff0a0",n:"#3a2a18",N:"#6a4c28",r:"#0f2a1a",R:"#7ad0a0"},
    wallTop:["bbbbbbba","baaaaaac","baaaaaac","baaaaaac","baaaaaac","baaaaaac","baaaaaac","acccccca"],
    wallTop2:["bbbbbbba","baaaaaac","baaxaaac","baxaxaac","baaxaaac","baaaaaac","baaaaaac","acccccca"],
    wallLeft:["kbbbbbba","kaaaaaac","kaaaaaac","kaaaaaac","kaaaaaac","kaaaaaac","kaaaaaac","kcccccca"],
    wallRight:["bbbbbbbk","baaaaaak","baaaaaak","baaaaaak","baaaaaak","baaaaaak","baaaaaak","acccccck"],
    wallFace:["aaaaaaaa","LLLLLLLL","YYYYYYYY","FFFmFFFm","fffmfffm","mmmmmmmm","FmFFFmFF","kkkkkkkk"],
    wallFace2:["aaaaaaaa","LLLLLLLL","YYYYYYYY","FbFbFbFm","bfbfbfbm","fbfbfbfm","mmmmmmmm","kkkkkkkk"],
    wallDeep:["DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD","DDDDDDDD"],
    edges:{
      edgeN:["kkkkkkkk","........","........","........","........","........","........","........"],
      edgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      edgeR:[".......k",".......k",".......k",".......k",".......k",".......k",".......k",".......k"],
      cornerNW:["k.......","........","........","........","........","........","........","........"],
      cornerNE:[".......k","........","........","........","........","........","........","........"],
      cornerSW:["........","........","........","........","........","........","........","k......."],
      cornerSE:["........","........","........","........","........","........","........",".......k"],
      faceEdgeL:["k.......","k.......","k.......","k.......","k.......","k.......","k.......","k......."],
      faceEdgeR:[".......k",".......k","......mk","......mk","......mk","......mk","......mk",".......k"],
      shadowN:["ssssssss","tttttttt","........","........","........","........","........","........"],
      shadowW:["t.......","t.......","t.......","t.......","t.......","t.......","t.......","t......."]
    },
    floors:[
      ["hhhhhhhj","hggggggj","hggggggj","hggggggj","hggggggj","hggggggj","hggggggj","jjjjjjjj"],
      ["hhhjhhhj","hggjhggj","hggjhggj","jjjjjjjj","hhhjhhhj","hggjhggj","hggjhggj","jjjjjjjj"],
      ["hhhhhhhj","hggggggj","hgggiggj","hggggggj","hggiiggj","hggggggj","hggggggj","jjjjjjjj"],
      ["hhhhhhhj","hggggggj","hgiiiggj","higggigj","hggggggj","hgggiiij","hggigggj","jjjjjjjj"]
    ],
    details:{
      scale:["........","........","..iii...",".i...i..","........","........","........","........"],
      crack:["........",".i......","..i.....","..ii....","....i...","....ii..","......i.","........"],
      vine:["........",".e......","..e.E...","..ee.e..","...Ee...","....e...","........","........"],
      coin:["........","........","........","...yy...","..ywyY..","...YY...","........","........"]
    },
    props:{
      jade:["yyyyyyyy","yeeEEeey","yeEEEeey","yeEeeeey","yeeeeeey","yeeeeeey","yeeeeeey","yyyyyyyy"],
      breakTop:["bbbbbbba","baakaaac","baaakaac","baakaaac","baaakkac","bakaaakc","bkaaaaac","acccccca"],
      breakWall:["aaaaaaaa","LLLLLLLL","YYYYYYYY","FFmkFFFm","ffkfkffm","mkmmmkmm","FmFkFmkF","kkkkkkkk"]
    },
    rims:{}
  }
};

// ---- helpers (standalone) ----
const _dtRGB={};
function dtRGBOf(set,ch){
  const key=set+ch;let c=_dtRGB[key];
  if(!c){const n=parseInt(DUNGEON_TILES[set].pal[ch].slice(1),16);c=_dtRGB[key]=[(n>>16)&255,(n>>8)&255,n&255];}
  return c;
}
function dtHash(x,y,s){let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041)|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function dtAlt(props,name,tx,ty){
  const alts=[name];for(let i=2;props[name+i];i++)alts.push(name+i);
  return props[alts[(dtHash(tx,ty,11)*alts.length)|0]];
}
// isWall(tx,ty) -> bool. kind(tx,ty) -> prop name ('pool','coral',...,'breakWall') or null for plain floor.
// Returns an array of row-arrays to paint in order (first is opaque).
function dtLayers(set,isWall,kind,tx,ty){
  const D=DUNGEON_TILES[set],E=D.edges,L=[];
  const N=isWall(tx,ty-1),S=isWall(tx,ty+1),W=isWall(tx-1,ty),Ea=isWall(tx+1,ty);
  if(isWall(tx,ty)){
    if(kind(tx,ty)==='breakWall'){L.push(S?D.props.breakTop:D.props.breakWall);return L;}
    if(!S){
      // wallBanner is a north-face variant (Throne of Ruin uses it on ~1 in 6 faces).
      const face=D.wallBanner&&dtHash(tx,ty,13)<1/6?D.wallBanner:(dtHash(tx,ty,7)<0.2?D.wallFace2:D.wallFace);
      L.push(face);
      if(!N)L.push(E.edgeN);if(!W)L.push(E.faceEdgeL);if(!Ea)L.push(E.faceEdgeR);
      return L;
    }
    if(N&&W&&Ea&&isWall(tx-1,ty-1)&&isWall(tx+1,ty-1)&&isWall(tx-1,ty+1)&&isWall(tx+1,ty+1)){L.push(D.wallDeep);return L;}
    L.push(dtHash(tx,ty,3)<0.2?D.wallTop2:D.wallTop);
    if(!N)L.push(E.edgeN);if(!W)L.push(E.edgeL);if(!Ea)L.push(E.edgeR);
    if(N&&W&&!isWall(tx-1,ty-1))L.push(E.cornerNW);
    if(N&&Ea&&!isWall(tx+1,ty-1))L.push(E.cornerNE);
    if(W&&!isWall(tx-1,ty+1))L.push(E.cornerSW);
    if(Ea&&!isWall(tx+1,ty+1))L.push(E.cornerSE);
    return L;
  }
  const k=kind(tx,ty);
  if(k){
    L.push(dtAlt(D.props,k,tx,ty));
    const rim=D.rims&&D.rims[k];
    if(rim){if(kind(tx,ty-1)!==k)L.push(rim.n);if(kind(tx,ty+1)!==k)L.push(rim.s);if(kind(tx-1,ty)!==k)L.push(rim.w);if(kind(tx+1,ty)!==k)L.push(rim.e);}
    if(k==='void')return L;
  }else{
    const r=dtHash(tx,ty,1),f=D.floors;
    L.push(f[r<0.55?0:r<0.7?1:r<0.85?2:3]);
    if(dtHash(tx,ty,5)<0.1){const d=Object.values(D.details);L.push(d[(dtHash(tx,ty,9)*d.length)|0]);}
  }
  if(N)L.push(E.shadowN);
  if(W)L.push(E.shadowW);
  return L;
}
function dtPixel(set,layers,px,py){
  for(let i=layers.length-1;i>=0;i--){const ch=layers[i][py][px];if(ch!=='.')return dtRGBOf(set,ch);}
  return [0,0,0];
}
if(typeof module!=='undefined')module.exports={DUNGEON_TILES,dtLayers,dtPixel};
