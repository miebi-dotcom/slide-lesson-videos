// Header line: keep only the static rule (white on red slides, navy on beige), switch off the moving red progress bar.
var n = 0, ruleInfo = [];
app.beginUndoGroup("Static header line");
for (var q = 1; q <= app.project.numItems; q++) {
    var c = app.project.item(q);
    if (!(c instanceof CompItem) || !/^S\d\d /.test(c.name)) continue;
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j);
        if (L.name !== "Header Line") continue;
        var root = L.property("ADBE Root Vectors Group");
        for (var i = 1; i <= root.numProperties; i++) if (root.property(i).name.indexOf("Progress") === 0) { root.property(i).enabled = false; n++; }
        if (c.name.indexOf("S02") === 0 || c.name.indexOf("S03") === 0) { var rl = root.property("Rule").property("ADBE Vectors Group").property("Stroke 1").property("ADBE Vector Stroke Color").value; ruleInfo.push(c.name.substr(0, 3) + " rule " + Math.round(rl[0] * 255) + "," + Math.round(rl[1] * 255) + "," + Math.round(rl[2] * 255)); }
    }
}
R.done.push("progress bars switched off: " + n); R.done.push(ruleInfo.join(" | "));
app.endUndoGroup();
