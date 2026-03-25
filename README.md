# IPH SYSTEM (HR & Personnel Management)

IPH SYSTEM is a comprehensive HR management platform designed for streamlined employee lifecycle tracking, performance evaluation, and payroll reporting.

## 🚀 Recent Technical Updates (March 2026)

This section provides a technical breakdown of the latest core system updates for the development team.

### 1. Performance Evaluation Engine (100-Point Scale)
The evaluation system has been refactored to use a standardized 100-point scale across all modules.

*   **Scoring Logic**: Raw attendance and performance data are converted using localized weightages:
    *   **Presence (20%)**: Calculated via `Math.max(0, 7 - AbsenceDays)` and normalized delay minutes.
    *   **Administrative Behavior (25%)**: Peer, Team, and Rule compliance metrics.
    *   **Executive Performance (40%)**: Task Quality, Time Commitment, and Problem Solving.
    *   **Care & Discipline (15%)**: Safety, Appearance, and Data Privacy.
*   **Implementation**: Logic residing in `src/services/payrollService.ts` and `src/pages/hr/EvaluationControl.tsx`. 
*   **Reporting**: Excel/CSV exports in `payrollService.ts` now reflect these standardized scores with precision-guided styling using `xlsx-js-style`.

### 2. Data Integrity: Transactional User Deletion
To prevent 500 status errors caused by foreign key constraints, a robust transactional deletion flow was implemented.

*   **Mechanism**: Uses `prisma.$transaction` to ensure atomicity.
*   **Cleanup Chain**: 
    1.  Nullify `userId` in `Employee`.
    2.  Nullify approval references in `LeaveRequest` (Unit, Dept, Director levels).
    3.  Nullify authorship/assignments in `StaffTask` and `Announcement`.
    4.  Nullify submission references in all Evaluation types (`HREvaluation`, `UnitEvaluation`, etc.).
    5.  Cascade delete owner-specific records (Notifications, user-owned Leave Requests).
*   **File**: `server/src/controllers/userController.ts`.

### 3. Internationalization & RTL Engine
The system now supports full Arabic localization and Right-to-Left (RTL) layout dynamics.

*   **Tech Stack**: `i18next`, `react-i18next`, `i18next-http-backend`.
*   **Dynamic RTL**: Layouts automatically adjust based on the current language detected or selected.
*   **Translation Mapping**: Managed via `public/locales/{{lng}}/translation.json`.
*   **Branding**: Logo and title strings are now fully localized.

### 4. Brand Identity & Theming
*   **Rebranding**: Transitioned from "IPH Portfolio" to **"IPH SYSTEM"**.
*   **Theming**: Role-based themes (Super Admin vs. Employee) are managed in `src/config/roleThemes.ts` and applied via `MainLayout.tsx`.
*   **Visuals**: High-fidelity UI using Tailwind CSS glassmorphism and Lucide-react icons.

---

## 🛠 Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query.
- **Backend**: Node.js, Express, Prisma ORM, MySQL/PostgreSQL.
- **State Management**: React Context API & TanStack Query.
- **Internationalization**: i18next.

## 📦 Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    cd server && npm install
    ```
2.  **Environment Setup**:
    Configure `.env` and `server/.env` with your database credentials.
3.  **Run Development Server**:
    ```bash
    # Root directory (Frontend)
    npm run dev
    
    # Server directory (Backend)
    cd server && npm run dev
    ```

## 🗄 Database Management

This project uses **PostgreSQL** with **Prisma ORM**. Here are the essential commands for managing your data.

### 1. Visualizing Data (Prisma Studio)
To browse and edit your data in a visual interface, run:
```powershell
cd server
npx prisma studio
```
This will open a dashboard at `http://localhost:5555`.

### 2. Creating a Database Backup
To save a snapshot of your database (replace `18` with your PostgreSQL version):
```powershell
# In your PowerShell terminal:
$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$filename = "backup_$date.sql"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -d iph_hr_db > $filename
```
*Note: Default password is `admin123`.*

### 3. Restoring a Backup
To restore data from an existing backup file (e.g., `backup_2026-03-25.sql`):
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d iph_hr_db < "YOUR_BACKUP_FILE.sql"
```
> [!CAUTION]
> **Warning**: Restoring a backup will overwrite your current database data.

