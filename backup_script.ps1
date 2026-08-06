$ErrorActionPreference = "Stop"

Write-Host "Backing up PostgreSQL Database..."
$env:PGPASSWORD="admin123"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -p 5432 -f "database_backup.sql" iph_hr_db

$source = "c:\Users\Muetaz layyas\Desktop\IPH-system\iph_hr-system"
$dest = "c:\Users\Muetaz layyas\Desktop\IPH-system\temp_backup"
$zipPath = "c:\Users\Muetaz layyas\Desktop\IPH-system\IPH_HR_System_Backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"

Write-Host "Copying files to temporary folder (excluding node_modules, dist, .git, scratch)..."
if (Test-Path $dest) { Remove-Item -Path $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# robocopy returns exit codes < 8 on success, so we must handle it so PS doesn't stop
$robocopyArgs = @(
    $source,
    $dest,
    "/E",
    "/XD", "node_modules", "dist", ".git", "scratch",
    "/NJH", "/NJS", "/NDL", "/NC", "/NS"
)
& robocopy $robocopyArgs

Write-Host "Compressing to $zipPath..."
Compress-Archive -Path "$dest\*" -DestinationPath $zipPath -Force

Write-Host "Cleaning up temporary folder..."
Remove-Item -Path $dest -Recurse -Force

Write-Host "Backup completed successfully! Saved to: $zipPath"
