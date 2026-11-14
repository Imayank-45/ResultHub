import time
import os
import hashlib
from playwright.sync_api import sync_playwright

def main():
    print("=== LIVE RGPV CAPTCHA FLOW STEP-BY-STEP TRACE ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Step 1: ProgramSelect.aspx
        print("\n--- STEP 1: Navigate to ProgramSelect.aspx ---")
        page.goto("https://result.rgpv.ac.in/Result/ProgramSelect.aspx", timeout=30000)
        page.wait_for_selector("input[name='radlstProgram']", timeout=15000)
        
        # Click B.Tech
        radios = page.query_selector_all("input[name='radlstProgram']")
        for r in radios:
            r_id = r.get_attribute("id")
            label = page.query_selector(f"label[for='{r_id}']")
            lbl_text = label.inner_text().strip() if label else ""
            if "b.tech" in lbl_text.lower() or "b.e." in lbl_text.lower():
                r.click()
                break

        page.wait_for_selector("#ctl00_ContentPlaceHolder1_txtrollno", timeout=15000)
        print("Arrived at BErslt.aspx page.")

        # Step 2: Check CAPTCHA Image properties & fetch image directly vs element screenshot
        img_elem = page.query_selector("#ctl00_ContentPlaceHolder1_imgCaptcha")
        src = img_elem.get_attribute("src")
        print(f"CAPTCHA img src: '{src}'")

        # Element screenshot
        ss_bytes = img_elem.screenshot()
        ss_hash = hashlib.sha256(ss_bytes).hexdigest()[:12]
        print(f"Element screenshot hash: {ss_hash}, length: {len(ss_bytes)}")

        # Direct HTTP request for the src using APIRequestContext (same session cookies)
        response = context.request.get(f"https://result.rgpv.ac.in/Result/{src}")
        http_bytes = response.body()
        http_hash = hashlib.sha256(http_bytes).hexdigest()[:12]
        print(f"HTTP GET image hash:     {http_hash}, length: {len(http_bytes)}")

        if ss_hash != http_hash:
            print("WARNING! HTTP GET on src returned a DIFFERENT image! (RGPV generates a NEW captcha whenever src URL is requested via HTTP GET!)")

        # Step 3: Check what happens on Semester change postback
        print("\n--- STEP 3: Change Semester drop down ---")
        sem_select = page.query_selector("#ctl00_ContentPlaceHolder1_drpSemester")
        if sem_select:
            page.select_option("#ctl00_ContentPlaceHolder1_drpSemester", value="1")
            page.wait_for_timeout(2000)
            
            img_elem_post = page.query_selector("#ctl00_ContentPlaceHolder1_imgCaptcha")
            src_post = img_elem_post.get_attribute("src")
            print(f"Post-semester change CAPTCHA img src: '{src_post}'")
            ss_bytes_post = img_elem_post.screenshot()
            ss_hash_post = hashlib.sha256(ss_bytes_post).hexdigest()[:12]
            print(f"Post-semester screenshot hash: {ss_hash_post}")
            if ss_hash == ss_hash_post:
                print("Image hash SAME after semester postback.")
            else:
                print("Image hash CHANGED after semester postback.")

        # Step 4: Submit test with bogus captcha to see how RGPV updates CAPTCHA on error
        print("\n--- STEP 4: Submit form with test input ---")
        page.fill("#ctl00_ContentPlaceHolder1_txtrollno", "0105IT241001")
        page.fill("#ctl00_ContentPlaceHolder1_TextBox1", "XXXXX")

        dialog_msg = []
        page.on("dialog", lambda d: (dialog_msg.append(d.message), d.dismiss()))

        page.click("#ctl00_ContentPlaceHolder1_btnviewresult")
        page.wait_for_timeout(2000)

        print(f"Alert dialog message: {dialog_msg}")
        
        img_elem_after = page.query_selector("#ctl00_ContentPlaceHolder1_imgCaptcha")
        src_after = img_elem_after.get_attribute("src") if img_elem_after else None
        print(f"Post-submission CAPTCHA img src: '{src_after}'")

        browser.close()

if __name__ == "__main__":
    main()
