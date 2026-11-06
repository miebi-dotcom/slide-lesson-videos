// QA gate 2 - read-only audit of what is actually in After Effects, run after building and before the QC frames.
// Writes a JSON dump for precheck_ae.py, which turns it into ERROR / WARN lines. Changes nothing unless "fixCaps" is true.
// DATA: { "out": "D:/.../_build/ae_dump.json", "mainId": 2543, "audioPrefix": "Background Music", "fixCaps": false }
// Per scene comp (name S## ...): text layers (text, size, fill colour, all-caps flags, where the text sits in the comp),
// layers that stop before the comp ends, expressions that failed, the background comp in use, missing footage.
// Per main comp: where every scene sits, the wipes, the music layer.
function rgb255(c) { return [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)]; }
function scanExpr(grp, path, out, depth) {
    if (depth > 8) return;
    for (var i = 1; i <= grp.numProperties; i++) {
        var p = grp.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
            try {
                if (p.expression !== "" && (!p.expressionEnabled || p.expressionError !== "")) {
                    out.push({ where: path + "/" + p.name, error: String(p.expressionError || "expression is switched off") });
                }
            } catch (e) {}
        } else scanExpr(p, path + "/" + p.name, out, depth + 1);
    }
}
function sceneInfo(c) {
    var info = { name: c.name, duration: c.duration, texts: [], early: [], exprErrors: [], bg: "", missing: [], disabledText: 0 };
    for (var j = 1; j <= c.numLayers; j++) {
        var L = c.layer(j);
        if (L.name === "BG" && L.source) info.bg = L.source.name;
        if (L.enabled && L.outPoint < c.duration - 0.05 && L.name !== "Header Line") info.early.push({ layer: L.name, outPoint: L.outPoint });
        scanExpr(L, c.name + "/" + L.name, info.exprErrors, 0);
        if (L.source instanceof CompItem) {
            for (var k = 1; k <= L.source.numLayers; k++) {
                var s = L.source.layer(k).source;
                if (s && s.footageMissing) info.missing.push(s.name);
            }
        } else if (L.source && L.source.footageMissing) info.missing.push(L.source.name);
        var st = null;
        try { st = L.property("Source Text"); } catch (e) {}
        if (!st) continue;
        if (!L.enabled) { info.disabledText++; continue; }
        var td = st.value, caps = false, small = false;
        try { caps = td.allCaps; small = td.smallCaps; } catch (e) {}
        // allCaps is read-only in ExtendScript; fontCapsOption is the writable switch
        if (DATA.fixCaps && (caps || small) && L.name !== "Title" && L.name !== "Lesson Title") {   /* topics stay in capitals */ try { td.fontCapsOption = FontCapsOption.FONT_NORMAL_CAPS; st.setValue(td); caps = st.value.allCaps; small = st.value.smallCaps; } catch (e) { R.warnings.push(c.name + " / " + L.name + ": caps not cleared: " + e.message); } }
        var t = Math.min(Math.max(L.inPoint + 3, L.inPoint), L.outPoint - 0.1);
        var r = L.sourceRectAtTime(t, false);
        var tg = L.property("ADBE Transform Group"), pos = tg.property("ADBE Position").valueAtTime(t, false), an = tg.property("ADBE Anchor Point").value;
        var sc = tg.property("ADBE Scale").valueAtTime(t, false)[0] / 100;
        var fill = null;
        try { fill = rgb255(td.fillColor); } catch (e) {}
        info.texts.push({ layer: L.name, text: String(td.text), size: td.fontSize, fill: fill, allCaps: caps, smallCaps: small,
                          left: Math.round(pos[0] + (r.left - an[0]) * sc), right: Math.round(pos[0] + (r.left + r.width - an[0]) * sc),
                          top: Math.round(pos[1] + (r.top - an[1]) * sc), bottom: Math.round(pos[1] + (r.top + r.height - an[1]) * sc),
                          inPoint: L.inPoint, outPoint: L.outPoint });
    }
    return info;
}
var out = { scenes: [], main: null, missingFootage: [] };
var scenes = [], re = /^S\d\d /;
for (var q = 1; q <= app.project.numItems; q++) {
    var it = app.project.item(q);
    if (it instanceof CompItem && re.test(it.name)) scenes.push(it);
    if (it instanceof FootageItem && it.footageMissing) out.missingFootage.push(it.name);
}
app.beginUndoGroup("Precheck");
for (var s = 0; s < scenes.length; s++) out.scenes.push(sceneInfo(scenes[s]));
app.endUndoGroup();
var main = byId(DATA.mainId);
if (main) {
    var m = { name: main.name, duration: main.duration, scenes: [], wipeBands: 0, wipeMattes: 0, audio: null };
    for (var i = 1; i <= main.numLayers; i++) {
        var L = main.layer(i), nm = L.name;
        if (L.source && re.test(L.source.name)) m.scenes.push({ name: L.source.name, inPoint: L.inPoint, outPoint: L.outPoint, matte: String(L.trackMatteType) });
        if (/Wipe band$/.test(nm)) m.wipeBands++;
        if (/Wipe matte$/.test(nm)) m.wipeMattes++;
        if (DATA.audioPrefix && nm.indexOf(DATA.audioPrefix) === 0) {
            var lv = L.property("ADBE Audio Group").property("ADBE Audio Levels");
            m.audio = { layer: nm, outPoint: L.outPoint, keys: lv.numKeys, enabled: L.audioEnabled };
        }
    }
    out.main = m;
}
var f = new File(DATA.out);
f.encoding = "UTF-8"; f.open("w"); f.write(toJSON(out)); f.close();
R.done.push("dump written: " + scenes.length + " scene comps -> " + DATA.out);
