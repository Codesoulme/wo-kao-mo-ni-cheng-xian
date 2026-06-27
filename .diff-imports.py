import sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open(r'E:\aigame2_publish\.orig-head.ts', 'rb') as f:
    orig = f.read().decode('utf-8')
with open(r'E:\aigame2_publish\scripts\xianxia-regression-smoke.ts', 'rb') as f:
    new = f.read().decode('utf-8')
orig_imports = orig.split(chr(10))[4]
new_imports = new.split(chr(10))[4]
def parse_import(text):
    m = re.match(r"import\s*\{\s*(.*?)\s*\}\s*from\s+'([^']+)'\s*;", text)
    if not m:
        return None
    return [s.strip() for s in m.group(1).split(',') if s.strip()], m.group(2)
orig_fns, mod = parse_import(orig_imports)
new_fns, mod2 = parse_import(new_imports)
print('Original import count:', len(orig_fns))
print('New import count:', len(new_fns))
print('Added:', set(new_fns) - set(orig_fns))
print('Removed:', set(orig_fns) - set(new_fns))