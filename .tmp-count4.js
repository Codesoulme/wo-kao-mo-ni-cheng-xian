const fs = require("fs");
const buf = fs.readFileSync(process.argv[2]);
const text = buf.toString("utf8").replace(/^\uFEFF/, "");
const lines = text.split(String.fromCharCode(10));
let smokeCount = 0;
let failCount = 0;
for (const l of lines) { if (l.indexOf("\"smoke\":") >= 0) smokeCount++; if (/\"passed\":false/.test(l)) failCount++; }
console.log("Total lines:", lines.length);
console.log("smoke lines:", smokeCount);
console.log("fail lines:", failCount);