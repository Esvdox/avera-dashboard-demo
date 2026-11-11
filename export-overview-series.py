"""Export only dashboard aggregates from the verified Excel sheet."""
import argparse
import calendar
from collections import Counter
import datetime
import json
import math
import re
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

def point(day, value, caption=None, partial=False):
    return [day.strftime('%Y-%m-%d'), value, caption or day.strftime('%d.%m.%Y'), '', partial]


def add_summary_series(workbook, data):
    data['receivables'] = [point(day, amount) for day, _, group, label, _, amount, *_ in
                           workbook['Отчётность'].iter_rows(min_row=2, values_only=True)
                           if group == 'Баланс' and 'дебиторская задолженность' in label.lower()]
    for key in ('cash', 'payments', 'loanCash', 'loanReceipts'):
        data[key] = []
    months = [row for row in workbook['ДДС'].iter_rows(min_row=2, values_only=True) if row[0]]
    accumulated = 0
    if months:
        data['loanCash'].append(point(months[0][0] - datetime.timedelta(days=1), 0, 'Начало накопления по ДДС'))
    for month, cutoff, _, _, _, closing, paid, _, _, _, received, repaid, *_ in months:
        end = month.replace(day=calendar.monthrange(month.year, month.month)[1])
        day = min(end, cutoff)
        caption = month.strftime('%m.%Y')
        accumulated += (received or 0) - (repaid or 0)
        data['cash'].append(point(day, closing, caption))
        data['payments'].append(point(day, paid, caption))
        data['loanCash'].append(point(day, accumulated, caption))
        if received:
            data['loanReceipts'].append(point(day, received, caption))

    deals = [row for row in workbook['Договоры'].iter_rows(min_row=2, values_only=True) if row[0] and row[3]]
    snapshot = max((row[0] for row in deals), default=None)
    deals = [row for row in deals if row[0] == snapshot]
    data['contractDates'] = [point(day, count) for day, count in sorted(Counter(row[3] for row in deals).items())]
    data['headcount'] = []
    for _, label, day, _, _, _, _, detail in workbook['Ряды дашборда'].iter_rows(min_row=2, max_col=8, values_only=True):
        count = re.search(r'Средняя численность:\s*([\d,]+)', str(detail)) if label == 'Текучесть' else None
        if day and count:
            data['headcount'].append(point(day, float(count[1].replace(',', '.')), 'Средняя численность за ' + str(day.year)))


def read_contract_analysis(source, as_of):
    # The source is a position-by-position snapshot, without signing dates.
    workbook = load_workbook(source, data_only=True, read_only=True)
    try:
        rows = workbook.active.iter_rows(max_col=9, values_only=True)
        header = next(rows)
        if not ('в т.ч. НДС' in str(header[5]) and 'без НДС' in str(header[6])
                and 'Рентабельность' in str(header[8])):
            raise ValueError('Не распознаны колонки файла анализа контрактов')
        points, net_prices, profits = [], [], []
        for row in rows:
            if row[1] == 'Итого':
                totals = row[5:8]
                break
            gross, net, profit, rate = row[5:9]
            if gross is None:
                continue
            if (not all(isinstance(x, (int, float)) and math.isfinite(x) for x in (gross, net, profit, rate))
                    or gross <= 0 or net <= 0 or not math.isclose(rate, profit / net, abs_tol=1e-9)):
                raise ValueError(f'Некорректные цена или рентабельность, позиция {len(points) + 1}')
            points.append([gross, rate])
            net_prices.append(net)
            profits.append(profit)
        else:
            raise ValueError('Отсутствует итог в файле анализа контрактов')
        sums = (sum(gross for gross, _ in points), sum(net_prices), sum(profits))
        if not points or not all(math.isclose(total, actual, rel_tol=0, abs_tol=.01) for total, actual in zip(totals, sums)):
            raise ValueError('Итог анализа контрактов не сходится с позициями')
        return {'asOf': as_of.isoformat(), 'weightedRate': sums[2] / sums[1], 'positions': points}
    finally:
        workbook.close()


def export(source, destination, contract_analysis, analysis_date):
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
    add_summary_series(workbook, data)
    data['contractAnalysisSnapshot'] = read_contract_analysis(contract_analysis, analysis_date)
    destination.write_text("window.AVERA_OVERVIEW_SERIES = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    return sum(len(points) for points in data.values() if isinstance(points, list)) + len(data['contractAnalysisSnapshot']['positions'])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--contract-analysis", type=Path, required=True)
    parser.add_argument("--analysis-date", type=datetime.date.fromisoformat, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("overview-series.js"))
    args = parser.parse_args()
    print(f"Exported {export(args.workbook, args.output, args.contract_analysis, args.analysis_date)} aggregate points")
