"""
image_converter.py
------------------
Handles Image -> PDF and Multi-Image -> PDF conversions.
Uses Pillow (PIL) and ReportLab to convert images (PNG, JPG, JPEG, WEBP)
into clean PDF documents with page layout controls.
"""

import io
from typing import Dict, Any, List, Optional
from PIL import Image

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4, landscape, portrait
from reportlab.platypus import SimpleDocTemplate, Image as RLImage, Spacer


def convert_image_to_pdf(
    image_bytes: bytes,
    options: Optional[Dict[str, Any]] = None
) -> bytes:
    """Converts a single image (PNG/JPG/JPEG) to a PDF document."""
    return convert_multiple_images_to_pdf([image_bytes], options)


def convert_multiple_images_to_pdf(
    image_bytes_list: List[bytes],
    options: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Converts a list of images into a single multi-page PDF document.
    Options support page_size ('A4', 'Letter'), orientation ('portrait', 'landscape'),
    margin, and image fitting.
    """
    options = options or {}
    page_size_name = options.get("page_size", "A4").upper()
    orientation = options.get("orientation", "portrait").lower()
    margin = float(options.get("margin", 20))
    image_fit = options.get("image_fit", "fit")  # 'fit', 'original'

    base_size = A4 if page_size_name == "A4" else letter
    pagesize = landscape(base_size) if orientation == "landscape" else portrait(base_size)

    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=pagesize,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin
    )

    usable_width = pagesize[0] - (2 * margin)
    usable_height = pagesize[1] - (2 * margin)

    elements = []

    for idx, img_bytes in enumerate(image_bytes_list):
        try:
            pil_img = Image.open(io.BytesIO(img_bytes))
            # Convert RGBA / CMYK to RGB
            if pil_img.mode in ('RGBA', 'LA') or (pil_img.mode == 'P' and 'transparency' in pil_img.info):
                bg = Image.new("RGB", pil_img.size, (255, 255, 255))
                bg.paste(pil_img, mask=pil_img.split()[-1] if pil_img.mode == 'RGBA' else None)
                pil_img = bg
            elif pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')

            # Save clean JPEG to stream for ReportLab
            clean_stream = io.BytesIO()
            pil_img.save(clean_stream, format='JPEG', quality=95)
            clean_stream.seek(0)

            orig_w, orig_h = pil_img.size

            if image_fit == "fit":
                # Scale proportionally to fit within usable page dimensions
                aspect = orig_h / orig_w if orig_w > 0 else 1.0
                target_w = usable_width
                target_h = target_w * aspect

                if target_h > usable_height:
                    target_h = usable_height
                    target_w = target_h / aspect
            else:
                target_w = min(orig_w, usable_width)
                target_h = min(orig_h, usable_height)

            rl_img = RLImage(clean_stream, width=target_w, height=target_h)
            elements.append(rl_img)

            if idx < len(image_bytes_list) - 1:
                elements.append(Spacer(1, 15))

        except Exception as e:
            print(f"[image_converter] Error processing image index {idx}: {e}")
            continue

    if not elements:
        raise ValueError("No valid images could be processed into PDF.")

    doc.build(elements)
    pdf_bytes = pdf_buffer.getvalue()
    pdf_buffer.close()
    return pdf_bytes
