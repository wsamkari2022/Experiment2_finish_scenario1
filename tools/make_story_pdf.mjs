/**
 * make_story_pdf.mjs — rebuilds docs/Sixty-Voices.pdf from the scenario data.
 *
 * The sheet is never typed by hand. It is generated from block5Scenarios.ts, so it cannot drift
 * from what the app actually shows a participant. Rerun this after changing any story.
 *
 *   npm run pdf:stories
 *
 * It needs Chrome (for printing) and an internet connection the first time, because the three
 * typefaces come from Google Fonts. Without the network the page still prints, in the fallback
 * stacks declared in the template.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OUT_PDF = "docs/Sixty-Voices.pdf";

/* Chrome ships in one of a few places on Windows, and is on PATH elsewhere. */
function findChrome() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(os.homedir(), "AppData/Local/Google/Chrome/Application/chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
  ];
  for (const c of candidates) {
    if (c.includes("/") && !fs.existsSync(c)) continue;
    return c;
  }
  throw new Error("Chrome not found. Install Chrome, or print tools/story_sheet_template.html by hand.");
}

/* 1 — build the standalone page (its own <head>/<body>, light theme stamped). */
const tmp = path.join(os.tmpdir(), "sixty-voices-print.html");
execFileSync(process.execPath, ["tools/build_story_sheet.cjs", tmp, "--standalone"], { stdio: "inherit" });

/* 2 — print it. --virtual-time-budget gives the webfonts time to arrive before the page is
   captured; without it Chrome can print in the fallback faces. */
const chrome = findChrome();
execFileSync(chrome, [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  "--virtual-time-budget=12000",
  `--print-to-pdf=${path.resolve(OUT_PDF)}`,
  "file:///" + tmp.replace(/\\/g, "/"),
], { stdio: ["ignore", "ignore", "ignore"] });

const size = fs.statSync(OUT_PDF).size;
if (size < 50_000) throw new Error(`${OUT_PDF} came out at only ${size} bytes — the print probably failed.`);
console.log(`${OUT_PDF} — ${(size / 1024).toFixed(0)} KB`);
