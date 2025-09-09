const axios = require("axios");
const hubspot = require('@hubspot/api-client');

// Integración con el chat de OpenAI para consultas médicas
async function chatWithOpenAI(message, patientData, chatHistory = []) {
  const openAiApiKey = process.env['OPENAI_API_KEY'];
  
  if (!openAiApiKey || openAiApiKey === 'mock-api-key') {
    const mockResponses = {
      'peso': 'Basado en los datos disponibles, el paciente muestra una tendencia estable en el peso con ligeras variaciones. Se recomienda continuar con el monitoreo regular.',
      'sueño': 'Los patrones de sueño del paciente indican una duración promedio adecuada. La calidad del sueño parece estar dentro de parámetros normales.',
      'tendencia': 'Las tendencias generales muestran una evolución positiva en las métricas de salud monitoreadas.',
      'default': 'Gracias por tu consulta. Basado en los datos del paciente, puedo ayudarte con análisis específicos sobre peso, sueño, composición corporal y tendencias generales. ¿Hay algún aspecto particular que te interese analizar?'
    };

    const lowerMessage = message.toLowerCase();
    for (const [key, response] of Object.entries(mockResponses)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }
    return mockResponses.default;
  }

  try {
    const systemPrompt = `Eres un asistente médico especializado que ayuda a profesionales de la salud (coaches, doctores, etc.) a analizar y entender los datos de salud de sus pacientes. 

Tienes acceso a los siguientes datos del paciente:
- Información personal: ${patientData.contact?.name || 'N/A'} (${patientData.contact?.email || 'N/A'})
- KPIs actuales: Peso: ${patientData.kpis?.weight?.current || 'N/A'} kg, Masa muscular: ${patientData.kpis?.muscle?.current || 'N/A'} kg, Masa grasa: ${patientData.kpis?.fat?.current || 'N/A'} kg
- Sueño promedio: ${patientData.kpis?.totalSleep?.current || 'N/A'} horas totales, ${patientData.kpis?.deepSleep?.current || 'N/A'} horas profundas
- Actividad: ${patientData.kpis?.steps?.current || 'N/A'} pasos promedio
- Tendencias: Los cambios porcentuales vs período anterior están disponibles para análisis

Instrucciones:
1. Responde de manera profesional y concisa
2. Basa tus respuestas en los datos disponibles
3. Si no tienes datos específicos, indícalo claramente
4. Proporciona insights útiles y recomendaciones cuando sea apropiado
5. Mantén un tono profesional pero accesible
6. Si la pregunta no está relacionada con salud, redirige amablemente al contexto médico

Responde siempre en español y limita tus respuestas a 200 palabras máximo.`;

    // Prepare messages array with chat history
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Agregamos el historial del chat pero solo los últimos 10 mensajes para no sobrepasar el límite de tokens
    const recentHistory = chatHistory.slice(-10);
    messages.push(...recentHistory);

    // Y por último agregamos el mensaje actual del usuario
    messages.push({ role: "user", content: message });

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4",
      messages: messages,
      max_tokens: 300,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error('Error calling OpenAI Chat API:', error);
    
    // Si falla la llamada a OpenAI, damos una respuesta genérica
    return 'Lo siento, no puedo procesar tu consulta en este momento. Por favor, inténtalo de nuevo más tarde. Mientras tanto, puedes revisar los KPIs y gráficos disponibles en el dashboard.';
  }
}

exports.main = async (context = {}) => {
  try {
    const hubspotClient = new hubspot.Client({
      accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN']
    });

    // Necesitamos el contacto para darle contexto a la IA sobre el paciente
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

    // Preparamos toda la información del paciente para que la IA entienda el contexto
    const patientData = {
      contact: {
        name: `${contact.properties.firstname} ${contact.properties.lastname}`,
        email: contact.properties.email,
        historia_clinica: contact.properties.historia_clinica
      },
      data: context.parameters.healthData?.data || {},
      kpis: context.parameters.healthData?.kpis || {}
    };

    // Obtenemos la respuesta de la IA con todos los datos del paciente
    const aiReply = await chatWithOpenAI(
      context.parameters.message,
      patientData,
      context.parameters.chatHistory || []
    );

    return {
      success: true,
      reply: aiReply,
      timestamp: new Date().toISOString(),
      patientName: patientData.contact.name
    };

  } catch (error) {
    console.error('Error in AI chat:', error);
    
    return {
      success: false,
      error: error.message,
      reply: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, inténtalo de nuevo.',
      timestamp: new Date().toISOString()
    };
  }
};
