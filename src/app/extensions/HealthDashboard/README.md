# Dashboard General de Salud - HubSpot Custom Card

## Descripción

Este dashboard proporciona una vista completa y unificada de los datos de salud de los pacientes dentro de HubSpot CRM. Está diseñado para profesionales de la salud que necesitan analizar y monitorear la evolución de sus pacientes de manera integral.

## Características Principales

### 📊 KPIs con Filtros Temporales
- **Filtros predefinidos**: 15, 30, 60, y 90 días
- **Métricas monitoreadas**:
  - Tendencia de peso corporal
  - Tendencia de masa muscular
  - Tendencia de masa grasa
  - Patrones de sueño general
  - Calidad de sueño profundo
  - Promedio de pasos diarios
- **Comparación automática** con períodos anteriores equivalentes

### 📈 Visualizaciones Interactivas
- Gráficos de líneas para evolución del peso
- Gráficos de barras para patrones de sueño
- Gráficos de actividad física (pasos diarios)
- Indicadores de tendencia con códigos de color

### 🤖 Inteligencia Artificial Integrada

#### Resúmenes Automáticos
- **Resumen Actual**: Análisis del período seleccionado (15/30/60/90 días)
- **Resumen General**: Análisis completo del historial del paciente
- Generación automática usando OpenAI GPT-4
- Recomendaciones médicas personalizadas

#### Chat Interactivo con IA
- Consultas en tiempo real sobre datos del paciente
- Respuestas contextualizadas basadas en:
  - Información de registros HC
  - Datos de dispositivos (sueño, actividad, calorías)
  - Mediciones de cintura
  - Aplicaciones farmacológicas
  - Analíticas OCR
  - Información de peso y composición corporal

## Fuentes de Datos

El dashboard integra información de múltiples fuentes:

1. **Registros HC**: Información médica del historial clínico
2. **Dispositivos wearables**: 
   - Datos de sueño (duración, calidad, sueño profundo)
   - Actividad física (pasos, calorías)
   - Frecuencia cardíaca
3. **Mediciones manuales**:
   - Peso corporal
   - Composición corporal (masa muscular, masa grasa)
   - Medición de cintura
4. **Analíticas médicas**: Resultados de laboratorio procesados con OCR
5. **Aplicaciones farmacológicas**: Medicamentos y tratamientos

## Configuración Técnica

### Variables de Entorno Requeridas

```env
# API de Lonvital/Firebase
LONVITAL_FIREBASE_API_URL=https://api.lonvital.com/firebase
LONVITAL_FIREBASE_API_TOKEN=your_firebase_token

# OpenAI para funciones de IA
OPENAI_API_KEY=your_openai_api_key
```

### Funciones Serverless

1. **healthDashboard**: Obtiene y procesa datos de salud
2. **generateAISummary**: Genera resúmenes médicos con IA
3. **aiChat**: Maneja el chat interactivo con IA
4. **healthAnalytics**: Obtiene analíticas médicas
5. **weightRegistries**: Datos de peso y composición corporal
6. **sleepRegistries**: Datos de sueño
7. **waistMeasurement**: Mediciones de cintura

## Uso del Dashboard

### 1. Acceso
- Navega a la HC (Historia Clínica) del paciente en HubSpot
- Selecciona la pestaña "Dashboard General de Salud"

### 2. Selección de Período
- Usa el selector en la parte superior derecha
- Opciones: 15, 30, 60, o 90 días
- Los KPIs se actualizan automáticamente

### 3. Interpretación de KPIs
- **Verde**: Tendencia positiva o estable
- **Rojo**: Tendencia que requiere atención
- **Amarillo**: Cambios menores o neutros
- Los porcentajes muestran el cambio vs período anterior

### 4. Análisis con IA

#### Resúmenes Automáticos
1. Clic en "Resumen Actual" para análisis del período seleccionado
2. Clic en "Resumen General" para análisis del historial completo
3. El resumen se genera automáticamente y se muestra en un panel modal

#### Chat Interactivo
1. Clic en "🤖 Abrir Chat con IA"
2. Escribe preguntas específicas sobre los datos del paciente
3. Ejemplos de preguntas:
   - "¿Cómo ha evolucionado el peso en los últimos 30 días?"
   - "¿Hay alguna correlación entre el sueño y la actividad física?"
   - "¿Qué tendencias preocupantes observas en los datos?"
   - "Interpreta los resultados de la última analítica"

### 5. Visualizaciones
- Los gráficos son interactivos
- Pasa el cursor sobre los puntos para ver valores exactos
- Los gráficos se actualizan automáticamente con el período seleccionado

## Datos Mock y Desarrollo

Para facilitar el desarrollo y testing, el sistema incluye:
- Datos mock cuando las APIs no están disponibles
- Respuestas de IA de fallback
- Manejo graceful de errores de conectividad
- Alertas informativas para el usuario

## Estructura de Archivos

```
HealthDashboard/
├── HealthDashboard.jsx          # Componente principal
├── health-dashboard.json        # Configuración de la extensión
├── services/
│   ├── api.js                  # Servicio de API (opcional)
│   └── ai.js                   # Servicio de IA (opcional)
└── README.md                   # Esta documentación
```

## Mantenimiento y Soporte

### Logs y Debugging
- Los errores se registran en la consola del navegador
- Las funciones serverless incluyen logging detallado
- Los datos mock se activan automáticamente en caso de fallos de API

### Actualizaciones
- Las funciones de IA se pueden actualizar modificando los prompts en `generate-ai-summary.js` y `ai-chat.js`
- Los KPIs se pueden personalizar en la función `calculateKPIs`
- Los períodos de filtro se pueden modificar en `DATE_FILTER_OPTIONS`

### Troubleshooting

#### Dashboard no carga datos
1. Verificar variables de entorno en HubSpot
2. Comprobar conectividad con API de Lonvital
3. Revisar logs de funciones serverless

#### IA no responde
1. Verificar `OPENAI_API_KEY`
2. Comprobar cuota de OpenAI
3. Los fallbacks mock están disponibles automáticamente

#### Gráficos no se muestran
1. Verificar que hay datos en el período seleccionado
2. Comprobar formato de fechas en los datos
3. Revisar consola para errores de rendering

## Próximas Mejoras

- [ ] Exportación de reportes en PDF
- [ ] Alertas automáticas por umbrales
- [ ] Integración con calendarios médicos
- [ ] Dashboard comparativo entre pacientes
- [ ] Predicciones de tendencias con ML
- [ ] Integración con más dispositivos wearables

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2025  
**Soporte**: Contactar al equipo de desarrollo
