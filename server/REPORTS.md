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

## Local smoke test

```powershell
cd "C:\Users\1111\WebstormProjects\buildshop\server"
python scripts\report_smoke.py --format both --out-dir report_output
```

