// Intro play button: a disc in the background colour has no contrast. Give it the content slides' look.
// DATA: { "scene": "S01 Intro", "disc": [255,255,255], "glyph": [15,55,83], "ring": [255,255,255] }  (pick colours that contrast with the intro background)
function cl(v) { return Math.round(v[0] * 255) + "," + Math.round(v[1] * 255) + "," + Math.round(v[2] * 255); }
var c = compByName(DATA.scene || "S01 Intro");
app.beginUndoGroup("Intro play button");
var names = ["Play Button", "Play Ring (pulse)"];
for (var n = 0; n < names.length; n++) {
    var L = null; for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).name === names[n]) L = c.layer(j);
    var root = L.property("ADBE Root Vectors Group");
    for (var i = 1; i <= root.numProperties; i++) {
        var g = root.property(i), cs = g.property("ADBE Vectors Group");
        for (var k = 1; k <= cs.numProperties; k++) {
            var p = cs.property(k);
            if (p.matchName === "ADBE Vector Graphic - Fill") {
                var before = cl(p.property("ADBE Vector Fill Color").value);
                p.property("ADBE Vector Fill Color").setValue(g.name === "Glyph" ? [DATA.glyph[0] / 255, DATA.glyph[1] / 255, DATA.glyph[2] / 255] : [DATA.disc[0] / 255, DATA.disc[1] / 255, DATA.disc[2] / 255]);
                R.done.push(names[n] + "/" + g.name + " fill " + before + " -> " + cl(p.property("ADBE Vector Fill Color").value));
            } else if (p.matchName === "ADBE Vector Graphic - Stroke") {
                var b2 = cl(p.property("ADBE Vector Stroke Color").value);
                p.property("ADBE Vector Stroke Color").setValue([DATA.ring[0] / 255, DATA.ring[1] / 255, DATA.ring[2] / 255]);
                R.done.push(names[n] + "/" + g.name + " stroke " + b2 + " -> " + DATA.ring.join(","));
            }
        }
    }
}
app.endUndoGroup();
