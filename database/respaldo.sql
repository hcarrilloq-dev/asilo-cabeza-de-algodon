/* =====================================================================
   SIGEVAN - Respaldo completo de la base de datos AsiloCabezaAlgodon
   Ejecutar en SSMS (F5). El archivo .bak se guarda en la carpeta de
   respaldos de SQL Server (al final se muestra la ruta exacta).
   Cada ejecución reemplaza el respaldo anterior (WITH INIT).
   ===================================================================== */
USE master;
GO
BACKUP DATABASE AsiloCabezaAlgodon
    TO DISK = N'AsiloCabezaAlgodon.bak'
    WITH INIT, NAME = N'SIGEVAN - respaldo completo', STATS = 25;
GO
-- Comprobar que el respaldo se puede leer
RESTORE VERIFYONLY FROM DISK = N'AsiloCabezaAlgodon.bak';
GO
-- Ruta y fecha del último respaldo
SELECT TOP 1 f.physical_device_name AS archivo, s.backup_finish_date AS fecha, CAST(s.backup_size / 1048576.0 AS DECIMAL(10,2)) AS tamano_mb
FROM msdb.dbo.backupset s JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = s.media_set_id
WHERE s.database_name = 'AsiloCabezaAlgodon' ORDER BY s.backup_finish_date DESC;
GO
