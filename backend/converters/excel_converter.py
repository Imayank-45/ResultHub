"""
excel_converter.py
------------------
Handles Excel -> PDF conversion.
Uses openpyxl, pandas, and ReportLab for layout-aware PDF generation.
"""

import io
import os
from typing import Dict, Any, Optional
import pandas as pd
from openpyxl import load_workbook, Workbook

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4, landscape, portrait
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer


def convert_excel_to_pdf(
    file_bytes: bytes,
    options: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Converts Excel file (.xlsx, .xls) to a PDF document using ReportLab.
    Options support page_size ('A4', 'Letter'), orientation ('portrait', 'landscape'),
    sheet_name, margins, and auto-scaling.
    """
    options = options or {}
    page_size_name = options.get("page_size", "A4").upper()
    orientation = options.get("orientation", "landscape").lower()  # landscape default for spreadsheets
    sheet_name = options.get("sheet_name", None)

    # Determine base page size
    base_size = A4 if page_size_name == "A4" else letter
    pagesize = landscape(base_size) if orientation == "landscape" else portrait(base_size)

    # Read Excel file using pandas
    excel_file = io.BytesIO(file_bytes)
    xl = pd.ExcelFile(excel_file)
    
    selected_sheets = [sheet_name] if sheet_name and sheet_name in xl.sheet_names else xl.sheet_names

    pdf_buffer = io.BytesIO()
    margin = float(options.get("margin", 20))
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=pagesize,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=10
    )
    cell_header_style = ParagraphStyle(
        'HeaderCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        fontName='Helvetica-Bold',
        textColor=colors.white,
        alignment=1  # Center
    )
    cell_body_style = ParagraphStyle(
        'BodyCell',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        fontName='Helvetica',
        textColor=colors.HexColor('#0F172A')
    )

    elements = []

    for sheet in selected_sheets:
        df = pd.read_excel(excel_file, sheet_name=sheet)
        df = df.fillna("")  # Replace NaN with empty string

        if len(selected_sheets) > 1:
            elements.append(Paragraph(f"Sheet: {sheet}", title_style))

        headers = [str(c) for c in df.columns]
        data_rows = df.values.tolist()

        # Build table data wrapped in Paragraphs for text wrapping
        table_data = []
        
        # Header row
        hdr_row = [Paragraph(str(h), cell_header_style) for h in headers]
        table_data.append(hdr_row)

        # Body rows
        for row in data_rows:
            formatted_row = [Paragraph(str(val), cell_body_style) for val in row]
            table_data.append(formatted_row)

        if not table_data or len(headers) == 0:
            continue

        # Compute column widths to fit page width evenly
        usable_width = pagesize[0] - (2 * margin)
        num_cols = len(headers)
        col_width = usable_width / num_cols if num_cols > 0 else usable_width

        t = Table(table_data, colWidths=[col_width] * num_cols, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            # Alternating row colors
            *[(
                'BACKGROUND',
                (0, i),
                (-1, i),
                colors.HexColor('#F8FAFC') if i % 2 == 0 else colors.white
            ) for i in range(1, len(table_data))]
        ]))

        elements.append(t)
        elements.append(Spacer(1, 15))

    doc.build(elements)
    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()
    return pdf_bytes

