/* Serpent King body + tail, redrawn for 1:1 drawing (Sprites). Nothing wired in; Rotmg adds after Joshua's go.
 * Same palette as the head (ourohead). Draw these at their natural size (no scaling) so their pixels match the head's.
 * Segment index i (0 = behind the head, 13 = tail): i<5 body16, i<9 body14, else body12, last = tail. body10 is a spare.
 * Drawn sizes with the mkSprite outline: 18, 16, 14 and a 12px tail, against a ~25px head and a 10px player.
 */
const SEG_SPRITES_V27={
 "pal": {
  "a": "#a6e86a",
  "b": "#4aa83a",
  "c": "#246a2a",
  "d": "#123a18",
  "y": "#f0e08a",
  "g": "#ffd34a"
 },
 "body16": [
  "......aaab......",
  "....aaaabbbb....",
  "..aaaaaggbbbbb..",
  "..aaaabggbbbbb..",
  ".aaaabbyybbbbbd.",
  ".aaabbbggbbbbbd.",
  "aaabbbbggbbbbbbd",
  "aabbbbbyybbbbbcd",
  "abbbbbbggbbbbccd",
  "bbbbbbbggbbbcccd",
  ".bbbbbbyybbcccd.",
  ".bbbbbbggbccccd.",
  "..bbbbbggccccd..",
  "..bbbbbyycccdd..",
  "....ddbcccdd....",
  "......dddd......"
 ],
 "body14": [
  ".....aaab.....",
  "...aaaabbbb...",
  "..aaaaggbbbb..",
  ".aaaabggbbbbd.",
  ".aaabbyybbbbd.",
  "aaabbbggbbbbbd",
  "aabbbbggbbbbcd",
  "abbbbbyybbbccd",
  "bbbbbbggbbcccd",
  ".bbbbbggbcccd.",
  ".bbbbbyyccccd.",
  "..bbbbggcccd..",
  "...ddbcccdd...",
  ".....dddd....."
 ],
 "body12": [
  "....aabb....",
  "..aaabbbbb..",
  ".aaabggbbbd.",
  ".aabbggbbbd.",
  "aabbbyybbbbd",
  "abbbbggbbbbd",
  "bbbbbggbbbcd",
  "bbbbbyybbccd",
  ".bbbbggbccd.",
  ".bbbbggccdd.",
  "..ddbbccdd..",
  "....dddd...."
 ],
 "body10": [
  "...aabb...",
  "..aabbbb..",
  ".aabggbbd.",
  "aabbggbbdd",
  "abbbyybbbd",
  "bbbbggbbcd",
  "bbbbggbcdd",
  ".bbbyyccd.",
  "..ddbcdd..",
  "...dddd..."
 ],
 "tail": [
  "...aabb...",
  "..aabbbb..",
  ".aabgbbbc.",
  "aabgygbbcc",
  "abgyyygbbc",
  "bbbgygbbcc",
  "bbbbgbbccc",
  ".bbbbbccc.",
  "..ccbccc..",
  "...cccc..."
 ]
};
if(typeof module!=='undefined')module.exports={SEG_SPRITES_V27};
