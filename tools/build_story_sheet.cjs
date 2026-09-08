/* Builds the proofreading sheet for the 60 CVR stories, straight from the data, so the page can
   never drift from what the app actually shows. */
const fs = require("fs");
const { BLOCK5_SCENARIOS } = require("../.sim-build/block5Scenarios.js");

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let sections = "";
let nav = "";
for (const sc of BLOCK5_SCENARIOS) {
  const slug = sc.id;
  nav += `<a href="#${slug}">${esc(sc.title)}</a>`;
  let rows = "";
  for (const op of sc.options) {
    const s = op.cvrSeed;
    const hurtLen = (s.identifiedCase + " " + s.harm).length;
    const needLen = (s.benefitCase + " " + s.benefitLost).length;
    rows += `
      <article class="opt">
        <header class="opt-head">
          <code class="oid">${esc(op.id)}</code>
          <p class="label">${esc(op.title)}</p>
        </header>
        <p class="already"><span class="tag">the option already says</span>${esc(op.givesUp)}</p>
        <div class="pair">
          <section class="side hurt">
            <h4>Hurts <span class="len">${hurtLen}</span></h4>
            <p><span class="they">They</span> ${esc(s.identifiedCase)}. <b>${esc(s.harm)}.</b></p>
          </section>
          <section class="side need">
            <h4>Needed it <span class="len">${needLen}</span></h4>
            <p><span class="they">They</span> ${esc(s.benefitCase)}. <b>${esc(s.benefitLost)}.</b></p>
          </section>
        </div>
      </article>`;
  }
  sections += `
    <section class="scenario" id="${slug}">
      <h2>${esc(sc.title)}</h2>
      <div class="opts">${rows}</div>
    </section>`;
}

const html = fs.readFileSync("tools/story_sheet_template.html", "utf8")
  .replace("<!--NAV-->", nav)
  .replace("<!--SECTIONS-->", sections);
/* The artifact host wraps the page in its own <!doctype>/<head>/<body>. A file opened straight
   from disk, or handed to Chrome for the PDF, needs that skeleton itself. --standalone adds it,
   and stamps the light theme so a dark OS does not produce a black PDF. */
const standalone = process.argv.includes("--standalone");
const HEAD = [
  "<!doctype html>",
  '<html lang="en" data-theme="light">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  "",
].join("\n");
const out = standalone
  ? HEAD + html.replace('<div class="wrap">', '</head>\n<body>\n<div class="wrap">') + "\n</body>\n</html>\n"
  : html;
fs.writeFileSync(process.argv[2], out);
console.log("wrote " + process.argv[2] + (standalone ? " (standalone)" : ""));
