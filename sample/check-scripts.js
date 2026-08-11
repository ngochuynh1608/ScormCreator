const fs = require("fs");
const vm = require("vm");

const course = fs.readFileSync("sample/scorm-fixed/course-data.js", "utf8");
console.log("course-data bytes", course.length);
try {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(course, ctx);
  console.log(
    "OK slides",
    ctx.window.__COURSE__.slides.length,
    ctx.window.__COURSE__.title,
  );
} catch (e) {
  console.log("course-data FAIL:", e.message);
}

const html = fs.readFileSync("sample/scorm-fixed/index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("inline scripts", inlineScripts.length);
inlineScripts.forEach((m, i) => {
  try {
    new Function(m[1]);
    console.log("inline", i, "OK len", m[1].length);
  } catch (e) {
    console.log("inline", i, "FAIL", e.message);
  }
});
