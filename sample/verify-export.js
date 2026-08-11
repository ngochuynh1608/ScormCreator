const fs = require("fs");
const JSZip = require("jszip");

JSZip.loadAsync(fs.readFileSync("sample/test-export2.zip")).then(async (z) => {
  const names = Object.keys(z.files).filter((n) => !z.files[n].dir);
  console.log("entries", names.length);
  const html = await z.file("index.html").async("string");
  console.log("has embedded", html.includes('id="course-data"'));
  const m = html.match(/id="course-data">([\s\S]*?)<\/script>/);
  if (m) {
    const c = JSON.parse(m[1]);
    console.log("embedded slides", c.slides.length, "first thumb", c.slides[0]?.thumbnail);
  } else {
    console.log("NO EMBEDDED COURSE DATA");
  }
  const man = await z.file("imsmanifest.xml").async("string");
  console.log("manifest file tags", (man.match(/<file /g) || []).length);
  console.log(
    "thumb count in zip",
    names.filter((n) => n.startsWith("thumbs/")).length,
  );
});
