// Shardwild v30 - 12 new RotMG classes (Sprites). Same format as players_anim.js PLAYER_FRAMES / players_refresh.js PLAYER_SPRITES.
// Frames: [stand, walk1, walk2, atk1, atk2]. Side faces right (game flips). No outline (mkSprite adds it). x=#ffffff flash.
const NEW_PLAYER_FRAMES={
  paladin:{pal:{"y": "#ffd34a", "m": "#e8eef6", "M": "#a8b4c8", "s": "#f1c27d", "e": "#1b1b24", "w": "#f8f8ff", "W": "#c8d0e0", "r": "#c02030", "b": "#e8f4ff", "g": "#b8801c", "x": "#ffffff"},
   side:[
    ["..yyy..b", ".mmmmm.b", ".mmses.b", "r.sss.gb", "rwwywMs.", "rWyyyW..", ".wwywW..", "..M..M.."],
    ["..yyy..b", ".mmmmm.b", ".mmses.b", "r.sss.gb", "rwwywMs.", "rWyyyW..", ".wwywW..", ".M...M.."],
    ["..yyy..b", ".mmmmm.b", ".mmses.b", "r.sss.gb", "rwwywMs.", "rWyyyW..", ".wwywW..", "...MM..."],
    ["..yyy.b.", ".mmmmmb.", ".mmsesb.", "r.sssgb.", "rwwywMs.", "rWyyyW..", ".wwywW..", "..M..M.."],
    ["..yyy..x", ".mmmmm.b", ".mmses.b", "r.sss.gb", "rwwywMs.", "rWyyyW..", ".wwywW..", "..M..M.."]],
   front:[
    ["..yyy..b", ".mmmmm.b", ".mesem.b", "..sss.gb", "rwwywMs.", "rWyyyW..", "rwwywW..", "..M.M..."],
    ["..yyy..b", ".mmmmm.b", ".mesem.b", "..sss.gb", "rwwywMs.", "rWyyyW..", "rwwywW..", "..M....."],
    ["..yyy..b", ".mmmmm.b", ".mesem.b", "..sss.gb", "rwwywMs.", "rWyyyW..", "rwwywW..", "....M..."],
    ["..yyy.b.", ".mmmmmb.", ".mesemb.", "..sssgb.", "rwwywMs.", "rWyyyW..", "rwwywW..", "..M.M..."],
    ["..yyy..x", ".mmmmm.b", ".mesem.b", "..sss.gb", "rwwywMs.", "rWyyyW..", "rwwywW..", "..M.M..."]],
   back:[
    ["b..yyy..", "b.mmmmm.", "b.mmmmm.", "bg.mmm..", ".sMrrrrr", "..rrrrrr", "..rrrrrr", "...M.M.."],
    ["b..yyy..", "b.mmmmm.", "b.mmmmm.", "bg.mmm..", ".sMrrrrr", "..rrrrrr", "..rrrrrr", ".....M.."],
    ["b..yyy..", "b.mmmmm.", "b.mmmmm.", "bg.mmm..", ".sMrrrrr", "..rrrrrr", "..rrrrrr", "...M...."],
    [".b.yyy..", ".bmmmmm.", ".bmmmmm.", ".bgmmm..", ".sMrrrrr", "..rrrrrr", "..rrrrrr", "...M.M.."],
    ["x..yyy..", "b.mmmmm.", "b.mmmmm.", "bg.mmm..", ".sMrrrrr", "..rrrrrr", "..rrrrrr", "...M.M.."]],
  },
  assassin:{pal:{"k": "#3e4e3a", "h": "#26321f", "c": "#101810", "s": "#c9986a", "e": "#b8ff4a", "m": "#141a14", "d": "#d8f0d0", "g": "#7dce4a", "r": "#a02020", "x": "#ffffff"},
   side:[
    ["...kk...", "..kkkk..", ".kkmme..", "rkhhm...", "rhhhhgdd", ".hgghh..", ".hhhhh..", "..c..c.."],
    ["...kk...", "..kkkk..", ".kkmme..", "rkhhm...", "rhhhhgdd", ".hgghh..", ".hhhhh..", ".c...c.."],
    ["...kk...", "..kkkk..", ".kkmme..", "rkhhm...", "rhhhhgdd", ".hgghh..", ".hhhhh..", "...cc..."],
    ["...kk...", "..kkkk..", ".kkmme..", "rkhhm...", "rhhhhdd.", ".hgghh..", ".hhhhh..", "..c..c.."],
    ["...kk...", "..kkkk..", ".kkmme..", "rkhhm...", "rhhhhgdx", ".hgghh..", ".hhhhh..", "..c..c.."]],
   front:[
    ["..kkk...", ".kkkkk..", ".kemek..", ".khmhk..", "rhhhhgdd", ".hgghh..", ".hhhhh..", "..c.c..."],
    ["..kkk...", ".kkkkk..", ".kemek..", ".khmhk..", "rhhhhgdd", ".hgghh..", ".hhhhh..", "..c....."],
    ["..kkk...", ".kkkkk..", ".kemek..", ".khmhk..", "rhhhhgdd", ".hgghh..", ".hhhhh..", "....c..."],
    ["..kkk...", ".kkkkk..", ".kemek..", ".khmhk..", "rhhhhdd.", ".hgghh..", ".hhhhh..", "..c.c..."],
    ["..kkk...", ".kkkkk..", ".kemek..", ".khmhk..", "rhhhhgdx", ".hgghh..", ".hhhhh..", "..c.c..."]],
   back:[
    ["...kkk..", "..kkkkk.", "..kkkkk.", "..kkkkk.", "ddghhhhr", "..hhggh.", "..hhhhh.", "...c.c.."],
    ["...kkk..", "..kkkkk.", "..kkkkk.", "..kkkkk.", "ddghhhhr", "..hhggh.", "..hhhhh.", ".....c.."],
    ["...kkk..", "..kkkkk.", "..kkkkk.", "..kkkkk.", "ddghhhhr", "..hhggh.", "..hhhhh.", "...c...."],
    ["...kkk..", "..kkkkk.", "..kkkkk.", "..kkkkk.", ".ddhhhhr", "..hhggh.", "..hhhhh.", "...c.c.."],
    ["...kkk..", "..kkkkk.", "..kkkkk.", "..kkkkk.", "xdghhhhr", "..hhggh.", "..hhhhh.", "...c.c.."]],
  },
  necromancer:{pal:{"k": "#2e2238", "K": "#5a4470", "r": "#b01828", "s": "#d8d0c8", "e": "#ff3040", "t": "#7a6450", "b": "#f0ece0", "x": "#ffffff"},
   side:[
    ["..kkk.bb", ".kkkkk.t", ".kkses.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", ".K...K.."],
    ["..kkk.bb", ".kkkkk.t", ".kkses.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", "K....K.."],
    ["..kkk.bb", ".kkkkk.t", ".kkses.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", "...KK..."],
    ["..kkkbb.", ".kkkkkt.", ".kksest.", "..sss.st", ".kkrkkt.", ".kKrKkt.", "kkkrkkkt", ".K...K.."],
    ["..kkk.bx", ".kkkkk.t", ".kkses.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", ".K...K.."]],
   front:[
    ["..kkk.bb", ".kkkkk.t", ".kesek.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", "..K.K..."],
    ["..kkk.bb", ".kkkkk.t", ".kesek.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", "..K....."],
    ["..kkk.bb", ".kkkkk.t", ".kesek.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", "....K..."],
    ["..kkkbb.", ".kkkkkt.", ".kesekt.", "..sss.st", ".kkrkkt.", ".kKrKkt.", "kkkrkkkt", "..K.K..."],
    ["..kkk.bx", ".kkkkk.t", ".kesek.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", "..K.K..."]],
   back:[
    ["bb.kkk..", "t.kkkkk.", "t.kkkkk.", "tk.kkk..", "t.kkrkk.", "t.kKrKk.", "tkkkrkkk", "...K.K.."],
    ["bb.kkk..", "t.kkkkk.", "t.kkkkk.", "tk.kkk..", "t.kkrkk.", "t.kKrKk.", "tkkkrkkk", ".....K.."],
    ["bb.kkk..", "t.kkkkk.", "t.kkkkk.", "tk.kkk..", "t.kkrkk.", "t.kKrKk.", "tkkkrkkk", "...K...."],
    [".bbkkk..", ".tkkkkk.", ".tkkkkk.", "tk.kkk..", ".tkkrkk.", ".tkKrKk.", "tkkkrkkk", "...K.K.."],
    ["xb.kkk..", "t.kkkkk.", "t.kkkkk.", "tk.kkk..", "t.kkrkk.", "t.kKrKk.", "tkkkrkkk", "...K.K.."]],
  },
  huntress:{pal:{"h": "#8a3a1a", "H": "#c05a2a", "s": "#f1c27d", "e": "#1b1b24", "l": "#3a8a6a", "L": "#246050", "b": "#8a5a30", "w": "#f0e2b0", "y": "#ffd34a", "x": "#ffffff"},
   side:[
    ["..hhh.b.", ".hhHhhwb", "hhhsesw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "..L..L.."],
    ["..hhh.b.", ".hhHhhwb", "hhhsesw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", ".L...L.."],
    ["..hhh.b.", ".hhHhhwb", "hhhsesw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "...LL..."],
    ["..hhhb..", ".hhHhhb.", "hhhsesw.", "h.ssswb.", ".lllllsb", ".Llylwb.", ".llllb..", "..L..L.."],
    ["..hhh.x.", ".hhHhhwb", "hhhsesw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "..L..L.."]],
   front:[
    ["..hhh.b.", ".hHHhhwb", "hhesehw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "..L.L..."],
    ["..hhh.b.", ".hHHhhwb", "hhesehw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "..L....."],
    ["..hhh.b.", ".hHHhhwb", "hhesehw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "....L..."],
    ["..hhhb..", ".hHHhhb.", "hhesehw.", "h.ssswb.", ".lllllsb", ".Llylwb.", ".llllb..", "..L.L..."],
    ["..hhh.x.", ".hHHhhwb", "hhesehw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "..L.L..."]],
   back:[
    [".b.hhh..", "bwhhHHh.", ".whhhhhh", "bw.hhh.h", "bslllll.", "bw.lylL.", ".b.llll.", "...L.L.."],
    [".b.hhh..", "bwhhHHh.", ".whhhhhh", "bw.hhh.h", "bslllll.", "bw.lylL.", ".b.llll.", ".....L.."],
    [".b.hhh..", "bwhhHHh.", ".whhhhhh", "bw.hhh.h", "bslllll.", "bw.lylL.", ".b.llll.", "...L...."],
    ["..bhhh..", ".whhHHh.", ".whhhhhh", ".bwhhh.h", "bslllll.", ".bwlylL.", "..bllll.", "...L.L.."],
    [".x.hhh..", "bwhhHHh.", ".whhhhhh", "bw.hhh.h", "bslllll.", "bw.lylL.", ".b.llll.", "...L.L.."]],
  },
  mystic:{pal:{"p": "#5a2a8a", "P": "#8a4ac0", "v": "#40d0c0", "s": "#f1c27d", "e": "#1b1b24", "y": "#ffd34a", "o": "#80f0ff", "t": "#c0a060", "x": "#ffffff"},
   side:[
    ["..pPp..o", ".pPPPp.t", ".ppses.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", ".P...P.."],
    ["..pPp..o", ".pPPPp.t", ".ppses.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", "P....P.."],
    ["..pPp..o", ".pPPPp.t", ".ppses.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", "...PP..."],
    ["..pPp.o.", ".pPPPpt.", ".ppsest.", "..vvv.st", ".pPyPpt.", ".ppyppt.", "pppyppt.", ".P...P.."],
    ["..pPp..x", ".pPPPp.t", ".ppses.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", ".P...P.."]],
   front:[
    ["..pPp..o", ".pPPPp.t", ".pesep.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", "..P.P..."],
    ["..pPp..o", ".pPPPp.t", ".pesep.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", "..P....."],
    ["..pPp..o", ".pPPPp.t", ".pesep.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", "....P..."],
    ["..pPp.o.", ".pPPPpt.", ".pesept.", "..vvv.st", ".pPyPpt.", ".ppyppt.", "pppyppt.", "..P.P..."],
    ["..pPp..x", ".pPPPp.t", ".pesep.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", "..P.P..."]],
   back:[
    ["o..pPp..", "t.pPPPp.", "t.ppppp.", "tp.ppp..", "t.pPpPp.", "t.ppppp.", "t.pppppp", "...P.P.."],
    ["o..pPp..", "t.pPPPp.", "t.ppppp.", "tp.ppp..", "t.pPpPp.", "t.ppppp.", "t.pppppp", ".....P.."],
    ["o..pPp..", "t.pPPPp.", "t.ppppp.", "tp.ppp..", "t.pPpPp.", "t.ppppp.", "t.pppppp", "...P...."],
    [".o.pPp..", ".tpPPPp.", ".tppppp.", "tp.ppp..", ".tpPpPp.", ".tppppp.", ".tpppppp", "...P.P.."],
    ["x..pPp..", "t.pPPPp.", "t.ppppp.", "tp.ppp..", "t.pPpPp.", "t.ppppp.", "t.pppppp", "...P.P.."]],
  },
  trickster:{pal:{"c": "#2a6ad0", "C": "#e04aa0", "k": "#141428", "s": "#f1c27d", "e": "#1b1b24", "d": "#e8f0ff", "g": "#ffd34a", "x": "#ffffff"},
   side:[
    [".c..C...", ".ccCc...", ".ccses..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", "..k..k.."],
    [".c..C...", ".ccCc...", ".ccses..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", ".k...k.."],
    [".c..C...", ".ccCc...", ".ccses..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", "...kk..."],
    [".c..C...", ".ccCc...", ".ccses..", "..sss...", "CcCcCdd.", "cCcCc...", ".cCcC...", "..k..k.."],
    [".c..C...", ".ccCc...", ".ccses..", "..sss...", "CcCcCgdx", "cCcCc...", ".cCcC...", "..k..k.."]],
   front:[
    [".c...C..", ".ccCcc..", ".cesec..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", "..k.k..."],
    [".c...C..", ".ccCcc..", ".cesec..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", "..k....."],
    [".c...C..", ".ccCcc..", ".cesec..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", "....k..."],
    [".c...C..", ".ccCcc..", ".cesec..", "..sss...", "CcCcCdd.", "cCcCc...", ".cCcC...", "..k.k..."],
    [".c...C..", ".ccCcc..", ".cesec..", "..sss...", "CcCcCgdx", "cCcCc...", ".cCcC...", "..k.k..."]],
   back:[
    ["..C...c.", "..ccCcc.", "..ccccc.", "...ccc..", "ddgCcCcC", "...cCcCc", "...CcCc.", "...k.k.."],
    ["..C...c.", "..ccCcc.", "..ccccc.", "...ccc..", "ddgCcCcC", "...cCcCc", "...CcCc.", ".....k.."],
    ["..C...c.", "..ccCcc.", "..ccccc.", "...ccc..", "ddgCcCcC", "...cCcCc", "...CcCc.", "...k...."],
    ["..C...c.", "..ccCcc.", "..ccccc.", "...ccc..", ".ddCcCcC", "...cCcCc", "...CcCc.", "...k.k.."],
    ["..C...c.", "..ccCcc.", "..ccccc.", "...ccc..", "xdgCcCcC", "...cCcCc", "...CcCc.", "...k.k.."]],
  },
  sorcerer:{pal:{"h": "#e8e8f0", "H": "#a8a8c0", "b": "#2a3a8a", "B": "#4a6ad0", "y": "#ffd34a", "s": "#f1c27d", "e": "#1b1b24", "w": "#a0f0ff", "t": "#6a3e28", "x": "#ffffff"},
   side:[
    ["..hhh..w", ".hhhhh.t", ".hhses.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", ".B...B.."],
    ["..hhh..w", ".hhhhh.t", ".hhses.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "B....B.."],
    ["..hhh..w", ".hhhhh.t", ".hhses.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "...BB..."],
    ["..hhh.w.", ".hhhhht.", ".hhsest.", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", ".B...B.."],
    ["..hhh..x", ".hhhhh.t", ".hhses.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", ".B...B.."]],
   front:[
    ["..hhh..w", ".hhhhh.t", ".heseh.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "..B.B..."],
    ["..hhh..w", ".hhhhh.t", ".heseh.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "..B....."],
    ["..hhh..w", ".hhhhh.t", ".heseh.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "....B..."],
    ["..hhh.w.", ".hhhhht.", ".heseht.", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "..B.B..."],
    ["..hhh..x", ".hhhhh.t", ".heseh.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", "..B.B..."]],
   back:[
    ["w..hhh..", "t.hhhhh.", "t.hhhhh.", "th.hh.H.", "..bbbbb.", "..BbbBb.", ".bbbbbbb", "...B.B.."],
    ["w..hhh..", "t.hhhhh.", "t.hhhhh.", "th.hh.H.", "..bbbbb.", "..BbbBb.", ".bbbbbbb", ".....B.."],
    ["w..hhh..", "t.hhhhh.", "t.hhhhh.", "th.hh.H.", "..bbbbb.", "..BbbBb.", ".bbbbbbb", "...B...."],
    [".w.hhh..", ".thhhhh.", ".thhhhh.", "th.hh.H.", "..bbbbb.", "..BbbBb.", ".bbbbbbb", "...B.B.."],
    ["x..hhh..", "t.hhhhh.", "t.hhhhh.", "th.hh.H.", "..bbbbb.", "..BbbBb.", ".bbbbbbb", "...B.B.."]],
  },
  ninja:{pal:{"k": "#24242e", "K": "#40404e", "r": "#d02030", "s": "#f1c27d", "e": "#1b1b24", "b": "#e8f0ff", "g": "#b8801c", "x": "#ffffff"},
   side:[
    ["..kkk..b", "rrrrrr.b", ".kkses.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k..k.."],
    ["..kkk..b", "rrrrrr.b", ".kkses.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", ".k...k.."],
    ["..kkk..b", "rrrrrr.b", ".kkses.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "...kk..."],
    ["..kkk.b.", "rrrrrrb.", ".kksesb.", "..kkkgb.", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k..k.."],
    ["..kkk..x", "rrrrrr.b", ".kkses.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k..k.."]],
   front:[
    ["..kkk..b", ".rrrrr.b", ".kesek.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k.k..."],
    ["..kkk..b", ".rrrrr.b", ".kesek.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k....."],
    ["..kkk..b", ".rrrrr.b", ".kesek.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "....k..."],
    ["..kkk.b.", ".rrrrrb.", ".kesekb.", "..kkkgb.", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k.k..."],
    ["..kkk..x", ".rrrrr.b", ".kesek.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k.k..."]],
   back:[
    ["b..kkk..", "b.rrrrr.", "b.kkkkk.", "bg.kkk..", ".gsKkKk.", "..kkrkk.", "..kKkKk.", "...k.k.."],
    ["b..kkk..", "b.rrrrr.", "b.kkkkk.", "bg.kkk..", ".gsKkKk.", "..kkrkk.", "..kKkKk.", ".....k.."],
    ["b..kkk..", "b.rrrrr.", "b.kkkkk.", "bg.kkk..", ".gsKkKk.", "..kkrkk.", "..kKkKk.", "...k...."],
    [".b.kkk..", ".brrrrr.", ".bkkkkk.", ".bgkkk..", ".gsKkKk.", "..kkrkk.", "..kKkKk.", "...k.k.."],
    ["x..kkk..", "b.rrrrr.", "b.kkkkk.", "bg.kkk..", ".gsKkKk.", "..kkrkk.", "..kKkKk.", "...k.k.."]],
  },
  samurai:{pal:{"r": "#b01c18", "R": "#6a1010", "y": "#ffd34a", "k": "#1b1b24", "s": "#f1c27d", "e": "#1b1b24", "m": "#2e2e38", "b": "#e8f0ff", "g": "#b8801c", "x": "#ffffff"},
   side:[
    [".y.y...b", ".yrrr..b", "rrrses.b", "R.mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k..k.."],
    [".y.y...b", ".yrrr..b", "rrrses.b", "R.mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", ".k...k.."],
    [".y.y...b", ".yrrr..b", "rrrses.b", "R.mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "...kk..."],
    [".y.y..b.", ".yrrr.b.", "rrrsesb.", "R.mmmgb.", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k..k.."],
    [".y.y...x", ".yrrr..b", "rrrses.b", "R.mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k..k.."]],
   front:[
    [".y...y.b", ".yrrry.b", ".reser.b", "..mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k.k..."],
    [".y...y.b", ".yrrry.b", ".reser.b", "..mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k....."],
    [".y...y.b", ".yrrry.b", ".reser.b", "..mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "....k..."],
    [".y...yb.", ".yrrryb.", ".reserb.", "..mmmgb.", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k.k..."],
    [".y...y.x", ".yrrry.b", ".reser.b", "..mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k.k..."]],
   back:[
    ["b.y...y.", "b.yrrry.", "b.rrrrr.", "bg.RRR..", ".gsRRRrr", "..rRRRrR", "..RrRrRr", "...k.k.."],
    ["b.y...y.", "b.yrrry.", "b.rrrrr.", "bg.RRR..", ".gsRRRrr", "..rRRRrR", "..RrRrRr", ".....k.."],
    ["b.y...y.", "b.yrrry.", "b.rrrrr.", "bg.RRR..", ".gsRRRrr", "..rRRRrR", "..RrRrRr", "...k...."],
    [".by...y.", ".byrrry.", ".brrrrr.", ".bgRRR..", ".gsRRRrr", "..rRRRrR", "..RrRrRr", "...k.k.."],
    ["x.y...y.", "b.yrrry.", "b.rrrrr.", "bg.RRR..", ".gsRRRrr", "..rRRRrR", "..RrRrRr", "...k.k.."]],
  },
  bard:{pal:{"p": "#c04a90", "P": "#ff8ac8", "f": "#ffd34a", "s": "#f1c27d", "e": "#1b1b24", "g": "#2a8a6a", "G": "#1a5a48", "y": "#ffd34a", "b": "#c08a40", "w": "#fff0c0", "x": "#ffffff"},
   side:[
    ["...ppfb.", "pppppPwb", "..psesw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "..G..G.."],
    ["...ppfb.", "pppppPwb", "..psesw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", ".G...G.."],
    ["...ppfb.", "pppppPwb", "..psesw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "...GG..."],
    ["...ppfb.", "pppppPb.", "..psesw.", "..ssswb.", ".gggygsb", ".Ggygwb.", ".ggggb..", "..G..G.."],
    ["...ppfx.", "pppppPwb", "..psesw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "..G..G.."]],
   front:[
    ["..pppfb.", "pppppPwb", ".pesepw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "..G.G..."],
    ["..pppfb.", "pppppPwb", ".pesepw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "..G....."],
    ["..pppfb.", "pppppPwb", ".pesepw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "....G..."],
    ["..pppfb.", "pppppPb.", ".pesepw.", "..ssswb.", ".gggygsb", ".Ggygwb.", ".ggggb..", "..G.G..."],
    ["..pppfx.", "pppppPwb", ".pesepw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "..G.G..."]],
   back:[
    [".bfppp..", "bwPppppp", ".wppppp.", "bw.ppp..", "bsggggg.", "bw.gggG.", ".b.gggg.", "...G.G.."],
    [".bfppp..", "bwPppppp", ".wppppp.", "bw.ppp..", "bsggggg.", "bw.gggG.", ".b.gggg.", ".....G.."],
    [".bfppp..", "bwPppppp", ".wppppp.", "bw.ppp..", "bsggggg.", "bw.gggG.", ".b.gggg.", "...G...."],
    [".bfppp..", ".wPppppp", ".wppppp.", ".bwppp..", "bsggggg.", ".bwgggG.", "..bgggg.", "...G.G.."],
    [".xfppp..", "bwPppppp", ".wppppp.", "bw.ppp..", "bsggggg.", "bw.gggG.", ".b.gggg.", "...G.G.."]],
  },
  summoner:{pal:{"t": "#1a8a8a", "T": "#40c0b0", "y": "#ffd34a", "w": "#f0f0e8", "W": "#b8b8c8", "s": "#f1c27d", "e": "#1b1b24", "v": "#ff6ae0", "k": "#4a3a2a", "x": "#ffffff"},
   side:[
    [".y..y..v", ".yttTy.k", ".ttses.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", ".W...W.."],
    [".y..y..v", ".yttTy.k", ".ttses.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "W....W.."],
    [".y..y..v", ".yttTy.k", ".ttses.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "...WW..."],
    [".y..y.v.", ".yttTyk.", ".ttsesk.", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", ".W...W.."],
    [".y..y..x", ".yttTy.k", ".ttses.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", ".W...W.."]],
   front:[
    [".y...y.v", ".yttty.k", ".teset.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "..W.W..."],
    [".y...y.v", ".yttty.k", ".teset.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "..W....."],
    [".y...y.v", ".yttty.k", ".teset.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "....W..."],
    [".y...yv.", ".ytttyk.", ".tesetk.", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "..W.W..."],
    [".y...y.x", ".yttty.k", ".teset.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", "..W.W..."]],
   back:[
    ["v.y...y.", "k.yttty.", "k.ttttt.", "kt.ttt..", "..wwtww.", "..wWtWw.", ".wwwtwww", "...W.W.."],
    ["v.y...y.", "k.yttty.", "k.ttttt.", "kt.ttt..", "..wwtww.", "..wWtWw.", ".wwwtwww", ".....W.."],
    ["v.y...y.", "k.yttty.", "k.ttttt.", "kt.ttt..", "..wwtww.", "..wWtWw.", ".wwwtwww", "...W...."],
    [".vy...y.", ".kyttty.", ".kttttt.", "kt.ttt..", "..wwtww.", "..wWtWw.", ".wwwtwww", "...W.W.."],
    ["x.y...y.", "k.yttty.", "k.ttttt.", "kt.ttt..", "..wwtww.", "..wWtWw.", ".wwwtwww", "...W.W.."]],
  },
  kensei:{pal:{"h": "#d8b060", "H": "#a07a30", "s": "#f1c27d", "e": "#1b1b24", "i": "#2a3a7a", "I": "#4a6ab0", "w": "#e8e8f0", "b": "#e8f0ff", "g": "#b8801c", "k": "#1b1b24", "x": "#ffffff"},
   side:[
    ["...hh..b", "hhhhhH.b", "..sses.b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k..k.."],
    ["...hh..b", "hhhhhH.b", "..sses.b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", ".k...k.."],
    ["...hh..b", "hhhhhH.b", "..sses.b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "...kk..."],
    ["...hh.b.", "hhhhhHb.", "..ssesb.", "..sssgb.", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k..k.."],
    ["...hh..x", "hhhhhH.b", "..sses.b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k..k.."]],
   front:[
    ["..hhh..b", "hhhhhhHb", "..ese..b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k.k..."],
    ["..hhh..b", "hhhhhhHb", "..ese..b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k....."],
    ["..hhh..b", "hhhhhhHb", "..ese..b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "....k..."],
    ["..hhh.b.", "hhhhhhHb", "..ese.b.", "..sssgb.", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k.k..."],
    ["..hhh..x", "hhhhhhHb", "..ese..b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k.k..."]],
   back:[
    ["b..hhh..", "bHhhhhhh", "b..iii..", "bg.iii..", ".gsIiIi.", "..iIiIi.", "..IiiiI.", "...k.k.."],
    ["b..hhh..", "bHhhhhhh", "b..iii..", "bg.iii..", ".gsIiIi.", "..iIiIi.", "..IiiiI.", ".....k.."],
    ["b..hhh..", "bHhhhhhh", "b..iii..", "bg.iii..", ".gsIiIi.", "..iIiIi.", "..IiiiI.", "...k...."],
    [".b.hhh..", "bHhhhhhh", ".b.iii..", ".bgiii..", ".gsIiIi.", "..iIiIi.", "..IiiiI.", "...k.k.."],
    ["x..hhh..", "bHhhhhhh", "b..iii..", "bg.iii..", ".gsIiIi.", "..iIiIi.", "..IiiiI.", "...k.k.."]],
  }
};
const NEW_PLAYER_SPRITES={
  paladin:{pal:{"y": "#ffd34a", "m": "#e8eef6", "M": "#a8b4c8", "s": "#f1c27d", "e": "#1b1b24", "w": "#f8f8ff", "W": "#c8d0e0", "r": "#c02030", "b": "#e8f4ff", "g": "#b8801c"},rows:["..yyy..b", ".mmmmm.b", ".mmses.b", "r.sss.gb", "rwwywMs.", "rWyyyW..", ".wwywW..", "..M..M.."]},
  assassin:{pal:{"k": "#3e4e3a", "h": "#26321f", "c": "#101810", "s": "#c9986a", "e": "#b8ff4a", "m": "#141a14", "d": "#d8f0d0", "g": "#7dce4a", "r": "#a02020"},rows:["...kk...", "..kkkk..", ".kkmme..", "rkhhm...", "rhhhhgdd", ".hgghh..", ".hhhhh..", "..c..c.."]},
  necromancer:{pal:{"k": "#2e2238", "K": "#5a4470", "r": "#b01828", "s": "#d8d0c8", "e": "#ff3040", "t": "#7a6450", "b": "#f0ece0"},rows:["..kkk.bb", ".kkkkk.t", ".kkses.t", "..sss.st", ".kkrkk.t", ".kKrKk.t", "kkkrkkkt", ".K...K.."]},
  huntress:{pal:{"h": "#8a3a1a", "H": "#c05a2a", "s": "#f1c27d", "e": "#1b1b24", "l": "#3a8a6a", "L": "#246050", "b": "#8a5a30", "w": "#f0e2b0", "y": "#ffd34a"},rows:["..hhh.b.", ".hhHhhwb", "hhhsesw.", "h.sss.wb", ".lllllsb", ".Llyl.wb", ".llll.b.", "..L..L.."]},
  mystic:{pal:{"p": "#5a2a8a", "P": "#8a4ac0", "v": "#40d0c0", "s": "#f1c27d", "e": "#1b1b24", "y": "#ffd34a", "o": "#80f0ff", "t": "#c0a060"},rows:["..pPp..o", ".pPPPp.t", ".ppses.t", "..vvv.st", ".pPyPp.t", ".ppypp.t", "pppypp.t", ".P...P.."]},
  trickster:{pal:{"c": "#2a6ad0", "C": "#e04aa0", "k": "#141428", "s": "#f1c27d", "e": "#1b1b24", "d": "#e8f0ff", "g": "#ffd34a"},rows:[".c..C...", ".ccCc...", ".ccses..", "..sss...", "CcCcCgdd", "cCcCc...", ".cCcC...", "..k..k.."]},
  sorcerer:{pal:{"h": "#e8e8f0", "H": "#a8a8c0", "b": "#2a3a8a", "B": "#4a6ad0", "y": "#ffd34a", "s": "#f1c27d", "e": "#1b1b24", "w": "#a0f0ff", "t": "#6a3e28"},rows:["..hhh..w", ".hhhhh.t", ".hhses.t", ".H.ss.st", ".bbybb..", ".bBybB..", "bbbybbb.", ".B...B.."]},
  ninja:{pal:{"k": "#24242e", "K": "#40404e", "r": "#d02030", "s": "#f1c27d", "e": "#1b1b24", "b": "#e8f0ff", "g": "#b8801c"},rows:["..kkk..b", "rrrrrr.b", ".kkses.b", "..kkk.gb", ".kKkKsg.", ".kkrkk..", ".kKkKk..", "..k..k.."]},
  samurai:{pal:{"r": "#b01c18", "R": "#6a1010", "y": "#ffd34a", "k": "#1b1b24", "s": "#f1c27d", "e": "#1b1b24", "m": "#2e2e38", "b": "#e8f0ff", "g": "#b8801c"},rows:[".y.y...b", ".yrrr..b", "rrrses.b", "R.mmm.gb", "rrRyRsg.", "RrRyRr..", "rRrRrR..", "..k..k.."]},
  bard:{pal:{"p": "#c04a90", "P": "#ff8ac8", "f": "#ffd34a", "s": "#f1c27d", "e": "#1b1b24", "g": "#2a8a6a", "G": "#1a5a48", "y": "#ffd34a", "b": "#c08a40", "w": "#fff0c0"},rows:["...ppfb.", "pppppPwb", "..psesw.", "..sss.wb", ".gggygsb", ".Ggyg.wb", ".gggg.b.", "..G..G.."]},
  summoner:{pal:{"t": "#1a8a8a", "T": "#40c0b0", "y": "#ffd34a", "w": "#f0f0e8", "W": "#b8b8c8", "s": "#f1c27d", "e": "#1b1b24", "v": "#ff6ae0", "k": "#4a3a2a"},rows:[".y..y..v", ".yttTy.k", ".ttses.k", "..sss.sk", ".wwtww..", ".wWtWw..", "wwwtwww.", ".W...W.."]},
  kensei:{pal:{"h": "#d8b060", "H": "#a07a30", "s": "#f1c27d", "e": "#1b1b24", "i": "#2a3a7a", "I": "#4a6ab0", "w": "#e8e8f0", "b": "#e8f0ff", "g": "#b8801c", "k": "#1b1b24"},rows:["...hh..b", "hhhhhH.b", "..sses.b", "..sss.gb", ".iIwIsg.", ".iIwIi..", ".IiwiI..", "..k..k.."]}
};
// RotMG kits: weapon / ability / armor. Ability item kinds below = ITEM_SPRITES keys in class_items.js
const NEW_CLASS_KIT={
 "paladin": [
  "sword",
  "seal",
  "heavy"
 ],
 "assassin": [
  "dagger",
  "poison",
  "leather"
 ],
 "necromancer": [
  "staff",
  "skull",
  "robe"
 ],
 "huntress": [
  "bow",
  "trap",
  "leather"
 ],
 "mystic": [
  "staff",
  "orb",
  "robe"
 ],
 "trickster": [
  "dagger",
  "prism",
  "leather"
 ],
 "sorcerer": [
  "wand",
  "scepter",
  "robe"
 ],
 "ninja": [
  "katana",
  "star",
  "leather"
 ],
 "samurai": [
  "katana",
  "wakizashi",
  "heavy"
 ],
 "bard": [
  "bow",
  "lute",
  "robe"
 ],
 "summoner": [
  "wand",
  "mace",
  "robe"
 ],
 "kensei": [
  "katana",
  "sheath",
  "heavy"
 ]
};
if(typeof module!=='undefined')module.exports={NEW_PLAYER_FRAMES,NEW_PLAYER_SPRITES,NEW_CLASS_KIT};
