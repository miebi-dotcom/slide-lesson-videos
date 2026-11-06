// Replace the template's bank icon in front of the course name with the PDF's briefcase-with-plus icon, rebuilt from shape
// layers in the same 36 x 35 px box (same position, same stroke colour and width as the layer it replaces).
function line(grp, name, pts, closed) {
    var p = grp.addProperty("ADBE Vector Shape - Group"); p.name = name;
    var sh = new Shape(), z = [];
    for (var i = 0; i < pts.length; i++) z.push([0, 0]);
    sh.vertices = pts; sh.inTangents = z; sh.outTangents = z; sh.closed = closed;
    p.property("ADBE Vector Shape").setValue(sh);
}
var done = 0;
app.beginUndoGroup("Header icon");
for (var q = 1; q <= app.project.numItems; q++) {
    var c = app.project.item(q);
    if (!(c instanceof CompItem) || !/^S\d\d /.test(c.name)) continue;
    var old = null;
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).name === "Header Icon") old = c.layer(j);
    if (!old) continue;
    var oldStroke = old.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property("Stroke 1");
    var col = oldStroke.property("ADBE Vector Stroke Color").value, w = oldStroke.property("ADBE Vector Stroke Width").value;
    var idx = old.index, inP = old.inPoint, outP = old.outPoint, lab = old.label;
    var wasLocked = old.locked; old.locked = false;
    var nl = c.layers.addShape(); nl.name = "Header Icon (briefcase)";
    var root = nl.property("ADBE Root Vectors Group");
    var g = root.addProperty("ADBE Vector Group"); g.name = "Briefcase";
    var cs = g.property("ADBE Vectors Group");
    var rc = cs.addProperty("ADBE Vector Shape - Rect"); rc.name = "Body";
    rc.property("ADBE Vector Rect Size").setValue([30, 23]); rc.property("ADBE Vector Rect Position").setValue([149, 108.5]); rc.property("ADBE Vector Rect Roundness").setValue(4);
    line(cs, "Handle", [[143, 97], [143, 91], [155, 91], [155, 97]], false);
    line(cs, "Plus horizontal", [[143, 108.5], [155, 108.5]], false);
    line(cs, "Plus vertical", [[149, 102.5], [149, 114.5]], false);
    var st = cs.addProperty("ADBE Vector Graphic - Stroke");
    st.property("ADBE Vector Stroke Color").setValue(col); st.property("ADBE Vector Stroke Width").setValue(w);
    st.property("ADBE Vector Stroke Line Cap").setValue(2); st.property("ADBE Vector Stroke Line Join").setValue(2);
    nl.inPoint = inP; nl.outPoint = outP; nl.label = lab;
    nl.moveBefore(old);
    old.remove();
    nl.name = "Header Icon";
    done++;
}
R.done.push("icons replaced: " + done);
app.endUndoGroup();
