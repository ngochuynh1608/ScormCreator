const fs = require("fs");
const html = fs.readFileSync("sample/scorm-fixed/index.html", "utf8");
const parts = html.split(/<script(?![^>]*\bsrc=)[^>]*>/i);
// parts[0] is before first inline; then each part ends at </script>
const inlines = [];
for (let i = 1; i < parts.length; i++) {
  const end = parts[i].indexOf("</script>");
  inlines.push(parts[i].slice(0, end));
}
console.log("inlines", inlines.length, inlines.map((s) => s.length));
const player = inlines[1];
fs.writeFileSync("sample/extracted-player.js", player);
try {
  new Function(player);
  console.log("OK");
} catch (e) {
  console.log("FAIL", e.message);
  // find approximate location
  const lines = player.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    try {
      new Function(lines.slice(0, i + 1).join("\n") + "\n}");
    } catch (err) {
      // continue binary-ish
    }
  }
  // try to compile with acorn-like progressive
  let lo = 0,
    hi = player.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    try {
      new Function(player.slice(0, mid) + "\n//");
      lo = mid + 1;
    } catch (e2) {
      hi = mid;
    }
  }
  console.log("fail around char", lo);
  console.log(player.slice(Math.max(0, lo - 80), lo + 80));
}
