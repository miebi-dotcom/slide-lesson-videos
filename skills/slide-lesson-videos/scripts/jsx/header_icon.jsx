// Put the lesson's own header icon (the small icon beside the subtopic line, top left) on every slide, in the place and size of the
// icon the template carries. The template's icon is a stand-in: each lesson has its own, drawn in the slide PDF.
// Get the pictures with extract_icon.py (transparent PNGs: dark icon on light pages, light icon on dark pages).
// DATA: { "assetsFolder": "<code> assets", "scenes": [ {"name": "S02 ...", "file": "D:/.../icon_p02.png"} ] }
// Replaces the layer named "Header Icon" (or "Header Icon (PDF)" from an earlier run) with a picture layer named "Header Icon (PDF)".
// The layer keeps the old one's in and out points, label, parent and stacking order. Returns where it put each icon.
function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
app.beginUndoGroup("Header icon from the PDF");
var folder = folderNamed(DATA.assetsFolder, true), done = 0;
for (var s = 0; s < DATA.scenes.length; s++) {
    var S = DATA.scenes[s], c = compByName(S.name);
    if (!c) { R.errors.push("missing scene " + S.name); continue; }
    if (!(new File(S.file)).exists) { R.errors.push(S.name + ": icon file not found " + S.file); continue; }
    var old = null;
    for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).name === "Header Icon" || c.layer(j).name === "Header Icon (PDF)") old = c.layer(j);
    if (!old) { R.warnings.push(S.name + ": no header icon layer to replace"); continue; }
    var wasLocked = old.locked; old.locked = false;
    var t = clamp(old.inPoint + 3, old.inPoint, Math.max(old.inPoint, old.outPoint - 0.1));
    var tg = old.property("ADBE Transform Group");
    var pos = tg.property("ADBE Position").valueAtTime(t, false), an = tg.property("ADBE Anchor Point").value;
    var sc = tg.property("ADBE Scale").valueAtTime(t, false)[0] / 100;
    var cx, cy, size;
    if (old.name === "Header Icon (PDF)") {          // a picture layer from an earlier run: its anchor is its centre
        cx = pos[0]; cy = pos[1]; size = Math.max(old.width, old.height) * sc;
    } else {
        var r = old.sourceRectAtTime(t, false);
        cx = pos[0] + (r.left + r.width / 2 - an[0]) * sc; cy = pos[1] + (r.top + r.height / 2 - an[1]) * sc;
        size = Math.max(r.width, r.height) * sc * 1.08;   // the measured box leaves out the stroke width
    }
    var item = importOnce(S.file, false, folder);
    var nl = c.layers.add(item);
    nl.name = "Header Icon (PDF)";
    nl.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);
    var k = size / Math.max(item.width, item.height) * 100;
    nl.property("ADBE Transform Group").property("ADBE Scale").setValue([k, k]);
    nl.inPoint = old.inPoint; nl.outPoint = old.outPoint; nl.label = old.label;
    try { nl.parent = old.parent; } catch (e) {}
    nl.moveBefore(old);
    old.remove();
    done++;
    R.done.push(S.name + ": icon at " + Math.round(cx) + "," + Math.round(cy) + " size " + Math.round(size) + " px");
}
R.done.push("icons placed: " + done);
app.endUndoGroup();
