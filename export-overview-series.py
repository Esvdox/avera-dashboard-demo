"""Export only dashboard aggregates from the verified Excel sheet."""
import argparse
import datetime
import json
import math
from pathlib import Path

from openpyxl import load_workbook

SERIES = {
    "Выручка": "revenue",
    "Чистая прибыль": "profit",
    "Средняя рентабельность позиций": "margin",
    "Взвешенная рентабельность": "weightedMargin",
    "Кредиторская задолженность": "payables",
    "Остаток займов": "loans",
    "Получено займов": "loansReceived",
    "Погашено займов": "loansRepaid",
    "Договоры по дате подписания": "contracts",
    "Продано по договорам": "salesByContract",
    "Полная цена договоров": "contractPrices",
    "Стоимость позиций анализа": "contractAnalysis",
    "Аттракционы": "attractions",
    "Неаттракционы": "otherProducts",
    "Ставок всего": "planned",
    "Занято ставок": "occupied",
    "Текучесть": "turnover",
}

def export(source, destination):
    workbook = load_workbook(source, data_only=True, read_only=True)
    rows = workbook["Ряды дашборда"].iter_rows(min_row=2, max_col=8, values_only=True)
    data = {key: [] for key in SERIES.values()}
    for _, label, day, period, value, _, _, detail in rows:
        if label not in SERIES:
            continue
        if value in (None, "НД"):
            continue
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f"Некорректное значение в ряду {label}: {value!r}")
        if day is None and label == "Текучесть" and period == "Январь–ноябрь 2026":
            day = datetime.date(2026, 11, 1)
        if not isinstance(day, datetime.date):
            raise ValueError(f"Нет даты для ряда {label}")
        basis = ("annual" if detail == "Годовой ряд" else "nine") if label in ("Выручка", "Чистая прибыль") else ""
        partial = label == "Текучесть" and period == "Январь–ноябрь 2026"
        caption = (period if label in ("Выручка", "Чистая прибыль", "Текучесть")
                   else day.strftime("%m.%Y" if period in ("За месяц", "Месяц договора") else "%d.%m.%Y"))
        data[SERIES[label]].append([day.strftime("%Y-%m-%d"), value, caption, basis, partial])
    for key, points in data.items():
        points.sort()
        if len({(p[0], p[3]) for p in points}) != len(points):
            raise ValueError(f"Дубли дат в ряду {key}")
    for key in ("revenue", "profit", "payables", "loans", "contracts", "margin", "planned", "occupied", "turnover"):
        if not data[key]:
            raise ValueError(f"Отсутствует обязательный ряд: {key}")
    destination.write_text("window.AVERA_OVERVIEW_SERIES = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    return sum(map(len, data.values()))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("overview-series.js"))
    args = parser.parse_args()
    print(f"Exported {export(args.workbook, args.output)} aggregate points")
