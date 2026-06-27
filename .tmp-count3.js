const fs = require("fs");
const buf = fs.readFileSync(process.argv[2]);
console.log("size:", buf.length);
console.log("first 100 bytes:", JSON.stringify(buf.slice(0, 100)));
const text = buf.toString("utf8");
console.log("text len:", text.length);
const lines = text.split(String.fromCharCode(10));
console.log("line count:", lines.length);
let smokeCount = 0;
for (const l of lines) { if (l.indexOf("\"smoke\":") >= 0) smokeCount++; }
console.log("smoke lines:", smokeCount);