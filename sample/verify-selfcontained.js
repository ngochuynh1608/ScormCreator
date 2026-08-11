const fs = require("fs");
const h = fs.readFileSync("sample/test-export3-out/index.html", "utf8");
console.log("has __COURSE__", h.includes("window.__COURSE__"));
console.log("has inline style", h.includes("<style>"));
console.log("has external player.js", h.includes('src="player.js"'));
console.log("index size", h.length);
const marker = "window.__COURSE__ = ";
const start = h.indexOf(marker);
if (start < 0) {
  console.log("NO COURSE ASSIGN");
  process.exit(1);
}
const jsonStart = start + marker.length;
const scriptEnd = h.indexOf("</script>", jsonStart);
const raw = h.slice(jsonStart, scriptEnd).trim().replace(/;$/, "");
try {
  const c = JSON.parse(raw);
  console.log("slides", c.slides.length, "title", c.title);
  console.log("first thumb", c.slides[0]?.thumbnail);
} catch (e) {
  console.log("parse fail", e.message);
  console.log(raw.slice(0, 200));
}
