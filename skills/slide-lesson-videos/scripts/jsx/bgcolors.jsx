// Title and course name colour, and logo version, by slide background.
// DATA: { project, scenes:[{name,bg:"navy"|"beige"}], navy:[r,g,b], white:[..], logoNavyId, logoBeigeId }
function lay(c, nm) { for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === nm) return c.layer(i); return null; }
function n(a) { return [a[0] / 255, a[1] / 255, a[2] / 255]; }
app.beginUndoGroup("Title colours by background");
for (var s = 0; s < DATA.scenes.length; s++) {
    var S = DATA.scenes[s], c = compByName(S.name);
    if (!c) { R.errors.push("missing " + S.name); continue; }
    var col = n(S.bg === "beige" ? DATA.navy : DATA.white);
    var nm = ["Title", "Course Name"];
    for (var k = 0; k < nm.length; k++) {
        var L = lay(c, nm[k]);
        if (!L) continue;
        var st = L.property("Source Text"), td = st.value;
        td.fillColor = col; st.setValue(td);
    }
    var info = [];
    for (var i = 1; i <= c.numLayers; i++) {
        var l = c.layer(i);
        if (l.source && l.source.name.indexOf("Logo") === 0) {
            var want = byId(S.bg === "beige" ? DATA.logoBeigeId : DATA.logoNavyId);
            if (l.source.id !== want.id) { l.replaceSource(want, false); info.push("logo->" + S.bg); }
        }
    }
    R.done.push(S.name + ": " + S.bg + " " + info.join(","));
}
app.endUndoGroup();
