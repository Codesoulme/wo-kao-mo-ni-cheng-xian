import sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open(r'E:\aigame2_publish\scripts\xianxia-regression-smoke.ts', 'rb') as f:
    text = f.read().decode('utf-8')
lines = text.split(chr(10))
old_import = lines[4]
new_funcs = ['buildCombatCauseChain', 'deriveBidderProfile', 'deriveSecretRealmAccess', 'resolveSecretRealmExit', 'resolveSecretRealmEntry', 'simulateBiddingRound']
m = re.match(r"import\s*\{\s*(.*?)\s*\}\s*from\s+'([^']+)'\s*;", old_import)
if not m:
    print('FAILED to parse import')
    sys.exit(1)
existing = [s.strip() for s in m.group(1).split(',') if s.strip()]
src_module = m.group(2)
for fn in new_funcs:
    if fn not in existing:
        existing.append(fn)
existing.sort()
new_import_text = 'import { ' + ', '.join(existing) + ' } from ' + chr(39) + src_module + chr(39) + ';'
lines[4] = new_import_text
output = chr(10).join(lines)
encoded = output.encode('utf-8')
with open(r'E:\aigame2_publish\scripts\xianxia-regression-smoke.ts', 'wb') as f:
    f.write(encoded)
print('Wrote', len(encoded), 'bytes')
print('Import has', len(existing), 'fns')
for fn in new_funcs:
    print('  ', fn, 'in import:', fn in existing)