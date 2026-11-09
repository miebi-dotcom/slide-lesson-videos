// Read-only inventory of the open project.
// DATA (optional): { "videoPattern": "regex for the tutor video file name",
//                    "slidePattern": "regex for slide template comp names" }
// Returns: project, active comp, folders, comps, footage, candidate main comps
// (comps holding a long video layer = the tutor recording) with that layer's timing,
// and slide-template signals for audio-free slide lessons (Google Vids style):
//   slideComps / introOutro / transitionComps / demoComps, plus lessonType = "tutor" | "slides" | "unknown".
var pat = DATA.videoPattern ? new RegExp(DATA.videoPattern, "i") : /\.(mp4|mov|mxf)$/i;
var reSlide = new RegExp(DATA.slidePattern || "\\bslides?\\b", "i");
var reIntro = /\bintro\b|\boutro\b|thank you|title card/i;
var reTr = /\bTR\b|transition|wipe/i;
var reDemo = /demo|assembled|showreel|example/i;
R.project = app.project.file ? app.project.file.fsName : null;
R.aeVersion = app.version;
var a = app.project.activeItem;
R.active = (a instanceof CompItem) ? { id: a.id, name: a.name, time: r2(a.time) } : null;
R.folders = []; R.comps = []; R.footage = []; R.mainCandidates = [];
R.slideComps = []; R.introOutro = []; R.transitionComps = []; R.demoComps = [];
for (var k = 1; k <= app.project.numItems; k++) {
    var it = app.project.item(k), parent = it.parentFolder ? it.parentFolder.name : "";
    if (it instanceof FolderItem) { R.folders.push(it.id + " | " + it.name + " | in: " + parent + " | items: " + it.numItems); continue; }
    if (it instanceof CompItem) {
        var line = it.id + " | " + it.name + " | in: " + parent + " | " + r2(it.duration) + "s";
        R.comps.push(line + " " + r2(it.frameRate) + "fps " + it.width + "x" + it.height + " | layers " + it.numLayers + " | used " + it.usedIn.length);
        var full = it.width >= 1280;
        if (reDemo.test(it.name)) R.demoComps.push(line);
        else if (reTr.test(it.name) || reTr.test(parent)) R.transitionComps.push(line);
        else if (full && reIntro.test(it.name)) R.introOutro.push(line);
        else if (full && (reSlide.test(it.name) || reSlide.test(parent))) R.slideComps.push(line);
        for (var j = 1; j <= it.numLayers; j++) {
            var L = it.layer(j);
            if (L.source && L.source.file && pat.test(L.source.file.name) && L.source.duration > 60) {
                var mp = it.markerProperty;
                R.mainCandidates.push({ compId: it.id, comp: it.name, dur: r2(it.duration), fps: it.frameRate, layers: it.numLayers,
                    tutorLayer: j, tutorName: L.name, tutorSourceId: L.source.id, tutorFile: L.source.file.fsName,
                    startTime: r2(L.startTime), inPoint: r2(L.inPoint), outPoint: r2(L.outPoint), stretch: L.stretch,
                    timeRemap: L.timeRemapEnabled, markers: mp.numKeys, hasAudio: L.hasAudio });
            }
        }
        continue;
    }
    if (it.file) R.footage.push(it.id + " | " + it.name + " | in: " + parent + (it.footageMissing ? " | MISSING" : ""));
}
// A guess only: confirm with the user. A long b-roll clip from the animator can look like a tutor recording.
if (R.mainCandidates.length) R.lessonType = "tutor";
else if (R.slideComps.length) R.lessonType = "slides";
else R.lessonType = "unknown";
if (R.mainCandidates.length && R.slideComps.length)
    R.warnings.push("both a long video and slide comps found: ask the user whether this is a tutor lesson or a slide lesson");
