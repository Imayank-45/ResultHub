import sys
import os
import re

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_sample_pdf(out_path):
    doc = SimpleDocTemplate(
        out_path,
        pagesize=landscape(A4),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    usable_width = 841.89 - 60  # 781.89 pt

    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=styles["Heading1"],
        alignment=1,
        fontSize=16,
        leading=18,
        textColor=colors.HexColor("#1E3A8A")
    )
    sub_style = ParagraphStyle(
        name="SubStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    story.append(Paragraph("ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("DEPARTMENT OF COMPUTER SCIENCE | SESSION: JAN - JUN 2026 | SEMESTER IV", sub_style))
    story.append(Spacer(1, 14))

    subjects = [
        {"subject_code": "BT401", "subject_name": "Mathematics-III"},
        {"subject_code": "CS402", "subject_name": "Analysis & Design of Algorithm"},
        {"subject_code": "CS403", "subject_name": "Software Engineering"},
        {"subject_code": "CS404", "subject_name": "Computer Organization & Architecture"},
        {"subject_code": "CS405", "subject_name": "Operating Systems"}
    ]

    header_style = ParagraphStyle(
        name="HeaderStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=10,
        leading=12,
        textColor=colors.white,
        fontName="Helvetica-Bold"
    )

    cell_style = ParagraphStyle(
        name="CellStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
        fontName="Helvetica"
    )

    headers = [
        Paragraph("<b>S.No.</b>", header_style),
        Paragraph("<b>Enrollment No.</b>", header_style)
    ]
    for s in subjects:
        headers.append(Paragraph(f"<b>{s['subject_code']}</b><br/><font size=8>(TOT)</font>", header_style))

    table_data = [headers]

    sample_students = [
        {"s_no": 1, "enrollment_no": "0105CS241001", "marks": {"BT401": 17, "CS402": 15, "CS403": 14, "CS404": 12, "CS405": 16}},
        {"s_no": 2, "enrollment_no": "0105CS241002", "marks": {"BT401": 18, "CS402": 19, "CS403": 17, "CS404": 15, "CS405": 18}},
        {"s_no": 3, "enrollment_no": "0105CS241003", "marks": {"BT401": 15, "CS402": 16, "CS403": 16, "CS404": 14, "CS405": 18}},
        {"s_no": 4, "enrollment_no": "0105CS241004", "marks": {"BT401": 17, "CS402": 16, "CS403": 14, "CS404": 12, "CS405": 16}},
        {"s_no": 5, "enrollment_no": "0105CS241005", "marks": {"BT401": 15, "CS402": 18, "CS403": 16, "CS404": 14, "CS405": 18}},
    ]

    for st in sample_students:
        row = [
            Paragraph(str(st["s_no"]), cell_style),
            Paragraph(f"<b>{st['enrollment_no']}</b>", cell_style)
        ]
        for s in subjects:
            val = st["marks"].get(s["subject_code"], "-")
            row.append(Paragraph(str(val), cell_style))
        table_data.append(row)

    # Calculate column widths to stretch 100% across available width (781.89 pt)
    sno_w = 50.0
    enroll_w = 150.0
    num_subj = len(subjects)
    subj_w = (usable_width - sno_w - enroll_w) / max(1, num_subj)
    col_widths = [sno_w, enroll_w] + [subj_w] * num_subj

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
    ]

    # Alternating row background colors
    for i in range(1, len(table_data)):
        bg = colors.HexColor('#F8FAFC') if i % 2 == 0 else colors.white
        t_style.append(('BACKGROUND', (0, i), (-1, i), bg))

    t.setStyle(TableStyle(t_style))
    story.append(t)

    doc.build(story)
    print("PDF generated successfully at:", out_path)

if __name__ == "__main__":
    out_pdf = os.path.join(PROJECT_ROOT, "test_pdf_output.pdf")
    generate_sample_pdf(out_pdf)
