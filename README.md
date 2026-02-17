
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ICAO Level 5 ATC Examiner

A realistic AI-driven aviation English examination simulator focusing on ICAO Level 5 standards (Emergency & Non-routine situations).

## Security Notice 🔒

**API Keys are no longer stored in the frontend code or `.env` files.**
To run this application, you must configure your Gemini API Key in the Supabase Database.

## Run Locally

**Prerequisites:**  Node.js

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Environment:**
    Ensure `.env` contains your Supabase credentials:
    ```
    VITE_SUPABASE_URL=...
    VITE_SUPABASE_KEY=...
    ```

3.  **Configure Database Secrets:**
    Run the `SUPABASE_SECRETS.sql` script in your Supabase SQL Editor, replacing `'INSERT_YOUR_REAL_GEMINI_KEY_HERE'` with your actual Gemini API Key.

4.  **Run the app:**
    ```bash
    npm run dev
    ```
