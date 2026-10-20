# Diagramas UML de SIGEVAN

Diagramas hechos con [PlantUML](https://plantuml.com). Cada archivo `.puml` es el código fuente y junto a él está la imagen generada (`.png` y `.svg`).

| Archivo | Diagrama |
|---------|----------|
| `01-casos-de-uso.puml` | Casos de uso: 8 actores y sus casos |
| `02-actividad-flujo-medico.puml` | Actividad por carriles: de la solicitud a la visita |
| `03-secuencia-solicitud.puml` | Secuencia: crear solicitud y avisar al familiar |
| `04-secuencia-visita.puml` | Secuencia: visita con examen, medicamento y cierre |
| `05-secuencia-cargo-pago.puml` | Secuencia: cargo con descuento y pago |
| `06-clases.puml` | Clases del dominio |
| `07-estados.puml` | Estados de la solicitud, la visita y el cargo |
| `08-modelo-er.puml` | Modelo entidad-relación de las 24 tablas, generado desde `database/script.sql` |

Para regenerar las imágenes (requiere Java):

```bash
java -jar plantuml.jar -charset UTF-8 -tpng -tsvg docs/uml/*.puml
```

También se pueden abrir en línea en https://www.plantuml.com/plantuml pegando el contenido de un `.puml`.
