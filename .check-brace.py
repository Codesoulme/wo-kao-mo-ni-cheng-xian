import sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'E:\aigame2_publish\scripts\xianxia-regression-smoke.ts', 'rb') as f:
    text = f.read().decode('utf-8')
text_clean = text.replace(chr(13), '')
lines = text_clean.split(chr(10))
depth = 0
in_string = False
string_char = None
in_template = False
in_comment = False
in_block_comment = False
DQ = chr(34)
SQ = chr(39)
BT = chr(96)
for i, line in enumerate(lines):
    j = 0
    while j < len(line):
        c = line[j]
        if in_block_comment:
            if j + 1 < len(line) and c == '*' and line[j+1] == '/':
                in_block_comment = False
                j += 2
                continue
            j += 1
            continue
        if in_comment:
            j += 1
            continue
        if in_string:
            if c == chr(92):
                j += 2
                continue
            if c == string_char:
                in_string = False
            j += 1
            continue
        if in_template:
            if c == chr(92):
                j += 2
                continue
            if c == BT:
                in_template = False
            j += 1
            continue
        if c == '/' and j + 1 < len(line) and line[j+1] == '/':
            in_comment = True
            j += 2
            continue
        if c == '/' and j + 1 < len(line) and line[j+1] == '*':
            in_block_comment = True
            j += 2
            continue
        if c == DQ or c == SQ:
            in_string = True
            string_char = c
            j += 1
            continue
        if c == BT:
            in_template = True
            j += 1
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth < 0:
                print('NEGATIVE depth at line', i + 1, ':', line.strip()[:80])
                break
        j += 1
    in_comment = False
print('Final brace depth:', depth)