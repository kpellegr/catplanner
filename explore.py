#!/usr/bin/env python3
"""Explore the structure of the studiewijzer markdown files."""
import re
import json

def explore(filepath):
    with open(filepath) as f:
        content = f.read()

    lines = content.split('\n')
    print(f"\n{'='*80}")
    print(f"FILE: {filepath}")
    print(f"{'='*80}")

    in_main_table = False
    header_found = False

    for i, line in enumerate(lines):
        if not line.strip().startswith('|'):
            if in_main_table and line.strip() == '':
                continue
            if in_main_table and not line.strip().startswith('|'):
                in_main_table = False
            continue

        cells = [c.strip() for c in line.split('|')]
        # Remove empty first/last from pipe splitting
        if cells and cells[0] == '':
            cells = cells[1:]
        if cells and cells[-1] == '':
            cells = cells[:-1]

        # Skip the bijzonderheden table
        if 'Bijzonderheden' in line:
            continue
        if 'ALGEMENE INFO' in line:
            continue

        # Detect main table header
        if 'RICHTING' in line:
            in_main_table = True
            header_found = True
            print(f"\nLine {i}: HEADER ({len(cells)} cols)")
            for j, c in enumerate(cells):
                print(f"  [{j}] = '{c}'")
            continue

        if not in_main_table:
            continue

        # Separator row
        if all(re.match(r'^[-:]+$', c) or c == '' for c in cells):
            print(f"Line {i}: SEPARATOR")
            continue

        # Sub-header (B/Z row)
        if any(c in ('**B**', '**Z**', '**3u**', '**4u**') for c in cells):
            print(f"Line {i}: SUB-HEADER: {cells}")
            continue

        # Section headers (bold text spanning the row)
        non_empty = [c for c in cells if c]
        if len(non_empty) == 1 and '**' in non_empty[0]:
            section = re.sub(r'\*\*', '', non_empty[0]).strip()
            print(f"\nLine {i}: SECTION: {section}")
            continue

        # Sub-section headers
        if len(non_empty) <= 2 and any('**' in c for c in non_empty):
            section = ' | '.join(re.sub(r'\*\*', '', c).strip() for c in non_empty if c)
            print(f"Line {i}: SUBSECTION: {section}")
            continue

        # Data rows
        print(f"Line {i}: DATA ({len(cells)} cols)")
        for j, c in enumerate(cells):
            if c:
                print(f"  [{j}] = '{c}'")

explore('P3W3.md')
explore('P3W4.md')
