// Catalogue template/preset comps: what can be filled and how each one animates.
// DATA: { "folderId": 4090 }  (every comp under that folder, recursively)  or  { "ids": [162, 519] }
// Per comp: text slots (layer index, current text, font, size, box/point), image slots (footage layers,
// with a warning when other layers are parented to them), nested comps, and timing:
//   intro  = first key .. start of the longest key-free gap
//   hold   = the longest key-free gap (safe to stretch)
//   exit   = keys after the hold, if they end near the comp end (needs time-remap fitting)
// Animation Composer text presets show as "AC" animators; they reveal per line and can clip extra lines.
function keyTimes(grp, offset, acc, depth) {
    for (var i = 1; i <= grp.numProperties; i++) {
        var p = grp.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
            if (p.numKeys > 0) for (var k = 1; k <= p.numKeys; k++) acc.push(r2(p.keyTime(k) + offset));
        } else if (depth < 7) keyTimes(p, offset, acc, depth + 1);
    }
}
function compKeys(c, offset, acc, depth) {
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j);
        if (!L.enabled) continue;
        keyTimes(L, offset + 0, acc, 0);
        if (L.source instanceof CompItem && depth < 2 && L.source.duration < 120) compKeys(L.source, offset + L.startTime, acc, depth + 1);
    }
}
function folderPath(it) { var p = [], f = it.parentFolder; while (f && f !== app.project.rootFolder) { p.unshift(f.name); f = f.parentFolder; } return p.join(" / "); }
function collect(folder, out) {
    for (var i = 1; i <= folder.numItems; i++) {
        var it = folder.item(i);
        if (it instanceof FolderItem) collect(it, out); else if (it instanceof CompItem) out.push(it);
    }
}
var comps = [];
if (DATA.folderId) collect(byId(DATA.folderId), comps);
if (DATA.ids) for (var n = 0; n < DATA.ids.length; n++) comps.push(byId(DATA.ids[n]));
R.presets = [];
for (var n = 0; n < comps.length; n++) {
    var c = comps[n];
    if (!c) continue;
    var e = { id: c.id, name: c.name, folder: folderPath(c), dur: r2(c.duration), fps: r2(c.frameRate), usedIn: c.usedIn.length, texts: [], images: [], nested: [], notes: [] };
    var parentedTo = {};
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).parent) parentedTo[c.layer(j).parent.index] = (parentedTo[c.layer(j).parent.index] || 0) + 1;
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j);
        if (L instanceof TextLayer) {
            var td = L.property("Source Text").value, anim = [];
            var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
            for (var a = 1; a <= an.numProperties; a++) anim.push(an.property(a).name.indexOf("AC ") === 0 ? "AC" : an.property(a).name);
            e.texts.push({ layer: j, name: L.name.substr(0, 40), text: String(td.text).replace(/\r/g, " / ").substr(0, 90), font: td.font,
                size: r2(td.fontSize), box: td.boxText, scale: r2(tg(L).property("ADBE Scale").value[0]), inPoint: r2(L.inPoint),
                enabled: L.enabled, matte: L.hasTrackMatte, animators: anim.join(",") });
        } else if (L instanceof ShapeLayer) {
            // shape image slots: named like a placeholder, or filled with a placeholder purple
            var fillCol = null;
            (function findFill(g, d) { for (var i = 1; i <= g.numProperties && !fillCol; i++) { var p = g.property(i);
                if (p.matchName === "ADBE Vector Graphic - Fill") { try { fillCol = p.property("ADBE Vector Fill Color").value; } catch (x) {} }
                else if (p.propertyType !== PropertyType.PROPERTY && d < 6) findFill(p, d + 1); } })(L, 0);
            var purple = fillCol && fillCol[0] > 0.35 && fillCol[2] > 0.6 && fillCol[1] < 0.3;
            if (/replace|image|photo|placeholder|picture/i.test(L.name) || purple)
                e.images.push({ layer: j, name: L.name, slot: "shape", note: "fillShape: photo matted into this shape" + (purple ? " (purple placeholder)" : "") });
        } else if (L.source instanceof CompItem) {
            e.nested.push(j + ":" + L.source.name + "#" + L.source.id + " (shared by " + L.source.usedIn.length + ")");
            if (/replace|asset|image|photo|picture/i.test(L.source.name))
                e.images.push({ layer: j, name: L.name, slot: "nested", note: "nested: give the scene its own copy, then swap inside (shared by " + L.source.usedIn.length + " comps)" });
        } else if (L.source && L.source.file) {
            var im = { layer: j, name: L.name, source: L.source.name, w: L.source.width, h: L.source.height, scale: r2(tg(L).property("ADBE Scale").value[0]),
                startTime: r2(L.startTime), matte: L.hasTrackMatte, scaleKeys: tg(L).property("ADBE Scale").numKeys, posKeys: tg(L).property("ADBE Position").numKeys };
            if (parentedTo[j]) im.warning = parentedTo[j] + " layer(s) parented to this image: swap via a holder comp of the same size, never rescale it";
            e.images.push(im);
        }
    }
    // effective length: where the enabled layers actually end (comps are often padded far past it)
    var effEnd = 0;
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).enabled) effEnd = Math.max(effEnd, Math.min(c.layer(j).outPoint, c.duration));
    // exit signals: a layer whose LAST key leaves it transparent, scaled to nothing, or off-frame
    var exits = [], exitStart = 1e9;
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j); if (!L.enabled) continue;
        var t3 = tg(L), op = t3.property("ADBE Opacity"), sc = t3.property("ADBE Scale"), ps = t3.property("ADBE Position");
        if (op.numKeys > 1 && op.keyValue(op.numKeys) < 5 && op.keyValue(op.numKeys - 1) > 50) { exits.push(L.name.substr(0, 25) + " fades out"); exitStart = Math.min(exitStart, op.keyTime(op.numKeys - 1)); }
        if (sc.numKeys > 1 && sc.keyValue(sc.numKeys)[0] < 5 && sc.keyValue(sc.numKeys - 1)[0] > 50) { exits.push(L.name.substr(0, 25) + " scales out"); exitStart = Math.min(exitStart, sc.keyTime(sc.numKeys - 1)); }
        if (ps.numKeys > 1 && !L.parent) {
            var pv = ps.keyValue(ps.numKeys), pp = ps.keyValue(ps.numKeys - 1);
            var off = function (v) { return v[0] < -200 || v[0] > c.width + 200 || v[1] < -200 || v[1] > c.height + 200; };
            if (off(pv) && !off(pp)) { exits.push(L.name.substr(0, 25) + " moves off-frame"); exitStart = Math.min(exitStart, ps.keyTime(ps.numKeys - 1)); }
        }
    }
    // shape layers that trim themselves to nothing at the end (Trim Paths start == end on the last keys)
    function trimExit(grp, depth) {
        for (var i = 1; i <= grp.numProperties; i++) {
            var p = grp.property(i);
            if (p.matchName === "ADBE Vector Filter - Trim") {
                var s = p.property("ADBE Vector Trim Start"), en = p.property("ADBE Vector Trim End");
                if (s.numKeys > 1 && en.numKeys > 1 && s.keyTime(s.numKeys) > 0.5 &&
                    Math.abs(s.keyValue(s.numKeys) - en.keyValue(en.numKeys)) < 1 && Math.abs(s.keyValue(s.numKeys - 1) - en.keyValue(en.numKeys - 1)) > 10) return true;
            } else if (p.propertyType !== PropertyType.PROPERTY && depth < 6 && trimExit(p, depth + 1)) return true;
        }
        return false;
    }
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).enabled && c.layer(j) instanceof ShapeLayer && trimExit(c.layer(j), 0)) exits.push(c.layer(j).name.substr(0, 25) + " trims out");
    var acc = []; compKeys(c, 0, acc, 0); acc.sort(function (x, y) { return x - y; });
    var u = []; for (var q = 0; q < acc.length; q++) if (!u.length || u[u.length - 1] !== acc[q]) u.push(acc[q]);
    if (u.length > 1) {
        var last = u[u.length - 1];
        // the hold is the longest key-free gap: everything before it is the intro, after it the exit
        var bg = 0, ga = 0, gb = 0;
        for (var q = 1; q < u.length; q++) if (u[q] - u[q - 1] > bg) { bg = u[q] - u[q - 1]; ga = u[q - 1]; gb = u[q]; }
        e.timing = { firstKey: u[0], lastKey: last, effectiveEnd: r2(effEnd), keys: u.length, exitSignals: exits };
        if (exits.length) {
            var exitEnd = r2(Math.min(last + 1 / c.frameRate, effEnd));
            e.timing.suggestedFit = "remap hold [" + ga + "," + gb + "] end " + exitEnd;
            e.notes.push("has an animate-out: fit with remapFit. Verify the exit with QC frames - a stray late key can make it look longer than it is");
        } else {
            e.timing.introEnd = last;
            e.timing.suggestedFit = "extend (intro ends at " + last + "s, then static)";
        }
    } else e.timing = { suggestedFit: "extend (no keys found)", effectiveEnd: r2(effEnd) };
    R.presets.push(e);
}
