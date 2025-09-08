/**
 * OpenAI AI Service
 * Servicio para generar resúmenes médicos usando OpenAI GPT-4
 */

/**
 * Genera un resumen médico usando OpenAI
 */
export async function generateMedicalSummary(patientData, summaryType = 'current', dateRange = null) {
  try {
    // Preparar el contexto del paciente
    const context = preparePatientContext(patientData, summaryType, dateRange);
    
    // Configurar el prompt según el tipo de resumen
    const systemPrompt = getSystemPrompt(summaryType);
    const userPrompt = getUserPrompt(context, summaryType, dateRange);

    // Llamada a la función serverless que maneja OpenAI
    const response = await hubspot.serverless('generateAISummary', {
      propertiesToSend: ['hs_object_id'],
      parameters: {
        summaryType,
        period: dateRange ? dateRange.label.match(/\d+/)[0] : null,
        healthData: {
          data: patientData,
          kpis: context
        }
      }
    });

    if (response && response.summary) {
      return {
        success: true,
        summary: response.summary,
        type: summaryType,
        dateRange: dateRange
      };
    } else {
      throw new Error('No se recibió respuesta válida del servicio de IA');
    }

  } catch (error) {
    console.error('Error generating AI summary:', error);
    return {
      success: false,
      error: error.message,
      summary: getFallbackSummary(summaryType)
    };
  }
}

/**
 * Prepara el contexto del paciente para el análisis de IA
 */
function preparePatientContext(patientData, summaryType, dateRange) {
  const context = {
    dateRange: dateRange,
    summaryType: summaryType,
    data: {}
  };

  // Datos de peso y composición corporal
  if (patientData.weight && patientData.weight.length > 0) {
    const weightStats = calculateStats(patientData.weight, 'weight');
    const muscleStats = calculateStats(patientData.weight, 'muscle');
    const fatStats = calculateStats(patientData.weight, 'fat');
    
    context.data.weight = {
      current: weightStats.average,
      trend: weightStats.trend,
      min: weightStats.min,
      max: weightStats.max,
      records: patientData.weight.length
    };
    
    context.data.muscle = {
      current: muscleStats.average,
      trend: muscleStats.trend,
      min: muscleStats.min,
      max: muscleStats.max
    };
    
    context.data.fat = {
      current: fatStats.average,
      trend: fatStats.trend,
      min: fatStats.min,
      max: fatStats.max
    };
  }

  // Datos de sueño
  if (patientData.sleep && patientData.sleep.length > 0) {
    const sleepStats = calculateStats(patientData.sleep, 'duration');
    const deepSleepStats = calculateStats(patientData.sleep, 'deepSleep');
    
    context.data.sleep = {
      averageDuration: sleepStats.average,
      averageDeepSleep: deepSleepStats.average,
      sleepTrend: sleepStats.trend,
      deepSleepTrend: deepSleepStats.trend,
      records: patientData.sleep.length,
      qualityDistribution: getQualityDistribution(patientData.sleep)
    };
  }

  // Datos de pasos/actividad
  if (patientData.steps && patientData.steps.length > 0) {
    const stepsStats = calculateStats(patientData.steps, 'steps');
    
    context.data.activity = {
      averageSteps: stepsStats.average,
      stepsTrend: stepsStats.trend,
      min: stepsStats.min,
      max: stepsStats.max,
      records: patientData.steps.length
    };
  }

  // Datos de cintura
  if (patientData.waist && patientData.waist.length > 0) {
    const waistStats = calculateStats(patientData.waist, 'measurement');
    
    context.data.waist = {
      current: waistStats.average,
      trend: waistStats.trend,
      min: waistStats.min,
      max: waistStats.max,
      records: patientData.waist.length
    };
  }

  // Datos de analíticas
  if (patientData.analytics && patientData.analytics.length > 0) {
    context.data.analytics = {
      totalTests: patientData.analytics.length,
      testTypes: [...new Set(patientData.analytics.map(a => a.type))],
      recentTests: patientData.analytics.slice(0, 3).map(a => ({
        date: a.date,
        type: a.type,
        markersCount: a.markers ? a.markers.length : 0
      }))
    };
  }

  return context;
}

/**
 * Calcula estadísticas básicas para un campo de datos
 */
function calculateStats(data, field) {
  if (!data || data.length === 0) return null;
  
  const values = data.map(item => item[field]).filter(val => val != null && !isNaN(val));
  if (values.length === 0) return null;
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  const average = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // Calcular tendencia simple (comparar primera mitad vs segunda mitad)
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  
  const firstAvg = firstHalf.reduce((acc, val) => acc + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((acc, val) => acc + val, 0) / secondHalf.length;
  
  let trend = 'stable';
  if (secondAvg > firstAvg * 1.02) trend = 'increasing';
  else if (secondAvg < firstAvg * 0.98) trend = 'decreasing';
  
  return {
    average: Math.round(average * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    trend
  };
}

/**
 * Obtiene la distribución de calidad de sueño
 */
function getQualityDistribution(sleepData) {
  const distribution = {};
  sleepData.forEach(sleep => {
    const quality = sleep.quality || 'unknown';
    distribution[quality] = (distribution[quality] || 0) + 1;
  });
  return distribution;
}

/**
 * Obtiene el prompt del sistema según el tipo de resumen
 */
function getSystemPrompt(summaryType) {
  const basePrompt = `Eres un asistente médico especializado que analiza datos de salud y bienestar. 
Tu tarea es generar resúmenes claros, profesionales y útiles para profesionales de la salud.

Instrucciones importantes:
- Usa terminología médica apropiada pero accesible
- Destaca tendencias significativas y patrones relevantes
- Proporciona insights accionables cuando sea posible
- Menciona cualquier valor que pueda requerir atención médica
- Mantén un tono profesional pero empático
- Estructura la información de manera clara y organizada`;

  if (summaryType === 'current') {
    return `${basePrompt}

Para este resumen del período específico, enfócate en:
- Análisis de los datos del período seleccionado
- Comparación con valores de referencia normales
- Identificación de tendencias dentro del período
- Recomendaciones específicas para el período analizado`;
  } else {
    return `${basePrompt}

Para este resumen general del historial completo, enfócate en:
- Análisis de tendencias a largo plazo
- Evolución general de la salud del paciente
- Patrones estacionales o cíclicos
- Progreso hacia objetivos de salud
- Recomendaciones para seguimiento a largo plazo`;
  }
}

/**
 * Genera el prompt del usuario con los datos del paciente
 */
function getUserPrompt(context, summaryType, dateRange) {
  let prompt = '';
  
  if (summaryType === 'current' && dateRange) {
    prompt += `Analiza los datos de salud del paciente para el período: ${dateRange.label} (${dateRange.startDate} a ${dateRange.endDate})\n\n`;
  } else {
    prompt += `Analiza el historial completo de datos de salud del paciente:\n\n`;
  }

  // Datos de peso y composición corporal
  if (context.data.weight) {
    prompt += `PESO Y COMPOSICIÓN CORPORAL:\n`;
    prompt += `- Peso promedio: ${context.data.weight.current} kg (rango: ${context.data.weight.min}-${context.data.weight.max} kg)\n`;
    prompt += `- Tendencia: ${context.data.weight.trend}\n`;
    if (context.data.muscle) {
      prompt += `- Masa muscular promedio: ${context.data.muscle.current} kg\n`;
      prompt += `- Tendencia masa muscular: ${context.data.muscle.trend}\n`;
    }
    if (context.data.fat) {
      prompt += `- Masa grasa promedio: ${context.data.fat.current} kg\n`;
      prompt += `- Tendencia masa grasa: ${context.data.fat.trend}\n`;
    }
    prompt += `- Registros analizados: ${context.data.weight.records}\n\n`;
  }

  // Datos de sueño
  if (context.data.sleep) {
    prompt += `PATRONES DE SUEÑO:\n`;
    prompt += `- Duración promedio: ${context.data.sleep.averageDuration} horas\n`;
    prompt += `- Tendencia duración: ${context.data.sleep.sleepTrend}\n`;
    if (context.data.sleep.averageDeepSleep) {
      prompt += `- Sueño profundo promedio: ${context.data.sleep.averageDeepSleep} horas\n`;
      prompt += `- Tendencia sueño profundo: ${context.data.sleep.deepSleepTrend}\n`;
    }
    prompt += `- Distribución de calidad: ${JSON.stringify(context.data.sleep.qualityDistribution)}\n`;
    prompt += `- Registros analizados: ${context.data.sleep.records}\n\n`;
  }

  // Datos de actividad física
  if (context.data.activity) {
    prompt += `ACTIVIDAD FÍSICA:\n`;
    prompt += `- Pasos promedio diarios: ${context.data.activity.averageSteps}\n`;
    prompt += `- Tendencia: ${context.data.activity.stepsTrend}\n`;
    prompt += `- Rango: ${context.data.activity.min}-${context.data.activity.max} pasos\n`;
    prompt += `- Registros analizados: ${context.data.activity.records}\n\n`;
  }

  // Datos de cintura
  if (context.data.waist) {
    prompt += `MEDICIÓN DE CINTURA:\n`;
    prompt += `- Medida promedio: ${context.data.waist.current} cm\n`;
    prompt += `- Tendencia: ${context.data.waist.trend}\n`;
    prompt += `- Rango: ${context.data.waist.min}-${context.data.waist.max} cm\n`;
    prompt += `- Registros analizados: ${context.data.waist.records}\n\n`;
  }

  // Datos de analíticas
  if (context.data.analytics) {
    prompt += `ANALÍTICAS CLÍNICAS:\n`;
    prompt += `- Total de exámenes: ${context.data.analytics.totalTests}\n`;
    prompt += `- Tipos de exámenes: ${context.data.analytics.testTypes.join(', ')}\n`;
    prompt += `- Exámenes recientes: ${JSON.stringify(context.data.analytics.recentTests)}\n\n`;
  }

  prompt += `Por favor, proporciona un resumen médico profesional de estos datos, destacando:\n`;
  prompt += `1. Estado general de salud\n`;
  prompt += `2. Tendencias significativas\n`;
  prompt += `3. Áreas de preocupación (si las hay)\n`;
  prompt += `4. Recomendaciones específicas\n`;
  prompt += `5. Próximos pasos sugeridos\n`;

  return prompt;
}

/**
 * Proporciona un resumen de fallback en caso de error
 */
function getFallbackSummary(summaryType) {
  if (summaryType === 'current') {
    return `Resumen del período seleccionado: Los datos están siendo procesados. 
    Por favor, inténtelo nuevamente en unos momentos. Si el problema persiste, 
    contacte con el soporte técnico para revisar la conectividad con los servicios de IA.`;
  } else {
    return `Resumen general del historial: Los datos históricos están siendo procesados. 
    Por favor, inténtelo nuevamente en unos momentos. Si el problema persiste, 
    contacte con el soporte técnico para revisar la conectividad con los servicios de IA.`;
  }
}

/**
 * Formatea la respuesta de IA para mostrar en la interfaz
 */
export function formatAISummary(aiResponse) {
  if (!aiResponse || !aiResponse.success) {
    return {
      title: 'Error en el Resumen',
      content: aiResponse?.summary || 'No se pudo generar el resumen en este momento.',
      type: 'error'
    };
  }

  const titleMap = {
    current: 'Resumen del Período Actual',
    general: 'Resumen General del Historial'
  };

  return {
    title: titleMap[aiResponse.type] || 'Resumen de Salud',
    content: aiResponse.summary,
    type: 'success',
    dateRange: aiResponse.dateRange
  };
}
