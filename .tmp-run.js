const { spawnSync } = require("child_process");
const proc = spawnSync("bun", ["scripts/xianxia-regression-smoke.ts"], { encoding: "utf8" });
require("fs").writeFileSync(process.argv[2], proc.stdout + "\n" + proc.stderr, "utf8");
console.log("exit:", proc.status);