// Put corrected text into existing text layers (after the text rules changed the wording), keeping the bold lead-in.
// DATA: { "regularFont": "Manrope-Regular", "boldFont": "Manrope-ExtraBold",
//         "items": [ {"scene": "S03 ...", "layer": "B1 Text", "kind": "topic|title|header|bullet", "text": "Pollution: air, water.", "lead": true, "font": "Manrope-Regular"} ] }   (lead and font are optional)
// Switches all-caps and small-caps off on every layer it touches through fontCapsOption (allCaps is read-only in ExtendScript); otherwise sentence case would not show.
// A bullet's base font is taken from its last character (the regular part), so a bold lead-in does not spread over the line.
// Run style_scenes.jsx with "refitOnly": true afterwards: new text may need a different size to fit.
function lay(c, n) { for (var j = 1; j <= c.numLayers; j++) if (c.layer(j).name === n) return c.layer(j); return null; }
app.beginUndoGroup("Apply text");
var changed = 0;
for (var i = 0; i < DATA.items.length; i++) {
    var it = DATA.items[i], c = compByName(it.scene);
    if (!c) { R.errors.push("missing scene " + it.scene); continue; }
    var L = lay(c, it.layer);
    if (!L) { R.errors.push(it.scene + ": no layer " + it.layer); continue; }
    var wasLocked = L.locked; L.locked = false;
    try {
        var st = L.property("Source Text"), td = st.value, old = String(td.text), base = null;
        if (it.kind === "bullet" && old.length > 0) { try { base = td.characterRange(old.length - 1, old.length).font; } catch (e) {} }
        try { td.fontCapsOption = (it.kind === "topic") ? FontCapsOption.FONT_ALL_CAPS : FontCapsOption.FONT_NORMAL_CAPS; } catch (e) { R.warnings.push(it.scene + " / " + it.layer + ": caps not cleared: " + e.message); }   // allCaps itself is read-only
        td.text = it.text;
        if (base) td.font = base;
        if (it.font) td.font = it.font;   // optional: force a font on the whole layer (a plain line must be regular, not bold)
        st.setValue(td);
        if (it.lead) {
            var idx = it.text.indexOf(":"), t2 = st.value;
            t2.characterRange(0, idx + 1).font = DATA.boldFont;
            st.setValue(t2);
        }
        changed++;
    } catch (e) { R.errors.push(it.scene + " / " + it.layer + ": " + e.message); }
    L.locked = wasLocked;
}
R.done.push("text layers updated: " + changed);
app.endUndoGroup();
