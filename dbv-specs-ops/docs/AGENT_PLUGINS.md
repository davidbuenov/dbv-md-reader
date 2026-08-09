# 🤖 Guía de Integración de Agent Plugins 1.0.0

Esta guía técnica detalla cómo empaquetar, exponer y migrar herramientas (servidores MCP) y habilidades (*Agent Skills*) en tus proyectos bajo el estándar universal **Agent Plugins 1.0.0**.

---

## 📂 1. Estructura de un Agent Plugin

El estándar exige organizar los recursos en un directorio autocontenido con una estructura predecible:

```text
mi-proyecto/
└── .well-known/agent-plugin/    # Ruta recomendada para autodescubrimiento web
    ├── plugin.json              # Manifiesto principal del plugin (metadatos)
    ├── mcp.json                 # Descriptor de servidores MCP asociados
    ├── skills/                  # Directorio para colecciones de Agent Skills
    │   └── mi-habilidad/
    │       ├── SKILL.md         # Instrucciones de la habilidad (addyosmani/agent-skills)
    │       ├── scripts/         # Scripts auxiliares
    │       └── references/      # Ficheros de documentación de soporte
    └── com.ejemplo.cliente/     # Extensión específica para un cliente (opcional)
```

---

## 📄 2. El Manifiesto: `plugin.json`

El manifiesto `plugin.json` describe la identidad y versión del plugin. Su esquema es estricto y no admite campos de primer nivel fuera de la especificación.

### Ejemplo de `plugin.json`
```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "mi-proyecto-plugin",
  "version": "1.0.0",
  "description": "Herramientas de automatización de base de datos para agentes de IA",
  "author": {
    "name": "Nombre Autor",
    "email": "autor@ejemplo.com",
    "url": "https://miweb.com"
  },
  "homepage": "https://miweb.com/docs/plugin",
  "repository": "https://github.com/usuario/mi-proyecto",
  "license": "MIT",
  "keywords": ["database", "validation", "automation"],
  "extensions": {
    "com.ejemplo.cliente": {
      "setting": true
    }
  }
}
```

---

## 🔌 3. Descriptor de Herramientas: `mcp.json`

El descriptor `mcp.json` configura las herramientas a las que la IA puede acceder a través del protocolo MCP (Model Context Protocol). Admite servidores locales (`stdio`) y servidores remotos (`streamable-http` o `sse`).

### Ejemplo de `mcp.json`
```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "db-validator": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_ROOT}/bin/validator.js", "--data", "${PLUGIN_DATA}/cache"],
      "cwd": "${PLUGIN_ROOT}",
      "env": {
        "DB_PATH": "${PLUGIN_DATA}/prod.db"
      }
    },
    "external-api": {
      "type": "streamable-http",
      "url": "https://api.miweb.com/mcp",
      "headers": {
        "X-Tenant": "tenant-id"
      }
    }
  }
}
```

---

## 🔒 4. Variables de Entorno y Placeholders

Cuando un cliente de IA ejecuta un servidor MCP en modo `stdio`, garantiza el aislamiento inyectando dos variables de entorno reservadas y expandiéndolas en `args`, `cwd` y `env`:

1.  **`${PLUGIN_ROOT}`**: Se expande a la ruta absoluta donde reside el plugin. Sirve para hacer referencia a ficheros de código estáticos empaquetados en el plugin.
2.  **`${PLUGIN_DATA}`**: Se expande a un directorio persistente de escritura asignado por el cliente de IA (IDE, CLI). Sirve para instalar dependencias de runtime (ej: `node_modules`, `venv`), almacenar bases de datos temporales, cachés o ficheros de configuración dinámica.

---

## 🌐 5. Autodescubrimiento Web (Agent Readiness)

Si tu proyecto es un servicio web o API, puedes exponer tu plugin para que agentes inteligentes externos (ej: buscadores de IA, asistentes integrados en IDEs) lo descubran y consuman de forma autónoma.

### 1. Ubicación recomendada
Exponer la carpeta completa del plugin bajo la ruta:
```text
https://tuweb.com/.well-known/agent-plugin/
```

### 2. Inyección de Cabeceras HTTP
Configura tu servidor web (Firebase, Netlify, Nginx, FastAPI) para que inyecte la cabecera `Link` en la respuesta de las páginas principales:

```http
Link: </.well-known/agent-plugin/plugin.json>; rel="agent-plugin"; type="application/json"
```

### 3. Configuración de `robots.txt`
Asegúrate de que los agentes tienen permiso para leer la ruta en tu `robots.txt`:

```text
User-agent: *
Allow: /.well-known/agent-plugin/
```

---

## 🔄 6. Migración desde Formatos Antiguos

Si tu proyecto tiene implementaciones ad-hoc de skills (`agent-skills/`) o descripciones sueltas de bots (`agent.json`, `mcp.json` suelto en la raíz):

1.  **Crea la carpeta del plugin** en `.well-known/agent-plugin/` (para proyectos web) o en un subdirectorio dedicado `agent-plugin/` en la raíz.
2.  **Mueve los ficheros `SKILL.md`** y sus directorios de soporte (`scripts/`, `references/`) a la carpeta `skills/` del plugin.
3.  **Genera `plugin.json`** con el esquema 1.0.0 y el nombre de tu proyecto.
4.  **Integra las configuraciones MCP** en `mcp.json` sustituyendo las rutas absolutas antiguas por los placeholders `${PLUGIN_ROOT}` y `${PLUGIN_DATA}`.
5.  **Elimina los ficheros sueltos antiguos** para limpiar la raíz del proyecto.
