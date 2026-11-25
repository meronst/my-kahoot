"""
scripts/make-import-template.py — builds the downloadable import templates (KQ-18):
  public/templates/quiz-template.xlsx  (right-to-left sheet, bold titles, a drop-down for "סוג")
  public/templates/quiz-template.csv   (UTF-8 with BOM, so Excel shows the Hebrew correctly)

Run after changing the columns:  python3 scripts/make-import-template.py   (needs: pip install openpyxl)
The column titles must match TEMPLATE_HEADERS in lib/quiz-import.ts; a unit test checks both files.
"""
import csv
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation

HEADERS = ["סבב", "שם הסבב", "שאלה", "סוג", "תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4",
           "תשובה נכונה", "זמן (שניות)", "הסבר"]
ROWS = [
    ["1", "פתיחה", "איזו עיר היא בירת ישראל?", "אמריקאית", "תל אביב", "ירושלים", "חיפה", "באר שבע",
     "2", "20", "ירושלים היא בירת ישראל."],
    ["1", "פתיחה", "ים המלח הוא המקום הנמוך ביותר ביבשה", "נכון/לא נכון", "", "", "", "",
     "נכון", "15", ""],
    ["2", "סבב שני", "כמה ספרים יש בתורה?", "אמריקאית", "3", "5", "7", "",
     "2", "", "חמשת חומשי תורה."],
]
WIDTHS = [7, 14, 44, 14, 16, 16, 16, 16, 12, 12, 36]

out = Path(__file__).resolve().parent.parent / "public" / "templates"
out.mkdir(parents=True, exist_ok=True)

wb = Workbook()
ws = wb.active
ws.title = "שאלות"
ws.sheet_view.rightToLeft = True
ws.append(HEADERS)
for row in ROWS:
    ws.append(row)
for cell in ws[1]:
    cell.font = Font(bold=True)
for i, width in enumerate(WIDTHS):
    ws.column_dimensions[chr(ord("A") + i)].width = width
ws.freeze_panes = "A2"
types = DataValidation(type="list", formula1='"אמריקאית,נכון/לא נכון"', allow_blank=True)
ws.add_data_validation(types)
types.add("D2:D500")
wb.save(out / "quiz-template.xlsx")

with open(out / "quiz-template.csv", "w", encoding="utf-8-sig", newline="") as f:
    csv.writer(f).writerows([HEADERS, *ROWS])
print("written to", out)
