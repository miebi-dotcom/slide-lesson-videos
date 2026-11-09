// Build the slides that have no picture slot in the template (two cards / four cards), from a red-background
// copy of "Slide 2 - Blue Card": keeps title, logo, header, course name and play button, replaces card + picture.
// DATA: { "mainId": 2543, "bgIds": {"red": 2525}, "baseId": 163, "scenesFolder": "<code> scenes", "course": "...",
//   "cardColor": [65,176,246], "textColor": [10,49,79],   (both from the slide PDF)
//   "slides": [ { "name": "S05 Team Roles", "title": "...", "t": 48.9, "D": 12.5, "kind": "two"|"four",
//                 "cards": [ ... ] } ] }
var main = byId(DATA.mainId), base = byId(DATA.baseId);
var scenesF = folderNamed(DATA.scenesFolder, true);
function c01(a) { return [a[0] / 255, a[1] / 255, a[2] / 255]; }
var WHITE = [1, 1, 1], NAVYT = c01(DATA.textColor), BLUE = c01(DATA.cardColor);
var KILL = ["Image Outline (white)", "Image Matte", "Image (open comp to replace)", "Card Header", "Card", "B1 Text", "B2 Text", "B3 Text", "B4 Text", "B5 Text",
            "B1 Arrow", "B2 Arrow", "B3 Arrow", "B4 Arrow", "B5 Arrow", "B1 Highlight", "B2 Highlight", "B3 Highlight", "B4 Highlight", "B5 Highlight"];

function ez(prop, inf) {
    var n = (prop.value instanceof Array) ? prop.value.length : 1, a = [];
    for (var i = 0; i < n; i++) a.push(new KeyframeEase(0, inf));
    return a;
}
function easeAt(prop, k, inInf, outInf) {
    // the expected array length depends on the property (opacity 1, spatial position 1 or 3, scale 3): try each
    var tries = [(prop.value instanceof Array) ? prop.value.length : 1, 1, 2, 3], done = false;
    for (var i = 0; i < tries.length && !done; i++) {
        var a = [], b = [];
        for (var q = 0; q < tries[i]; q++) { a.push(new KeyframeEase(0, inInf)); b.push(new KeyframeEase(0, outInf)); }
        try { prop.setTemporalEaseAtKey(k, a, b); done = true; } catch (e) {}
    }
    if (!done) R.warnings.push("ease not set on " + prop.name);
}
function easeKeys(prop, k1, k2) {
    easeAt(prop, k1, 33, 10);
    easeAt(prop, k2, 85, 33);
}
function rise(L, x, y, t0, dur, dist) {
    var p = L.property("ADBE Transform Group").property("ADBE Position"), o = L.property("ADBE Transform Group").property("ADBE Opacity");
    p.setValueAtTime(t0, [x, y + dist]); p.setValueAtTime(t0 + dur, [x, y]);
    easeKeys(p, 1, 2);
    o.setValueAtTime(t0, 0); o.setValueAtTime(t0 + dur * 0.5, 100);
    easeKeys(o, 1, 2);
}
function addCard(c, name, x, y, w, h, color, t0) {
    var sl = c.layers.addShape(); sl.name = name;
    var g = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = "Card Body";
    var rc = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    rc.property("ADBE Vector Rect Size").setValue([w, h]); rc.property("ADBE Vector Rect Roundness").setValue(30);
    var fl = g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(color);
    rise(sl, x + w / 2, y + h / 2, t0, 0.97, 90);
    return sl;
}
function addText(c, name, str, font, size, x, y, boxW, t0, dist) {
    var L = c.layers.addBoxText([boxW, 500]); L.name = name;
    var st = L.property("Source Text"), td = st.value;
    td.resetCharStyle(); td.font = font; td.fontSize = size; td.fillColor = NAVYT; td.applyFill = true; td.applyStroke = false;
    td.justification = ParagraphJustification.LEFT_JUSTIFY; td.leading = Math.round(size * 1.3);
    td.text = str; st.setValue(td);
    L.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([-boxW / 2, -250]);   // box text: anchor (-w/2,-h/2) puts the layer position at the box's top-left
    rise(L, x, y, t0, 0.81, dist === undefined ? 30 : dist);
    return L;
}
function boldLead(L, text) {
    var idx = text.indexOf(":");
    if (idx < 2 || idx > 45) return;
    var st = L.property("Source Text"), td = st.value;
    try { td.characterRange(0, idx + 1).font = "Manrope-ExtraBold"; st.setValue(td); } catch (e) { R.warnings.push("bold lead failed"); }
}
function textH(L) { return L.sourceRectAtTime(L.inPoint + 5, false).height; }
function addDot(c, name, x, y, t0) {
    // small play-triangle bullet, lands with a slight overshoot
    var sl = c.layers.addShape(); sl.name = name;
    var g = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var pt = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Star");
    pt.property("ADBE Vector Star Type").setValue(2); pt.property("ADBE Vector Star Points").setValue(3);
    pt.property("ADBE Vector Star Outer Radius").setValue(9); pt.property("ADBE Vector Star Rotation").setValue(90);
    var fl = g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(NAVYT);
    sl.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
    var s = sl.property("ADBE Transform Group").property("ADBE Scale");
    s.setValueAtTime(t0, [0, 0]); s.setValueAtTime(t0 + 0.35, [115, 115]); s.setValueAtTime(t0 + 0.55, [100, 100]);
    easeAt(s, 1, 33, 10);
    easeAt(s, 2, 60, 33);
    easeAt(s, 3, 85, 33);
    return sl;
}
function addBar(c, name, x, y, w, h, t0) {
    // translucent highlight that wipes in from the left behind a bullet
    var sl = c.layers.addShape(); sl.name = name;
    var g = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var rc = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    rc.property("ADBE Vector Rect Size").setValue([w, h]); rc.property("ADBE Vector Rect Roundness").setValue(14);
    rc.property("ADBE Vector Rect Position").setValue([w / 2, 0]);
    var fl = g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(WHITE);
    fl.property("ADBE Vector Fill Opacity").setValue(16);
    sl.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
    var s = sl.property("ADBE Transform Group").property("ADBE Scale");
    s.setValueAtTime(t0, [0, 100]); s.setValueAtTime(t0 + 0.76, [100, 100]); easeKeys(s, 1, 2);
    return sl;
}

function twoCards(c, S) {
    var cw = 810, ch = 580, y0 = 430, xs = [128, 982];
    for (var i = 0; i < 2; i++) {
        var card = S.cards[i];
        addCard(c, S.name.substr(0, 3) + " Card " + (i + 1), xs[i], y0, cw, ch, BLUE, card.t);
        var y = y0 + 56;
        if (card.header) {
            var hd = addText(c, S.name.substr(0, 3) + " Card " + (i + 1) + " Header", card.header, "Manrope-Bold", 40, xs[i] + 56, y, cw - 112, card.th);
            y += textH(hd) + 34;
        }
        for (var b = 0; b < card.items.length; b++) {
            var it = card.items[b], tx = addText(c, S.name.substr(0, 3) + " Card " + (i + 1) + " Bullet " + (b + 1), it.text, "Manrope-Regular", 38, xs[i] + 118, y, cw - 190, it.t);
            boldLead(tx, it.text);
            var h = textH(tx);
            addBar(c, S.name.substr(0, 3) + " Card " + (i + 1) + " Highlight " + (b + 1), xs[i] + 40, y + h / 2 + 4, cw - 80, h + 24, it.t - 0.09);
            addDot(c, S.name.substr(0, 3) + " Card " + (i + 1) + " Arrow " + (b + 1), xs[i] + 78, y + 34, it.t + 0.1);
            y += h + 50;
        }
        R.done.push(S.name + " card " + (i + 1) + " content ends y " + Math.round(y));
    }
}
function fourCards(c, S) {
    var cw = 392, ch = 560, y0 = 440, gap = 32, x0 = 128;
    for (var i = 0; i < 4; i++) {
        var card = S.cards[i], x = x0 + i * (cw + gap), pre = S.name.substr(0, 3) + " Card " + (i + 1);
        addCard(c, pre, x, y0, cw, ch, BLUE, card.t);
        var num = addText(c, pre + " Number", card.num, "Afacad-SemiBold", 150, x + 40, y0 + 18, cw - 80, card.t + 0.45, 24);
        var y = y0 + 220;
        if (card.title) {
            var tt = addText(c, pre + " Title", card.title, "Manrope-Bold", 38, x + 40, y, cw - 80, card.t + 0.7);
            y += textH(tt) + 14;
        }
        var body = addText(c, pre + " Text", card.text, "Manrope-Regular", card.size || 30, x + 40, y, cw - 80, card.t + (card.title ? 0.9 : 0.7));
        R.done.push(S.name + " card " + (i + 1) + " text ends y " + Math.round(y + textH(body)));
    }
}

app.beginUndoGroup("Custom slides");
for (var n = 0; n < DATA.slides.length; n++) {
    var S = DATA.slides[n];
    try {
        for (var j = main.numLayers; j >= 1; j--) if (main.layer(j).source && main.layer(j).source.name === S.name) main.layer(j).remove();
        var old = compByName(S.name); if (old) old.remove();
        var c = base.duplicate(); c.name = S.name; c.parentFolder = scenesF;
        for (var k = c.numLayers; k >= 1; k--) { var nm = c.layer(k).name; for (var q = 0; q < KILL.length; q++) if (nm === KILL[q]) { c.layer(k).remove(); break; } }
        for (var m = 1; m <= c.numLayers; m++) {
            var Lm = c.layer(m);
            if (Lm.name === "BG" && DATA.bgIds[S.bg]) Lm.replaceSource(byId(DATA.bgIds[S.bg]), false);
            if (Lm.name === "Title") { var st = Lm.property("Source Text"), td = st.value; td.text = S.title; st.setValue(td); }
            if (Lm.name === "Course Name") { var st2 = Lm.property("Source Text"), td2 = st2.value; td2.text = DATA.course; st2.setValue(td2); }
        }
        if (S.kind === "two") twoCards(c, S); else fourCards(c, S);
        for (var z = 1; z <= c.numLayers; z++) { if (c.layer(z).outPoint > c.duration - 0.05) { try { c.layer(z).outPoint = c.duration; } catch (e) {} } }
        var L = main.layers.add(c); L.startTime = S.t; L.inPoint = S.t; L.outPoint = S.t + S.D;
        R.done.push(S.name + " @" + S.t + " +" + S.D);
    } catch (e) { R.errors.push(S.name + ": " + e.message + " (line " + e.line + ")"); }
}
app.endUndoGroup();
