// Put a still picture (from the PDF) into a slide's image slot, with a slow push-in; hide the placeholder label/icon.
// DATA: { "scene": "S17 Case Study ...", "file": "D:/.../p17_img2.png", "push": 0.07, "assetsFolder": "<code> assets", "holdersFolder": "<code> image holders" }
var c = compByName(DATA.scene);
if (!c) throw new Error("scene not found");
var NL = null;
for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === "Image (open comp to replace)") NL = c.layer(i);
var nc = NL.source;
if (nc.name.indexOf(DATA.scene) !== 0) {   // own copy: the template image comp is shared by other slides
    nc = nc.duplicate(); nc.name = DATA.scene + " / " + NL.source.name; nc.parentFolder = folderNamed(DATA.holdersFolder, true);
}
var item = importOnce(DATA.file, false, folderNamed(DATA.assetsFolder, true));
var ph = null;
app.beginUndoGroup("Still in slot");
NL.replaceSource(nc, false);
for (var k = 1; k <= nc.numLayers; k++) {
    var q = nc.layer(k);
    if (q.name === "Label" || q.name === "Icon") q.enabled = false;
    else if (q.source) ph = q;
}
if (!ph) throw new Error("no footage layer in " + nc.name);
var fx = ph.property("ADBE Effect Parade");
while (fx.numProperties > 0) fx.property(1).remove();
ph.replaceSource(item, false);
var s = Math.max(nc.width / item.width, nc.height / item.height) * 100;
var sc = ph.property("ADBE Transform Group").property("ADBE Scale");
sc.setValue([s, s, 100]);
sc.expression = "var p=linear(time,0,12,0,1); value*(1+" + (DATA.push || 0.07) + "*(1-Math.pow(1-p,2)))";
ph.property("ADBE Transform Group").property("ADBE Position").setValue([nc.width / 2, nc.height / 2]);
ph.inPoint = 0; ph.outPoint = nc.duration;
R.done.push(DATA.scene + ": still " + item.name + " at " + s.toFixed(1) + "%");
app.endUndoGroup();
