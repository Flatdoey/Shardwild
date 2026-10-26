# Design notes: Realm of the Mad God (RotMG), and how they map to a mobile prototype

Sources: RealmEye wiki (Getting Started, Experience & Fame, Choosing a Class, Godlands guide), beginner-guide videos, plus general knowledge of the game. This is reference only. Our game is original: it has its own name, art, and text.

## What RotMG is
- A free-to-play co-op MMO bullet-hell shooter, viewed top-down, made of 8x8 pixel sprites scaled up big with crisp edges.
- Twin-stick style controls: WASD moves and the mouse aims. Holding the mouse fires your weapon. Space uses the class ability, which costs MP.
- Sessions are short and the danger is real. Death is **permanent** by default: you lose the character and everything it has equipped or carries. Only the vault, pets, and skins survive.

## Core loop
1. You start in the **Nexus**, a safe hub with no combat. It has portals, a vault, and a shop.
2. A portal takes you to a **Realm**, an open world built procedurally. Zones get harder as you go **from the beach (south and edges) toward the center/north Godlands**: beach → lowlands → midlands → highlands → mountains/Godlands.
3. You kill monsters for XP. **Max level is 20.** After that, progress means gear and stat potions.
4. Monsters drop **loot bags** whose color shows how valuable they are. Brown/pink bags are common. Purple, cyan, blue, and white bags are better and **soulbound**, meaning only you can see them.
5. Some monsters drop **dungeon portals**. A dungeon is a short instanced run with a boss at the end.
6. A **quest marker** (a red skull on the minimap) always points at the strongest monster that suits your level. It guides you into harder content.
7. Killing every realm quest boss triggers the realm closing and an end-game boss encounter.
8. You return to the Nexus to escape danger (the panic button). You die, earn fame, and start a new character.

## Classes (17+). Archetypes worth borrowing
- Robe (low defense, high damage, ranged): Wizard (staff, spell bomb ability), Priest (wand, heal tome), Necromancer, Sorcerer.
- Leather (mid): Rogue (dagger, cloak/invisibility), Archer (bow with piercing shots, quiver slow), Huntress, Ninja.
- Heavy (tanky, short range): Warrior (sword, helm for speed and berserk), Knight (sword, shield stun), Paladin (seal buff).
- Each class gets weapon, ability, armor, and ring slots. Weapon types are locked to the class.

## Stats
HP, MP, Attack (damage multiplier), Defense (flat reduction), Speed (move), Dexterity (fire rate), Vitality (HP regen), Wisdom (MP regen). Stats grow when you level and with **stat potions**. Each class has a stat cap ("8/8 maxed").
- HP and MP potions are hotkeyed consumables that heal and restore mana.

## Loot tiers
Equipment runs T0 to T14 or so, then untiered (UT) and set items. Higher tiers drop in harder zones and dungeons. The bag color tells you what's inside before you open it.

## Fame
Fame grows from XP and survival. It **only pays out when the character dies**, and achievements during the run add bonuses ("Fame bonuses": first born, max level, kills, and so on). The death screen shows the fame breakdown. Fame is the score you chase across runs.

## Bullet-hell vocabulary to borrow
- Aimed shots, spreads/shotguns (3 to 7 bullets in a fan), radial rings (8 to 32 bullets), rotating spirals, slow big orbs, fast thin needles, bullets that change angle or speed mid-flight, bullets that cause status effects (slow, paralyze, confuse).
- Gods and bosses chain phases: a shield phase, then a ring burst, then spirals and minion spawns.

## How this maps to mobile
- Left virtual stick moves. Right virtual stick aims and fires automatically while you hold it. Big ability button. HP and MP potion buttons near the thumbs.
- Short readable sessions: the hub, then a single scrolling realm with 4 zones that ring a central boss.
- Permadeath and fame stay, because they make the tension. Best runs are saved in localStorage.
- Single-player for now (MMO networking is out of scope for the prototype).
- Pixel art is drawn procedurally from small strings at 8x8 and upscaled with nearest-neighbor.
- Performance: object pools for bullets, a fixed canvas pixel scale with devicePixelRatio caps, no page scroll or zoom, and a PWA manifest so it can be added to the home screen.
