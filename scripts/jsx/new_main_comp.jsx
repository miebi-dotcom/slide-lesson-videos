// Create the main comp for a slide lesson (no tutor recording to build on).
// DATA: { "name": "COURSE101_L01 MAIN", "width": 1920, "height": 1080, "fps": 30, "duration": 300,
//         "folder": "COURSE101 build",                   optional project folder for it
//         "likeId": 2494 }                              optional: copy size/fps/bg colour from this comp (e.g. the template's demo)
// Returns: mainId. Re-running with the same name returns the existing comp instead of making another.
var nm = DATA.name;
if (!nm) throw new Error("name is required");
var existing = compByName(nm);
if (existing) { R.mainId = existing.id; R.done.push("main comp already exists: " + nm); }
else {
    var like = DATA.likeId ? byId(DATA.likeId) : null;
    var w = DATA.width || (like ? like.width : 1920), h = DATA.height || (like ? like.height : 1080);
    var fps = DATA.fps || (like ? like.frameRate : 30), dur = DATA.duration || 300;
    app.beginUndoGroup("New main comp");
    var c = app.project.items.addComp(nm, w, h, 1, dur, fps);
    if (like) c.bgColor = like.bgColor;
    if (DATA.folder) c.parentFolder = folderNamed(DATA.folder, true);
    app.endUndoGroup();
    c.openInViewer();
    R.mainId = c.id;
    R.done.push("created " + nm + " (" + w + "x" + h + ", " + fps + " fps, " + dur + " s)");
}
