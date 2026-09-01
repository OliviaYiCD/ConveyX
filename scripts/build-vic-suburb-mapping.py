#!/usr/bin/env python3
"""Regenerate vic-suburb-mapping.json from VIC mapping.xlsx.

Usage: python3 scripts/build-vic-suburb-mapping.py [path-to-xlsx]
"""
from __future__ import annotations

import csv
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path.home() / "Downloads/VIC mapping.xlsx"
OUT_PATH = ROOT / "services/catalog-intelligence/src/data/vic-suburb-mapping.json"
PRODUCTS_CSV = ROOT / "data/import/products-all.csv"

LGA_COUNCIL_ALIASES = {
    "Rural City of Mildura": "Mildura Rural City",
    "Rural City of Wangaratta": "Wangaratta Rural City",
}

WATER_AUTHORITIES = {
    "Barwon Water": "Barwon Region",
    "Central Highlands Water": "Central Highlands",
    "Coliban Water": "Coliban Region",
    "East Gippsland Water": "East Gippsland Region",
    "Gippsland Water": "Gippsland Region",
    "Goulburn Valley Water": "Goulburn Valley Region",
    "Greater Western Water": "Greater Western",
    "Lower Murray Water": "Lower Murray Urban",
    "North East Water": "North East Region",
    "South East Water": "South East",
    "Wannon Water": "Wannon Region",
    "Yarra Valley Water": "Yarra Valley",
}


def norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", value.lower()).strip()


def read_xlsx(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as z:
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        shared: list[str] = []
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", ns):
            shared.append("".join((t.text or "") for t in si.findall(".//m:t", ns)))

        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows: list[list[str]] = []
        for row in sheet.findall("m:sheetData/m:row", ns):
            cells: list[str] = []
            for cell in row.findall("m:c", ns):
                cell_type = cell.get("t")
                value_node = cell.find("m:v", ns)
                if value_node is None:
                    cells.append("")
                    continue
                raw = value_node.text or ""
                cells.append(shared[int(raw)] if cell_type == "s" else raw)
            rows.append(cells)

    header = rows[0]
    return [dict(zip(header, row)) for row in rows[1:]]


def load_lga_councils() -> list[str]:
    with PRODUCTS_CSV.open(encoding="utf-8-sig") as f:
        return sorted(
            {
                row["council"]
                for row in csv.DictReader(f)
                if row["state"] == "VIC" and row["type"] == "LGA"
            }
        )


def excel_council_to_product(excel_name: str, lga_councils: list[str]) -> str | None:
    if excel_name in LGA_COUNCIL_ALIASES:
        return LGA_COUNCIL_ALIASES[excel_name]

    n = norm_key(excel_name)
    for council in lga_councils:
        if norm_key(council) == n:
            return council

    city_match = re.match(r"city of (.+)", n)
    if city_match:
        target = f"{city_match.group(1)} city"
        for council in lga_councils:
            if norm_key(council) == target:
                return council

    shire_match = re.match(r"shire of (.+)", n)
    if shire_match:
        target = f"{shire_match.group(1)} shire"
        for council in lga_councils:
            if norm_key(council) == target:
                return council

    greater_match = re.match(r"city of greater (.+)", n)
    if greater_match:
        token = greater_match.group(1)
        for council in lga_councils:
            key = norm_key(council)
            if "greater" in key and token in key:
                return council

    for council in lga_councils:
        key = norm_key(council)
        if key.replace(" city", "") == n.replace("city of ", ""):
            return council

    return None


def main() -> None:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    lga_councils = load_lga_councils()
    council_aliases: dict[str, str] = {}
    suburbs: list[dict] = []

    for row in read_xlsx(xlsx_path):
        suburb = str(row.get("suburb", "")).strip()
        postcode = str(row.get("postcode", "")).split(".")[0]
        region = str(row.get("region", "")).strip()
        council_field = str(row.get("Council", "")).strip()
        water_provider = str(row.get("Water", "")).strip()

        councils: list[str] = []
        for part in re.split(r"\s*/\s*", council_field):
            excel_council = part.strip()
            if not excel_council:
                continue
            if excel_council not in council_aliases:
                mapped = excel_council_to_product(excel_council, lga_councils)
                if mapped:
                    council_aliases[excel_council] = mapped
            mapped = council_aliases.get(excel_council)
            if mapped:
                councils.append(mapped)

        suburbs.append(
            {
                "suburb": suburb,
                "postcode": postcode,
                "region": region,
                "councils": sorted(set(councils)),
                "water_authority": WATER_AUTHORITIES.get(water_provider),
                "water_provider": water_provider,
            }
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "suburbs": suburbs,
                "council_aliases": council_aliases,
                "water_authorities": WATER_AUTHORITIES,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {len(suburbs)} suburbs to {OUT_PATH}")


if __name__ == "__main__":
    main()
