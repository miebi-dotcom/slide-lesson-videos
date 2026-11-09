// Highlight bars: sized to their text (template bar is a fixed 73 px, one line) and sequenced so they never overlap:
// bar k wipes in with its bullet, and has fully faded out before bar k+1 starts to wipe in.
// bar height = measured text height + 40, full width as in the template; top sits 20 px above the text.
// DATA: { "scenes": [ {"name": "S02 ...", "n": 5, "h0": 131} ] }   h0 = the template bar's native height (73; 131 in 'Slide 5 - Red Outline Card')
function lay(c, nm) { for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === nm) return c.layer(i); return null; }
app.beginUndoGroup("Highlight bars: fit and sequence");
for (var s = 0; s < DATA.scenes.length; s++) {
    var S = DATA.scenes[s], c = compByName(S.name);
    if (!c) { R.errors.push("missing " + S.name); continue; }
    var cnt = 0;
    for (var k = 1; k <= S.n; k++) {
        var H = lay(c, "B" + k + " Highlight");
        if (!H) continue;
        // every bar starts from the same 840 x 73 base (the template's bars differ: bullet 1 of the outline-card slide is 131 tall)
        var rect = H.property("ADBE Root Vectors Group").property("Bar").property("ADBE Vectors Group").property("Rectangle Path 1");
        rect.property("ADBE Vector Rect Size").expression = ""; rect.property("ADBE Vector Rect Size").setValue([840, 73]);
        rect.property("ADBE Vector Rect Position").setValue([420, 36.5]);
        var tgp = H.property("ADBE Transform Group"), nm = "B" + k + " Text";
        tgp.property("ADBE Position").expression = 'var tx=thisComp.layer("' + nm + '"); [188, tx.transform.position[1]-20]';
        tgp.property("ADBE Scale").expression = 'var tx=thisComp.layer("' + nm + '"); var p=Math.min(Math.max((time-tx.inPoint+0.1)/0.55,0),1); p=1-Math.pow(1-p,3); var h=tx.sourceRectAtTime(time,false).height; [100*p,100*(h+40)/' + 73 + ']';
        var fade = "1";
        if (k < S.n) fade = '(function(){var nx=thisComp.layer("B' + (k + 1) + ' Text"); return 1-ease(time,nx.inPoint-0.65,nx.inPoint-0.3,0,1);})()';
        tgp.property("ADBE Opacity").expression = 'var tx=thisComp.layer("' + nm + '"); (time>=tx.inPoint-0.1?100:0)*' + fade + '*(1-ease(time,thisComp.duration+5,thisComp.duration+6,0,1))';
        cnt++;
    }
    R.done.push(S.name + ": " + cnt + " highlight bars fitted and sequenced");
}
app.endUndoGroup();
