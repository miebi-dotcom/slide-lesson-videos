// Render check frames locally (nothing leaves the machine).
// DATA: { "compId": 123, "times": [12.5, 30], "outDir": "C:/path/qc", "prefix": "S03" }
// Uses CompItem.saveFrameToPng (AE 2023+). Returns the written file paths.
var c = byId(DATA.compId);
if (!c) throw new Error("comp " + DATA.compId + " not found");
// render into a fresh folder: saveFrameToPng can silently skip files that already exist
var dir = new Folder(DATA.outDir);
if (dir.exists && dir.getFiles("*.png").length) dir = new Folder(DATA.outDir + "_" + (new Date().getTime()));
dir.create();
R.outDir = dir.fsName;
R.files = [];
// frames follow the comp's preview resolution; render Full so measurements and labels line up
var resWas = c.resolutionFactor;
if (DATA.fullRes !== false) c.resolutionFactor = [1, 1];
for (var i = 0; i < DATA.times.length; i++) {
    var t = DATA.times[i];
    var f = new File(dir.fsName + "/" + (DATA.prefix || "qc") + "_" + ("000" + Math.round(t * 100)).slice(-7) + ".png");
    try {
        if (renderFrame(c, t, f)) R.files.push(f.fsName); else R.errors.push("timed out writing frame at " + t);
    } catch (e) { R.errors.push("frame " + t + ": " + e.toString()); }
}
c.resolutionFactor = resWas;
