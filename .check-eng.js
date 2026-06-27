const fs = require("fs");
const text = fs.readFileSync(process.argv[2], "utf8");
try { new Function(text); console.log("eng parsed OK"); } catch (e) { console.log("eng parse error:", e.message); }