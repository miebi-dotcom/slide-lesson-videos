// Fade the music in and out and cut it at the end of the video. The level the user set is kept.
// DATA: { "mainId": 2543, "audioPrefix": "Background Music", "fadeIn": 2.5, "fadeOut": 5 }
var main = byId(DATA.mainId), A = null;
var FIN = DATA.fadeIn || 2.5, FOUT = DATA.fadeOut || 5;
for (var i = 1; i <= main.numLayers; i++) if (main.layer(i).name.indexOf(DATA.audioPrefix) === 0) A = main.layer(i);
if (!A) throw new Error("music layer not found");
app.beginUndoGroup("Music fades");
A.outPoint = main.duration;
var lv = A.property("ADBE Audio Group").property("ADBE Audio Levels");
var base = [0, 0];   // the level the user set (0 dB); read from the property only when it has no keys
if (lv.numKeys === 0) base = lv.value;
while (lv.numKeys > 0) lv.removeKey(1);
lv.setValueAtTime(0, [-48, -48]);
lv.setValueAtTime(FIN, [base[0], base[1]]);
lv.setValueAtTime(main.duration - FOUT, [base[0], base[1]]);
lv.setValueAtTime(main.duration, [-48, -48]);
R.done.push("music level " + base.join(",") + " dB, fades in " + FIN + " s and out over the last " + FOUT + " s; ends at " + main.duration.toFixed(1));
app.endUndoGroup();
