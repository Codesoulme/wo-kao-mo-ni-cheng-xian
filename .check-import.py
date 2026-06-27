import sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open(r'E:\aigame2_publish\scripts\xianxia-regression-smoke.ts', 'rb') as f:
    new = f.read().decode('utf-8')
lines = new.split(chr(10))
new_imports = lines[4]
# Parse the long import manually - split by 'from'
m = re.search(r"^import\s*\{(.*)\}\s*from\s+'([^']+)'", new_imports)
if m:
    fns_str = m.group(1)
    fns = [s.strip() for s in fns_str.split(',') if s.strip()]
    print('New import count:', len(fns))
    print('Has new fns:')
    for fn in ['buildCombatCauseChain', 'deriveBidderProfile', 'deriveSecretRealmAccess', 'resolveSecretRealmEntry', 'simulateBiddingRound']:
        print(' ', fn, ':', fn in fns)