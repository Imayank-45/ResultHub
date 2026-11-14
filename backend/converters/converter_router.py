"""
converter_router.py
--------------------
FastAPI Router for ResultAI File Converter Tool endpoints.
Includes security checks, safe temporary file handling, cleanup,
database conversion history logging, and Content-Disposition download headers.
"""

import json
import os
import re
import shutil
import time
import uuid
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import User, FileConversionHistory
from backend.db.auth import get_current_user

from backend.converters.excel_converter import convert_excel_to_pdf
from backend.converters.pdf_converter import convert_pdf_to_excel, compress_pdf
from backend.converters.image_converter import convert_image_to_pdf
from backend.converters.result_formatter import (
    analyze_result_excel, format_result_excel
)

router = APIRouter(tags=["File Converter Tools"])

TEMP_DIR = os.path.abspath("data/temp_conversions")
os.makedirs(TEMP_DIR, exist_ok=True)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def sanitize_filename(filename: str) -> str:
    """Sanitizes user-provided filenames to prevent path traversal and injection attacks."""
    clean = os.path.basename(filename)
    clean = re.sub(r'[^\w\-_.]', '_', clean)
    return clean or "converted_file"


def cleanup_expired_temp_files(max_age_seconds: int = 3600):
    """Deletes temporary conversion files older than 1 hour."""
    now = time.time()
    try:
        for f in os.listdir(TEMP_DIR):
            fpath = os.path.join(TEMP_DIR, f)
            if os.path.isfile(fpath):
                if now - os.path.getmtime(fpath) > max_age_seconds:
                    try:
                        os.remove(fpath)
                    except Exception:
                        pass
    except Exception:
        pass


@router.post("/convert")
async def convert_file_endpoint(
    file: UploadFile = File(..., description="Uploaded source file"),
    operation: str = Form(..., description="Target conversion operation key"),
    options: Optional[str] = Form(None, description="JSON string of converter options"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    General file conversion endpoint supporting:
    - excel_to_pdf
    - pdf_to_excel
    - image_to_pdf
    """
    cleanup_expired_temp_files()

    opts_dict: Dict[str, Any] = {}
    if options:
        try:
            opts_dict = json.loads(options)
        except Exception:
            opts_dict = {}

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowed limit (50 MB).")

    safe_orig_name = sanitize_filename(file.filename or "file")
    base_name, _ = os.path.splitext(safe_orig_name)
    token = str(uuid.uuid4())[:8]

    try:
        out_bytes: bytes = b""
        out_ext: str = ".bin"
        mime_type: str = "application/octet-stream"

        if operation == "excel_to_pdf":
            out_bytes = convert_excel_to_pdf(file_bytes, opts_dict)
            out_ext = ".pdf"
            mime_type = "application/pdf"

        elif operation == "pdf_to_excel":
            out_bytes = convert_pdf_to_excel(file_bytes, opts_dict)
            out_ext = ".xlsx"
            mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        elif operation == "image_to_pdf":
            out_bytes = convert_image_to_pdf(file_bytes, opts_dict)
            out_ext = ".pdf"
            mime_type = "application/pdf"

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported conversion operation: '{operation}'")


        output_filename = f"{base_name}_converted_{token}{out_ext}"
        save_path = os.path.join(TEMP_DIR, output_filename)
        with open(save_path, "wb") as out_f:
            out_f.write(out_bytes)

        # Log to database
        history_item = FileConversionHistory(
            user_id=current_user.id,
            operation=operation,
            original_filename=safe_orig_name,
            output_filename=output_filename,
            file_size_bytes=len(out_bytes),
            output_path=save_path,
            status="completed"
        )
        db.add(history_item)
        db.commit()

        print(f"[Converter Router] Operation: '{operation}' | Input: '{safe_orig_name}' | Output: '{output_filename}' ({len(out_bytes)} bytes)")

        return {
            "success": True,
            "operation": operation,
            "original_filename": safe_orig_name,
            "output_filename": output_filename,
            "file_size_bytes": len(out_bytes),
            "download_url": f"/api/tools/convert/download?filename={encode_uri(output_filename)}",
            "preview_url": f"/api/tools/convert/preview?filename={encode_uri(output_filename)}"
        }

    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        print(f"[Converter Router Error] {operation} failed: {e}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


@router.post("/pdf/compress")
async def pdf_compress_endpoint(
    file: UploadFile = File(...),
    options: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Compresses PDF content streams to reduce file size."""
    opts_dict = json.loads(options) if options else {}
    file_bytes = await file.read()
    safe_orig_name = sanitize_filename(file.filename or "file.pdf")
    base_name, _ = os.path.splitext(safe_orig_name)
    token = str(uuid.uuid4())[:8]

    compressed_bytes = compress_pdf(file_bytes, opts_dict)
    output_filename = f"{base_name}_compressed_{token}.pdf"
    save_path = os.path.join(TEMP_DIR, output_filename)
    with open(save_path, "wb") as out_f:
        out_f.write(compressed_bytes)

    history_item = FileConversionHistory(
        user_id=current_user.id,
        operation="pdf_compress",
        original_filename=safe_orig_name,
        output_filename=output_filename,
        file_size_bytes=len(compressed_bytes),
        output_path=save_path,
        status="completed"
    )
    db.add(history_item)
    db.commit()

    orig_len = len(file_bytes)
    comp_len = len(compressed_bytes)
    saved_bytes = max(0, orig_len - comp_len)
    saved_pct = round((saved_bytes / orig_len) * 100, 1) if orig_len > 0 else 0

    return {
        "success": True,
        "operation": "pdf_compress",
        "original_size": orig_len,
        "compressed_size": comp_len,
        "saved_bytes": saved_bytes,
        "saved_percent": saved_pct,
        "output_filename": output_filename,
        "download_url": f"/api/tools/convert/download?filename={encode_uri(output_filename)}"
    }



@router.post("/result/analyze")
async def result_analyze_endpoint(
    file: UploadFile = File(...)
):
    """
    Pre-conversion inspection for RGPV result Excel files.
    Returns analysis of student count, sheets, columns, missing values, duplicates, and suspicious rows.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.pdf')):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and PDF (.pdf) files are supported for result formatting.")


    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    safe_name = sanitize_filename(file.filename)
    analysis = analyze_result_excel(file_bytes, filename=safe_name)
    return analysis


@router.post("/result/format")
async def result_format_endpoint(
    file: UploadFile = File(...),
    options: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    RGPV Academic Result Excel Formatter & Sanitizer.
    Cleans empty rows, normalizes headers, formats SGPA/CGPA & PASS/FAIL, adds autofilters,
    freezes header row, applies table styling theme, and returns formatted download link + summary of changes.
    """
    opts_dict = json.loads(options) if options else {}
    file_bytes = await file.read()
    safe_orig_name = sanitize_filename(file.filename or "RGPV_Result.xlsx")
    base_name, _ = os.path.splitext(safe_orig_name)
    token = str(uuid.uuid4())[:8]

    formatted_bytes, changes_summary = format_result_excel(file_bytes, opts_dict)
    output_filename = f"{base_name}_Formatted_{token}.xlsx"
    save_path = os.path.join(TEMP_DIR, output_filename)
    with open(save_path, "wb") as out_f:
        out_f.write(formatted_bytes)

    history_item = FileConversionHistory(
        user_id=current_user.id,
        operation="result_format",
        original_filename=safe_orig_name,
        output_filename=output_filename,
        file_size_bytes=len(formatted_bytes),
        output_path=save_path,
        status="completed"
    )
    db.add(history_item)
    db.commit()

    return {
        "success": True,
        "operation": "result_format",
        "original_filename": safe_orig_name,
        "output_filename": output_filename,
        "file_size_bytes": len(formatted_bytes),
        "changes_applied": changes_summary,
        "download_url": f"/api/tools/convert/download?filename={encode_uri(output_filename)}"
    }


@router.get("/convert/download")
def download_converted_file(filename: str):
    """Serves converted output files with proper Content-Type and Content-Disposition headers."""
    safe_name = sanitize_filename(filename)
    file_path = os.path.join(TEMP_DIR, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Requested converted file was not found or has expired.")

    # Determine media type
    ext = os.path.splitext(safe_name)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".zip": "application/zip",
        ".png": "image/png"
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=file_path,
        filename=safe_name,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=\"{safe_name}\""}
    )


@router.get("/convert/history")
def get_conversion_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves conversion activity logs for the current user."""
    items = (
        db.query(FileConversionHistory)
        .filter(FileConversionHistory.user_id == current_user.id)
        .order_by(FileConversionHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": h.id,
            "operation": h.operation,
            "original_filename": h.original_filename,
            "output_filename": h.output_filename,
            "file_size_bytes": h.file_size_bytes,
            "created_at": h.created_at.isoformat(),
            "download_url": f"/api/tools/convert/download?filename={encode_uri(h.output_filename)}"
        }
        for h in items
    ]


@router.delete("/convert/history/{item_id}")
@router.post("/convert/history/delete/{item_id}")
def delete_conversion_history_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a specific conversion history record for the current user."""
    item = db.query(FileConversionHistory).filter(
        FileConversionHistory.id == item_id,
        FileConversionHistory.user_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Conversion record not found.")
    db.delete(item)
    db.commit()
    return {"message": "Conversion record deleted successfully."}


@router.post("/convert/history/clear")
def clear_conversion_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clears all conversion activity history records for the current user."""
    db.query(FileConversionHistory).filter(
        FileConversionHistory.user_id == current_user.id
    ).delete()
    db.commit()
    return {"message": "All conversion history cleared successfully."}


def encode_uri(s: str) -> str:
    from urllib.parse import quote
    return quote(s)


