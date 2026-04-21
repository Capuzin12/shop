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
1. `REPORT_FONT_PATH` environment variable (if set)
2. Windows: **Segoe UI** (`C:/Windows/Fonts/segoeui.ttf`) - recommended, has excellent Unicode support
3. Windows: Arial Unicode MS (`C:/Windows/Fonts/arialuni.ttf`) - if available
4. Windows: Arial (`C:/Windows/Fonts/arial.ttf`)
5. Project directory: `server/fonts/DejaVuSans.ttf`
6. Linux: `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`
7. Linux: `/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf`
If no Unicode-capable font is found, PDF generation is intentionally rejected (instead of returning broken squares).

Notes:
- The backend now validates that the selected font contains required Ukrainian glyphs before using it.
- The Docker image installs `fonts-dejavu-core`, so Linux/container deployments have a deterministic Unicode fallback.

## Local smoke test

```powershell
cd "C:\Users\1111\WebstormProjects\buildshop\server"
python scripts\report_smoke.py --format both --out-dir report_output
```

