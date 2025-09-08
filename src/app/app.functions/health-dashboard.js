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
  
  // Deep sleep KPI (assuming quality "good" represents deep sleep - this may need adjustment)
  const currentDeepSleep = currentData.sleep ? 
    currentData.sleep.filter(s => s.quality === 'good').length * 2 / currentData.sleep.length * (currentTotalSleep || 0) : null;
  const previousDeepSleep = previousData.sleep ? 
    previousData.sleep.filter(s => s.quality === 'good').length * 2 / previousData.sleep.length * (previousTotalSleep || 0) : null;
  
  // Steps KPI (mock data for now since not in API spec)
  const currentSteps = 8500; // Mock average
  const previousSteps = 8200; // Mock average

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
      date: new Date(item.datetime).toISOString(),
      duration: item.duration,
      quality: item.quality
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  return {
    weightData: data.weight ? formatWeight(data.weight) : [],
    compositionData: data.weight ? formatComposition(data.weight) : [],
    sleepData: data.sleep ? formatSleep(data.sleep) : []
  };
}

exports.main = async (context = {}) => {
  try {
    // Use environment variables or fallback to mock API
    const firebaseApiUrl = process.env['LONVITAL_FIREBASE_API_URL'];
    const firebaseApiToken = process.env['LONVITAL_FIREBASE_API_TOKEN'];

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
    const userId = contact.properties.email || contact.properties.historia_clinica;
    
    if (!userId) {
      throw new Error('No se encontró email o historia clínica para el contacto');
    }

    const currentStart = context.parameters.currentStart;
    const currentEnd = context.parameters.currentEnd;
    const previousStart = context.parameters.previousStart;
    const previousEnd = context.parameters.previousEnd;

    // Parameters for Firebase API
    const baseParams = {
      key: firebaseApiToken,
      userEmail: contact.properties.email,
      userId: contact.properties.lonvital_app_uid || contact.properties.email,
      pageSize: 100
    };

    // Fetch current period data
    const currentDataPromises = [
      axios.get(`${firebaseApiUrl}/firebase_get-weight-registries`, {
        params: { ...baseParams, from: `${currentStart}T00:00:00.000Z`, to: `${currentEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${firebaseApiUrl}/firebase_get-sleep-registries`, {
        params: { ...baseParams, from: `${currentStart}T00:00:00.000Z`, to: `${currentEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${firebaseApiUrl}/firebase_get-waist-measurement`, {
        params: { ...baseParams, from: `${currentStart}T00:00:00.000Z`, to: `${currentEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${firebaseApiUrl}/firebase_get-health-analytics`, {
        params: { ...baseParams, from: `${currentStart}T00:00:00.000Z`, to: `${currentEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } }))
    ];

    // Fetch previous period data
    const previousDataPromises = [
      axios.get(`${firebaseApiUrl}/firebase_get-weight-registries`, {
        params: { ...baseParams, from: `${previousStart}T00:00:00.000Z`, to: `${previousEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${firebaseApiUrl}/firebase_get-sleep-registries`, {
        params: { ...baseParams, from: `${previousStart}T00:00:00.000Z`, to: `${previousEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${firebaseApiUrl}/firebase_get-waist-measurement`, {
        params: { ...baseParams, from: `${previousStart}T00:00:00.000Z`, to: `${previousEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } })),
      
      axios.get(`${firebaseApiUrl}/firebase_get-health-analytics`, {
        params: { ...baseParams, from: `${previousStart}T00:00:00.000Z`, to: `${previousEnd}T23:59:59.000Z` }
      }).catch(() => ({ data: { data: [] } }))
    ];

    // Execute all API calls
    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentDataPromises),
      Promise.all(previousDataPromises)
    ]);

    // Structure the data
    const currentData = {
      weight: currentResults[0].data.data || [],
      sleep: currentResults[1].data.data || [],
      waist: currentResults[2].data.data || [],
      analytics: currentResults[3].data.data || []
    };

    const previousData = {
      weight: previousResults[0].data.data || [],
      sleep: previousResults[1].data.data || [],
      waist: previousResults[2].data.data || [],
      analytics: previousResults[3].data.data || []
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
          { date: '2025-01-01T00:00:00Z', duration: 7.5, quality: 'good' },
          { date: '2025-01-02T00:00:00Z', duration: 6.8, quality: 'fair' },
          { date: '2025-01-03T00:00:00Z', duration: 8.2, quality: 'good' }
        ]
      },
      kpis: {
        weight: { current: 74.8, previous: 76.2, change: -1.8 },
        muscle: { current: 35.4, previous: 35.0, change: 1.1 },
        fat: { current: 15.4, previous: 16.1, change: -4.3 },
        totalSleep: { current: 7.5, previous: 7.2, change: 4.2 },
        deepSleep: { current: 2.8, previous: 2.5, change: 12.0 },
        steps: { current: 8500, previous: 8200, change: 3.7 }
      }
    };
  }
};
