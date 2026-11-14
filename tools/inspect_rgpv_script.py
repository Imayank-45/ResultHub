from playwright.sync_api import sync_playwright

def inspect_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.goto("https://result.rgpv.ac.in/Result/ProgramSelect.aspx")
        page.wait_for_selector("input[name='radlstProgram']")
        
        radios = page.query_selector_all("input[name='radlstProgram']")
        for r in radios:
            r_id = r.get_attribute("id")
            label = page.query_selector(f"label[for='{r_id}']")
            lbl_text = label.inner_text().strip() if label else ""
            if "b.tech" in lbl_text.lower() or "b.e." in lbl_text.lower():
                r.click()
                break
                
        page.wait_for_selector("#ctl00_ContentPlaceHolder1_txtrollno")
        
        # Get validate() function source code
        validate_fn = page.evaluate("typeof validate !== 'undefined' ? validate.toString() : 'NO VALIDATE FN'")
        print("=== VALIDATE FUNCTION SOURCE ===")
        print(validate_fn)
        
        # Get all scripts on page
        scripts = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('script')).map(s => s.innerHTML).filter(t => t.trim().length > 0);
        }""")
        
        print("\n=== PAGE SCRIPTS ===")
        for i, s in enumerate(scripts):
            if "validate" in s.lower() or "captcha" in s.lower() or "textbox" in s.lower():
                print(f"--- Script {i} ---")
                print(s[:500])
                
        browser.close()

if __name__ == "__main__":
    inspect_page()
