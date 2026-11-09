// Create a background comp next to a template background (own base solid; the template's shared solids stay untouched).
// DATA: { "fromId": 45, "folderId": 43, "name": "BG Red", "rgb": [207,53,43], "shade": [112,24,20] }
// rgb comes from the slide PDF (pdf_palette.py); shade is a darker tone of it for the bottom gradient. Returns bgId.
app.beginUndoGroup("Background " + DATA.name);
var old = compByName(DATA.name);
if (old) old.remove();
var navy = byId(DATA.fromId);
var red = navy.duplicate();
red.name = DATA.name;
red.parentFolder = byId(DATA.folderId);
var oldBase = null;
for (var i = 1; i <= red.numLayers; i++) if (red.layer(i).name === "Base") oldBase = red.layer(i);
if (oldBase) oldBase.remove();
var base = red.layers.addSolid([DATA.rgb[0] / 255, DATA.rgb[1] / 255, DATA.rgb[2] / 255], "Base", 1920, 1080, 1, red.duration);
var shade = red.layers.addSolid([DATA.shade[0] / 255, DATA.shade[1] / 255, DATA.shade[2] / 255], "Bottom Shade", 1920, 1080, 1, red.duration);
var m = shade.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
var sh = new Shape();
sh.vertices = [[0, 700], [1920, 700], [1920, 1300], [0, 1300]];
sh.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
sh.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
sh.closed = true;
m.property("ADBE Mask Shape").setValue(sh);
m.property("ADBE Mask Feather").setValue([0, 520]);
shade.moveToEnd();
base.moveToEnd();
R.bgId = red.id;
R.done.push(DATA.name + " " + red.id + " layers: " + red.numLayers);
app.endUndoGroup();
