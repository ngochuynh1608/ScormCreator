const fs = require("fs");
const JSZip = require("jszip");

JSZip.loadAsync(fs.readFileSync("sample/test-embed.zip")).then(async (z) => {
  const h = await z.file("index.html").async("string");
  const marker = "window.__COURSE__ = ";
  const start = h.indexOf(marker) + marker.length;
  const end = h.indexOf("</script>", start);
  const raw = h.slice(start, end).trim().replace(/;$/, "");
  const c = JSON.parse(raw);
  const s0 = c.slides[0];
  console.log("slides", c.slides.length);
  console.log(
    "slide1 thumb starts",
    String(s0.thumbnail).slice(0, 30),
    "len",
    String(s0.thumbnail).length,
  );
  console.log(
    "slide1 audio starts",
    String(s0.audio).slice(0, 30),
    "len",
    String(s0.audio || "").length,
  );
  const withImg = c.slides.filter(
    (s) => s.thumbnail && String(s.thumbnail).startsWith("data:image"),
  ).length;
  const withAud = c.slides.filter(
    (s) => s.audio && String(s.audio).startsWith("data:audio"),
  ).length;
  console.log("data-image slides", withImg);
  console.log("data-audio slides", withAud);
  // write a tiny smoke html extract optional
  fs.writeFileSync("sample/embed-index.html", h);
  console.log("wrote sample/embed-index.html");
});
