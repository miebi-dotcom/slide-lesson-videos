// Recolour cards, card text, arrows and highlight bars, and switch off the card's progress line, without rebuilding a slide.
// Use it when the client's PDF changes its colours. Colours come from pdf_palette.py; never guess them.
// DATA: { "hideProgress": true,
//   "scenes": [ {"name": "S08 ...", "fill": [10,49,79], "text": [255,255,255], "arrow": [255,255,255], "hl": {"rgb": [255,255,255], "op": 16}} ],   (template slide comps: any key may be left out)
//   "custom": [ {"name": "S05 ...", "fill": [255,255,255], "text": [10,49,79], "bar": {"rgb": [10,49,79], "op": 8}, "arrow": [10,49,79]} ] }   (comps made by build_custom.jsx)
function c01(a) { return [a[0] / 255, a[1] / 255, a[2] / 255]; }
function lay(c, n) { for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).name === n) return c.layer(j); return null; }
function groupProp(L, group, sub, prop) {
    var g = L.property("ADBE Root Vectors Group").property(group);
    if (!g) return null;
    var s = g.property("ADBE Vectors Group").property(sub);
    return s ? s.property(prop) : null;
}
function paintText(L, rgb) { var st = L.property("Source Text"), td = st.value; td.fillColor = c01(rgb); st.setValue(td); }
function firstFill(L) {   // first fill of the first group that has one
    var root = L.property("ADBE Root Vectors Group");
    for (var i = 1; i <= root.numProperties; i++) {
        var cs = root.property(i).property("ADBE Vectors Group");
        if (!cs) continue;
        for (var k = 1; k <= cs.numProperties; k++) if (cs.property(k).matchName === "ADBE Vector Graphic - Fill") return cs.property(k);
    }
    return null;
}
function paintShape(L, rgb, op) {
    var f = firstFill(L);
    if (!f) return false;
    f.property("ADBE Vector Fill Color").setValue(c01(rgb));
    if (op !== undefined && op !== null) f.property("ADBE Vector Fill Opacity").setValue(op);
    return true;
}
app.beginUndoGroup("Recolour");
for (var s = 0; s < (DATA.scenes || []).length; s++) {
    var S = DATA.scenes[s], c = compByName(S.name);
    if (!c) { R.errors.push("missing " + S.name); continue; }
    var card = lay(c, "Card"), did = [];
    if (card && DATA.hideProgress) {
        var root = card.property("ADBE Root Vectors Group"), names = ["Progress", "Track"];
        for (var q = 0; q < names.length; q++) { var g = root.property(names[q]); if (g && g.enabled) { g.enabled = false; did.push("no " + names[q]); } }
    }
    if (card && S.fill) {
        var fp = groupProp(card, "Card Body", "Fill 1", "ADBE Vector Fill Color");
        if (fp) { fp.setValue(c01(S.fill)); did.push("fill"); }
    }
    if (S.text) { var h = lay(c, "Card Header"); if (h && String(h.property("Source Text").value.text) !== "") paintText(h, S.text); }
    for (var k = 1; k <= 7; k++) {
        var T = lay(c, "B" + k + " Text"), A = lay(c, "B" + k + " Arrow"), H = lay(c, "B" + k + " Highlight");
        if (T && S.text) paintText(T, S.text);
        if (A && (S.arrow || S.text)) { var ap = groupProp(A, "Arrow", "Fill 1", "ADBE Vector Fill Color"); if (ap) ap.setValue(c01(S.arrow || S.text)); }
        if (H && S.hl) {
            var bf = groupProp(H, "Bar", "Fill 1", "ADBE Vector Fill Color");
            if (bf) { bf.setValue(c01(S.hl.rgb)); groupProp(H, "Bar", "Fill 1", "ADBE Vector Fill Opacity").setValue(S.hl.op); }
        }
    }
    if (S.text) did.push("text"); if (S.hl) did.push("bars");
    R.done.push(S.name + ": " + did.join(", "));
}
for (var u = 0; u < (DATA.custom || []).length; u++) {
    var C = DATA.custom[u], cc = compByName(C.name);
    if (!cc) { R.errors.push("missing " + C.name); continue; }
    var n = { card: 0, text: 0, bar: 0, dot: 0 };
    for (var j = 1; j <= cc.numLayers; j++) {
        var L = cc.layer(j), nm = L.name;
        var wasLocked = L.locked; L.locked = false;
        if (/ Card \d+$/.test(nm) && C.fill) { if (paintShape(L, C.fill)) n.card++; }
        else if (/ Highlight \d+$/.test(nm) && C.bar) { if (paintShape(L, C.bar.rgb, C.bar.op)) n.bar++; }
        else if (/ Arrow \d+$/.test(nm) && (C.arrow || C.text)) { if (paintShape(L, C.arrow || C.text)) n.dot++; }
        else if (nm !== "Title" && nm !== "Course Name" && C.text) {
            var st = null; try { st = L.property("Source Text"); } catch (e) {}
            if (st && String(st.value.text) !== "") { paintText(L, C.text); n.text++; }
        }
        L.locked = wasLocked;
    }
    R.done.push(C.name + ": cards " + n.card + ", text " + n.text + ", bars " + n.bar + ", dots " + n.dot);
}
app.endUndoGroup();
