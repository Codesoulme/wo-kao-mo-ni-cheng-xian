const fs = require("fs");
const t = fs.readFileSync(process.argv[2], "utf8");
console.log(t.substring(0, 200));