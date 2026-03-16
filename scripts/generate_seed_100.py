import re
from pathlib import Path


SRC = Path(r"C:\Simcha\Apps\catalog\supabase\seed_product_summary.sql")
DST = Path(r"C:\Simcha\Apps\catalog\supabase\seed_product_summary_100.sql")


SEED_ROWS_RE = re.compile(r"^\s*(?:with\s+)?seed_rows\(.+\)\s+as\s+\(\s*$", re.IGNORECASE)
ROW_KEY_RE = re.compile(r"^\('((?:''|[^'])*)','((?:''|[^'])*)','((?:''|[^'])*)',")


def parse_key(row_line: str) -> tuple[str, str, str] | None:
    m = ROW_KEY_RE.match(row_line.strip())
    if not m:
        return None
    return tuple(part.replace("''", "'") for part in m.groups())


def find_seed_row_blocks(lines: list[str]) -> list[tuple[int, int]]:
    blocks: list[tuple[int, int]] = []
    i = 0
    while i < len(lines):
        if SEED_ROWS_RE.match(lines[i]):
            values_line = i + 1
            if values_line >= len(lines) or "values" not in lines[values_line].lower():
                i += 1
                continue
            start = i + 2
            end = start
            while end < len(lines) and lines[end].lstrip().startswith("('"):
                end += 1
            blocks.append((start, end))
            i = end
        else:
            i += 1
    return blocks


def normalize_rows(rows: list[str]) -> list[str]:
    out: list[str] = []
    for idx, row in enumerate(rows):
        s = row.rstrip("\r\n")
        if idx < len(rows) - 1:
            if not s.rstrip().endswith(","):
                s += ","
        else:
            s = s.rstrip().rstrip(",")
        out.append(s + "\n")
    return out


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    blocks = find_seed_row_blocks(lines)
    if not blocks:
        raise RuntimeError("No seed_rows blocks found.")

    first_start, first_end = blocks[0]
    first_rows = lines[first_start:first_end]

    selected_keys: list[tuple[str, str, str]] = []
    selected_key_set: set[tuple[str, str, str]] = set()
    for row in first_rows:
        key = parse_key(row)
        if key is None:
            continue
        if key not in selected_key_set:
            selected_keys.append(key)
            selected_key_set.add(key)
            if len(selected_keys) >= 100:
                break

    if len(selected_keys) < 100:
        raise RuntimeError(f"Only found {len(selected_keys)} distinct product buckets.")

    for start, end in reversed(blocks):
        raw_rows = lines[start:end]
        kept = []
        for row in raw_rows:
            key = parse_key(row)
            if key in selected_key_set:
                kept.append(row)
        lines[start:end] = normalize_rows(kept)

    output = "".join(lines)
    DST.write_text(output, encoding="utf-8")

    print(f"Created: {DST}")
    print(f"Distinct products: {len(selected_keys)}")


if __name__ == "__main__":
    main()
