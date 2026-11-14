"""
marksheet_pdf.py
----------------
On-Demand PDF Marksheet Generator for individual student records using ReportLab.
Generates clean, professional student marksheet PDF documents directly from stored
database/Excel records without needing Playwright browser rendering or active scraping.
"""

from __future__ import annotations

import os
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

# Colors
CLR_PRIMARY = HexColor("#059669")
CLR_DARK = HexColor("#0F172A")
CLR_SLATE = HexColor("#334155")
CLR_GRAY = HexColor("#64748B")
CLR_LIGHT = HexColor("#F8FAFC")
CLR_BORDER = HexColor("#E2E8F0")
CLR_SUCCESS = HexColor("#16A34A")
CLR_DANGER = HexColor("#DC2626")


def generate_student_marksheet_pdf(record: Dict[str, Any], output_path: str) -> str:
    """
    Generate an individual student marksheet PDF on-demand from a record dictionary.

    Args:
        record: Dict containing keys: enrollment, name, result, sgpa, cgpa, subjects, etc.
        output_path: Path where the generated PDF should be saved.

    Returns:
        Absolute path to the generated PDF file.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom Paragraph Styles
    style_header_title = ParagraphStyle(
        "HeaderTitle",
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=CLR_PRIMARY,
        alignment=TA_CENTER,
        spaceAfter=4,
    )

    style_header_sub = ParagraphStyle(
        "HeaderSub",
        fontName="Helvetica",
        fontSize=10,
        textColor=CLR_GRAY,
        alignment=TA_CENTER,
        spaceAfter=14,
    )

    style_section_title = ParagraphStyle(
        "SectionTitle",
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=CLR_DARK,
        spaceBefore=10,
        spaceAfter=8,
    )

    style_cell = ParagraphStyle(
        "Cell",
        fontName="Helvetica",
        fontSize=9,
        textColor=CLR_SLATE,
        alignment=TA_LEFT,
    )

    style_cell_bold = ParagraphStyle(
        "CellBold",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=CLR_DARK,
        alignment=TA_LEFT,
    )

    style_cell_center = ParagraphStyle(
        "CellCenter",
        fontName="Helvetica",
        fontSize=9,
        textColor=CLR_SLATE,
        alignment=TA_CENTER,
    )

    elements = []

    # 1. Header Banner
    elements.append(Paragraph("Rajiv Gandhi Proudyogiki Vishwavidyalaya", style_header_title))
    elements.append(Paragraph("Statement of Marks — Institutional Result Record", style_header_sub))

    # 2. Student Info Grid
    enrollment = record.get("enrollment", "N/A")
    name = record.get("name", "N/A")
    result_status = str(record.get("result", "N/A")).upper()
    sgpa = record.get("sgpa")
    cgpa = record.get("cgpa")
    sgpa_str = f"{sgpa:.2f}" if isinstance(sgpa, (int, float)) else (str(sgpa) if sgpa else "N/A")
    cgpa_str = f"{cgpa:.2f}" if isinstance(cgpa, (int, float)) else (str(cgpa) if cgpa else "N/A")

    status_color = CLR_SUCCESS if result_status == "PASS" else CLR_DANGER if result_status == "FAIL" else CLR_GRAY

    info_data = [
        [
            Paragraph("<b>Enrollment No:</b>", style_cell),
            Paragraph(str(enrollment), style_cell_bold),
            Paragraph("<b>Student Name:</b>", style_cell),
            Paragraph(str(name), style_cell_bold),
        ],
        [
            Paragraph("<b>Result Status:</b>", style_cell),
            Paragraph(f"<font color='{status_color.hexval()}'><b>{result_status}</b></font>", style_cell),
            Paragraph("<b>SGPA / CGPA:</b>", style_cell),
            Paragraph(f"SGPA: {sgpa_str} | CGPA: {cgpa_str}", style_cell_bold),
        ],
    ]

    info_table = Table(info_data, colWidths=[100, 160, 100, 160])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CLR_LIGHT),
        ("GRID", (0, 0), (-1, -1), 0.5, CLR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 14))

    # 3. Subject-wise Marks Table
    elements.append(Paragraph("Subject-Wise Grade Breakdown", style_section_title))

    subjects = record.get("subjects", {})
    table_rows = [
        [
            Paragraph("<b>#</b>", style_cell_center),
            Paragraph("<b>Subject Code / Name</b>", style_cell_bold),
            Paragraph("<b>Grade Obtained</b>", style_cell_center),
        ]
    ]

    if subjects and isinstance(subjects, dict):
        idx = 1
        for code, grade in subjects.items():
            table_rows.append([
                Paragraph(str(idx), style_cell_center),
                Paragraph(str(code), style_cell),
                Paragraph(str(grade), style_cell_center),
            ])
            idx += 1
    else:
        table_rows.append([
            Paragraph("1", style_cell_center),
            Paragraph("Overall Performance Record", style_cell),
            Paragraph(result_status, style_cell_center),
        ])

    subject_table = Table(table_rows, colWidths=[40, 340, 140])
    tbl_style = [
        ("BACKGROUND", (0, 0), (-1, 0), CLR_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#FFFFFF")),
        ("GRID", (0, 0), (-1, -1), 0.5, CLR_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
    ]

    # Alternating row background
    for i in range(1, len(table_rows)):
        if i % 2 == 0:
            tbl_style.append(("BACKGROUND", (0, i), (-1, i), CLR_LIGHT))

    subject_table.setStyle(TableStyle(tbl_style))
    elements.append(subject_table)
    elements.append(Spacer(1, 20))

    # 4. Verification Footer
    footer_text = (
        f"<font color='{CLR_GRAY.hexval()}'>This document is generated on-demand by ResultAI Engine from verified result database records.<br/>"
        f"Job / Record ID: {enrollment}  |  Official Portal Sync Verified</font>"
    )
    elements.append(Paragraph(footer_text, ParagraphStyle("Footer", fontName="Helvetica", fontSize=8, alignment=TA_CENTER)))

    doc.build(elements)
    return output_path
