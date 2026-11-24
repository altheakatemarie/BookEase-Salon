# BookEase Salon — Pink Appointment Booking System

A beginner-friendly pink salon receptionist system with validated Philippine mobile numbers and year-locked booking dates.

## Technology
- React 18 + Vite (frontend)
- Node.js + Express (backend)
- Built-in Node.js SQLite (`node:sqlite`) database (no better-sqlite3 or native compilation)
- CSS (pink/cream responsive interface)

**Requirement:** Node.js 22.13+ (Node.js 24 LTS or 26 also works). SQLite may show an experimental warning on some Node versions; that is normal.

## How to start (Windows / VS Code)
1. Extract this ZIP.
2. Open the **BookEase_Salon_NEW** folder itself in VS Code (File > Open Folder).
3. Open Terminal > New Terminal. Make sure you can see `package.json` in the current folder.
4. Run `npm run install:all` **once**.
5. Run `npm run dev`.
6. Open **http://127.0.0.1:5180** in Chrome.

When done, press Ctrl+C in the terminal. On future days, just run `npm run dev` (no need to reinstall).

## Fixed ports — no old-server conflicts
- Website: **http://127.0.0.1:5180**
- API: **http://127.0.0.1:4088**
- Health check: **http://127.0.0.1:4088/api/health**

If a port is in use, close other copies of **this new** project before starting it. Do **not** turn off Windows security.

## Pages
- **Dashboard**: pink welcome banner, live counts, upcoming active appointments **view only**. No add/edit/delete/view-all buttons.
- **Appointments**: add, search, filter, edit details, delete; change status **directly in the Status dropdown**, which saves automatically. The server updates ONLY the SQLite `status` column through PATCH. Dashboard counts refresh after success.
- **Services**: create, edit, delete, manage duration and price.

All new appointments start as **Pending**. Status can become Pending, Confirmed, Completed or Cancelled. Cancelled slots free up. Overlapping bookings are blocked. Salon hours: 9:00 AM to 5:00 PM.

## SQLite records
Created automatically at `server/data/bookease.sqlite` on first run. The ZIP has **no personal/customer data**. Records persist between restarts. Do not delete `server/data` if you want to keep them.

This is a **brand-new database**, separate from the old BookEase, by design. If you have old bookings, they are NOT automatically copied into this new database.

## Notes
- Local staff-operated project with no login; do not expose it directly to the public Internet or place real customer personal data in a publicly hosted demo.
- No automatic email/SMS is sent. Email is optional contact information.
- Dependency `@rollup/wasm-node` is used via an npm override to avoid Windows Smart App Control blocking native Rollup modules. Do not disable Windows Security.
- If you use Node 22.13+, `node:sqlite` is available. Older Node versions are not supported.

## Improvements (v2)
- Customer mobile must be **exactly 11 digits** and start with **09**. Both React and Express validate it; non-digit typing is removed in the form.
- Date is separated into **Month / Day / Locked Year**. Year cannot be typed or selected; it comes from the **actual Philippine calendar** (Asia/Manila), changing automatically on January 1. Only this calendar year's dates are bookable, and past dates are rejected. The backend enforces the same restriction, even for requests outside the UI.
- **Status meanings:** Pending = newly booked, needs salon approval; Confirmed = salon accepted the reservation; Completed = service finished; Cancelled = visit will not take place.
- Decorative salon icons, flowers and sparkles in the pink interface; no outside image assets needed.
- Previous-year appointments may remain visible as history, but cannot be rebooked into a past year.

## November update — dates and service availability
- **No past month/day booking:** In the appointment form, earlier months are disabled, and earlier days in the current month are disabled. The current year remains locked to the actual Philippine calendar. Backend validation rejects any past date, including July when it is November.
- **Availability toggle:** Services have an Available / Unavailable switch. If Hair Treatment is unavailable, switch it OFF instead of deleting. It remains visible in Services, with its price and description; it disappears from new appointment choices. Switch it ON anytime to resume booking.
- **Existing appointments preserved:** Turning a service off does not delete appointments already recorded for that service. You can edit their customer contact information; rescheduling to an unavailable service is blocked until you turn it back ON.
- **Existing database migration:** The server adds the `is_available` column automatically on first start. Do not delete `server/data/bookease.sqlite`.
- **Run:** Open the inner `BookEase_Salon_NEW` folder (with `package.json`), then `npm run install:all` once and `npm run dev` on subsequent starts. Open http://127.0.0.1:5180.

## Appointments filter and salon badge refinement
- The **Appointments page date filter** is now three clearly labeled controls: **Month**, **Day**, and **locked Year** (instead of the browser's editable mm/dd/yyyy input). The year follows the current date in Asia/Manila; past months and past days cannot be chosen. Clear date to view appointments from all dates, including history.
- The **Services availability badge** is kept in front, readable in full, with the decorative flower moved underneath the badge instead of overlapping its wording.
- No changes to the SQLite database schema or saved records.


## Defense preparation fixes (November 2026)
- A new reservation cannot select a time that already passed **today** (Asia/Manila); backend also checks this.
- Upcoming Reservations on the Dashboard shows all future pending/confirmed bookings, no 8-row cap.
- A Cancelled count appears on Dashboard.
- Appointment date filter can search past days of the current year; the booking form continues to prevent past-date bookings. Use Clear Date to see all years.
- Removed nonfunctional Pretty days ahead sidebar card and BE avatar; date and Refresh remain.
- Existing completed/cancelled records stay in Appointments. **Deleting a record remains permanent**; do not click Delete if you intend to retain history.
- When changing only the customer details of an existing appointment, its old schedule is preserved.

Existing SQLite data: The ZIP does **not** bundle your existing data file. To transfer your current salon records from the previous project, stop the old server first, then copy its `server/data/bookease.sqlite` (and any `bookease.sqlite-wal`/`bookease.sqlite-shm` if present) into the new project `server/data` folder. Make a backup before replacing any file.
