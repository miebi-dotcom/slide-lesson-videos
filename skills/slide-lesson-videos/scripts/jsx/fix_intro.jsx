// Intro title: break it over more lines so a long word clears the picture.
// DATA: { "scene": "S01 Intro", "text": "INTRODUCTION\rTO SUSTAINABLE\rGARDENING", "size": 92 }
var c = compByName(DATA.scene), L = null;
for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === "Lesson Title") L = c.layer(i);
var st = L.property("Source Text"), td = st.value;
app.beginUndoGroup("Intro title");
td.fontSize = DATA.size; td.leading = Math.round(DATA.size * 1.12); td.text = DATA.text;
st.setValue(td);
var r = L.sourceRectAtTime(3, false), sc = L.property("ADBE Transform Group").property("ADBE Scale").value[0] / 100;
R.done.push("title box w " + Math.round(r.width * sc) + " h " + Math.round(r.height * sc) + " left " + Math.round(L.property("ADBE Transform Group").property("ADBE Position").value[0] + r.left * sc));
app.endUndoGroup();
