// Place the template's chevron wipe on every slide-to-slide cut, stacked exactly like the template's DEMO comp:
// per cut (top to bottom) red band, matte (hidden), incoming slide with an alpha matte. Latest scene on top.
// DATA: { "mainId": 2543, "bandId": 442, "matteId": 455 }
var main = byId(DATA.mainId), BAND = byId(DATA.bandId), MATTE = byId(DATA.matteId);
app.beginUndoGroup("Place wipes");
for (var j = main.numLayers; j >= 1; j--) { var Lr = main.layer(j); if (Lr.source === BAND || Lr.source === MATTE) Lr.remove(); }
var sc = [];
for (var i = 1; i <= main.numLayers; i++) {
    var L = main.layer(i);
    if (L.source && /^S\d\d /.test(L.source.name)) { L.trackMatteType = TrackMatteType.NO_TRACK_MATTE; sc.push(L); }
}
sc.sort(function (a, b) { return a.startTime - b.startTime; });
for (var n = 0; n < sc.length; n++) {
    var sl = sc[n], t0 = sl.startTime, tag = sl.source.name.substr(0, 3), end = sl.outPoint;
    if (n > 0) {
        var m = main.layers.add(MATTE); m.startTime = t0; m.inPoint = t0; m.outPoint = end; m.name = tag + " Wipe matte"; m.enabled = false;
        var b = main.layers.add(BAND); b.startTime = t0; b.inPoint = t0; b.outPoint = t0 + BAND.duration; b.name = tag + " Wipe band";
        sl.moveToBeginning(); m.moveToBeginning();
        sl.trackMatteType = TrackMatteType.ALPHA;
        b.moveToBeginning();
    } else sl.moveToBeginning();
}
var last = sc[sc.length - 1];
main.duration = last.outPoint;
main.workAreaStart = 0; main.workAreaDuration = main.duration;
R.done.push("wipes placed on " + (sc.length - 1) + " cuts; main duration " + main.duration.toFixed(2));
app.endUndoGroup();
