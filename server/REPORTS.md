# BuildShop admin reports

Available formats:
- `pdf`
- `xlsx`

## API

Download admin reports with:

```http
GET /api/admin/report?format=pdf
GET /api/admin/report?format=xlsx
```

The response includes `Content-Disposition`, which is exposed through CORS for browser downloads.

## PDF Unicode fonts (important)

For readable Ukrainian/Cyrillic text in PDF, the backend must load a Unicode TTF font.

Priority order:
1. `REPORT_FONT_PATH` environment variable
2. `server/fonts/DejaVuSans.ttf`
3. ReportLab bundled font (`reportlab/fonts/Vera.ttf`)

If no Unicode font is found, PDF generation is intentionally rejected (instead of returning broken squares).

## Local smoke test

```powershell
cd "C:\Users\1111\WebstormProjects\buildshop\server"
python scripts\report_smoke.py --format both --out-dir report_output
```

