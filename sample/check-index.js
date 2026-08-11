const fs = require("fs");
const h = fs.readFileSync("sample/latest-unzip/index.html", "utf8");
const m = h.match(/id="course-data">([\s\S]*?)<\/script>/);
if (!m) {
  console.log("no match");
  process.exit(1);
}
const raw = m[1];
console.log("json len", raw.length);
try {
  const c = JSON.parse(raw);
  console.log("parse OK", c.slides.length);
} catch (e) {
  console.log("PARSE FAIL", e.message);
}
const js = fs.readFileSync("sample/latest-unzip/player.js", "utf8");
try {
  new Function(js);
  console.log("player.js syntax OK");
} catch (e) {
  console.log("player.js SYNTAX FAIL", e.message);
}

// Simulate DOM textContent behavior - browsers may decode entities
const fakeTextContent = raw; // script type=application/json textContent is raw
try {
  JSON.parse(fakeTextContent.trim());
  console.log("trim parse OK");
} catch (e) {
  console.log("trim parse fail", e.message);
}
