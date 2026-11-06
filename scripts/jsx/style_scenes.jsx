// Style scene comps built from the animator's slide templates: background, card colours, extra bullets,
// bullet fitting, plain lines, video slot cleanup + freeze-last-frame.
// DATA: { "bgIds": {"red": 2525, "beige": 1234}, "limit": 925, "boldFont": "Manrope-ExtraBold", "trackColor": [228,60,49], "scenes": [ {name, bg, cardFill, items, plain, hasHeader, video, intro, outro} ] }
var BOLD = DATA.boldFont || "Manrope-ExtraBold";
var LIMIT = DATA.limit || 925;
var S_D = 15;
function col(a) { return [a[0] / 255, a[1] / 255, a[2] / 255]; }
function lay(c, nm) { for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === nm) return c.layer(i); return null; }
function setSize(L, size, lead) {
    var st = L.property("Source Text"), td = st.value;
    td.fontSize = size; td.leading = lead; st.setValue(td);
}
function bodyProp(c, group, sub, prop) {
    var card = lay(c, "Card");
    return card.property("ADBE Root Vectors Group").property(group).property("ADBE Vectors Group").property(sub).property(prop);
}
function addBullet(c, k, rel, text) {
    // duplicate B5 text / arrow / highlight as B<k>
    var src = ["Text", "Arrow", "Highlight"], out = {};
    for (var i = 0; i < 3; i++) {
        var o = lay(c, "B5 " + src[i]);
        var d = o.duplicate();
        d.name = "B" + k + " " + src[i];
        out[src[i]] = d;
        if (src[i] === "Text") {
            var st = d.property("Source Text"), td = st.value; td.text = text; st.setValue(td);
            var shift = rel - d.inPoint; d.startTime += shift; d.outPoint = c.duration;
        }
    }
    var ex = out.Text.property("ADBE Transform Group").property("ADBE Position").expression;
    out.Text.property("ADBE Transform Group").property("ADBE Position").expression = ex.replace("j<5", "j<" + k);
    var names = ["Arrow", "Highlight"];
    for (var n = 0; n < 2; n++) {
        var tgp = out[names[n]].property("ADBE Transform Group");
        var props = ["ADBE Position", "ADBE Scale", "ADBE Opacity"];
        for (var q = 0; q < 3; q++) {
            var pr = tgp.property(props[q]);
            // the template expressions quote the layer name with double quotes: replace the bare name, every occurrence
            if (pr.expression) pr.expression = pr.expression.split("B5 Text").join("B" + k + " Text");
        }
    }
}
// bold the "Term:" lead-in of a bullet (hierarchy: term first, explanation second)
function boldLead(L, text) {
    var idx = text.indexOf(":");
    if (idx < 2 || idx > 45) return;
    var st = L.property("Source Text"), td = st.value;
    try { var rg = td.characterRange(0, idx + 1); rg.font = BOLD; st.setValue(td); } catch (e) { R.warnings.push("bold lead failed: " + e.message); }
}
function fitBullets(c, items, hasHeader, R2, plain) {
    var n = items.length, hdr = lay(c, "Card Header");
    var hsz = 32;
    if (hasHeader) {
        var htxt = String(hdr.property("Source Text").value.text);
        if (htxt.length > 70) hsz = 28;
        setSize(hdr, hsz, 44);
    }
    var best = 22;
    for (var s = 34; s >= 22; s -= 2) {
        var Lh = Math.round(s * 1.55), G = Math.round(s * 0.4);
        var hn = 0;
        if (hasHeader) { var hr = hdr.sourceRectAtTime(hdr.inPoint + 0.01, false); hn = Math.max(1, Math.round((hr.height + 10) / 44)); }
        var y = hasHeader ? (hdr.property("ADBE Transform Group").property("ADBE Position").value[1] + hn * 44 + 32) : 495;
        for (var i = 1; i <= n; i++) {
            var L = lay(c, "B" + i + " Text");
            setSize(L, s, Lh);
            var r = L.sourceRectAtTime(L.inPoint + 1.0, false);
            var lines = Math.max(1, Math.round((r.height + 10) / Lh));
            y += lines * Lh + G;
        }
        if (y <= LIMIT) { best = s; R2.done.push(c.name + ": bullets " + s + "pt (end y " + Math.round(y) + ", header lines " + hn + ")"); break; }
        if (s === 22) { best = 22; R2.warnings.push(c.name + ": bullets still overflow at 22pt (end y " + Math.round(y) + ")"); }
    }
    var Lf = Math.round(best * 1.55), Gf = Math.round(best * 0.4);
    for (var j = 1; j <= n; j++) {
        var T = lay(c, "B" + j + " Text"), pp = T.property("ADBE Transform Group").property("ADBE Position");
        setSize(T, best, Lf);
        if (pp.expression) pp.expression = pp.expression.replace(/var L=\d+,G=\d+/, "var L=" + Lf + ",G=" + Gf);
    }
    for (var b = 1; b <= n; b++) {
        var isPlain = false;   // a plain line (no arrow) is an introduction or a note: regular weight, no bold lead-in
        for (var pp2 = 0; pp2 < (plain || []).length; pp2++) if (plain[pp2] === b - 1) isPlain = true;
        if (!isPlain) boldLead(lay(c, "B" + b + " Text"), items[b - 1]);
    }
}
function videoSlot(c, name) {
    var NL = lay(c, "Image (open comp to replace)");
    if (!NL || !(NL.source instanceof CompItem)) return "no image slot";
    var nc = NL.source, msg = "";
    var v = null;
    for (var i = 1; i <= nc.numLayers; i++) if (nc.layer(i).source && nc.layer(i).source.mainSource instanceof FileSource && nc.layer(i).source.hasVideo) v = nc.layer(i);
    if (!v) return "no video layer in " + nc.name;
    for (var k = 1; k <= nc.numLayers; k++) { var q = nc.layer(k); if (q !== v && (q.name === "Label" || q.name === "Icon")) q.enabled = false; }
    var fxp = v.property("ADBE Effect Parade");   // the placeholder's Gradient Ramp survives replaceSource and hides the video
    while (fxp.numProperties > 0) fxp.property(1).remove();
    var dur = v.source.duration;
    v.startTime = 0;
    if (!v.timeRemapEnabled) v.timeRemapEnabled = true;
    var tr = v.property("ADBE Time Remapping");
    // keep the footage's own keys (0 and last frame), then let the last frame hold to the end of the comp
    v.outPoint = nc.duration;
    v.audioEnabled = false;       // the clips carry their own sound; the lesson uses the music track only
    NL.audioEnabled = false;
    // keep the held last frame alive: one slow push-in across the whole slide (the clip's own motion rides on top)
    var vs = v.property("ADBE Transform Group").property("ADBE Scale");
    if (vs.numKeys === 0) vs.expression = "var d=" + (S_D || 15) + "; value*(1+0.06*(1-Math.pow(1-Math.min(time/d,1),2)))";
    msg ="video " + dur.toFixed(2) + "s frozen to " + nc.duration.toFixed(0) + "s; remap keys " + tr.numKeys;
    return msg;
}

app.beginUndoGroup("Style scenes");
for (var n = 0; n < DATA.scenes.length; n++) {
    var S = DATA.scenes[n];
    try {
        var c = compByName(S.name);
        if (!c) { R.warnings.push("scene comp not found: " + S.name); continue; }
        if (DATA.refitOnly) { if (S.items) fitBullets(c, S.items, S.hasHeader, R, S.plain); continue; }
        if (S.bg && DATA.bgIds && DATA.bgIds[S.bg]) {
            var bgNew = byId(DATA.bgIds[S.bg]), bgl = lay(c, "BG");
            if (bgl && bgNew && bgl.source !== bgNew) { bgl.replaceSource(bgNew, false); R.done.push(S.name + ": BG -> " + S.bg); }
        }
        if (S.cardFill) {
            bodyProp(c, "Card Body", "Fill 1", "ADBE Vector Fill Color").setValue(col(S.cardFill));
            var trk = bodyProp(c, "Track", "Stroke 1", "ADBE Vector Stroke Color");
            var cur = trk.value;
            if (DATA.trackColor && Math.abs(cur[0] - 15 / 255) < 0.02 && S.cardFill[0] === 15) trk.setValue(col(DATA.trackColor));   // a dark track on a dark card would vanish
            R.done.push(S.name + ": card fill " + S.cardFill.join(","));
        }
        if (S.items) {
            var items = S.items, nn = items.length;
            for (var k = 6; k <= nn; k++) addBullet(c, k, S.rels[k - 1], items[k - 1]);
            for (var pi = 0; pi < S.plain.length; pi++) {
                var idx = S.plain[pi] + 1;
                var ar = lay(c, "B" + idx + " Arrow"), hl = lay(c, "B" + idx + " Highlight");
                if (ar) ar.enabled = false;
                if (hl) hl.enabled = false;
            }
            fitBullets(c, items, S.hasHeader, R, S.plain);
        }
        S_D = S.D;
        if (S.video) R.done.push(S.name + ": " + videoSlot(c, S.name));
    } catch (e) { R.errors.push(S.name + ": " + e.message + " (line " + e.line + ")"); }
}
app.endUndoGroup();
