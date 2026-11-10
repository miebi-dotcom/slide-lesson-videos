// Add the background music to the main comp (if it is not there yet), fade it in and out and cut it at the end of the video.
// The music is a bed under the slides: it is never analysed and the slides are not timed to it. A long track is simply trimmed.
// DATA: { "mainId": 2543, "audioFile": "D:/.../Track.mp3", "audioPrefix": "Track", "fadeIn": 2.5, "fadeOut": 5 }
var main = byId(DATA.mainId), A = null;
var FIN = DATA.fadeIn || 2.5, FOUT = DATA.fadeOut || 5;
function findMusic() {
    for (var i = 1; i <= main.numLayers; i++) if (main.layer(i).name.indexOf(DATA.audioPrefix) === 0) return main.layer(i);
    return null;
}
app.beginUndoGroup("Music");
A = findMusic();
if (!A) {
    if (!DATA.audioFile) throw new Error("music layer not found and no audioFile given");
    var f = new File(DATA.audioFile);
    if (!f.exists) throw new Error("audio file not found: " + DATA.audioFile);
    var item = null;
    for (var k = 1; k <= app.project.numItems; k++) {
        var it = app.project.item(k);
        if (it instanceof FootageItem && it.mainSource instanceof FileSource && it.mainSource.file && it.mainSource.file.fsName === f.fsName) { item = it; break; }
    }
    if (!item) item = app.project.importFile(new ImportOptions(f));
    A = main.layers.add(item);
    A.moveToEnd();            /* under every slide */
    A.startTime = 0;
    R.done.push("music added to the main comp: " + A.name);
}
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
