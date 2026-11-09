// Build scenes from a plan: duplicate presets, fill them, fit timing, place on the main comp.
// One undo group per run. Re-running a scene name replaces the earlier version of that scene.
// DATA: {
//   "mainId": 4638, "scenesFolder": "COURSE101 scenes", "assetsFolder": "COURSE101 assets", "holdersFolder": "COURSE101 image holders",
//   "scenes": [ {
//     "name": "S03 Lesson objectives",          unique; becomes the duplicated comp's name
//     "preset": 519,                             template comp id to duplicate
//                                                (or "layered": "D:/path/file.psd" / ".ai" - imported as a layered comp)
//     "t": 23.92, "D": 28.5,                     start in main-comp seconds, length
//     "texts":   { "13": "Lesson objectives", "12": "First bullet" },   layer index -> text
//     "fontSize":{ "12": 64 },                   layer index -> pt
//     "fitWidth":{ "1": 844 },                   shrink font until the text is at most this many px wide (fixed-width bars)
//     "images":  { "10": "D:/assets/2 photo.jpg" },   footage image slot: layer index -> file (holder comp used automatically when needed)
//     "fillShape": { "8": "D:/assets/photo.png" },    shape image slot ("Replace Image here" box): photo matted into the shape
//     "nested":  { "2": {"images": {"2": "D:/a.png"}, "texts": {}, "fillShape": {}} },   slots inside a nested comp: the
//                                                scene gets its OWN copy of that nested comp first (shared comps stay untouched)
//     All layer indices refer to the ORIGINAL preset (as inspect_presets.jsx reports them).
//     "disable": [1, 2],                         layer indices to switch off (unused bullets)
//     "retime":  [[11, 12, 0.6], [9, 10, 2.4]],  [shapeIdx, textIdx, rel]: shift a bullet pair so its text starts at rel s ([t, t, rel] = text only)
//     "fit": {"mode": "extend"} | {"mode": "remap", "hold": [1.42, 12.42], "end": 13.45},
//     "moveKeys": [{"layer": "sidebar", "keys": [3, 4], "to": [-2, 0]}],   re-time keys to D+to (e.g. exit in last 2 s)
//     "heading": {"copyFrom": 2, "text": "Frontline workers", "font": "Manrope-ExtraBold", "sizeMul": 1.15, "dx": -150, "dy": -115},
//     "highlights": [{"layer": 1, "phrase": "comprehensive", "t": 61.96, "color": [1, 1, 0]}],  t in main-comp seconds
//     "pushIn": 0.07,                            slow push on image layers (fraction of scale over the scene)
//     "dy": -110                                 vertical offset of the placed layer (stacking bars)
//   } ] }
var main = byId(DATA.mainId);
if (!main) throw new Error("main comp " + DATA.mainId + " not found");
var scenesF = folderNamed(DATA.scenesFolder, true), assetsF = folderNamed(DATA.assetsFolder, true);
var holdersF = folderNamed(DATA.holdersFolder || (DATA.scenesFolder + " image holders"), true);
var PUSH = "var p=linear(time,inPoint,outPoint,0,1); value*(1+%A*(1-Math.pow(1-p,2)))";

function removeScene(name) {
    for (var j = main.numLayers; j >= 1; j--) { var L = main.layer(j); if (L.source && L.source.name === name) L.remove(); }
    var old = compByName(name);
    if (old && (old.parentFolder === scenesF || old.parentFolder === assetsF)) old.remove();
}

function swapImage(c, L, path, pushIn) {
    var item = importOnce(path, false, assetsF);
    var needsHolder = false;
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).parent === L) needsHolder = true;
    if (L.startTime < 0) needsHolder = true;
    if (needsHolder) {
        // frames/mattes are parented to this layer (or it starts before 0): keep its size and scale exactly,
        // put the new image inside a holder comp of the old source's size
        var ow = L.source.width, oh = L.source.height, need = Math.ceil(-Math.min(L.startTime, 0) + c.duration + 5);
        var h = app.project.items.addComp(item.name.replace(/\.[a-z0-9]+$/i, "") + " HOLDER", ow, oh, 1, need, c.frameRate);
        h.parentFolder = holdersF;
        var il = h.layers.add(item), s = Math.max(ow / item.width, oh / item.height) * 100;
        tg(il).property("ADBE Scale").setValue([s, s, 100]);
        il.outPoint = need;
        if (pushIn) tg(il).property("ADBE Scale").expression = "var p=linear(time," + r2(-L.startTime) + "," + r2(-L.startTime + c.duration) + ",0,1); value*(1+" + pushIn + "*(1-Math.pow(1-p,2)))";
        L.replaceSource(h, false);
        L.inPoint = 0; L.outPoint = c.duration;
        R.done.push(c.name + ": image in holder " + h.name);
    } else {
        var sc = tg(L).property("ADBE Scale"), v = sc.value, ow2 = L.source.width, oh2 = L.source.height;
        L.replaceSource(item, false);
        var s2 = Math.max(ow2 * v[0] / item.width, oh2 * v[1] / item.height);
        if (sc.numKeys === 0) sc.setValue([s2, s2, 100]); else R.warnings.push(c.name + ": image has scale keys, not rescaled");
        if (pushIn && sc.numKeys === 0) sc.expression = PUSH.replace("%A", pushIn);
        L.name = item.name;
    }
}

// Image slot that is a SHAPE (e.g. a purple "Replace Image here" box): put the photo directly under
// the shape and use the shape as its alpha matte, so the photo takes the shape's form and animation.
function fillShapeSlot(c, S, path, pushIn) {
    var item = importOnce(path, false, assetsF);
    // cover the LARGEST extent the shape reaches during the scene (slots often grow or move after their intro)
    var t3 = tg(S), X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
    var tEnd = Math.min(c.duration, Math.max(S.outPoint, 0)), tStart = Math.max(S.inPoint, 0);
    for (var ts = tStart + 0.5; ts <= tEnd; ts += 0.5) {
        var r = S.sourceRectAtTime(ts, false);
        var a = t3.property("ADBE Anchor Point").valueAtTime(ts, false), p = t3.property("ADBE Position").valueAtTime(ts, false), sc = t3.property("ADBE Scale").valueAtTime(ts, false);
        if (r.width < 1 || sc[0] < 1) continue;
        var ax = p[0] + sc[0] / 100 * (r.left - a[0]), ay = p[1] + sc[1] / 100 * (r.top - a[1]);
        X0 = Math.min(X0, ax); Y0 = Math.min(Y0, ay); X1 = Math.max(X1, ax + sc[0] / 100 * r.width); Y1 = Math.max(Y1, ay + sc[1] / 100 * r.height);
    }
    if (X1 <= X0) throw new Error("image-slot shape '" + S.name + "' has no visible area");
    if (S.parent) R.warnings.push(c.name + ": image-slot shape is parented; check the photo's framing in QC");
    var x0 = Math.max(0, X0), y0 = Math.max(0, Y0), bw = Math.min(c.width, X1) - x0, bh = Math.min(c.height, Y1) - y0;
    var L = c.layers.add(item);
    L.moveAfter(S);                                   // directly below the matte
    var s = Math.max(bw / item.width, bh / item.height) * 102;
    tg(L).property("ADBE Scale").setValue([s, s, 100]);
    tg(L).property("ADBE Position").setValue([x0 + bw / 2, y0 + bh / 2]);
    L.startTime = 0; L.inPoint = S.inPoint; L.outPoint = Math.max(S.outPoint, c.duration);
    L.trackMatteType = TrackMatteType.ALPHA;          // classic matte: the layer above (S) becomes the matte
    if (pushIn) tg(L).property("ADBE Scale").expression = PUSH.replace("%A", pushIn);
    R.done.push(c.name + ": " + item.name + " matted into shape '" + S.name + "'");
}

// Nested comp slot shared by every copy of the preset (e.g. "Replace asset here"): give this scene its
// own copy of the nested comp before changing anything inside it.
function ownNested(c, NL, sceneName) {
    var nc = NL.source.duplicate();
    nc.name = sceneName + " / " + NL.source.name;
    nc.parentFolder = holdersF;
    NL.replaceSource(nc, false);
    return nc;
}

function fitTextWidth(L, maxW) {
    var st = L.property("Source Text"), td = st.value;
    var w = L.sourceRectAtTime(L.inPoint + 2, false).width * Math.abs(tg(L).property("ADBE Scale").value[0]) / 100;
    if (w > maxW && w > 0) { td.fontSize = td.fontSize * maxW / w; st.setValue(td); R.done.push(L.name.substr(0, 30) + ": font -> " + r2(td.fontSize)); }
}

app.beginUndoGroup("Build lesson scenes");
for (var n = 0; n < DATA.scenes.length; n++) {
    var s = DATA.scenes[n];
    try {
        removeScene(s.name);
        var c;
        var layered = s.layered || s.psd;   // layered asset file: .psd or .ai (imported as a composition)
        if (layered) {
            c = importOnce(layered, true, assetsF);
            c.name = s.name; c.frameRate = main.frameRate;
            extendComp(c, s.D);
            if (/\.(ai|eps|pdf)$/i.test(layered)) {
                // vector layers: rasterize at render size so pops/overshoots stay sharp
                for (var v = 1; v <= c.numLayers; v++) { try { if (c.layer(v).source && c.layer(v).source.file) c.layer(v).collapseTransformation = true; } catch (e) {} }
                if (c.numLayers <= 2) R.warnings.push(s.name + ": the Illustrator file came in as " + c.numLayers + " layer(s) - only TOP-LEVEL Illustrator layers import separately. Ask for the artwork with each element on its own top-level layer (Illustrator: Release to Layers) before animating.");
            }
        } else {
            var src = byId(s.preset);
            if (!src) throw new Error("preset " + s.preset + " not found");
            c = src.duplicate(); c.name = s.name; c.parentFolder = scenesF;
            var k, slotLayers = {};
            if (s.fillShape) for (k in s.fillShape) slotLayers[parseInt(k, 10)] = c.layer(parseInt(k, 10));   // layer objects survive index shifts
            if (s.texts) for (k in s.texts) setText(c.layer(parseInt(k, 10)), s.texts[k], s.fontSize && s.fontSize[k] ? s.fontSize[k] : null);
            if (s.fontSize) for (k in s.fontSize) if (!s.texts || !s.texts[k]) setText(c.layer(parseInt(k, 10)), c.layer(parseInt(k, 10)).property("Source Text").value.text, s.fontSize[k]);
            if (s.images) for (k in s.images) swapImage(c, c.layer(parseInt(k, 10)), s.images[k], s.pushIn || 0);
            // nested slots first resolve their own copy; shape slots add a layer, so do them by
            // descending index to keep the other indices valid
            if (s.nested) for (k in s.nested) {
                var nsp = s.nested[k], nc = ownNested(c, c.layer(parseInt(k, 10)), s.name), kk;
                if (nsp.texts) for (kk in nsp.texts) setText(nc.layer(parseInt(kk, 10)), nsp.texts[kk]);
                if (nsp.images) for (kk in nsp.images) swapImage(nc, nc.layer(parseInt(kk, 10)), nsp.images[kk], s.pushIn || 0);
                if (nsp.fillShape) { var nks = []; for (kk in nsp.fillShape) nks.push(parseInt(kk, 10)); nks.sort(function (x, y) { return y - x; });
                    for (var q2 = 0; q2 < nks.length; q2++) fillShapeSlot(nc, nc.layer(nks[q2]), nsp.fillShape[String(nks[q2])], s.pushIn || 0); }
            }
            if (s.fitWidth) for (k in s.fitWidth) fitTextWidth(c.layer(parseInt(k, 10)), s.fitWidth[k]);
            var fit = s.fit || { mode: "extend" };
            if (fit.mode !== "remap") extendComp(c, s.D);
            if (s.retime) for (var b = 0; b < s.retime.length; b++) {
                var rt = s.retime[b], shp = c.layer(rt[0]), txt = c.layer(rt[1]), d = rt[2] - txt.inPoint;
                // text-only bullets (slide templates): pass the same index twice, it is shifted once
                if (rt[0] !== rt[1]) { shp.startTime += d; shp.outPoint = c.duration; }
                txt.startTime += d; txt.outPoint = c.duration;
            }
            if (s.disable) for (var q = 0; q < s.disable.length; q++) c.layer(s.disable[q]).enabled = false;
            // moveKeys: "layer" is a layer index (preferred: names change when images are swapped) or a name
            if (s.moveKeys) for (var m = 0; m < s.moveKeys.length; m++) {
                var mk = s.moveKeys[m], ml = (typeof mk.layer === "number") ? c.layer(mk.layer) : layerNamed(c, mk.layer);
                if (!ml) { R.warnings.push(s.name + ": moveKeys layer not found: " + mk.layer); continue; }
                var mp = tg(ml).property("ADBE Position");
                if (mp.numKeys >= mk.keys[mk.keys.length - 1]) moveKeys(mp, mk.keys, [s.D + mk.to[0], s.D + mk.to[1]]);
                else R.warnings.push(s.name + ": " + ml.name + " has only " + mp.numKeys + " position keys");
            }
            // heading last: duplicating a layer shifts the indices of the layers below it
            if (s.heading) {
                var hd = c.layer(s.heading.copyFrom).duplicate();
                hd.name = "Heading " + s.heading.text.substr(0, 30);
                var hst = hd.property("Source Text"), htd = hst.value;
                htd.text = s.heading.text;
                if (s.heading.font) { try { htd.font = s.heading.font; } catch (e) { R.warnings.push("font not set: " + s.heading.font); } }
                if (s.heading.sizeMul) htd.fontSize = htd.fontSize * s.heading.sizeMul;
                hst.setValue(htd);
                var hp = tg(hd).property("ADBE Position"), hv = hp.value;
                hp.setValue([hv[0] + (s.heading.dx || 0), hv[1] + (s.heading.dy || 0)]);
                if (s.heading.startAt !== undefined) hd.startTime += s.heading.startAt - hd.inPoint;
            }
            // shape image slots LAST: each adds a layer and shifts the indices below it.
            // Indices refer to the original preset; a heading (duplicated above its source) shifts layers
            // below it by one, so resolve the shape layers by name captured before the heading was added.
            if (s.fillShape) {
                var ks = []; for (k in s.fillShape) ks.push(parseInt(k, 10));
                ks.sort(function (x, y) { return y - x; });
                for (var q1 = 0; q1 < ks.length; q1++) fillShapeSlot(c, slotLayers[ks[q1]], s.fillShape[String(ks[q1])], s.pushIn || 0);
            }
            for (var z = 1; z <= c.numLayers; z++) { if (fit.mode !== "remap" && c.layer(z).outPoint > c.duration - 0.05) { try { c.layer(z).outPoint = c.duration; } catch (e) {} } }
        }
        var L = main.layers.add(c);
        var want = null;
        if (s.fit && s.fit.mode === "remap") want = remapFit(L, s.t, s.D, s.fit.hold[0], s.fit.hold[1], s.fit.end);
        else { L.startTime = s.t; L.inPoint = s.t; L.outPoint = s.t + s.D; }
        if (s.dy) { var pp = tg(L).property("ADBE Position"), pv = pp.value; pp.setValue([pv[0], pv[1] + s.dy]); }
        if (c.width !== main.width || c.height !== main.height) {
            // artboard / document of a different size: fit inside the frame (contain), centred
            var fs = Math.min(main.width / c.width, main.height / c.height) * 100;
            tg(L).property("ADBE Scale").setValue([fs, fs, 100]);
            if (layered && /\.(ai|eps|pdf)$/i.test(layered)) { try { L.collapseTransformation = true; } catch (e) {} }   // keep vectors sharp when scaled up
            R.warnings.push(s.name + ": source is " + c.width + "x" + c.height + ", scaled to " + r2(fs) + "% to fit the frame");
        }
        if (s.highlights) for (var h2 = 0; h2 < s.highlights.length; h2++) {
            var H = s.highlights[h2], tl = c.layer(H.layer), txt2 = String(tl.property("Source Text").value.text);
            var i0 = txt2.indexOf(H.phrase);
            if (i0 < 0) { R.warnings.push(s.name + ": highlight phrase not in text: " + H.phrase); continue; }
            var an = tl.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
            an.name = "HL " + H.phrase.substr(0, 25);
            an.property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color").setValue(H.color);
            var sel = an.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
            var adv = sel.property("ADBE Text Range Advanced");
            adv.property("ADBE Text Range Units").setValue(2);
            sel.property("ADBE Text Index Start").setValue(i0);
            sel.property("ADBE Text Index End").setValue(i0 + H.phrase.length);
            var rel = H.t - s.t, ctime = want ? mapThroughRemap(rel, want) : rel;
            var amt = adv.property("ADBE Text Selector Max Amount");
            amt.setValueAtTime(ctime - 0.1, 0); amt.setValueAtTime(ctime + 0.25, 100);
        }
        R.done.push(s.name + " @" + r2(s.t) + " +" + r2(s.D) + "s" + (want ? " (remap)" : ""));
    } catch (e) { R.errors.push(s.name + ": " + e.toString() + " (line " + e.line + ")"); }
}
app.endUndoGroup();
