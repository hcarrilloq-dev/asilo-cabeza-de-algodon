/* =====================================================================
   SIGEVAN - Restaurar la base de datos desde el último respaldo
   ATENCIÓN: reemplaza TODOS los datos actuales por los del respaldo.
   1. Detener el backend (Ctrl + C en su terminal).
   2. Ejecutar este script en SSMS (F5).
   3. Volver a encender el backend (npm run dev).
   ===================================================================== */
USE master;
GO
ALTER DATABASE AsiloCabezaAlgodon SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO
RESTORE DATABASE AsiloCabezaAlgodon
    FROM DISK = N'AsiloCabezaAlgodon.bak'
    WITH REPLACE, STATS = 25;
GO
ALTER DATABASE AsiloCabezaAlgodon SET MULTI_USER;
GO
PRINT 'Base de datos restaurada desde el respaldo.';
GO
