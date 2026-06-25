import { watch } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

const meetingDir = process.argv[2] || './.handoff/meeting/kickoff-and-handover';
const filesToWatch = [
  'xiaoxia-to-xiaoxin.md',
  'xiaoxin-to-xiaoxia.md',
];

let lastSizes: Record<string, number> = {};

async function checkChanges() {
  for (const file of filesToWatch) {
    const path = join(meetingDir, file);
    try {
      const stat = await readFile(path).then(b => b.length);
      if (lastSizes[file] && lastSizes[file] !== stat) {
        console.log(`[${new Date().toISOString()}] CHANGE DETECTED: ${file}`);
      }
      lastSizes[file] = stat;
    } catch {}
  }
}

setInterval(checkChanges, 30000);
checkChanges();
console.log(`Watching ${meetingDir} every 30s`);
