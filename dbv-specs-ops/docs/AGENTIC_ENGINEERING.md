# 📖 Ingeniería Agéntica (Agentic Engineering): Principios de dbv-specs-ops v2.0.0

Este documento detalla los principios de diseño técnico y la filosofía detrás del desarrollo asistido por Inteligencia Artificial en **dbv-specs-ops v2.0.0**. Está basado en el marco de trabajo del libro blanco de Google *"The New SDLC With Vibe Coding"* (mayo de 2026).

---

## 🧭 1. El Espectro del Desarrollo con IA: Vibe Coding vs. Ingeniería Agéntica

El desarrollo de software con modelos de lenguaje (LLMs) se sitúa en un espectro que va desde la programación informal hasta la ingeniería rigurosa:

```
[ Vibe Coding ] ────────────── [ Structured Coding ] ────────────── [ Agentic Engineering ]
  - Prompting casual             - Prompts con ejemplos               - Especificaciones formales (SDD)
  - Validación visual            - Tests unitarios manuales           - Evals no deterministas automáticos
  - Deuda técnica alta           - Corrección guiada                  - Arnés agéntico completo
  - Alta velocidad inicial       - Riesgo moderado                    - Bajo coste marginal (OpEx) a escala
```

*   **Vibe Coding**: Caracterizado por dar instrucciones en lenguaje natural informal y aceptar el código generado sin una validación rigurosa. Cuando algo falla, se copia y pega el error de vuelta a la IA para que lo arregle. Es ideal para prototipos rápidos de fin de semana, pero es insostenible para sistemas de producción.
*   **Ingeniería Agéntica (Agentic Engineering)**: El desarrollo estructurado bajo un **Arnés (Harness)** estricto. La IA actúa como un motor de ejecución guiado por especificaciones de diseño previas y validado de manera automática mediante pruebas y rúbricas de evaluación (Evals).

---

## 🛠️ 2. La Ecuación del Agente: El Arnés (Harness)

Un modelo de lenguaje de última generación por sí mismo no es un agente de software. La efectividad de un agente en producción depende de la siguiente fórmula:

$$\text{Agente} = \text{Modelo (10\%)} + \text{Harness (90\%)} $$

El **Harness (Arnés)** es la infraestructura y las reglas que rodean al modelo para guiarlo hacia un comportamiento predecible y seguro. Sus componentes esenciales son:

1.  **Instrucciones y Reglas**: El rol, las directivas y los límites (ej. `MASTER_PROMPT.md`, `.windsurfrules`).
2.  **Contexto Estático y Dinámico (Context Engineering)**:
    *   *Contexto Estático*: Archivos de configuración cargados siempre al inicio (muy costosos en tokens, ej. `memory.md`).
    *   *Contexto Dinámico / Skills*: Paquetes de procedimientos cargados bajo demanda (`skills/`) que se inyectan en el prompt solo cuando la tarea coincide. Esto optimiza el consumo de tokens y la precisión de la IA.
3.  **Herramientas e Integraciones**: Conectores MCP (Model Context Protocol) para interactuar con bases de datos, APIs de Git o sistemas de archivos.
4.  **Sandbox**: Entornos virtuales de ejecución aislados (ej. `venv`, contenedores Docker) donde el agente puede ejecutar código y pruebas de manera segura.
5.  **Guardrails Deterministas**: Scripts y herramientas de seguridad (ej. linters de código, análisis de secretos) que verifican el trabajo del agente.

---

## 💵 3. La Economía del Desarrollo con IA: CapEx vs. OpEx

El desarrollo con IA altera profundamente el Coste Total de Propiedad (TCO) de los proyectos de software:

*   **El Costo Oculto del Vibe Coding (Bajo CapEx, Alto OpEx)**:
    *   El costo inicial de desarrollo es casi cero (sin planificación ni arquitectura previas).
    *   Sin embargo, el costo operativo (**OpEx**) se dispara debido al **Token Burn** (limites de contexto saturados por prompts mal optimizados y bucles infinitos de corrección de errores) y al **Maintenance Tax** (horas de desarrolladores humanos reverse-engineering "código espagueti" o solucionando fallos de seguridad).
*   **La Inversión de la Ingeniería Agéntica (Alto CapEx, Bajo OpEx)**:
    *   Requiere un esfuerzo inicial de diseño (escribir `SPECIFICATIONS.md` y configurar el arnés).
    *   El costo marginal de añadir nuevas características, refactorizar o desplegar disminuye radicalmente, ya que la IA opera en una "fábrica de código" estructurada y autogobernada con baja tasa de error.

---

## 🛡️ 4. Seguridad por Diseño (Security Guardrails)

El código generado por modelos de IA presenta riesgos de seguridad específicos que este framework mitiga activamente en la fase `/code-simplify`:

*   **Credential Leakage (Fugas de Secretos)**: Los agentes pueden accidentalmente dejar claves API, tokens o credenciales de staging escritas directamente en el código de forma hardcodeada.
*   **Dependency Hallucination / Slopsquatting**: Las IAs pueden sugerir bibliotecas o dependencias externas que no existen en los repositorios oficiales. Los atacantes pueden registrar estos nombres falsos (typosquatting) para inyectar malware en los servidores de compilación.
*   **Vulnerabilidades Lógicas**: Código que funciona pero introduce fallos de inyección SQL, desbordamientos de buffer o problemas de autorización de endpoints públicos.

**Estrategia de mitigación de dbv-specs-ops**: El agente debe auditar los commits, verificar que cada importación pertenezca a paquetes válidos y utilizar linters/analizadores automáticos integrados en el arnés.

---

## 🧪 5. Validación Unificada: Tests & Evals

En **dbv-specs-ops v2.0.0**, la fase de pruebas (`/test`) no solo abarca pruebas de código convencional, sino que unifica ambos mundos de validación:

### Pruebas Deterministas (Tests)
Verifican el comportamiento clásico del sistema:
*   *¿Compila el código?*
*   *¿El test unitario da verde?*
*   *¿Se cubren los caminos críticos de control?*

### Pruebas No Deterministas (Evals)
Verifican el comportamiento inteligente y probabilístico de la IA o pipelines generativos:
*   **Evaluación del Output**: Evaluar la calidad, el tono, la ausencia de alucinaciones y la conformidad de formato JSON/XML de una respuesta de IA mediante rúbricas automáticas o "Model Judges" (modelos evaluadores).
*   **Evaluación de la Trayectoria (Trajectory Eval)**: Auditar la secuencia de pasos que tomó el agente. No basta con que el código final sea correcto si para llegar a él la IA realizó 100 llamadas ineficientes a herramientas o consumió tokens excesivos en un bucle repetitivo.
