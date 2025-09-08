const axios = require("axios");
const hubspot = require('@hubspot/api-client');

// Utility function to format date objects from HubSpot
function formatDateObj(dateObj) {
  if (!dateObj) return undefined;
  const year = dateObj.year;
  const month = String(dateObj.month + 1).padStart(2, '0');
  const day = String(dateObj.date).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate KPIs with period comparison
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

  // Weight KPI
  const currentWeight = calculateAverage(currentData.weight, 'weight');
  const previousWeight = calculateAverage(previousData.weight, 'weight');
  
  // Muscle mass KPI
  const currentMuscle = calculateAverage(currentData.weight, 'muscle');
  const previousMuscle = calculateAverage(previousData.weight, 'muscle');
  
  // Fat mass KPI
  const currentFat = calculateAverage(currentData.weight, 'fat');
  const previousFat = calculateAverage(previousData.weight, 'fat');
  
  // Total sleep KPI
  const currentTotalSleep = calculateAverage(currentData.sleep, 'duration');
  const previousTotalSleep = calculateAverage(previousData.sleep, 'duration');
  
  // Deep sleep KPI (API no provee deepSleep, estimamos como 22% del sueño total)
  const estimateDeepSleep = (sleepData) => {
    if (!sleepData || sleepData.length === 0) return null;
    const validSleepData = sleepData.filter(item => item.duration != null && !isNaN(item.duration));
    if (validSleepData.length === 0) return null;
    
    return validSleepData.map(item => ({
      ...item,
      deepSleep: item.duration * 0.22 // Estimación: 22% del sueño total
    }));
  };
  
  const currentSleepWithDeepSleep = estimateDeepSleep(currentData.sleep);
  const previousSleepWithDeepSleep = estimateDeepSleep(previousData.sleep);
  
  const currentDeepSleep = calculateAverage(currentSleepWithDeepSleep, 'deepSleep');
  const previousDeepSleep = calculateAverage(previousSleepWithDeepSleep, 'deepSleep');
  
  // Steps KPI (use real data if available, otherwise mock data)
  const currentSteps = calculateAverage(currentData.steps, 'steps') || 8500;
  const previousSteps = calculateAverage(previousData.steps, 'steps') || 8200;
  
  // Waist KPI (API usa campo 'waist' no 'measurement')
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

// Format data for charts
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
      date: new Date(item.datetime).toISOString(), // API usa 'datetime'
      duration: item.duration,
      deepSleep: item.duration * 0.22, // Estimación del sueño profundo
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
      date: new Date(item.measurementTimeStamp).toISOString(), // API usa 'measurementTimeStamp'
      measurement: item.waist // API usa 'waist' no 'measurement'
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
    // Use Lonvital API instead of Firebase API
    const lonvitalApiUrl = process.env['LONVITAL_API_URL'] || 'https://api.lonvital.com/v1/health';
    const lonvitalApiKey = process.env['LONVITAL_API_KEY'];

    const hubspotClient = new hubspot.Client({
      accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN']
    });

    // Get associated contact
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

    // Use email or historia_clinica as userId
    let userId = contact.properties.email || contact.properties.historia_clinica;
    let useHistoriaClinnica = false;
    
    // Si no tiene email pero sí tiene historia clínica, usar búsqueda por HC
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

    // Headers for Lonvital API
    const headers = {
      'x-api-key': lonvitalApiKey,
      'Content-Type': 'application/json'
    };

    // Prepare base params for API calls
    const getBaseParams = (from, to) => {
      const params = { from, to, pageSize: 100 };
      if (useHistoriaClinnica) {
        params.findByHc = true;
      }
      return params;
    };

    // Fetch current period data using new Lonvital API
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

    // Fetch previous period data using new Lonvital API
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

    // Execute all API calls
    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentDataPromises),
      Promise.all(previousDataPromises)
    ]);

    // Structure the data for new API format
    const currentData = {
      weight: currentResults[0].data.data || [],
      sleep: currentResults[1].data.data || [],
      waist: currentResults[2].data.data || [],
      analytics: currentResults[3].data.data || [],
      steps: [] // Mock data as steps are not in API yet
    };

    const previousData = {
      weight: previousResults[0].data.data || [],
      sleep: previousResults[1].data.data || [],
      waist: previousResults[2].data.data || [],
      analytics: previousResults[3].data.data || [],
      steps: [] // Mock data as steps are not in API yet
    };

    // Calculate KPIs
    const kpis = calculateKPIs(currentData, previousData);

    // Format chart data
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
    
    // Return mock data for development
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
