const axios = require("axios");
const hubspot = require('@hubspot/api-client');
const OpenAI = require('openai');

// Integración con OpenAI para generar resúmenes médicos automáticos
async function generateSummaryWithOpenAI(patientData, summaryType, period = null) {
  const openAiApiKey = process.env['OPENAI_API_KEY'];
  const client = new OpenAI({ apiKey: openAiApiKey });

  if (!openAiApiKey || openAiApiKey === 'mock-api-key') {
    // Si no tenemos API key, devolvemos un resumen de ejemplo para que el equipo pueda probar
    return summaryType === 'current'
      ? `Resumen del período de ${period} días: El paciente muestra una tendencia positiva en su composición corporal, con una reducción del 1.8% en el peso corporal y un aumento del 1.1% en masa muscular. La calidad del sueño ha mejorado un 4.2%, manteniendo un promedio de 7.5 horas por noche. Se recomienda continuar con el plan actual.`
      : `Resumen general del historial: El paciente ha mostrado una evolución consistente en sus métricas de salud a lo largo del tiempo. Los datos indican una mejora gradual en la composición corporal y patrones de sueño estables. Se sugiere mantener el seguimiento regular y ajustar el plan según las tendencias observadas.`;
  }

  try {
    const systemPrompt = summaryType === 'current'
      ? `Eres un asistente médico especializado que analiza datos de salud de pacientes. Genera un resumen clínico conciso del período de ${period} días basado en los datos proporcionados. Enfócate en tendencias, cambios significativos y recomendaciones prácticas. Mantenlo dentro de un máximo de 450 palabras.`
      : `Eres un asistente médico especializado que analiza historiales completos de salud. Genera un resumen general del historial del paciente, identificando patrones a largo plazo, tendencias generales y recomendaciones para el seguimiento continuo. Mantenlo dentro de un máximo de 450 palabras.`;

    const userPrompt = `Datos del paciente:
    
Información del contacto: ${patientData.contact?.name || 'N/A'} (${patientData.contact?.email || 'N/A'})

KPIs del período:
- Peso: ${patientData.kpis?.weight?.current || 'N/A'} kg (cambio: ${patientData.kpis?.weight?.change || 'N/A'}%)
- Masa muscular: ${patientData.kpis?.muscle?.current || 'N/A'} kg (cambio: ${patientData.kpis?.muscle?.change || 'N/A'}%)
- Masa grasa: ${patientData.kpis?.fat?.current || 'N/A'} kg (cambio: ${patientData.kpis?.fat?.change || 'N/A'}%)
- Sueño total promedio: ${patientData.kpis?.totalSleep?.current || 'N/A'} minutos (cambio: ${patientData.kpis?.totalSleep?.change || 'N/A'}%)
- Sueño profundo promedio: ${patientData.kpis?.deepSleep?.current || 'N/A'} minutos (cambio: ${patientData.kpis?.deepSleep?.change || 'N/A'}%)
- Pasos promedio: ${patientData.kpis?.steps?.current || 'N/A'} (cambio: ${patientData.kpis?.steps?.change || 'N/A'}%)

Datos de evolución:
- Registros de peso: ${patientData.data?.weightData?.length || 0} mediciones
- Registros de sueño: ${patientData.data?.sleepData?.length || 0} registros
- Datos de composición corporal disponibles: ${patientData.data?.compositionData?.length > 0 ? 'Sí' : 'No'}

Por favor, proporciona un análisis profesional con recomendaciones específicas.`;

    const response = await client.responses.create({
      model: "gpt-4",
      background: true,
      max_output_tokens: 1000,
      temperature: 0.7,
      instructions: systemPrompt,
      input: userPrompt
    })

    return response.id;

  } catch (error) {
    console.error('Error calling OpenAI API:', error);

    // Si algo falla con OpenAI, usamos el resumen de ejemplo
    return summaryType === 'current'
      ? `Resumen del período de ${period} días: Basado en los datos disponibles, se observan tendencias en las métricas de salud del paciente. Se recomienda continuar con el monitoreo regular y consultar con el profesional de salud para ajustes en el plan de tratamiento.`
      : `Resumen general: El historial del paciente muestra datos de seguimiento de salud. Se sugiere mantener el registro continuo de métricas y realizar evaluaciones periódicas para optimizar el plan de salud.`;
  }
}

const pollForSummaryResponse = async (summaryRequestId) => {
  const openAiApiKey = process.env['OPENAI_API_KEY'];
  const client = new OpenAI({ apiKey: openAiApiKey });

  try {
    return response = await client.responses.retrieve(summaryRequestId);
  } catch (error) {
    console.error('Error polling OpenAI response:', error);
    return { status: 'error', error: error.message };
  }
}

const cancelSummaryRequest = async (summaryRequestId) => {
  const openAiApiKey = process.env['OPENAI_API_KEY'];
  const client = new OpenAI({ apiKey: openAiApiKey });

  try {
    await client.responses.cancel(summaryRequestId);
    return { success: true };
  } catch (error) {
    console.error('Error cancelling OpenAI response:', error);
    return { success: false, error: error.message };
  }
}

exports.main = async (context = {}) => {
  try {
    if (context.parameters.method === 'poll') {
      const summaryResponse = await pollForSummaryResponse(context.parameters.summaryRequestId);

      if (summaryResponse.status === 'completed') {
        return {
          success: true,
          summaryText: summaryResponse.output[0].content[0].text,
          status: 'completed'
        }
      } else if (summaryResponse.status === 'pending' || summaryResponse.status === 'in_progress' || summaryResponse.status === 'queued') {
        return {
          success: false,
          status: 'pending'
        }
      } else if (summaryResponse.status === 'incomplete') {
        return {
          success: false,
          status: 'error',
          error: summaryResponse.incomplete_details?.reason
        }
      } else {
        return {
          success: false,
          status: 'error',
          error: summaryResponse.error
        }
      }
    } else if (context.parameters.method === 'cancel') {
      const summaryCancel = await cancelSummaryRequest(context.parameters.summaryRequestId);
      return {
        success: true,
        message: 'La solicitud de resumen ha sido cancelada.'
      };
    } else {
      const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN']
      });

      // Obtenemos el contacto para tener más contexto sobre el paciente
      const response = await hubspotClient.crm.objects.associationsApi.getAll(
        context.parameters.objectType,
        context.parameters.objectId,
        'contacts'
      );

      const associatedContactId = response.results[0].id;
      const contact = await hubspotClient.crm.contacts.basicApi.getById(
        associatedContactId,
        ['firstname', 'lastname', 'email', 'historia_clinica']
      );

      // Preparamos todos los datos del paciente para que la IA los pueda analizar bien
      const patientData = {
        contact: {
          name: `${contact.properties.firstname} ${contact.properties.lastname}`,
          email: contact.properties.email,
          historia_clinica: contact.properties.historia_clinica
        },
        data: context.parameters.healthData?.data || {},
        kpis: context.parameters.healthData?.kpis || {},
        period: context.parameters.period
      };

      // Generamos el resumen con IA usando todos los datos que preparamos
      const summaryRequest = await generateSummaryWithOpenAI(
        patientData,
        context.parameters.summaryType,
        context.parameters.period
      );

      return {
        success: true,
        summaryRequest: summaryRequest,
        summaryType: context.parameters.summaryType,
        period: context.parameters.period,
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    console.error('Error generating AI summary:', error);

    return {
      success: false,
      status: 'error',
      error: error.message,
      summaryRequest: null,
      summaryType: context.parameters.summaryType
    };
  }
};
