// Shared helpers, prepended to every script by ae_run.ps1.
// ae_run.ps1 fills in RESULT_PATH (a unique temp file) and DATA (the JSON input) below.
// ExtendScript has no JSON object: results are written with toSource(), input arrives as a JS literal.

var RESULT_PATH = "__RESULT_PATH__";
var DATA = __DATA__;
var R = { done: [], warnings: [], errors: [] };

function writeResult() {
    var f = new File(RESULT_PATH);
    f.encoding = "UTF-8";
    f.open("w");
    f.write(R.toSource());
    f.close();
}

function byId(id) {
    for (var k = 1; k <= app.project.numItems; k++) {
        var it = app.project.item(k);
        if (it.id === id) return it;
    }
    return null;
}

// Comp names are often duplicated in template projects: prefer byId. byName returns the first match.
function compByName(n) {
    for (var k = 1; k <= app.project.numItems; k++) {
        var it = app.project.item(k);
        if (it instanceof CompItem && it.name === n) return it;
    }
    return null;
}

function folderNamed(name, create) {
    for (var k = 1; k <= app.project.numItems; k++) {
        var it = app.project.item(k);
        if (it instanceof FolderItem && it.name === name) return it;
    }
    return create ? app.project.items.addFolder(name) : null;
}

// Layer lookup by name; PSD footage layers may only match their source name "Layer/file.psd".
function layerNamed(comp, n) {
    for (var j = 1; j <= comp.numLayers; j++) if (comp.layer(j).name === n) return comp.layer(j);
    for (var j = 1; j <= comp.numLayers; j++) {
        var L = comp.layer(j);
        if (L.source && L.source.name && L.source.name.indexOf(n + "/") === 0) return L;
    }
    return null;
}

function tg(L) { return L.property("ADBE Transform Group"); }

function setText(L, str, fontSize) {
    var st = L.property("Source Text"), td = st.value;
    td.text = str;
    if (fontSize) td.fontSize = fontSize;
    if (st.numKeys > 0) { for (var k = 1; k <= st.numKeys; k++) st.setValueAtKey(k, td); }
    else st.setValue(td);
}

// Uniform bezier ease on every key of a property (dimension-aware; spatial props take 1 ease).
function easeAll(p, influence) {
    var dims = 1;
    try {
        if (!p.isSpatial) {
            if (p.propertyValueType === PropertyValueType.ThreeD) dims = 3;
            else if (p.propertyValueType === PropertyValueType.TwoD) dims = 2;
        }
    } catch (e) {}
    for (var k = 1; k <= p.numKeys; k++) {
        var a = [];
        for (var d = 0; d < dims; d++) a.push(new KeyframeEase(0, influence || 70));
        try { p.setTemporalEaseAtKey(k, a, a); } catch (e) {}
    }
}

// The lesson's signature curves (references/motion-polish.md). Influence pairs are [outgoing, incoming]:
//   "in"   entrance: fast start, long soft landing   first key out 10, landing key in 85
//   "out"  exit: gentle start, fast departure        first key out 85, last key in 10
//   "move" between two on-screen states: asymmetric  out 40, in 85 (never the symmetric F9 33/33)
// Middle keys (overshoot / settle) get in 60 / out 35 so the bounce stays soft.
var CURVE = { "in": [10, 85], "out": [85, 10], "move": [40, 85] };
function signatureEase(p, mode) {
    var c = CURVE[mode] || CURVE.move, n = p.numKeys, dims = 1;
    if (n < 1) return;
    try {
        if (!p.isSpatial) {
            if (p.propertyValueType === PropertyValueType.ThreeD) dims = 3;
            else if (p.propertyValueType === PropertyValueType.TwoD) dims = 2;
        }
    } catch (e) {}
    function ez(inf) { var a = []; for (var d = 0; d < dims; d++) a.push(new KeyframeEase(0, inf)); return a; }
    for (var k = 1; k <= n; k++) {
        var hold = false;
        try { hold = p.keyOutInterpolationType(k) === KeyframeInterpolationType.HOLD; } catch (e) {}
        if (hold) continue;
        var inI = k === n ? c[1] : 60, outI = k === 1 ? c[0] : 35;
        try {
            p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            p.setTemporalEaseAtKey(k, ez(inI), ez(outI));
        } catch (e) {}
    }
}

// Snap a time to the comp's frame grid (keys on half/sub-frames are a polish bug).
function snapT(comp, t) { var f = comp.frameDuration; return Math.round(t / f) * f; }

// Fit a preset with an animate-out into a scene of length D using time remap:
// play the intro (0..a) normally, stretch the static hold (a..b), play the exit (b..end) at the end.
// Removing every remap key switches remapping off, so new keys are added before old ones are removed.
function remapFit(L, t, D, a, b, end) {
    L.startTime = t;
    L.timeRemapEnabled = true;
    var tr = L.property("ADBE Time Remapping"), want;
    if (D >= a + (end - b)) want = [[0, 0], [a, a], [D - (end - b), b], [D, end]];
    else { var k2 = D / (a + end - b); want = [[0, 0], [a * k2, a], [D, end]]; }
    for (var w = 0; w < want.length; w++) tr.setValueAtTime(t + want[w][0], want[w][1]);
    for (var k = tr.numKeys; k >= 1; k--) {
        var kt = tr.keyTime(k) - t, keep = false;
        for (var w = 0; w < want.length; w++) if (Math.abs(kt - want[w][0]) < 0.02) keep = true;
        if (!keep && tr.numKeys > 2) tr.removeKey(k);
    }
    L.inPoint = t; L.outPoint = t + D;
    return want;
}

// Map a scene-relative time through remapFit's key list (for keying things inside a remapped comp).
function mapThroughRemap(rel, want) {
    for (var i = 1; i < want.length; i++) {
        if (rel <= want[i][0]) {
            var p = want[i - 1], q = want[i];
            return p[1] + (rel - p[0]) * (q[1] - p[1]) / (q[0] - p[0]);
        }
    }
    return want[want.length - 1][1];
}

// Extend a comp (no animate-out) to length D; layers that ran to the old end run to the new end.
function extendComp(c, D) {
    var L0 = c.duration;
    if (D > L0) {
        c.duration = D;
        for (var j = 1; j <= c.numLayers; j++) {
            var ly = c.layer(j);
            if (ly.outPoint >= L0 - 0.05) { try { ly.outPoint = D; } catch (e) {} }
        }
    }
}

// Re-time keys idxs of property p to newTimes, keeping values and eases.
function moveKeys(p, idxs, newTimes) {
    var data = [];
    for (var i = 0; i < idxs.length; i++) {
        var k = idxs[i];
        data.push({ v: p.keyValue(k), ie: p.keyInTemporalEase(k), oe: p.keyOutTemporalEase(k) });
    }
    for (var i = idxs.length - 1; i >= 0; i--) p.removeKey(idxs[i]);
    for (var i = 0; i < data.length; i++) {
        var nk = p.addKey(newTimes[i]);
        p.setValueAtKey(nk, data[i].v);
        try { p.setTemporalEaseAtKey(nk, data[i].ie, data[i].oe); } catch (e) {}
    }
}

function importOnce(path, asComp, folder) {
    var f = new File(path);
    if (!f.exists) throw new Error("file not found: " + path);
    if (!asComp) {
        for (var k = 1; k <= app.project.numItems; k++) {
            var x = app.project.item(k);
            if (x instanceof FootageItem && x.file && x.file.fsName === f.fsName) return x;
        }
    }
    var io = new ImportOptions(f);
    if (asComp) io.importAs = ImportAsType.COMP;
    var it = app.project.importFile(io);
    if (folder) {
        it.parentFolder = folder;
        if (asComp) {
            for (var k = 1; k <= app.project.numItems; k++) {
                var y = app.project.item(k);
                if (y instanceof FolderItem && y.parentFolder === app.project.rootFolder && y.name === it.name + " Layers") y.parentFolder = folder;
            }
        }
    }
    return it;
}

function r2(x) { return Math.round(x * 100) / 100; }

// Render one frame to PNG and wait until the file is completely written
// (saveFrameToPng is asynchronous: the file can exist before its data is flushed).
function renderFrame(comp, t, file) {
    comp.saveFrameToPng(t, file);
    var last = -1, seen = 0;
    for (var w = 0; w < 400; w++) {
        if (file.exists) {
            seen++;
            var len = file.length;                    // may read 0 (stale) for a while: readers retry
            if ((len > 0 && len === last) || seen > 20) return true;
            last = len;
        }
        $.sleep(75);
    }
    return file.exists;
}

// Minimal JSON writer (ExtendScript has no JSON object; toSource() output isn't valid JSON).
function toJSON(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(v) : "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
    if (v instanceof Array) { var a = []; for (var i = 0; i < v.length; i++) a.push(toJSON(v[i])); return "[" + a.join(",") + "]"; }
    var o = []; for (var k in v) if (v.hasOwnProperty(k)) o.push(toJSON(String(k)) + ":" + toJSON(v[k])); return "{" + o.join(",") + "}";
}
