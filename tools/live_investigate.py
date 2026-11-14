import time
import os
from playwright.sync_api import sync_playwright

def main():
    print("=== LIVE RGPV PORTAL INVESTIGATION ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Intercept and log network requests for image / captcha / postbacks
        def on_request(request):
            if "captcha" in request.url.lower() or "image" in request.url.lower() or request.method == "POST":
                print(f"[NET REQ] {request.method} {request.url}")

        def on_response(response):
            if "captcha" in response.url.lower() or "image" in response.url.lower():
                print(f"[NET RES] {response.status} {response.url} (Headers: {response.headers.get('content-type')})")

        page.on("request", on_request)
        page.on("response", on_response)

        print("\n1. Navigating to ProgramSelect.aspx...")
        page.goto("https://result.rgpv.ac.in/Result/ProgramSelect.aspx", timeout=30000)
        page.wait_for_selector("input[name='radlstProgram']", timeout=15000)
        
        # Click B.Tech radio button (id ctl00_ContentPlaceHolder1_radlstProgram_0)
        print("Selecting B.Tech program...")
        radios = page.query_selector_all("input[name='radlstProgram']")
        for r in radios:
            r_id = r.get_attribute("id")
            label = page.query_selector(f"label[for='{r_id}']")
            lbl_text = label.inner_text().strip() if label else ""
            print(f" Radio option: id='{r_id}', label='{lbl_text}'")
            if "b.tech" in lbl_text.lower() or "b.e." in lbl_text.lower():
                r.click()
                break

        page.wait_for_selector("#ctl00_ContentPlaceHolder1_txtrollno", timeout=15000)
        print("\n2. Arrived at BErslt.aspx page.")
        
        # Inspect form hidden inputs
        hidden_inputs = page.query_selector_all("input[type='hidden']")
        print(f"\nHidden inputs count: {len(hidden_inputs)}")
        for h in hidden_inputs:
            name = h.get_attribute("name")
            val = h.get_attribute("value")
            val_snippet = (val[:30] + "...") if val and len(val) > 30 else val
            print(f" Hidden field: {name} = {val_snippet}")

        # Inspect Captcha Image element
        captcha_img = page.query_selector("#ctl00_ContentPlaceHolder1_imgCaptcha, img[src*='Captcha']")
        if captcha_img:
            src = captcha_img.get_attribute("src")
            img_id = captcha_img.get_attribute("id")
            print(f"\nCAPTCHA Image Element Found:")
            print(f"  id: {img_id}")
            print(f"  src: {src}")
            
            # Check properties
            props = page.evaluate("""(selector) => {
                const img = document.querySelector(selector);
                return {
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    complete: img.complete,
                    outerHTML: img.outerHTML
                };
            }""", f"#{img_id}" if img_id else "img[src*='Captcha']")
            print(f"  Properties: {props}")
        else:
            print("\nCAPTCHA Image Element NOT FOUND!")

        # Inspect cookies
        cookies = context.cookies()
        print(f"\nCookies count: {len(cookies)}")
        for c in cookies:
            print(f"  Cookie: {c['name']} = {c['value']} (domain: {c['domain']})")

        browser.close()

if __name__ == "__main__":
    main()
