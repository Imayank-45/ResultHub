import sys
import os
from bs4 import BeautifulSoup

PROJECT_ROOT = r"C:\Users\mayan\OneDrive\IntelliJ IDEA Community Edition 2024.2.3\Desktop\RESULT_AI"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from automation.parser import parse_result_html

def test_parser_scenarios():
    print("=== TESTING PARSER AUDIT SCENARIOS ===")

    # Scenario 1: 5-column vertical table (1st Sem B.Tech / New Scheme format)
    html_5col = """
    <html>
      <body>
        <span id="ctl00_ContentPlaceHolder1_lblName">TEST STUDENT 1</span>
        <span id="ctl00_ContentPlaceHolder1_lblSGPA">7.80</span>
        <span id="ctl00_ContentPlaceHolder1_lblcgpa">7.80</span>
        <span id="ctl00_ContentPlaceHolder1_lblResult">PASS</span>
        <table>
          <tr><th>Subject Code</th><th>Subject Name</th><th>Total Credit</th><th>Earned Credit</th><th>Grade</th></tr>
          <tr><td>BT101</td><td>Engineering Mathematics-I</td><td>4</td><td>4</td><td>A</td></tr>
          <tr><td>BT102</td><td>Engineering Physics</td><td>4</td><td>4</td><td>B+</td></tr>
          <tr><td>BT103</td><td>Basic Electrical Engg</td><td>3</td><td>3</td><td>A+</td></tr>
          <tr><td>BT104</td><td>Engineering Graphics</td><td>3</td><td>3</td><td>B</td></tr>
          <tr><td>BT105</td><td>Manufacturing Practices</td><td>2</td><td>2</td><td>O</td></tr>
        </table>
      </body>
    </html>
    """

    res1 = parse_result_html(html_5col, "0105IT251001")
    print(f"\nScenario 1 (5-column vertical table):")
    print(f"  Name     : {res1['name']}")
    print(f"  SGPA/CGPA: {res1['sgpa']} / {res1['cgpa']}")
    print(f"  Subjects : {res1['subjects']}")
    print(f"  Result   : {res1['result']}")
    assert len(res1["subjects"]) == 5, f"Expected 5 subjects, got {len(res1['subjects'])}"

    # Scenario 2: Fail grade variants (F[T], F[P], ABS)
    html_fail_variants = """
    <html>
      <body>
        <span id="ctl00_ContentPlaceHolder1_lblName">TEST STUDENT 2</span>
        <span id="ctl00_ContentPlaceHolder1_lblSGPA">4.20</span>
        <span id="ctl00_ContentPlaceHolder1_lblcgpa">4.20</span>
        <span id="ctl00_ContentPlaceHolder1_lblResult">FAIL</span>
        <table>
          <tr><td>BT201</td><td>Engg Mathematics-II</td><td>4</td><td>F[T]</td></tr>
          <tr><td>BT202</td><td>Engg Chemistry</td><td>4</td><td>F[P]</td></tr>
          <tr><td>BT203</td><td>Basic Mechanical Engg</td><td>3</td><td>ABS</td></tr>
          <tr><td>BT204</td><td>Basic Civil Engg</td><td>3</td><td>B</td></tr>
        </table>
      </body>
    </html>
    """

    res2 = parse_result_html(html_fail_variants, "0105IT251002")
    print(f"\nScenario 2 (Fail grade variants F[T], F[P], ABS):")
    print(f"  Subjects     : {res2['subjects']}")
    print(f"  Fail Subjects: {res2['fail_subjects']}")
    print(f"  Result Status: {res2['result']}")

    print("\nPARSER AUDIT TEST COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    test_parser_scenarios()
