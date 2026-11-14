"""
scraper.py
----------
Browser automation for the RGPV result portal using Playwright.

CAPTCHA handling strategy: Auto-solve via ddddocr (OCR).
    RGPV issues a fresh image captcha per request. This script uses
    ddddocr (a pure-Python OCR library) to automatically capture the
    CAPTCHA image, recognize the text, fill it in, and submit. If OCR
    fails after 12 attempts, the browser automatically switches from
    headless to visible mode so the user can solve the CAPTCHA manually.
    After successful manual entry, headless OCR mode is restored and
    scraping continues for remaining students.

You MUST inspect the live RGPV result page's HTML (view-source / devtools)
and update the SELECTORS below to match. RGPV's markup / URL has changed
across the years, so a hardcoded selector set copied from an old thread
will not reliably work.
"""

from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass
from typing import Callable, Optional

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

# ---------------------------------------------------------------------------
# CONFIG - update these after inspecting the live page
# ---------------------------------------------------------------------------

RESULT_PAGE_URL = "https://result.rgpv.ac.in/Result/BErslt.aspx"  # VERIFY current URL first
PROGRAM_SELECT_URL = "https://result.rgpv.ac.in/Result/ProgramSelect.aspx"

# CSS selectors on the RGPV form - PLACEHOLDERS, verify against live DOM
SELECTOR_ENROLLMENT_INPUT = "#ctl00_ContentPlaceHolder1_txtrollno"
SELECTOR_CAPTCHA_INPUT = "#ctl00_ContentPlaceHolder1_TextBox1"
SELECTOR_SUBMIT_BUTTON = "#ctl00_ContentPlaceHolder1_btnviewresult"
SELECTOR_RESULT_CONTAINER = ".gridtable, table"
SELECTOR_SEMESTER_SELECT = "#ctl00_ContentPlaceHolder1_drpSemester"

# CAPTCHA image selector - flexible to handle RGPV's ASP.NET naming
SELECTOR_CAPTCHA_IMAGE = "img[id$='imgCaptcha'], img[src*='CaptchaImage'], img[src*='captcha'], #ctl00_ContentPlaceHolder1_imgCaptcha"

# Max auto-solve attempts per student before falling back to manual
MAX_CAPTCHA_RETRIES = 5

PLAYWRIGHT_CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-extensions",
    "--disable-background-networking",
]


# ---------------------------------------------------------------------------
# OCR Engine (lazy-loaded singleton to avoid slow import on every call)
# ---------------------------------------------------------------------------
_ocr_engine = None

def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        import ddddocr
        _ocr_engine = ddddocr.DdddOcr(show_ad=False)
        print("[OCR] ddddocr engine initialized.")
    return _ocr_engine


@dataclass
class FetchResult:
    enrollment: str
    html: Optional[str]
    error: Optional[str] = None


class RGPVScraper:
    def __init__(
        self,
        headless: bool = True,
        min_delay: float = 1.0,
        max_delay: float = 2.0,
        on_captcha_mode_change: Optional[Callable[[str], None]] = None,
    ):
        self.headless = headless
        self.min_delay = min_delay
        self.max_delay = max_delay
        self._on_captcha_mode_change = on_captcha_mode_change
        self._pw = None
        self._browser = None
        self._page: Optional[Page] = None

    def __enter__(self):
        print(f"[Browser] Initializing Playwright with headless={self.headless}")
        try:
            self._pw = sync_playwright().start()
            print("[Browser] Playwright started successfully.")
            self._browser = self._pw.chromium.launch(
                headless=self.headless,
                args=PLAYWRIGHT_CHROMIUM_ARGS,
            )
            print("[Browser] Chromium launched successfully.")
            self._page = self._browser.new_page()
            return self
        except Exception as exc:
            print(f"[Browser] Chromium launch failed: {exc}")
            if self._pw:
                self._pw.stop()
            raise

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    def _polite_delay(self):
        time.sleep(random.uniform(self.min_delay, self.max_delay))

    def _set_captcha_mode(self, mode: str) -> None:
        if self._on_captcha_mode_change:
            self._on_captcha_mode_change(mode)

    def _switch_browser(self, headless: bool) -> Page:
        """Relaunch the browser in headless or visible mode without stopping the scraper."""
        if self._browser:
            try:
                self._browser.close()
            except Exception:
                pass
        self.headless = headless
        print(f"[Browser] Switching Chromium mode to headless={headless}")
        try:
            self._browser = self._pw.chromium.launch(
                headless=headless,
                args=PLAYWRIGHT_CHROMIUM_ARGS,
            )
            page = self._browser.new_page()
            self._page = page
            print("[Browser] Chromium relaunch succeeded.")
            return page
        except Exception as exc:
            print(f"[Browser] Chromium relaunch failed: {exc}")
            raise

def find_program_radio_id(page: Page, program: str) -> Optional[str]:
    """
    Finds the radio button element ID corresponding to the target program name on RGPV's ProgramSelect.aspx.
    Supports all RGPV programs (B.E., B.Tech., B.Pharmacy, B.Pharmacy (PCI), M.Pharmacy, M.Pharmacy (PCI), 
    MCA, MCA (DD), MCA Bridge Course, M.Tech., M.Tech. (PT), MBA, M.Arch., B.Arch., M.Plan, B.Design, Diploma, Ph.D., etc.)
    with multi-stage exact, normalized, and fuzzy matching.
    """
    import re
    radios = page.query_selector_all("input[name='radlstProgram']")
    if not radios:
        return None

    def clean_str(s: str) -> str:
        return re.sub(r'[\s\.\-\(\)]+', '', s).lower().strip()

    prog_clean = clean_str(program)
    prog_lower = program.lower().strip()

    # Stage 1: Exact string or normalized string match
    for r in radios:
        r_id = r.get_attribute("id")
        label = page.query_selector(f"label[for='{r_id}']")
        if label:
            lbl_raw = label.inner_text().strip()
            if lbl_raw.lower() == prog_lower or clean_str(lbl_raw) == prog_clean:
                return r_id

    # Stage 2: Substring / Fuzzy match fallback
    for r in radios:
        r_id = r.get_attribute("id")
        label = page.query_selector(f"label[for='{r_id}']")
        if label:
            lbl_clean = clean_str(label.inner_text())
            if prog_clean and (prog_clean in lbl_clean or lbl_clean in prog_clean):
                return r_id

    return None


class RGPVScraper:
    def __init__(
        self,
        headless: bool = True,
        min_delay: float = 1.0,
        max_delay: float = 2.0,
        on_captcha_mode_change: Optional[Callable[[str], None]] = None,
    ):
        self.headless = headless
        self.min_delay = min_delay
        self.max_delay = max_delay
        self._on_captcha_mode_change = on_captcha_mode_change
        self._pw = None
        self._browser = None
        self._page: Optional[Page] = None

    def __enter__(self):
        print(f"[Browser] Initializing Playwright with headless={self.headless}")
        try:
            self._pw = sync_playwright().start()
            print("[Browser] Playwright started successfully.")
            self._browser = self._pw.chromium.launch(
                headless=self.headless,
                args=PLAYWRIGHT_CHROMIUM_ARGS,
            )
            print("[Browser] Chromium launched successfully.")
            self._page = self._browser.new_page()
            return self
        except Exception as exc:
            print(f"[Browser] Chromium launch failed: {exc}")
            if self._pw:
                self._pw.stop()
            raise

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    def _polite_delay(self):
        time.sleep(random.uniform(self.min_delay, self.max_delay))

    def _set_captcha_mode(self, mode: str) -> None:
        if self._on_captcha_mode_change:
            self._on_captcha_mode_change(mode)

    def _switch_browser(self, headless: bool) -> Page:
        """Relaunch the browser in headless or visible mode without stopping the scraper."""
        if self._browser:
            try:
                self._browser.close()
            except Exception:
                pass
        self.headless = headless
        print(f"[Browser] Switching Chromium mode to headless={headless}")
        try:
            self._browser = self._pw.chromium.launch(
                headless=headless,
                args=PLAYWRIGHT_CHROMIUM_ARGS,
            )
            page = self._browser.new_page()
            self._page = page
            print("[Browser] Chromium relaunch succeeded.")
            return page
        except Exception as exc:
            print(f"[Browser] Chromium relaunch failed: {exc}")
            raise

    def _navigate_to_result_form(self, page: Page, enrollment: str, sem: Optional[str], program: str) -> None:
        """
        Cleanly navigate to ProgramSelect.aspx, select the program radio button,
        select the semester, and fill in the student enrollment number.
        This guarantees fresh ASP.NET session state, ViewState, and CAPTCHA generation
        for every student attempt.
        """
        page.goto(PROGRAM_SELECT_URL, timeout=30000)
        page.wait_for_selector("input[name='radlstProgram']", timeout=15000)

        target_radio_id = find_program_radio_id(page, program)

        if target_radio_id:
            page.click(f"#{target_radio_id}")
            page.wait_for_selector(SELECTOR_ENROLLMENT_INPUT, timeout=20000)
        else:
            page.goto(RESULT_PAGE_URL, timeout=30000)
            page.wait_for_selector(SELECTOR_ENROLLMENT_INPUT, timeout=15000)

        if sem:
            try:
                base_img = page.query_selector(SELECTOR_CAPTCHA_IMAGE)
                base_src = base_img.get_attribute("src") if base_img else None

                # Always trigger select_option to guarantee ASP.NET ViewState & CAPTCHA session synchronization
                page.select_option(SELECTOR_SEMESTER_SELECT, value=str(sem))

                if base_src:
                    js_fn = """
                        (args) => {
                            const [selector, prevSrc] = args;
                            const img = document.querySelector(selector);
                            if (!img) return false;
                            if (img.getAttribute('src') === prevSrc) {
                                return false;
                            }
                            return img.complete && img.naturalWidth > 0;
                        }
                    """
                    try:
                        page.wait_for_function(js_fn, arg=[SELECTOR_CAPTCHA_IMAGE, base_src], timeout=8000)
                    except Exception:
                        page.wait_for_timeout(1000)
                else:
                    page.wait_for_timeout(1500)
            except Exception as e:
                print(f"[{enrollment}] Warning: Could not select semester '{sem}': {e}")

        page.fill(SELECTOR_ENROLLMENT_INPUT, enrollment)
        page.wait_for_timeout(300)

    def _restore_form_for_manual(self, page: Page, enrollment: str, sem: Optional[str], program: str) -> None:
        """Re-navigate to the result form after a browser relaunch (manual CAPTCHA recovery only)."""
        self._navigate_to_result_form(page, enrollment, sem, program)

    def _solve_captcha_ocr(self, page: Page, attempt_num: int = 1, prev_img_bytes: Optional[bytes] = None) -> tuple[Optional[str], Optional[str], Optional[bytes]]:
        """
        Locate the CAPTCHA image on the page, wait for it to be rendered and complete,
        take a fresh screenshot, and use ddddocr raw image bytes to recognize the text.
        Saves diagnostic screenshot and logs evidence of CAPTCHA freshness.
        Returns (cleaned_text, current_src, img_bytes).
        """
        try:
            import hashlib
            from datetime import datetime

            # Log DOM readiness and element properties before OCR
            dom_info = page.evaluate("""
                (selector) => {
                    const img = document.querySelector(selector);
                    return {
                        readyState: document.readyState,
                        imgFound: !!img,
                        naturalWidth: img ? img.naturalWidth : 0,
                        naturalHeight: img ? img.naturalHeight : 0,
                        clientWidth: img ? img.clientWidth : 0,
                        clientHeight: img ? img.clientHeight : 0,
                        complete: img ? img.complete : false,
                        src: img ? img.getAttribute('src') : null
                    };
                }
            """, SELECTOR_CAPTCHA_IMAGE)
            
            ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            print(f"[DIAGNOSTIC {ts}] Attempt {attempt_num} | DOM State: '{dom_info['readyState']}' | Img Found: {dom_info['imgFound']} | Dim: {dom_info['naturalWidth']}x{dom_info['naturalHeight']} (Client: {dom_info['clientWidth']}x{dom_info['clientHeight']}) | Complete: {dom_info['complete']} | src: '{dom_info['src']}'")

            # Wait for the captcha image to be present and fully rendered in the DOM
            js_fn = """
                (selector) => {
                    const img = document.querySelector(selector);
                    if (!img) return false;
                    return img.complete && img.naturalWidth > 0;
                }
            """
            try:
                page.wait_for_function(js_fn, arg=SELECTOR_CAPTCHA_IMAGE, timeout=12000)
            except Exception as e:
                print(f"[OCR] Timeout/error waiting for rendered CAPTCHA image: {e}")
            
            # Fetch captcha image element
            captcha_img = None
            for _ in range(5):
                try:
                    captcha_img = page.query_selector(SELECTOR_CAPTCHA_IMAGE)
                    if captcha_img:
                        captcha_img.get_attribute("src")
                        break
                except Exception:
                    page.wait_for_timeout(200)
            
            if not captcha_img:
                print("[OCR] CAPTCHA image element not found on page.")
                return None, None, None
            
            current_src = captcha_img.get_attribute("src")
            page.wait_for_timeout(300)

            # Take direct screenshot of current CAPTCHA image
            img_bytes = captcha_img.screenshot()
            img_hash = hashlib.sha256(img_bytes).hexdigest()[:12]

            # Save screenshot for evidence comparison (data/attempt_1.png, attempt_2.png, etc.)
            os.makedirs("data", exist_ok=True)
            saved_filename = f"data/attempt_{attempt_num}.png"
            with open(saved_filename, "wb") as f:
                f.write(img_bytes)

            is_identical_to_prev = False
            if prev_img_bytes is not None:
                is_identical_to_prev = (img_bytes == prev_img_bytes)
                prev_hash = hashlib.sha256(prev_img_bytes).hexdigest()[:12]
                if is_identical_to_prev:
                    print(f"[DIAGNOSTIC EVIDENCE] Attempt {attempt_num}: Saved {saved_filename} (Hash: {img_hash}). WARNING: Image bytes are EXACTLY IDENTICAL to Attempt {attempt_num - 1} (Hash: {prev_hash})! Stale DOM capture confirmed!")
                else:
                    print(f"[DIAGNOSTIC EVIDENCE] Attempt {attempt_num}: Saved {saved_filename} (Hash: {img_hash}). Image bytes changed from Attempt {attempt_num - 1} (Hash: {prev_hash}).")
            else:
                print(f"[DIAGNOSTIC EVIDENCE] Attempt {attempt_num}: Saved {saved_filename} (Hash: {img_hash}). Initial CAPTCHA captured.")

            # Run Universal Adaptive OCR Engine (evaluates 5 strategies with ensemble consensus)
            from automation.ocr_engine import UniversalOCREngine
            engine = UniversalOCREngine()
            solver_res = engine.solve_captcha(img_bytes, attempt_num=attempt_num)

            if not solver_res or not solver_res.text:
                print("[OCR] Warning: Universal OCR solver produced no valid prediction. Retrying...")
                return None, current_src, img_bytes

            cleaned = solver_res.text
            print(f"[Universal OCR] Prediction: \"{cleaned}\" (Consensus: {solver_res.consensus_count}/{solver_res.total_strategies} strategies | Winning Strategy: {solver_res.winning_strategy})")
            return cleaned, current_src, img_bytes
        except Exception as e:
            print(f"[OCR] Error during CAPTCHA recognition: {e}")
            return None, None, None

    def fetch_result_html(self, enrollment: str, sem: Optional[str] = None, program: str = "B.Tech.", max_retries: int = 3) -> FetchResult:
        """
        Navigate to the result page, fill in the enrollment number,
        auto-solve the CAPTCHA via OCR, submit, and return the
        rendered result HTML.
        """
        page = self._page
        assert page is not None, "Use RGPVScraper as a context manager"

        # Handle dialogs (alerts) automatically
        dialog_message = [None]
        def handle_dialog(dialog):
            dialog_message[0] = dialog.message
            print(f"\n[Browser Alert] {dialog.message}")
            try:
                dialog.dismiss()
            except Exception:
                pass

        # Clear any existing dialog listeners to avoid duplicates
        try:
            page.remove_all_listeners("dialog")
        except Exception:
            pass
        page.on("dialog", handle_dialog)

        for attempt in range(1, max_retries + 1):
            try:
                # Clean form navigation per student (guarantees fresh ASP.NET session state & CAPTCHA)
                self._navigate_to_result_form(page, enrollment, sem, program)

                # Auto CAPTCHA solving loop
                captcha_solved = False
                last_img_bytes = None
                print("[INFO] OCR Started")
                self._set_captcha_mode("ocr")
                for captcha_attempt in range(1, MAX_CAPTCHA_RETRIES + 1):
                    # Clear any previous dialog
                    dialog_message[0] = None

                    # Screenshot and OCR the CAPTCHA, logging diagnostic evidence per attempt
                    captcha_text, _, current_bytes = self._solve_captcha_ocr(page, attempt_num=captcha_attempt, prev_img_bytes=last_img_bytes)
                    if current_bytes:
                        last_img_bytes = current_bytes
                    
                    if not captcha_text:
                        print(f"[{enrollment}] CAPTCHA OCR returned empty. Re-initializing fresh form...")
                        self._navigate_to_result_form(page, enrollment, sem, program)
                        continue

                    print(f"[{enrollment}] CAPTCHA OCR attempt {captcha_attempt}/{MAX_CAPTCHA_RETRIES}: \"{captcha_text}\"")

                    # Fill CAPTCHA input using realistic keypress events for ASP.NET WebForms event dispatch
                    try:
                        page.click(SELECTOR_CAPTCHA_INPUT)
                        page.locator(SELECTOR_CAPTCHA_INPUT).fill("")
                        page.locator(SELECTOR_CAPTCHA_INPUT).press_sequentially(captcha_text, delay=40)
                        page.wait_for_timeout(200)
                        
                        # Submit form using Enter key press inside text input (ASP.NET WebForms native submit)
                        page.locator(SELECTOR_CAPTCHA_INPUT).press("Enter")
                    except Exception as e:
                        print(f"[{enrollment}] Could not type CAPTCHA input: {e}")
                        try:
                            page.click(SELECTOR_SUBMIT_BUTTON)
                        except Exception:
                            pass
                        continue

                    # Fallback click on submit button if Enter key press did not trigger navigation immediately
                    try:
                        page.wait_for_timeout(300)
                        if page.query_selector(SELECTOR_SUBMIT_BUTTON):
                            page.click(SELECTOR_SUBMIT_BUTTON)
                    except Exception:
                        pass

                    # Wait for result page or alert dialog
                    page.wait_for_timeout(1500)

                    # Check if result page loaded
                    try:
                        content = page.content()
                    except Exception:
                        page.wait_for_timeout(500)
                        try:
                            content = page.content()
                        except Exception:
                            continue

                    from automation.parser import is_not_found

                    if "SGPA" in content or "CGPA" in content or is_not_found(content):
                        captcha_solved = True
                        page.remove_listener("dialog", handle_dialog)
                        self._polite_delay()
                        return FetchResult(enrollment=enrollment, html=content)

                    # Check if an alert was triggered
                    if dialog_message[0] is not None:
                        msg = dialog_message[0]
                        dialog_message[0] = None
                        
                        m = msg.lower()
                        # If the alert indicates the record wasn't found
                        if "not found" in m or "invalid" in m or "no record" in m or "does not exist" in m:
                            print(f"[{enrollment}] Alert indicates record not found: {msg}")
                            result_html = f"<html><body>Result not found: {msg}</body></html>"
                            page.remove_listener("dialog", handle_dialog)
                            self._polite_delay()
                            return FetchResult(enrollment=enrollment, html=result_html)
                        else:
                            # CAPTCHA failure - re-initialize fresh form for clean retry
                            print(f"[{enrollment}] Wrong CAPTCHA (\"{captcha_text}\"). Re-initializing fresh form for retry...")
                            self._navigate_to_result_form(page, enrollment, sem, program)
                            continue

                # If all CAPTCHA attempts failed, fall back to intelligent manual recovery
                if not captcha_solved:
                    print("[INFO] OCR Failed 12 Times")
                    switched_to_visible = self.headless

                    if switched_to_visible:
                        print("[INFO] Switching to Manual Browser Mode")
                        self._set_captcha_mode("manual")
                        page = self._switch_browser(headless=False)
                        try:
                            page.remove_all_listeners("dialog")
                        except Exception:
                            pass
                        page.on("dialog", handle_dialog)
                        self._restore_form_for_manual(page, enrollment, sem, program)

                    print("OCR failed after 12 attempts. Please solve the CAPTCHA manually.")
                    print("[INFO] Waiting for Manual CAPTCHA")
                    if not switched_to_visible:
                        self._set_captcha_mode("manual")

                    result_html = None
                    while True:
                        try:
                            content = page.content()
                        except Exception as exc:
                            exc_str = str(exc).lower()
                            _closed_signals = ("target closed", "browser closed", "context closed",
                                               "has been closed", "target page", "browser has been")
                            if any(sig in exc_str for sig in _closed_signals):
                                page.remove_listener("dialog", handle_dialog)
                                return FetchResult(enrollment=enrollment, html=None, error="Browser closed by user")
                            page.wait_for_timeout(500)
                            continue
                        from automation.parser import is_not_found

                        if "SGPA" in content or "CGPA" in content or is_not_found(content):
                            result_html = content
                            break

                        if dialog_message[0] is not None:
                            msg = dialog_message[0]
                            dialog_message[0] = None

                            m = msg.lower()
                            if "not found" in m or "invalid" in m or "no record" in m or "does not exist" in m:
                                print(f"[{enrollment}] Alert indicates record not found: {msg}")
                                result_html = f"<html><body>Result not found: {msg}</body></html>"
                                break
                            else:
                                print(f"[{enrollment}] Submit failed: {msg}. Please re-enter the CAPTCHA.")
                                try:
                                    page.fill(SELECTOR_ENROLLMENT_INPUT, enrollment)
                                except Exception:
                                    pass

                        page.wait_for_timeout(500)

                    print("[INFO] Manual CAPTCHA Solved Successfully")

                    if switched_to_visible:
                        print("[INFO] Returning to Automatic OCR Mode")
                        page.remove_listener("dialog", handle_dialog)
                        self._switch_browser(headless=True)
                        print("[INFO] Headless Mode Enabled Again")
                        self._set_captcha_mode("ocr_restored")
                    else:
                        page.remove_listener("dialog", handle_dialog)
                        self._set_captcha_mode("ocr_restored")

                    self._polite_delay()
                    return FetchResult(enrollment=enrollment, html=result_html)

            except PWTimeout:
                print(f"[{enrollment}] Timed out on attempt {attempt}/{max_retries}.")
                if attempt == max_retries:
                    page.remove_listener("dialog", handle_dialog)
                    return FetchResult(enrollment=enrollment, html=None, error="timeout")
                self._polite_delay()
            except Exception as exc:  # noqa: BLE001
                print(f"[{enrollment}] Error on attempt {attempt}/{max_retries}: {exc}")
                exc_str = str(exc).lower()
                # Playwright's exact wording: "Target page, context or browser has been closed"
                _closed_signals = ("target closed", "browser closed", "context closed",
                                   "has been closed", "target page", "browser has been")
                if any(sig in exc_str for sig in _closed_signals):
                    page.remove_listener("dialog", handle_dialog)
                    return FetchResult(enrollment=enrollment, html=None, error="Browser closed by user")
                if attempt == max_retries:
                    page.remove_listener("dialog", handle_dialog)
                    return FetchResult(enrollment=enrollment, html=None, error=str(exc))
                self._polite_delay()

        page.remove_listener("dialog", handle_dialog)
        return FetchResult(enrollment=enrollment, html=None, error="unknown")
