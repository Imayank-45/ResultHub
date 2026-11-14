import requests

BASE_URL = "http://127.0.0.1:8000/api"

def test_endpoint():
    # 1. Create session
    sess_res = requests.post(f"{BASE_URL}/mid-sem/sessions", json={
        "academic_session": "Jan - Jun 2026",
        "year": "2nd Year",
        "semester": "IV",
        "branch": "CS",
        "program": "B.Tech.",
        "roll_prefix": "0105CS2410",
        "roll_start": 1,
        "roll_end": 5
    })
    print("Session creation status:", sess_res.status_code)
    sess_data = sess_res.json()
    session_id = sess_data["id"]
    print("Session ID:", session_id)

    # 2. Call generate-excel
    excel_res = requests.post(f"{BASE_URL}/mid-sem/sessions/{session_id}/generate-excel?marks_type=all")
    print("Generate Excel status:", excel_res.status_code)
    if excel_res.status_code != 200:
        print("Excel Error detail:", excel_res.text)

    # 3. Call generate-pdf
    pdf_res = requests.post(f"{BASE_URL}/mid-sem/sessions/{session_id}/generate-pdf?marks_type=all")
    print("Generate PDF status:", pdf_res.status_code)
    if pdf_res.status_code != 200:
        print("PDF Error detail:", pdf_res.text)

if __name__ == "__main__":
    test_endpoint()
