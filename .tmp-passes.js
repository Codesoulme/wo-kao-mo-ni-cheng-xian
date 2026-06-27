const fs = require("fs");
const buf = fs.readFileSync(process.argv[2]);
let text = buf.toString("utf8");
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const lines = text.split(String.fromCharCode(10));
const passes = [];
const fails = [];
const newSmokes = [];
for (const l of lines) { const t = l.trim(); if (!t.startsWith("{")) continue; const m = t.match(/^\{"smoke":"([^"]+)"/); if (m) { passes.push(m[1]); if (m[1].startsWith("smoke-g-")) newSmokes.push(m[1]); } else if (/"passed":false/.test(t)) fails.push(t); }
console.log("Total smoke log lines:", passes.length);
console.log("Failed smokes:", fails.length);
if (fails.length > 0) console.log("First fail:", fails[0]);
console.log("New g-* smoke log lines:", newSmokes.length);
for (const s of newSmokes) console.log("  ", s);