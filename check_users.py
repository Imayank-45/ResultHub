import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'data', 'result_ai.db')
print("Checking DB at:", db_path)

if not os.path.exists(db_path):
    print("Database file does not exist!")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n--- ALL REGISTERED ACCOUNTS (USERS) ---")
    cursor.execute("SELECT id, name, email, phone, created_at, last_login, is_active, email_verified FROM users")
    users = cursor.fetchall()
    print(f"Total Accounts Created: {len(users)}\n")
    for u in users:
        print(f"ID: {u[0]} | Name: {u[1]} | Email: {u[2]} | Phone: {u[3]} | Created: {u[4]} | Last Login: {u[5]} | Active: {u[6]} | Verified: {u[7]}")
        
    print("\n--- LOGIN HISTORIES ---")
    cursor.execute("SELECT id, user_id, login_time, ip_address, browser, os FROM login_histories ORDER BY login_time DESC")
    logins = cursor.fetchall()
    print(f"Total Login Attempts/Sessions Recorded: {len(logins)}\n")
    for l in logins:
        print(f"Log ID: {l[0]} | User ID: {l[1]} | Login Time: {l[2]} | IP: {l[3]} | Browser: {l[4]} | OS: {l[5]}")

    print("\n--- REFRESH TOKEN SESSIONS (ACTIVE/RECENT SESSIONS) ---")
    cursor.execute("SELECT id, user_id, created_at, expires_at, is_revoked, ip_address, user_agent FROM refresh_token_sessions")
    sessions = cursor.fetchall()
    print(f"Total Refresh Token Sessions: {len(sessions)}\n")
    for s in sessions:
        print(f"Session ID: {s[0]} | User ID: {s[1]} | Created: {s[2]} | Expires: {s[3]} | Revoked: {s[4]} | IP: {s[5]}")
