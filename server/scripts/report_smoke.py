from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database import SessionLocal
from reporting import build_admin_report_pdf, build_admin_report_xlsx, collect_admin_report_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate BuildShop admin reports locally for smoke testing.")
    parser.add_argument(
        "--format",
        choices=("pdf", "xlsx", "both"),
        default="both",
        help="Report format to generate.",
    )
    parser.add_argument(
        "--out-dir",
        default="report_output",
        help="Directory where generated files will be saved.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        data = collect_admin_report_data(db)
        generated = []

        if args.format in ("pdf", "both"):
            pdf_bytes = build_admin_report_pdf(data)
            pdf_path = out_dir / "buildshop_admin_report.pdf"
            pdf_path.write_bytes(pdf_bytes)
            generated.append(("pdf", pdf_path, len(pdf_bytes)))

        if args.format in ("xlsx", "both"):
            xlsx_bytes = build_admin_report_xlsx(data)
            xlsx_path = out_dir / "buildshop_admin_report.xlsx"
            xlsx_path.write_bytes(xlsx_bytes)
            generated.append(("xlsx", xlsx_path, len(xlsx_bytes)))

        for fmt, path, size in generated:
            print(f"{fmt.upper()}: {path} ({size} bytes)")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

