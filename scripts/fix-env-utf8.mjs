import fs from "fs";

let t = fs.readFileSync(".env", "utf8");

// Normalize smart punctuation / mojibake to ASCII
const swaps = [
  [/â€”/g, "-"],
  [/â€“/g, "-"],
  [/â€“/g, "-"],
  [/â€\"/g, "-"],
  [/â†’/g, "->"],
  [/â€¦/g, "..."],
  [/Â /g, " "],
  [/Â/g, ""],
  [/\u2014/g, "-"],
  [/\u2013/g, "-"],
  [/\u2018/g, "'"],
  [/\u2019/g, "'"],
  [/\u201C/g, '"'],
  [/\u201D/g, '"'],
  [/\u2026/g, "..."],
  [/\u2192/g, "->"],
  [/\u00A0/g, " "],
  [/\uFFFD/g, ""],
];
for (const [re, to] of swaps) t = t.replace(re, to);

// Force ASCII-safe lines (env parsers / Lovable require UTF-8 clean files)
t = t
  .split(/\r?\n/)
  .map((line) => line.replace(/[^\x09\x20-\x7E]/g, ""))
  .join("\n")
  .replace(/\n+$/, "\n");

fs.writeFileSync(".env", t, "utf8");

const b = fs.readFileSync(".env");
const non = [...b].filter((x) => x > 127).length;
console.log("bytes", b.length, "non_ascii", non);
console.log("--- tail ---");
console.log(t.split("\n").slice(-18).join("\n"));
