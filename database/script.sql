/* =====================================================================
   SIGEVAN - Sistema para Administración del Asilo de Ancianos
   "Cabeza de Algodón"
   Script de base de datos para Microsoft SQL Server 2019 / 2022
   Versión 2.0
   ---------------------------------------------------------------------
   Ejecutar completo en SQL Server Management Studio (F5).
   ATENCIÓN: si la base AsiloCabezaAlgodon ya existe, este script la
   BORRA y la crea de nuevo (todos los datos se pierden). Útil para
   instalar desde cero o reiniciar el ambiente de pruebas.
   Después de ejecutarlo, correr "npm run seed" en el backend.
   ===================================================================== */

USE master;
GO
IF DB_ID('AsiloCabezaAlgodon') IS NOT NULL
BEGIN
    ALTER DATABASE AsiloCabezaAlgodon SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE AsiloCabezaAlgodon;
END
GO
CREATE DATABASE AsiloCabezaAlgodon;
GO
USE AsiloCabezaAlgodon;
GO

/* =====================================================================
   1. SEGURIDAD
   ===================================================================== */
CREATE TABLE roles (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombre      NVARCHAR(40)  NOT NULL UNIQUE,
    descripcion NVARCHAR(200) NULL
);

CREATE TABLE usuarios (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    nombres        NVARCHAR(80)  NOT NULL,
    apellidos      NVARCHAR(80)  NOT NULL,
    email          NVARCHAR(120) NOT NULL UNIQUE,
    password_hash  NVARCHAR(200) NOT NULL,
    rol_id         INT           NOT NULL REFERENCES roles(id),
    activo         BIT           NOT NULL DEFAULT 1,
    ultimo_acceso  DATETIME2(0)  NULL,
    creado_en      DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE auditoria (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario_id   INT           NULL REFERENCES usuarios(id),
    accion       NVARCHAR(30)  NOT NULL,
    tabla        NVARCHAR(60)  NULL,
    registro_id  INT           NULL,
    detalle      NVARCHAR(500) NULL,
    ip           NVARCHAR(45)  NULL,
    fecha        DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
CREATE INDEX ix_auditoria_fecha ON auditoria(fecha);

-- Parámetros que el Administrador puede cambiar (descuentos de la fundación, correo)
CREATE TABLE configuracion (
    clave        NVARCHAR(50)  PRIMARY KEY,
    valor        NVARCHAR(200) NOT NULL,
    descripcion  NVARCHAR(200) NULL
);

/* =====================================================================
   2. INTERNOS (FICHA) Y FAMILIARES
   ===================================================================== */
CREATE TABLE residentes (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    codigo               NVARCHAR(20)  NOT NULL UNIQUE,          -- RES-0001
    nombres              NVARCHAR(80)  NOT NULL,
    apellidos            NVARCHAR(80)  NOT NULL,
    dpi                  NVARCHAR(13)  NULL,
    fecha_nacimiento     DATE          NOT NULL,
    sexo                 CHAR(1)       NOT NULL CHECK (sexo IN ('M','F')),
    fecha_ingreso        DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    estado               NVARCHAR(20)  NOT NULL DEFAULT 'Activo'
                         CHECK (estado IN ('Activo','Egresado','Fallecido')),
    tipo_sangre          NVARCHAR(3)   NULL,
    psicopatologias      NVARCHAR(500) NULL,     -- dato clínico sensible
    medicamentos_cajon   NVARCHAR(500) NULL,     -- medicamentos habituales
    alergias             NVARCHAR(300) NULL,
    condiciones_medicas  NVARCHAR(500) NULL,
    habitacion           NVARCHAR(10)  NULL,
    observaciones        NVARCHAR(500) NULL,
    creado_por           INT           NULL REFERENCES usuarios(id),
    creado_en            DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    actualizado_en       DATETIME2(0)  NULL,
    CONSTRAINT ck_residente_fechas CHECK (fecha_ingreso >= fecha_nacimiento)
);
CREATE UNIQUE INDEX uq_residentes_dpi ON residentes(dpi) WHERE dpi IS NOT NULL;
CREATE INDEX ix_residentes_apellidos ON residentes(apellidos, nombres);

CREATE TABLE familiares (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombres     NVARCHAR(80)  NOT NULL,
    apellidos   NVARCHAR(80)  NOT NULL,
    dpi         NVARCHAR(13)  NULL,
    telefono    NVARCHAR(15)  NOT NULL,
    email       NVARCHAR(120) NULL,
    direccion   NVARCHAR(200) NULL,
    usuario_id  INT           NULL REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_familiares_dpi     ON familiares(dpi)        WHERE dpi IS NOT NULL;
CREATE UNIQUE INDEX uq_familiares_usuario ON familiares(usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE residente_familiar (
    residente_id    INT          NOT NULL REFERENCES residentes(id),
    familiar_id     INT          NOT NULL REFERENCES familiares(id),
    parentesco      NVARCHAR(30) NOT NULL,
    es_responsable  BIT          NOT NULL DEFAULT 0,   -- a su cuenta van los cargos
    PRIMARY KEY (residente_id, familiar_id)
);
-- Solo un familiar responsable por interno
CREATE UNIQUE INDEX uq_un_responsable ON residente_familiar(residente_id) WHERE es_responsable = 1;

/* =====================================================================
   3. PERSONAL
   ===================================================================== */
CREATE TABLE especialidades (
    id      INT IDENTITY(1,1) PRIMARY KEY,
    nombre  NVARCHAR(60) NOT NULL UNIQUE
);

-- General = médico del asilo. Especialista = médico de la fundación.
CREATE TABLE medicos (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    nombres          NVARCHAR(80) NOT NULL,
    apellidos        NVARCHAR(80) NOT NULL,
    colegiado        NVARCHAR(20) NULL,
    especialidad_id  INT          NOT NULL REFERENCES especialidades(id),
    tipo             NVARCHAR(12) NOT NULL CHECK (tipo IN ('General','Especialista')),
    telefono         NVARCHAR(15) NULL,
    activo           BIT          NOT NULL DEFAULT 1,
    usuario_id       INT          NULL REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_medicos_colegiado ON medicos(colegiado)  WHERE colegiado IS NOT NULL;
CREATE UNIQUE INDEX uq_medicos_usuario   ON medicos(usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE enfermeros (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombres     NVARCHAR(80) NOT NULL,
    apellidos   NVARCHAR(80) NOT NULL,
    telefono    NVARCHAR(15) NULL,
    turno       NVARCHAR(10) NOT NULL CHECK (turno IN ('Matutino','Vespertino','Nocturno')),
    activo      BIT          NOT NULL DEFAULT 1,
    usuario_id  INT          NULL REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_enfermeros_usuario ON enfermeros(usuario_id) WHERE usuario_id IS NOT NULL;

/* =====================================================================
   4. FLUJO MÉDICO (según el enunciado)
   Médico general crea SOLICITUD (+ enfermero acompañante)
   -> Fundación asigna CITA (horario + médico especialista)
   -> El especialista abre la VISITA desde la cita (no hay visita sin cita)
   -> En la visita se asignan EXÁMENES (laboratorio coloca resultados)
      y MEDICAMENTOS (farmacia los entrega y quedan con su costo).
   ===================================================================== */
CREATE TABLE solicitudes_medicas (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    residente_id       INT           NOT NULL REFERENCES residentes(id),
    medico_general_id  INT           NOT NULL REFERENCES medicos(id),
    especialidad_id    INT           NOT NULL REFERENCES especialidades(id),
    enfermero_id       INT           NOT NULL REFERENCES enfermeros(id),
    motivo             NVARCHAR(500) NOT NULL,
    prioridad          NVARCHAR(10)  NOT NULL DEFAULT 'Normal' CHECK (prioridad IN ('Normal','Urgente')),
    estado             NVARCHAR(12)  NOT NULL DEFAULT 'Pendiente'
                       CHECK (estado IN ('Pendiente','Asignada','Atendida','Cancelada')),
    fecha_solicitud    DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    creado_por         INT           NOT NULL REFERENCES usuarios(id)
);
CREATE INDEX ix_solicitudes_estado ON solicitudes_medicas(estado);

CREATE TABLE citas_medicas (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    solicitud_id     INT           NOT NULL UNIQUE REFERENCES solicitudes_medicas(id),
    medico_id        INT           NOT NULL REFERENCES medicos(id),     -- especialista
    fecha_hora       DATETIME2(0)  NOT NULL,
    lugar            NVARCHAR(150) NULL,
    estado           NVARCHAR(12)  NOT NULL DEFAULT 'Programada'
                     CHECK (estado IN ('Programada','Realizada','Cancelada','No asistio')),
    precio           DECIMAL(10,2) NOT NULL CHECK (precio >= 0),                 -- precio normal
    descuento_pct    DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
    monto            AS CAST(ROUND(precio * (100 - descuento_pct) / 100, 2) AS DECIMAL(10,2)) PERSISTED,
    asignado_por     INT           NOT NULL REFERENCES usuarios(id),
    asignado_en      DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
CREATE INDEX ix_citas_fecha ON citas_medicas(fecha_hora);

CREATE TABLE visitas_medicas (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    cita_id        INT            NOT NULL UNIQUE REFERENCES citas_medicas(id),   -- no hay visita sin cita
    fecha_visita   DATETIME2(0)   NOT NULL DEFAULT SYSDATETIME(),
    motivo         NVARCHAR(500)  NOT NULL,
    diagnostico    NVARCHAR(1000) NULL,
    observaciones  NVARCHAR(1000) NULL,
    estado         NVARCHAR(10)   NOT NULL DEFAULT 'Abierta' CHECK (estado IN ('Abierta','Cerrada')),
    cerrada_en     DATETIME2(0)   NULL,
    CONSTRAINT ck_visita_cierre CHECK (estado = 'Abierta' OR (diagnostico IS NOT NULL AND LEN(diagnostico) > 0))
);

CREATE TABLE examenes_laboratorio (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    visita_id        INT            NOT NULL REFERENCES visitas_medicas(id),
    tipo_examen      NVARCHAR(100)  NOT NULL,
    indicaciones     NVARCHAR(300)  NULL,
    estado           NVARCHAR(12)   NOT NULL DEFAULT 'Solicitado'
                     CHECK (estado IN ('Solicitado','Completado','Cancelado')),
    resultado        NVARCHAR(2000) NULL,
    fecha_resultado  DATETIME2(0)   NULL,
    precio           DECIMAL(10,2)  NOT NULL DEFAULT 0 CHECK (precio >= 0),
    descuento_pct    DECIMAL(5,2)   NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
    monto            AS CAST(ROUND(precio * (100 - descuento_pct) / 100, 2) AS DECIMAL(10,2)) PERSISTED,
    registrado_por   INT            NULL REFERENCES usuarios(id),
    CONSTRAINT ck_examen_resultado CHECK (estado <> 'Completado' OR (resultado IS NOT NULL AND LEN(resultado) > 0))
);

CREATE TABLE medicamentos (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    nombre           NVARCHAR(100) NOT NULL,
    presentacion     NVARCHAR(50)  NOT NULL,
    concentracion    NVARCHAR(30)  NOT NULL DEFAULT N'',
    precio_unitario  DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    activo           BIT           NOT NULL DEFAULT 1,
    CONSTRAINT uq_medicamento UNIQUE (nombre, presentacion, concentracion)
);

-- Medicamento indicado en la visita (cantidad, cómo tomarlo y tiempo de aplicación)
CREATE TABLE visita_medicamentos (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    visita_id           INT           NOT NULL REFERENCES visitas_medicas(id),
    medicamento_id      INT           NOT NULL REFERENCES medicamentos(id),
    cantidad            INT           NOT NULL CHECK (cantidad > 0),
    dosis               NVARCHAR(60)  NOT NULL,        -- 1 tableta
    frecuencia          NVARCHAR(60)  NOT NULL,        -- cada 8 horas
    tiempo_aplicacion   NVARCHAR(60)  NOT NULL,        -- 7 días
    indicaciones        NVARCHAR(300) NULL,
    estado              NVARCHAR(10)  NOT NULL DEFAULT 'Indicado' CHECK (estado IN ('Indicado','Entregado')),
    precio_unitario     DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
    descuento_pct       DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
    monto               AS CAST(ROUND(cantidad * precio_unitario * (100 - descuento_pct) / 100, 2) AS DECIMAL(10,2)) PERSISTED,
    entregado_en        DATETIME2(0)  NULL,
    entregado_por       INT           NULL REFERENCES usuarios(id)
);

-- Registro de enfermería de cada aplicación del medicamento al interno
CREATE TABLE administracion_medicamentos (
    id                     INT IDENTITY(1,1) PRIMARY KEY,
    visita_medicamento_id  INT           NOT NULL REFERENCES visita_medicamentos(id),
    enfermero_id           INT           NOT NULL REFERENCES enfermeros(id),
    fecha_hora             DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME(),
    observaciones          NVARCHAR(300) NULL
);
GO

/* =====================================================================
   5. ENTRADAS, SALIDAS Y CAJA
   - Cada consulta, examen y medicamento genera un CARGO a la cuenta del
     familiar responsable, siempre con el descuento de la fundación.
   - Lo mismo se le debe a la fundación (ver vista v_deuda_fundacion_cita).
   ===================================================================== */
CREATE TABLE cuotas (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    residente_id    INT           NOT NULL REFERENCES residentes(id),
    monto_mensual   DECIMAL(10,2) NOT NULL CHECK (monto_mensual > 0),
    vigente_desde   DATE          NOT NULL,
    activa          BIT           NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX uq_cuota_activa ON cuotas(residente_id) WHERE activa = 1;

CREATE TABLE cargos (
    id                     INT IDENTITY(1,1) PRIMARY KEY,
    residente_id           INT           NOT NULL REFERENCES residentes(id),
    familiar_id            INT           NULL REFERENCES familiares(id),
    tipo                   NVARCHAR(12)  NOT NULL
                           CHECK (tipo IN ('Consulta','Examen','Medicamento','Cuota','Otro')),
    concepto               NVARCHAR(200) NOT NULL,
    monto_base             DECIMAL(10,2) NOT NULL CHECK (monto_base > 0),
    descuento_pct          DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
    monto                  AS CAST(ROUND(monto_base * (100 - descuento_pct) / 100, 2) AS DECIMAL(10,2)) PERSISTED,
    periodo                CHAR(7)       NULL,            -- 2026-10 (cuotas)
    cita_id                INT           NULL REFERENCES citas_medicas(id),
    examen_id              INT           NULL REFERENCES examenes_laboratorio(id),
    visita_medicamento_id  INT           NULL REFERENCES visita_medicamentos(id),
    estado                 NVARCHAR(10)  NOT NULL DEFAULT 'Pendiente'
                           CHECK (estado IN ('Pendiente','Parcial','Cancelado','Vencido')),
    fecha                  DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    fecha_vencimiento      DATE          NULL,
    creado_por             INT           NULL REFERENCES usuarios(id)
);
CREATE INDEX ix_cargos_residente ON cargos(residente_id);
CREATE UNIQUE INDEX uq_cargo_cuota_periodo ON cargos(residente_id, periodo) WHERE tipo = 'Cuota';
CREATE UNIQUE INDEX uq_cargo_cita        ON cargos(cita_id)               WHERE cita_id IS NOT NULL;
CREATE UNIQUE INDEX uq_cargo_examen      ON cargos(examen_id)             WHERE examen_id IS NOT NULL;
CREATE UNIQUE INDEX uq_cargo_medicamento ON cargos(visita_medicamento_id) WHERE visita_medicamento_id IS NOT NULL;

CREATE TABLE pagos (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    cargo_id         INT           NOT NULL REFERENCES cargos(id),
    residente_id     INT           NOT NULL REFERENCES residentes(id),
    familiar_id      INT           NULL REFERENCES familiares(id),     -- quién pagó
    monto            DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    metodo           NVARCHAR(15)  NOT NULL CHECK (metodo IN ('Efectivo','Transferencia','Deposito','Tarjeta')),
    numero_recibo    NVARCHAR(20)  NOT NULL UNIQUE,
    clave_operacion  NVARCHAR(64)  NOT NULL UNIQUE,   -- evita registrar dos veces el mismo pago (doble clic)
    fecha            DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    observaciones    NVARCHAR(300) NULL,
    registrado_por   INT           NOT NULL REFERENCES usuarios(id),
    registrado_en    DATETIME2(0)  NOT NULL DEFAULT SYSDATETIME()
);
CREATE INDEX ix_pagos_residente ON pagos(residente_id);

CREATE TABLE pagos_fundacion (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    cita_id          INT           NOT NULL REFERENCES citas_medicas(id),
    monto            DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    fecha            DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    comprobante      NVARCHAR(30)  NULL,
    clave_operacion  NVARCHAR(64)  NOT NULL UNIQUE,
    registrado_por   INT           NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE donaciones (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    tipo_donante     NVARCHAR(25)  NOT NULL
                     CHECK (tipo_donante IN ('Empresa internacional','Empresa nacional','Gobierno','Particular')),
    donante          NVARCHAR(150) NOT NULL,
    monto            DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    fecha            DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    descripcion      NVARCHAR(300) NULL,
    numero_recibo    NVARCHAR(20)  NOT NULL UNIQUE,
    clave_operacion  NVARCHAR(64)  NOT NULL UNIQUE,
    registrado_por   INT           NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE gastos (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    categoria        NVARCHAR(20)  NOT NULL
                     CHECK (categoria IN ('Luz','Agua','Telefono e internet','Alimentacion','Mantenimiento','Salarios','Insumos','Otro')),
    descripcion      NVARCHAR(300) NOT NULL,
    monto            DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    fecha            DATE          NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
    comprobante      NVARCHAR(30)  NULL,
    clave_operacion  NVARCHAR(64)  NOT NULL UNIQUE,
    registrado_por   INT           NOT NULL REFERENCES usuarios(id)
);

/* =====================================================================
   6. NOTIFICACIONES (correo al familiar al crear una solicitud)
   Si el correo no se puede enviar queda 'Pendiente' para reenvío.
   ===================================================================== */
CREATE TABLE notificaciones (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    familiar_id   INT            NOT NULL REFERENCES familiares(id),
    residente_id  INT            NOT NULL REFERENCES residentes(id),
    solicitud_id  INT            NULL REFERENCES solicitudes_medicas(id),
    email         NVARCHAR(120)  NOT NULL,
    asunto        NVARCHAR(150)  NOT NULL,
    mensaje       NVARCHAR(2000) NOT NULL,
    estado        NVARCHAR(10)   NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado IN ('Pendiente','Enviada','Fallida')),
    intentos      INT            NOT NULL DEFAULT 0,
    ultimo_error  NVARCHAR(300)  NULL,
    creada_en     DATETIME2(0)   NOT NULL DEFAULT SYSDATETIME(),
    enviada_en    DATETIME2(0)   NULL
);
CREATE INDEX ix_notificaciones_estado ON notificaciones(estado);
GO

/* =====================================================================
   7. VISTAS
   ===================================================================== */
-- Costo de cada cita (consulta + exámenes + medicamentos entregados) y lo pagado a la fundación
CREATE VIEW v_deuda_fundacion_cita AS
SELECT c.id AS cita_id,
       s.residente_id,
       c.fecha_hora,
       c.monto AS costo_consulta,
       ISNULL(e.total, 0) AS costo_examenes,
       ISNULL(m.total, 0) AS costo_medicamentos,
       c.monto + ISNULL(e.total, 0) + ISNULL(m.total, 0) AS costo_total,
       ISNULL(p.total, 0) AS pagado,
       c.monto + ISNULL(e.total, 0) + ISNULL(m.total, 0) - ISNULL(p.total, 0) AS saldo,
       CASE WHEN ISNULL(p.total, 0) = 0 THEN 'Pendiente'
            WHEN ISNULL(p.total, 0) < c.monto + ISNULL(e.total, 0) + ISNULL(m.total, 0) THEN 'Parcial'
            ELSE 'Cancelada' END AS estado_pago
FROM citas_medicas c
JOIN solicitudes_medicas s ON s.id = c.solicitud_id
LEFT JOIN visitas_medicas v ON v.cita_id = c.id
LEFT JOIN (SELECT visita_id, SUM(monto) AS total FROM examenes_laboratorio
           WHERE estado = 'Completado' GROUP BY visita_id) e ON e.visita_id = v.id
LEFT JOIN (SELECT visita_id, SUM(monto) AS total FROM visita_medicamentos
           WHERE estado = 'Entregado' GROUP BY visita_id) m ON m.visita_id = v.id
LEFT JOIN (SELECT cita_id, SUM(monto) AS total FROM pagos_fundacion GROUP BY cita_id) p ON p.cita_id = c.id
WHERE c.estado <> 'Cancelada';
GO

-- Estado de cuenta del interno (cuenta del familiar responsable)
CREATE VIEW v_estado_cuenta AS
SELECT r.id AS residente_id,
       r.codigo,
       r.nombres + N' ' + r.apellidos AS residente,
       ISNULL(c.total, 0) AS total_cargos,
       ISNULL(p.total, 0) AS total_pagos,
       ISNULL(c.total, 0) - ISNULL(p.total, 0) AS saldo
FROM residentes r
LEFT JOIN (SELECT residente_id, SUM(monto) AS total FROM cargos GROUP BY residente_id) c ON c.residente_id = r.id
LEFT JOIN (SELECT residente_id, SUM(monto) AS total FROM pagos  GROUP BY residente_id) p ON p.residente_id = r.id;
GO

/* =====================================================================
   8. DATOS DE CATÁLOGO Y DE EJEMPLO
   ===================================================================== */
INSERT INTO roles (nombre, descripcion) VALUES
 (N'Administrador',      N'Gestiona usuarios, internos, caja, reportes y configuración'),
 (N'MedicoGeneral',      N'Médico del asilo: evalúa al interno y crea solicitudes a especialistas'),
 (N'MedicoEspecialista', N'Médico de la fundación: atiende la cita y registra la visita médica'),
 (N'Enfermeria',         N'Acompaña al interno a la cita y registra la aplicación de medicamentos'),
 (N'Fundacion',          N'Asigna horario y médico a las solicitudes; sin acceso a la ficha clínica'),
 (N'Laboratorio',        N'Registra los resultados de los exámenes asignados en la visita'),
 (N'Farmacia',           N'Entrega los medicamentos indicados en la visita'),
 (N'Familiar',           N'Consulta la cuenta y la información de su familiar');

INSERT INTO configuracion (clave, valor, descripcion) VALUES
 (N'descuento_consulta',    N'30', N'% de descuento de la fundación en consultas'),
 (N'descuento_laboratorio', N'25', N'% de descuento de la fundación en exámenes'),
 (N'descuento_farmacia',    N'20', N'% de descuento de la fundación en medicamentos'),
 (N'precio_consulta',       N'250.00', N'Precio normal de una consulta con especialista (Q)');

INSERT INTO especialidades (nombre) VALUES
 (N'Medicina general'), (N'Cardiología'), (N'Geriatría'), (N'Neurología'), (N'Psiquiatría'),
 (N'Traumatología'), (N'Oftalmología'), (N'Endocrinología'), (N'Odontología');

-- Médicos de la fundación (sin usuario; el seed vincula uno de ellos a un usuario de prueba)
INSERT INTO medicos (nombres, apellidos, colegiado, especialidad_id, tipo, telefono) VALUES
 (N'Lucía',   N'Ramírez', N'COL-11021', (SELECT id FROM especialidades WHERE nombre = N'Cardiología'),   'Especialista', N'55510001'),
 (N'Fernando',N'Castillo',N'COL-11022', (SELECT id FROM especialidades WHERE nombre = N'Geriatría'),     'Especialista', N'55510002'),
 (N'Marta',   N'Ochoa',   N'COL-11023', (SELECT id FROM especialidades WHERE nombre = N'Psiquiatría'),   'Especialista', N'55510003'),
 (N'Ricardo', N'Monzón',  N'COL-11024', (SELECT id FROM especialidades WHERE nombre = N'Endocrinología'),'Especialista', N'55510004');

INSERT INTO enfermeros (nombres, apellidos, telefono, turno) VALUES
 (N'Sandra', N'Pérez', N'55520001', 'Vespertino'),
 (N'Luis',   N'Ajú',   N'55520002', 'Nocturno');

INSERT INTO medicamentos (nombre, presentacion, concentracion, precio_unitario) VALUES
 (N'Metformina',   N'Tableta',  N'850 mg', 2.50),
 (N'Losartán',     N'Tableta',  N'50 mg',  3.00),
 (N'Acetaminofén', N'Tableta',  N'500 mg', 1.00),
 (N'Omeprazol',    N'Cápsula',  N'20 mg',  2.00),
 (N'Sertralina',   N'Tableta',  N'50 mg',  6.50),
 (N'Insulina NPH', N'Frasco',   N'100 UI/ml', 95.00),
 (N'Amoxicilina',  N'Cápsula',  N'500 mg', 2.75);
GO

/* =====================================================================
   9. Permisos del usuario de la aplicación (si ya existe el login)
   El login "asilo_app" se crea una sola vez (ver README); su contraseña
   no se escribe en este script.
   ===================================================================== */
IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'asilo_app')
BEGIN
    CREATE USER asilo_app FOR LOGIN asilo_app;
    ALTER ROLE db_datareader ADD MEMBER asilo_app;
    ALTER ROLE db_datawriter ADD MEMBER asilo_app;
    PRINT 'Permisos asignados al usuario asilo_app.';
END
ELSE
    PRINT 'AVISO: el login asilo_app no existe todavía. Créelo siguiendo el README.';
GO

PRINT 'Base de datos AsiloCabezaAlgodon (SIGEVAN v2.0) creada correctamente.';
