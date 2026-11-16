/* Shardwild inventory UI art (Sprites, for v27 game.js -> Rotmg's v28)
 * All pieces are RAW: outline baked in, '.' transparent, painted 1:1, each art px = u CSS px with u = hudArtPx()
 * (6032; it's 1 CSS px on a typical phone, the same scale as CLEAR_BAR and the event arrow). Do NOT run them through mkSprite.
 * Item icons keep drawItemIcon (79) and its own integer scale. Only the frames, slots, bars and strip are new.
 *
 * MAP TO GAME CODE (v27 line numbers):
 *  pieces.panel (16x16, 9-slice 6)         -> drawSidePanel 5958-5959 (fill .96 + #6a5aaa stripe). Also panel() 5594 for tooltips.
 *  pieces.statusStrip (9-slice 3) + status -> NEW fixed-height row at the TOP of the side panel (Rotmg v28 layout).
 *                                             Replaces the inline drawStatusTooltip call at 5981 (5860, which pushed the slots down).
 *                                             Tapping the strip can still open the old text list as an overlay to the LEFT of the panel.
 *  header (capL 6 / mid 1 / capR 6, 11 tall)-> the "Lv N Class" line, 5976
 *  pieces.barFrame (9-slice 2) + bar fills -> bar() 5872 for HP 5978, MP 5979 and XP 5980
 *  divider (end/line/gem, 3 tall)          -> 'Equipped' 5985, the #6a5430 line 5990-5991, 'Inventory' 5993, 'Loot' 6001
 *  pieces.slot / slotEquip / slotHover     -> drawSlot 6172-6180 (normal / equipped / sel=slotHot drag-over)
 *  pieces.slotSelect                       -> for a picked/tapped slot (the tooltip's ref slot) if you want one; v27 has no state for it
 *  eqIcon.weapon/ability/armor/ring        -> the empty equipped-slot label 'wpn','abl','arm','rng' (6212 txt -> faint icon)
 *  pieces.tabOn / tabOff                   -> drawChestPanel tabs 6230-6232 (keep the tab text colours)
 *  pieces.button / buttonHot + dropIcon    -> miniBtn 5904 (used by the tooltip Drop button, tag 'drop-item', and chest Unlock)
 *  pieces.slotPotHP / slotPotMP            -> OPTIONAL. v27 has no potion slot: hpPots/mpPots are a hidden stash (drinkHP/drinkMP 4629-4630).
 *                                             If you add a quick-pot row, use these frames with SHARD_ART pots.hp/mp icons and a count.
 *  There's no trash slot in v27 (drop = the tooltip button), so there's no trash-slot piece. The dropIcon goes on that button.
 *
 * LAYOUT (new, matches inventory_compare.png): pad 9 (inside the 4px frame), status strip 26 tall at the top (always drawn, even
 * when empty, so nothing moves), then header/zone/bars/stats/Equipped/Inventory/Loot.
 * Slot size: slot=floor(min((inner-3*gap)/4,(Pnl.h-FIXED-reserve)/rows)), FIXED=176+(bag?7:0) (all non-slot height incl. gaps
 * and the 7px 'Loot' divider), rows = slot rows as in v27, reserve = (chest?96:0)+(vchest?40:0) (the old bag 18 is now in FIXED).
 * It gives slot 46 at 844x390 with a bag, and the slots end at y=359 of 390. Clamp 18..46 as before.
 */
const INV_UI={"pal":{"k":"#0d0b12","F":"#2a2136","f":"#4a3c60","n":"#7a6898","b":"#15101d","s":"#0e0b14","e":"#241c30","E":"#3a2f4c","p":"#ff4fa8","P":"#a01860","R":"#ffb8d8","c":"#8a3ad0","y":"#ffd34a","o":"#b8801c","O":"#6a4a1c","i":"#2c2440","I":"#3c3254","t":"#1c1528","T":"#2e2242","h":"#2a1426","w":"#ffffff","r":"#e8304a","q":"#7a1626","u":"#3a7aff","U":"#1a3a8a","g":"#5ad86a","G":"#1e6a2e"},"pieces":{"panel":{"rows":["kkkkkkkkkkkkkkkk","kkRknnnnnnnnkRkk","kRpPffffffffRpPk","kkPkkkkkkkkkkPkk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","knfkbbbbbbbbkfFk","kkRkkkkkkkkkkRkk","kRpPffffffffRpPk","kkPkFFFFFFFFkPkk","kkkkkkkkkkkkkkkk"],
"slice":[6,6,6,6]},"statusStrip":{"rows":["kkkkkkkkkk","keeeeeeeEk","kessssssEk","kessssssEk","kessssssEk","kessssssEk","kessssssEk","kessssssEk","keEEEEEEEk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"slot":{"rows":["kkkkkkkkkk","keeeeeeeEk","kessssssEk","kessssssEk","kessssssEk","kessssssEk","kessssssEk","kessssssEk","keEEEEEEEk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"slotEquip":{"rows":["kkkkkkkkkk","kyooooooyk","koeeeeeEOk","koessssEOk","koessssEOk","koessssEOk","koessssEOk","koeEEEEEOk","kyOOOOOOyk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"slotHover":{"rows":["kppppppppk","pRRRRRRRPp","pReeeeeEPp","pRessssEPp","pRessssEPp","pRessssEPp","pRessssEPp","pReEEEEEPp","pRPPPPPPPp","kppppppppk"],
"slice":[3,3,3,3]},"slotSelect":{"rows":["kkkkkkkkkk","kpppppppPk","kpPPPPPPPk","kpPhhhhPPk","kpPhhhhPPk","kpPhhhhPPk","kpPhhhhPPk","kpPPPPPPPk","kpPPPPPPPk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"slotPotHP":{"rows":["kkkkkkkkkk","krqfffffFk","kqeeeeeEFk","kfessssEFk","kfessssEFk","kfessssEFk","kfessssEFk","kfeEEEEEFk","kfFFFFFFFk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"slotPotMP":{"rows":["kkkkkkkkkk","kuUfffffFk","kUeeeeeEFk","kfessssEFk","kfessssEFk","kfessssEFk","kfessssEFk","kfeEEEEEFk","kfFFFFFFFk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"button":{"rows":["kkkkkkkkkk","knnnnnnnFk","knttttttFk","knttttttFk","knttttttFk","knttttttFk","knttttttFk","knttttttFk","knFFFFFFFk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"buttonHot":{"rows":["kkkkkkkkkk","kpppppppPk","kpTTTTTTPk","kpTTTTTTPk","kpTTTTTTPk","kpTTTTTTPk","kpTTTTTTPk","kpTTTTTTPk","kpPPPPPPPk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"tabOn":{"rows":["kkkkkkkkkk","kppppppppk","kpRRRRRRpk","knTTTTTTFk","knTTTTTTFk","knTTTTTTFk","knTTTTTTFk","knTTTTTTFk","knFFFFFFFk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"tabOff":{"rows":["kkkkkkkkkk","kfffffffFk","kfttttttFk","kfttttttFk","kfttttttFk","kfttttttFk","kfttttttFk","kfttttttFk","kfFFFFFFFk","kkkkkkkkkk"],
"slice":[3,3,3,3]},"barFrame":{"rows":["kkkkkk","kFFFfk","kFssfk","kFssfk","kFfffk","kkkkkk"],
"slice":[2,2,2,2]}},"header":{"capL":["....kk","...kkf","..kRkt",".kRpkt","kRppkt","kppPkt",".kpPkt","..kPkt","...kkt","....kF","....kk"],
"mid":["k","f","t","t","t","t","t","t","t","F","k"],
"capR":["kk....","fkk...","tkRk..","tkpRk.","tkppRk","tkPppk","tkPpk.","tkPk..","tkk...","Fk....","kk...."]},"divider":{"end":["...",".ff","..."],
"line":["F","f","k"],
"gem":["..kRk..","kfPpPfk","..kPk.."]},"bar":{"hp":["#ff9aa8","#e8304a","#9a1426"],
"mp":["#9ac0ff","#3a7aff","#1a3a8a"],
"xp":["#b8ffc0","#5aff7a","#1e8a3e"],
"xpmax":["#ffe0b0","#ffb347","#a0601a"]},"eqIcon":{"weapon":["........II",".......IIi","......IIi.",".....IIi..",".i..IIi...","..iiIi....","...ii.....","..i.ii....",".i........","i........."],
"ability":["....II....","..IIiiii..",".Ii....ii.",".i..II..i.","Ii.IIii.ii","ii.Iiii.ii",".i..ii..i.",".ii....ii.","..iiiiii..","....ii...."],
"armor":["..II..ii..",".IIIiiiii.","IIiiiiiiii","Ii.iiii.ii","...iiii...","...Iiii...","...Iiii...","...iiii...","..iiiiii..",".........."],
"ring":["....II....","...IiiI...","....ii....","..IIiiii..",".Ii....ii.",".i......i.",".i......i.",".ii....ii.","..iiiiii..",".........."]},"dropIcon":["....p....","....p....","..p.p.p..","...ppp...","....p....",".........","k.......k","kRRRRRRRk","kkkkkkkkk"],
"statusPal":{"k":"#0d0b12","a":"#ff8a3a","A":"#ffd0a0","v":"#f4f6ff","V":"#9aa0b8","z":"#ffd34a","Z":"#fff4b0","m":"#b46aff","M":"#e8c8ff","l":"#6aa0ff","L":"#c8dcff","x":"#c6d67a","X":"#5a6430","j":"#7dce4a","J":"#d8ffb0"},"status":{"berserk":["....k....","...kak...","...kaak..","..kaAak..",".kaaAAak.","kaaAAAaak","kaAAAAAak",".kaAAAak.","..kkkkk.."],
"invis":["..kvkvk..",".kv.v.vk.","kv.....vk","v.......v","k.......k","v.......v","kv.....vk",".kv.v.vk.","..kvkvk.."],
"stun":["...kzk...","..kzZzk..","kkzZZZzkk","kzZZZZZzk",".kzZZZzk.",".kzZkZzk.","kzzk.kzzk","kkk...kkk","........."],
"para":["....kkkk.","...kmMk..","..kmMk...",".kmMMmkk.","kmmmMMmk.",".kkkmMk..","...kmk...","..kmk....","..kk....."],
"slow":["kkkkkkkkk","klLLLLLlk",".klLLLlk.","..klLlk..","...klk...","..klLlk..",".kllLllk.","klllllllk","kkkkkkkkk"],
"weak":["..kkkkk..","..kxXxk..","..kxXxk..","..kxXxk..","kkkxXxkkk",".kxxXxxk.","..kxXxk..","...kxk...","....k...."],
"poison":["....k....","...kjk...","..kjJjk..",".kjJjjjk.",".kjjjjjk.","kjjjjjjjk","kjjjjjjjk",".kjjjjjk.","..kkkkk.."]},"statusCol":{"berserk":"#ff8a3a","invis":"#f4f6ff","stun":"#ffd34a","para":"#b46aff","slow":"#6aa0ff","weak":"#c6d67a","poison":"#7dce4a"}};
