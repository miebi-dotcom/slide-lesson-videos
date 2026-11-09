// New shape layers are centred in the comp by default; the template's icon sat at 0,0 with the artwork drawn in place.
var n = 0;
app.beginUndoGroup("Header icon position");
for (var q = 1; q <= app.project.numItems; q++) {
    var c = app.project.item(q);
    if (!(c instanceof CompItem) || !/^S\d\d /.test(c.name)) continue;
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).name === "Header Icon") { c.layer(j).property("ADBE Transform Group").property("ADBE Position").setValue([0, 0, 0]); n++; }
}
R.done.push("positioned " + n);
app.endUndoGroup();
