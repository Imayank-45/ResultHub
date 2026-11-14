"""
ocr_engine.py
-------------
Universal Adaptive CAPTCHA OCR Engine for RGPV result portal.

Uses multi-strategy adaptive image preprocessing (scaling, contrast enhancement,
soft thresholding, denoising/sharpening, and RGBA white-canvas compositing) combined with
dual-model ensemble consensus voting (Default + Beta models with character set restrictions)
to reliably solve CAPTCHAs across all RGPV programs & branches.
"""

from __future__ import annotations

import io
import string
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from PIL import Image, ImageEnhance, ImageOps

# Singleton ddddocr engine instances
_ocr_default_instance = None
_ocr_beta_instance = None


def get_ocr_engines() -> Tuple[any, Optional[any]]:
    """Initialize singleton ddddocr default and beta OCR engines."""
    global _ocr_default_instance, _ocr_beta_instance
    if _ocr_default_instance is None:
        import ddddocr
        _ocr_default_instance = ddddocr.DdddOcr(show_ad=False)

    if _ocr_beta_instance is None:
        import ddddocr
        try:
            _ocr_beta_instance = ddddocr.DdddOcr(show_ad=False, beta=True)
        except Exception:
            _ocr_beta_instance = None

    return _ocr_default_instance, _ocr_beta_instance


@dataclass
class OCRSolverResult:
    text: str
    consensus_count: int
    total_strategies: int
    winning_strategy: str
    candidates: List[Tuple[str, str]]  # [(strategy_name, predicted_text)]


class UniversalOCREngine:
    """
    Universal CAPTCHA solver executing multi-strategy preprocessing pipelines
    across dual OCR models (Default + Beta) with ensemble consensus.
    """

    @staticmethod
    def _to_solid_white_bg(img: Image.Image) -> Image.Image:
        """Composite RGBA/Palette image with transparency onto solid white canvas."""
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            bg.paste(img, mask=img.split()[-1])
            return bg
        return img.convert("RGB")

    def strategy_white_bg(self, img: Image.Image) -> bytes:
        """Strategy 1: Solid white canvas compositing (baseline)."""
        clean_img = self._to_solid_white_bg(img)
        buf = io.BytesIO()
        clean_img.save(buf, format='PNG')
        return buf.getvalue()

    def strategy_scale_contrast(self, img: Image.Image) -> bytes:
        """Strategy 2: 2x Lanczos upscale + gentle contrast enhancement."""
        clean_img = self._to_solid_white_bg(img)
        scaled = clean_img.resize((clean_img.width * 2, clean_img.height * 2), Image.Resampling.LANCZOS)
        gray = scaled.convert("L")
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.4)
        buf = io.BytesIO()
        enhanced.save(buf, format='PNG')
        return buf.getvalue()

    def strategy_soft_threshold(self, img: Image.Image) -> bytes:
        """Strategy 3: Soft binarization preserving thin letter strokes."""
        clean_img = self._to_solid_white_bg(img)
        scaled = clean_img.resize((int(clean_img.width * 2), int(clean_img.height * 2)), Image.Resampling.LANCZOS)
        gray = scaled.convert("L")
        # Soft threshold at 120 to avoid erasing thin stroke connections
        binary = gray.point(lambda p: 255 if p > 120 else 0)
        buf = io.BytesIO()
        binary.save(buf, format='PNG')
        return buf.getvalue()

    def strategy_denoise_sharpen(self, img: Image.Image) -> bytes:
        """Strategy 4: Denoising filter + sharpness enhancement for line fonts."""
        clean_img = self._to_solid_white_bg(img)
        scaled = clean_img.resize((clean_img.width * 2, clean_img.height * 2), Image.Resampling.LANCZOS)
        gray = scaled.convert("L")
        sharp = ImageEnhance.Sharpness(gray).enhance(1.8)
        contrast = ImageEnhance.Contrast(sharp).enhance(1.3)
        buf = io.BytesIO()
        contrast.save(buf, format='PNG')
        return buf.getvalue()

    def strategy_autocontrast(self, img: Image.Image) -> bytes:
        """Strategy 5: Auto-contrast stretching to equalize background luminance."""
        clean_img = self._to_solid_white_bg(img)
        scaled = clean_img.resize((int(clean_img.width * 1.8), int(clean_img.height * 1.8)), Image.Resampling.LANCZOS)
        gray = scaled.convert("L")
        auto = ImageOps.autocontrast(gray, cutoff=2)
        buf = io.BytesIO()
        auto.save(buf, format='PNG')
        return buf.getvalue()

    def clean_prediction(self, text: str) -> str:
        """Normalize prediction string: uppercase, alphanumeric only."""
        if not text:
            return ""
        cleaned = text.strip().replace(" ", "").upper()
        allowed = set(string.ascii_uppercase + string.digits)
        cleaned = "".join(c for c in cleaned if c in allowed)
        return cleaned

    def solve_captcha(self, raw_img_bytes: bytes, attempt_num: int = 1) -> Optional[OCRSolverResult]:
        """
        Run dual-engine ensemble across 5 adaptive preprocessing strategies on raw image bytes,
        filter candidate predictions, and return highest-consensus 5-character result.
        """
        if not raw_img_bytes:
            return None

        try:
            pil_img = Image.open(io.BytesIO(raw_img_bytes))
        except Exception:
            return None

        ocr_default, ocr_beta = get_ocr_engines()

        engines = [("default", ocr_default)]
        if ocr_beta is not None:
            engines.append(("beta", ocr_beta))

        strategies = [
            ("white_bg", self.strategy_white_bg),
            ("scale_contrast", self.strategy_scale_contrast),
            ("soft_threshold", self.strategy_soft_threshold),
            ("denoise_sharpen", self.strategy_denoise_sharpen),
            ("autocontrast", self.strategy_autocontrast),
        ]

        candidates: List[Tuple[str, str]] = []
        votes: Dict[str, int] = {}
        strategy_winner: Dict[str, str] = {}

        # 1. Baseline evaluation on raw image bytes across available OCR engines
        for eng_name, eng in engines:
            try:
                raw_pred = self.clean_prediction(eng.classification(raw_img_bytes))
                if len(raw_pred) >= 4:
                    tag = f"raw_{eng_name}"
                    candidates.append((tag, raw_pred))
                    votes[raw_pred] = votes.get(raw_pred, 0) + 1
                    if raw_pred not in strategy_winner:
                        strategy_winner[raw_pred] = tag
            except Exception:
                pass

        # 2. Evaluate all preprocessing strategies across available engines
        for strat_name, fn in strategies:
            try:
                prep_bytes = fn(pil_img)
                for eng_name, eng in engines:
                    try:
                        pred = self.clean_prediction(eng.classification(prep_bytes))
                        if len(pred) >= 4:
                            tag = f"{strat_name}_{eng_name}"
                            candidates.append((tag, pred))
                            votes[pred] = votes.get(pred, 0) + 1
                            if pred not in strategy_winner:
                                strategy_winner[pred] = tag
                    except Exception:
                        continue
            except Exception:
                continue

        if not candidates or not votes:
            return None

        # Sort candidate predictions by vote count and exact 5-character length preference
        def candidate_rank(item: Tuple[str, int]) -> Tuple[int, int, int]:
            pred_str, count = item
            is_length_5 = 1 if len(pred_str) == 5 else 0
            is_raw = 1 if "raw" in strategy_winner.get(pred_str, "") else 0
            return (count, is_length_5, is_raw)

        ranked = sorted(votes.items(), key=candidate_rank, reverse=True)

        # Always select top consensus candidate for fresh CAPTCHA images
        best_text, best_count = ranked[0]
        winning_strat = strategy_winner.get(best_text, "ensemble")

        return OCRSolverResult(
            text=best_text,
            consensus_count=best_count,
            total_strategies=len(candidates),
            winning_strategy=winning_strat,
            candidates=candidates
        )

