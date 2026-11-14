"""
pdf_converter.py
----------------
Handles PDF -> Excel and Compress PDF operations.
Uses pypdf, pdfplumber, Pillow, and openpyxl.
"""

import io
import os
import re
from typing import Dict, Any, List, Optional, Tuple
try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    try:
        from PyPDF2 import PdfReader, PdfWriter
    except ImportError:
        PdfReader = None
        PdfWriter = None

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


def _check_pypdf():
    if PdfReader is None or PdfWriter is None:
        raise ImportError("pypdf package is required for PDF operations. Please run: pip install pypdf")


def convert_pdf_to_excel(
    pdf_bytes: bytes,
    options: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Extracts tabular data from PDF document into an Excel spreadsheet.
    Validates presence of structured tables before generating workbook.
    """
    options = options or {}
    pdf_file = io.BytesIO(pdf_bytes)
    extracted_rows: List[List[str]] = []


    # Strategy 1: Use pdfplumber if available
    if pdfplumber is not None:
        try:
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            if row and any(cell for cell in row if cell and str(cell).strip()):
                                clean_row = [str(cell or "").strip() for cell in row]
                                extracted_rows.append(clean_row)
        except Exception as e:
            print(f"[pdf_converter] pdfplumber extraction warning: {e}")

    # Strategy 2: Fallback to pypdf line-by-line tabular parsing
    if not extracted_rows:
        pdf_file.seek(0)
        reader = PdfReader(pdf_file)
        for page in reader.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")
            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue
                # Split line on multiple spaces or tabs
                parts = [p.strip() for p in re.split(r'\s{2,}|\t', line_str) if p.strip()]
                if len(parts) >= 2:
                    extracted_rows.append(parts)

    if not extracted_rows:
        raise ValueError("No structured table was detected in this PDF file.")

    # Determine maximum number of columns across extracted rows
    max_cols = max(len(r) for r in extracted_rows)
    normalized_rows = [r + [""] * (max_cols - len(r)) for r in extracted_rows]

    # Create Excel workbook with openpyxl
    wb = Workbook()
    ws = wb.active
    ws.title = "Extracted_PDF_Data"

    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    # First row as header
    headers = normalized_rows[0]
    ws.append(headers)
    for col_idx in range(1, max_cols + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # Data rows
    for row_num, row_data in enumerate(normalized_rows[1:], 2):
        ws.append(row_data)
        for col_idx in range(1, max_cols + 1):
            cell = ws.cell(row=row_num, column=col_idx)
            cell.font = data_font
            cell.border = thin_border

    # Auto-fit columns
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            max_len = max(max_len, len(str(cell.value or "")))
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)

    out_excel = io.BytesIO()
    wb.save(out_excel)
    return out_excel.getvalue()


def compress_pdf(
    pdf_bytes: bytes,
    options: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Compresses PDF content streams and embedded images using Pillow and pypdf.
    Reduces file size significantly while keeping visual quality readable.
    """
    _check_pypdf()
    options = options or {}
    level = str(options.get("compression_level", "medium")).lower()

    # Determine image compression quality and resolution limit
    if level == "high":
        quality = 35
        max_dim = 1000
    elif level == "low":
        quality = 80
        max_dim = 2000
    else:  # medium
        quality = 55
        max_dim = 1400

    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()

    try:
        from PIL import Image
    except ImportError:
        Image = None

    for page in reader.pages:
        try:
            page.compress_content_streams()
        except Exception as e:
            print(f"[compress_pdf] compress_content_streams warning: {e}")

        if Image is not None and hasattr(page, "images"):
            try:
                for img_obj in page.images:
                    try:
                        img_data = getattr(img_obj, "data", None)
                        if not img_data:
                            continue
                        img = Image.open(io.BytesIO(img_data))
                        w, h = img.size

                        if max(w, h) > max_dim:
                            scale = max_dim / float(max(w, h))
                            new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
                            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                        if img.mode in ("RGBA", "P"):
                            img = img.convert("RGB")

                        buf = io.BytesIO()
                        img.save(buf, format="JPEG", quality=quality, optimize=True)
                        buf.seek(0)
                        compressed_pil_img = Image.open(buf)

                        img_name = getattr(img_obj, "name", None)
                        if img_name:
                            try:
                                page.replace_image(img_name, compressed_pil_img)
                            except Exception:
                                base_img_name = os.path.splitext(img_name)[0]
                                try:
                                    page.replace_image(base_img_name, compressed_pil_img)
                                except Exception as ex:
                                    print(f"[compress_pdf] Could not replace image '{img_name}': {ex}")
                    except Exception as img_err:
                        print(f"[compress_pdf] Image processing error: {img_err}")
            except Exception as page_img_err:
                print(f"[compress_pdf] Page images error: {page_img_err}")

        writer.add_page(page)

    if hasattr(writer, "compress_identical_objects"):
        try:
            writer.compress_identical_objects()
        except Exception:
            pass

    writer.add_metadata(reader.metadata or {})

    out_buf = io.BytesIO()
    writer.write(out_buf)
    compressed_bytes = out_buf.getvalue()

    # If compressed output is smaller, return it
    if len(compressed_bytes) < len(pdf_bytes):
        return compressed_bytes

    # Fallback: Content stream compression
    fallback_writer = PdfWriter()
    for page in reader.pages:
        try:
            page.compress_content_streams()
        except Exception:
            pass
        fallback_writer.add_page(page)

    if hasattr(fallback_writer, "compress_identical_objects"):
        try:
            fallback_writer.compress_identical_objects()
        except Exception:
            pass

    fallback_buf = io.BytesIO()
    fallback_writer.write(fallback_buf)
    fb_bytes = fallback_buf.getvalue()
    return fb_bytes if len(fb_bytes) < len(pdf_bytes) else pdf_bytes

