"""Append verified, aggregate 1C staffing snapshots to the dashboard history."""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

from openpyxl import load_workbook

PREFIX = "window.AVERA_OVERVIEW_SERIES = "
MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split()


def read_snapshot(path):
    book = load_workbook(path, read_only=True, data_only=True)
    try:
        rows = list(book.active.values)
    finally:
        book.close()
    if rows[1][0] != "Штатная расстановка" or rows[6][4:9] != ("Запланировано", "Свободно", "Учтено", None, "ФОТ"):
        raise ValueError(f"Не распознан формат: {path.name}")
    match = re.search(r"(\d+)\s+([а-я]+)\s+(\d{4})", str(rows[4][2]))
    if not match:
        raise ValueError(f"Нет даты отчёта: {path.name}")
    day, month, year = match.groups()
    stamp = date(int(year), MONTHS.index(month) + 1, int(day)).isoformat()
    split_payroll = rows[6][11:13] == ("ФОТ занятых ставок", "ФОТ свободных ставок")
    columns = (4, 5, 8, 11, 12) if split_payroll else (4, 5, 8)
    departments = defaultdict(lambda: [Decimal(0)] * len(columns))

    def amounts(row):
        return [Decimal(str(row[column] or 0)) for column in columns]

    for row in rows:
        position = re.search(r"/([^/]+)/\s*$", str(row[0]))
        if position and isinstance(row[4], (int, float)):
            name = position[1].strip()
            values = amounts(row)
            if values[0] < 0 or not 0 <= values[1] <= values[0]:
                raise ValueError(f"Некорректные ставки в {path.name}")
            if split_payroll and abs(values[2] - values[3] - values[4]) > Decimal(".01"):
                raise ValueError(f"ФОТ позиции не сходится в {path.name}")
            departments[name] = [a + b for a, b in zip(departments[name], values)]
    if not departments:
        raise ValueError(f"Нет позиций в {path.name}")
    totals = [sum(values) for values in zip(*departments.values())]
    if any(abs(a - b) > Decimal(".01") for a, b in zip(totals, amounts(rows[9]))):
        raise ValueError(f"Итоги позиций не сходятся в {path.name}")
    planned, vacant, payroll = totals[:3]
    return {
        "date": stamp,
        "source": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "planned": float(planned),
        "occupied": float(planned - vacant),
        "vacant": float(vacant),
        "scheduledPayroll": float(payroll),
        "occupiedPayroll": float(totals[3]) if split_payroll else None,
        "vacantPayroll": float(totals[4]) if split_payroll else None,
        "departments": [
            {"name": name, "planned": float(values[0]), "occupied": float(values[0] - values[1]),
             "vacant": float(values[1]), "scheduledPayroll": float(values[2]),
             "occupiedPayroll": float(values[3]) if split_payroll else None,
             "vacantPayroll": float(values[4]) if split_payroll else None}
            for name, values in departments.items()
        ],
    }


def apply_snapshots(data, files):
    snapshots = {entry["date"]: entry for entry in data.get("staffingSnapshots", [])}
    for path in files:
        entry = read_snapshot(path)
        old = snapshots.get(entry["date"])
        if old and old != entry:
            raise ValueError(f"Срез {entry['date']} уже загружен с другими значениями")
        snapshots[entry["date"]] = entry
    data["staffingSnapshots"] = [snapshots[day] for day in sorted(snapshots)]
    for series, field in (("planned", "planned"), ("occupied", "occupied")):
        points = {point[0]: point for point in data.get(series, [])}
        for entry in data["staffingSnapshots"]:
            old = points.get(entry["date"])
            if old and abs(old[1] - entry[field]) > .000001:
                raise ValueError(f"История {series} не совпадает на {entry['date']}")
            if not old:
                caption = ".".join(reversed(entry["date"].split("-")))
                points[entry["date"]] = [entry["date"], entry[field], caption, "", False]
        data[series] = [points[day] for day in sorted(points)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("overview-series.js"))
    args = parser.parse_args()
    text = args.output.read_text(encoding="utf-8")
    if not text.startswith(PREFIX):
        raise ValueError("Не распознан файл рядов")
    data = json.loads(text.removeprefix(PREFIX).strip().removesuffix(";"))
    apply_snapshots(data, args.files)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(PREFIX + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    temporary.replace(args.output)
    for entry in data["staffingSnapshots"]:
        print(entry["date"], entry["planned"], entry["occupied"], entry["vacant"])


if __name__ == "__main__":
    main()
