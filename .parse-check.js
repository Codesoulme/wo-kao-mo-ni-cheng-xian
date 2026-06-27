const fs = require("fs");
const text = fs.readFileSync(process.argv[2], "utf8");
try { new Function(text); console.log("parsed OK, length:", text.length); } catch (e) { console.log("parse error:", e.message); }