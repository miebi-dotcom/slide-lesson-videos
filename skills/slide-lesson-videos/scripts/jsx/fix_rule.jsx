// Header line: set the static rule's colour from the slide's background (white on navy, navy on beige).
// Run after staticline.jsx and after any background swap. DATA: { "project": "...", "scenes": [ {"name": "S02 ...", "bg": "navy" | "beige"} ] }
app.beginUndoGroup("Header rule colour");
for (var s = 0; s < DATA.scenes.length; s++) {
    var S = DATA.scenes[s], c = compByName(S.name);
    if (!c) { R.errors.push("missing " + S.name); continue; }
    var col = S.bg === "navy" ? [1, 1, 1] : [10 / 255, 49 / 255, 79 / 255], n = 0;
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j);
        if (L.name !== "Header Line") continue;
        L.property("ADBE Root Vectors Group").property("Rule").property("ADBE Vectors Group").property("Stroke 1").property("ADBE Vector Stroke Color").setValue(col);
        n++;
    }
    R.done.push(S.name + ": rule " + S.bg + " (" + n + ")");
}
app.endUndoGroup();
