// After the slides were lengthened: (1) custom slides get comps as long as their slot, (2) every scene's background layer
// (and any layer still ending at the old 15 s) runs to the end of its comp, so the template's navy comp colour never shows.
// DATA: { "mainId": 2543, "custom": [ {"name": "S05 ...", "D": 19.6} ] }   (durations.json from plan_lesson.py)
var main = byId(DATA.mainId);
app.beginUndoGroup("Extend scene backgrounds");
for (var n = 0; n < DATA.custom.length; n++) {
    var cc = compByName(DATA.custom[n].name);
    if (!cc) { R.errors.push("missing " + DATA.custom[n].name); continue; }
    if (cc.duration < DATA.custom[n].D) cc.duration = DATA.custom[n].D;
    for (var i = 1; i <= main.numLayers; i++) if (main.layer(i).source === cc) main.layer(i).outPoint = main.layer(i).inPoint + DATA.custom[n].D;
}
var fixed = 0;
for (var q = 1; q <= app.project.numItems; q++) {
    var c = app.project.item(q);
    if (!(c instanceof CompItem) || !/^S\d\d /.test(c.name)) continue;
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j);
        if (L.outPoint < c.duration - 0.04 && (L.name === "BG" || L.outPoint > 14.9)) { try { var wasLocked = L.locked; L.locked = false; L.outPoint = c.duration; L.locked = wasLocked; fixed++; } catch (e) { R.warnings.push(c.name + " / " + L.name + ": " + e.message); } }
    }
}
R.done.push("layers extended: " + fixed);
app.endUndoGroup();
