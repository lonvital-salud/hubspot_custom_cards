# Dashboard de Salud General - HubSpot Extension

## Descripción
Dashboard integral de salud para la Historia Clínica (HC) en HubSpot, diseñado para coaches, doctores y profesionales de la salud. Proporciona una vista completa y fácil de entender de los datos de salud de los pacientes.

## Características Principales

### 1. KPIs con Comparación de Períodos
- **Tendencia de peso**: Seguimiento del peso corporal con comparación vs período anterior
- **Masa muscular**: Evolución de la masa muscular magra
- **Masa grasa**: Monitoreo de la composición grasa corporal
- **Sueño total**: Promedio de horas de sueño por noche
- **Sueño profundo**: Análisis de la calidad del sueño
- **Promedio de pasos**: Actividad física diaria

### 2. Filtros de Fecha Predefinidos
- Últimos 15 días
- Últimos 30 días
- Últimos 60 días
- Últimos 90 días

### 3. Visualizaciones Gráficas
- **Gráfico de línea**: Evolución del peso a lo largo del tiempo
- **Gráfico de composición corporal**: Masa muscular vs masa grasa
- **Gráfico de barras**: Análisis del sueño por día

### 4. Resúmenes con IA
- **Resumen actual**: Análisis del período seleccionado
- **Resumen general**: Análisis completo del historial del paciente
- Powered by OpenAI GPT-4

### 5. Chat con IA
- Consultas interactivas sobre el paciente
- Respuestas contextuales basadas en los datos de salud
- Historial de conversación mantenido durante la sesión

## APIs Integradas

### Lonvital API
- **Weight**: `/v1/health/weight/:userId`
- **Sleep**: `/v1/health/sleep/:userId`
- **Waist**: `/v1/health/waist/:userId`
- **Analytics**: `/v1/health/analytics/:userId`

### OpenAI API
- **Modelo**: GPT-4
- **Funcionalidades**: Resúmenes médicos y chat interactivo

## Estructura de Archivos

```
src/app/extensions/
├── HealthDashboard.jsx          # Componente principal del dashboard
├── health-dashboard.json        # Configuración de la card
└── HealthDashboard.README.md    # Esta documentación

src/app/app.functions/
├── health-dashboard.js          # Función para obtener y procesar datos de salud
├── generate-ai-summary.js       # Función para generar resúmenes con IA
├── ai-chat.js                   # Función para el chat con IA
└── serverless.json              # Configuración de funciones serverless
```

## Variables de Entorno Requeridas

```env
LONVITAL_API_URL=https://api.lonvital.com/v1/health
LONVITAL_API_KEY=your-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
PRIVATE_APP_ACCESS_TOKEN=your-hubspot-token-here
```

## Instalación y Despliegue

1. **Instalar dependencias**:
   ```bash
   cd src/app/app.functions
   npm install
   ```

2. **Configurar variables de entorno**:
   - Copia `example.env` a `.env`
   - Configura las API keys necesarias

3. **Desarrollo local**:
   ```bash
   hs project dev
   ```

4. **Despliegue**:
   ```bash
   hs project upload
   ```

## Uso

1. **Seleccionar período**: Elige uno de los filtros de fecha predefinidos
2. **Revisar KPIs**: Analiza las métricas clave con comparación de períodos
3. **Explorar gráficos**: Examina las tendencias visuales de los datos
4. **Generar resúmenes**: Usa los botones de IA para obtener análisis automáticos
5. **Consultar con IA**: Haz preguntas específicas sobre el paciente en el chat

## Consideraciones de Diseño

- **UX/UI**: Diseño limpio y organizado, priorizando la facilidad de navegación
- **Responsivo**: Adaptable a diferentes tamaños de pantalla
- **Accesible**: Componentes de HubSpot UI para garantizar accesibilidad
- **Performance**: Carga de datos optimizada con manejo de errores robusto

## Manejo de Errores

- Fallback a datos mock en caso de falla de API
- Mensajes de error claros para el usuario
- Logging detallado para debugging
- Reintentos automáticos para operaciones críticas

## Futuras Mejoras

- Integración con más fuentes de datos de salud
- Exportación de reportes en PDF
- Notificaciones automáticas para valores anómalos
- Dashboard personalizable por tipo de profesional
