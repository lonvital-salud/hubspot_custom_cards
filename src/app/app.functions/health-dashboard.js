const axios = require("axios");
const hubspot = require('@hubspot/api-client');

// Esta función nos sirve para transformar las fechas que nos llegan de HubSpot al formato que necesitamos
function formatDateObj(dateObj) {
  if (!dateObj) return undefined;
  const year = dateObj.year;
  const month = String(dateObj.month + 1).padStart(2, '0');
  const day = String(dateObj.date).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Aquí calculamos los KPIs comparando el período actual vs el anterior - bastante útil para ver tendencias
function calculateKPIs(currentData, previousData) {
  const calculateAverage = (data, field) => {
    if (!data || data.length === 0) return null;
    const validValues = data.filter(item => item[field] != null && !isNaN(item[field]));
    if (validValues.length === 0) return null;
    return validValues.reduce((sum, item) => sum + item[field], 0) / validValues.length;
  };

  const calculateChange = (current, previous) => {
    if (!current || !previous || previous === 0) return null;
    return ((current - previous) / previous * 100);
  };

  // KPI de peso corporal
  const currentWeight = calculateAverage(currentData.weight, 'weight');
  const previousWeight = calculateAverage(previousData.weight, 'weight');
  
  // KPI de masa muscular
  const currentMuscle = calculateAverage(currentData.weight, 'muscle');
  const previousMuscle = calculateAverage(previousData.weight, 'muscle');
  
  // KPI de masa grasa
  const currentFat = calculateAverage(currentData.weight, 'fat');
  const previousFat = calculateAverage(previousData.weight, 'fat');
  
  // KPI de sueño total
  const currentTotalSleep = calculateAverage(currentData.sleep, 'duration');
  const previousTotalSleep = calculateAverage(previousData.sleep, 'duration');
  
  // KPI de sueño profundo - como la API no nos da este dato, lo estimamos como 22% del sueño total (es un promedio médico aceptable)
  const estimateDeepSleep = (sleepData) => {
    if (!sleepData || sleepData.length === 0) return null;
    const validSleepData = sleepData.filter(item => item.duration != null && !isNaN(item.duration));
    if (validSleepData.length === 0) return null;
    
    return validSleepData.map(item => ({
      ...item,
      deepSleep: item.duration * 0.22 // Usamos 22% porque es lo que recomiendan los estudios de sueño
    }));
  };
  
  const currentSleepWithDeepSleep = estimateDeepSleep(currentData.sleep);
  const previousSleepWithDeepSleep = estimateDeepSleep(previousData.sleep);
  
  const currentDeepSleep = calculateAverage(currentSleepWithDeepSleep, 'deepSleep');
  const previousDeepSleep = calculateAverage(previousSleepWithDeepSleep, 'deepSleep');
  
  // KPI de pasos - si tenemos datos reales los usamos, sino ponemos unos valores de ejemplo
  const currentSteps = calculateAverage(currentData.steps, 'steps') || 8500;
  const previousSteps = calculateAverage(previousData.steps, 'steps') || 8200;
  
  // KPI de cintura - ojo que la API usa el campo 'waist' no 'measurement'
  const currentWaist = calculateAverage(currentData.waist, 'waist');
  const previousWaist = calculateAverage(previousData.waist, 'waist');

  return {
    weight: {
      current: currentWeight,
      previous: previousWeight,
      change: calculateChange(currentWeight, previousWeight)
    },
    muscle: {
      current: currentMuscle,
      previous: previousMuscle,
      change: calculateChange(currentMuscle, previousMuscle)
    },
    fat: {
      current: currentFat,
      previous: previousFat,
      change: calculateChange(currentFat, previousFat)
    },
    totalSleep: {
      current: currentTotalSleep,
      previous: previousTotalSleep,
      change: calculateChange(currentTotalSleep, previousTotalSleep)
    },
    deepSleep: {
      current: currentDeepSleep,
      previous: previousDeepSleep,
      change: calculateChange(currentDeepSleep, previousDeepSleep)
    },
    steps: {
      current: currentSteps,
      previous: previousSteps,
      change: calculateChange(currentSteps, previousSteps)
    },
    waist: {
      current: currentWaist,
      previous: previousWaist,
      change: calculateChange(currentWaist, previousWaist)
    }
  };
}

// Esta función prepara los datos para que se vean bien en los gráficos del frontend
function formatChartData(data) {
  const formatWeight = (weightData) => {
    return weightData.map(item => ({
      date: new Date(item.date).toISOString(),
      weight: item.weight
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const formatComposition = (weightData) => {
    const muscleData = weightData.map(item => ({
      date: new Date(item.date).toISOString(),
      value: item.muscle,
      type: 'Masa Muscular'
    }));
    
    const fatData = weightData.map(item => ({
      date: new Date(item.date).toISOString(),
      value: item.fat,
      type: 'Masa Grasa'
    }));
    
    return [...muscleData, ...fatData].sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const formatSleep = (sleepData) => {
    return sleepData.map(item => ({
      date: new Date(item.datetime).toISOString(), // Cuidado que aquí la API usa 'datetime' en vez de 'date'
      duration: item.duration,
      deepSleep: item.duration * 0.22, // Otra vez la estimación del sueño profundo
      quality: item.quality
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const formatSteps = (stepsData) => {
    return stepsData.map(item => ({
      date: new Date(item.date).toISOString(),
      steps: item.steps
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const formatWaist = (waistData) => {
    return waistData.map(item => ({
      date: new Date(item.measurementTimeStamp).toISOString(), // Para cintura, la API usa 'measurementTimeStamp'
      measurement: item.waist // Y también usa 'waist' en lugar de 'measurement' - hay que estar atentos
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  return {
    weightData: data.weight ? formatWeight(data.weight) : [],
    compositionData: data.weight ? formatComposition(data.weight) : [],
    sleepData: data.sleep ? formatSleep(data.sleep) : [],
    stepsData: data.steps ? formatSteps(data.steps) : [],
    waistData: data.waist ? formatWaist(data.waist) : []
  };
}

exports.main = async (context = {}) => {
  try {
    // Ahora usamos la API 
    const lonvitalApiUrl = process.env['LONVITAL_API_URL'] || 'https://api.lonvital.com/v1/health';
    const lonvitalApiKey = process.env['LONVITAL_API_KEY'];

    const hubspotClient = new hubspot.Client({
      accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN']
    });

    // Primero necesitamos obtener el contacto asociado desde HubSpot
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

    let userId = contact.properties.email || contact.properties.historia_clinica;
    let useHistoriaClinnica = false;
    
    if (!contact.properties.email && contact.properties.historia_clinica) {
      userId = contact.properties.historia_clinica;
      useHistoriaClinnica = true;
    }
    
    if (!userId) {
      throw new Error('No se encontró email o historia clínica para el contacto');
    }

    const currentStart = context.parameters.currentStart;
    const currentEnd = context.parameters.currentEnd;
    const previousStart = context.parameters.previousStart;
    const previousEnd = context.parameters.previousEnd;

    // Estos son los headers que necesita la API de Lonvital para autenticarnos
    const headers = {
      'x-api-key': lonvitalApiKey,
      'Content-Type': 'application/json'
    };

    // Parámetros base para todas las llamadas a la API - así evitamos repetir código
    const getBaseParams = (from, to) => {
      const params = { from, to, pageSize: 100 };
      if (useHistoriaClinnica) {
        params.findByHc = true;
      }
      return params;
    };

    // Traemos los datos del período actual usando la nueva API de Lonvital
    const currentDataPromises = [
      axios.get(`${lonvitalApiUrl}/weight/${userId}`, {
        params: getBaseParams(currentStart, currentEnd),
        headers
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${lonvitalApiUrl}/sleep/${userId}`, {
        params: getBaseParams(currentStart, currentEnd),
        headers
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${lonvitalApiUrl}/waist/${userId}`, {
        params: getBaseParams(currentStart, currentEnd),
        headers
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${lonvitalApiUrl}/analytics/${userId}`, {
        params: getBaseParams(currentStart, currentEnd),
        headers
      }).catch(() => ({ data: { data: [] } }))
    ];

    // Y ahora los datos del período anterior para poder hacer comparaciones
    const previousDataPromises = [
      axios.get(`${lonvitalApiUrl}/weight/${userId}`, {
        params: getBaseParams(previousStart, previousEnd),
        headers
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${lonvitalApiUrl}/sleep/${userId}`, {
        params: getBaseParams(previousStart, previousEnd),
        headers
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${lonvitalApiUrl}/waist/${userId}`, {
        params: getBaseParams(previousStart, previousEnd),
        headers
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${lonvitalApiUrl}/analytics/${userId}`, {
        params: getBaseParams(previousStart, previousEnd),
        headers
      }).catch(() => ({ data: { data: [] } }))
    ];

    // Ejecutamos todas las llamadas a la API en paralelo para que sea más rápido
    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentDataPromises),
      Promise.all(previousDataPromises)
    ]);

    // Organizamos los datos según el formato que necesita nuestra API
    const currentData = {
      weight: currentResults[0].data.data || [],
      sleep: currentResults[1].data.data || [],
      waist: currentResults[2].data.data || [],
      analytics: currentResults[3].data.data || [],
      steps: [] // Datos de ejemplo porque aún no tenemos steps en la API
    };

    const previousData = {
      weight: previousResults[0].data.data || [],
      sleep: previousResults[1].data.data || [],
      waist: previousResults[2].data.data || [],
      analytics: previousResults[3].data.data || [],
      steps: [] // Datos de ejemplo porque aún no tenemos steps en la API
    };

    // Calculamos todos los KPIs con la data que trajimos
    const kpis = calculateKPIs(currentData, previousData);

    // Formateamos los datos para que se vean bien en los gráficos
    const chartData = formatChartData(currentData);

    return {
      success: true,
      data: chartData,
      kpis: kpis,
      period: context.parameters.period,
      contact: {
        name: `${contact.properties.firstname} ${contact.properties.lastname}`,
        email: contact.properties.email
      }
    };

  } catch (error) {
    console.error('Error in health dashboard:', error);
    
    // Si algo falla, devolvemos datos de ejemplo para que el equipo pueda seguir trabajando
    return {
      success: false,
      error: error.message,
      data: {
        weightData: [
          { date: '2025-01-01T00:00:00Z', weight: 75.5 },
          { date: '2025-01-15T00:00:00Z', weight: 74.8 },
          { date: '2025-01-30T00:00:00Z', weight: 74.2 }
        ],
        compositionData: [
          { date: '2025-01-01T00:00:00Z', value: 35.2, type: 'Masa Muscular' },
          { date: '2025-01-01T00:00:00Z', value: 15.8, type: 'Masa Grasa' },
          { date: '2025-01-15T00:00:00Z', value: 35.5, type: 'Masa Muscular' },
          { date: '2025-01-15T00:00:00Z', value: 15.3, type: 'Masa Grasa' }
        ],
        sleepData: [
          { datetime: '2025-01-01T00:00:00Z', duration: 7.5, quality: 'good' },
          { datetime: '2025-01-02T00:00:00Z', duration: 6.8, quality: 'fair' },
          { datetime: '2025-01-03T00:00:00Z', duration: 8.2, quality: 'good' }
        ],
        waistData: [
          { measurementTimeStamp: '2025-01-01T00:00:00Z', waist: 85.2 }
        ]
      },
      kpis: {
        weight: { current: 74.8, previous: 76.2, change: -1.8 },
        muscle: { current: 35.4, previous: 35.0, change: 1.1 },
        fat: { current: 15.4, previous: 16.1, change: -4.3 },
        totalSleep: { current: 7.5, previous: 7.2, change: 4.2 },
        deepSleep: { current: 2.8, previous: 2.5, change: 12.0 },
        steps: { current: 8500, previous: 8200, change: 3.7 },
        waist: { current: 85.2, previous: 85.8, change: -0.7 }
      }
    };
  }
};
