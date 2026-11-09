// Match card text colour to the PDF: navy on blue / tan / outline cards, white on navy / red cards.
// Text, header and the bullet arrows follow. DATA: { "palette": {"navy": [10,49,79], "white": [255,255,255]}, "scenes": [ {"name": "S02 ...", "n": 5, "color": "navy"} ] }
// palette = the text colour of each page, read from the slide PDF (pdf_palette.py).
function lay(c, nm) { for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === nm) return c.layer(i); return null; }
var RGB = {};
for (var pk in DATA.palette) RGB[pk] = [DATA.palette[pk][0] / 255, DATA.palette[pk][1] / 255, DATA.palette[pk][2] / 255];
function paint(L, col) {
    var st = L.property("Source Text"), td = st.value;
    td.fillColor = col; st.setValue(td);
}
app.beginUndoGroup("Card text colours");
for (var s = 0; s < DATA.scenes.length; s++) {
    var S = DATA.scenes[s], c = compByName(S.name), col = RGB[S.color];
    if (!c) { R.errors.push("missing " + S.name); continue; }
    paint(lay(c, "Card Header"), col);
    for (var k = 1; k <= S.n; k++) {
        paint(lay(c, "B" + k + " Text"), col);
        var A = lay(c, "B" + k + " Arrow");
        if (A) A.property("ADBE Root Vectors Group").property("Arrow").property("ADBE Vectors Group").property("Fill 1").property("ADBE Vector Fill Color").setValue(col);
    }
    R.done.push(S.name + ": " + S.color);
}
app.endUndoGroup();
