// Remove the template's exit fade (everything faded out 0.6 s before the wipe started): push it past the end of each scene
// comp, so every element stays on screen until the next slide's wipe has covered it.
var SWAPS = [["thisComp.duration - 1.71", "thisComp.duration + 5"], ["thisComp.duration - 1.08", "thisComp.duration + 6"],
             ["thisComp.duration-1.71", "thisComp.duration+5"], ["thisComp.duration-1.08", "thisComp.duration+6"],
             ["thisComp.duration-1.3", "thisComp.duration+5"], ["thisComp.duration-0.7", "thisComp.duration+6"]];
var changed = 0;
function scan(grp, d) {
    for (var i = 1; i <= grp.numProperties; i++) {
        var p = grp.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
            if (p.expression && p.expression.indexOf("duration") >= 0) {
                var e = p.expression, o = e;
                for (var s = 0; s < SWAPS.length; s++) e = e.split(SWAPS[s][0]).join(SWAPS[s][1]);
                if (e !== o) { p.expression = e; changed++; }
            }
        } else if (d < 6) scan(p, d + 1);
    }
}
app.beginUndoGroup("Remove exit fades");
for (var q = 1; q <= app.project.numItems; q++) {
    var c = app.project.item(q);
    if (!(c instanceof CompItem) || !/^S\d\d /.test(c.name)) continue;
    for (var j = 1; j <= c.numLayers; j++) scan(c.layer(j), 0);
}
R.done.push("expressions updated: " + changed);
app.endUndoGroup();
