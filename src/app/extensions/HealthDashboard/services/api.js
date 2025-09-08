/**
 * Lonvital API Service
 * Wrapper para la API de Lonvital con manejo de errores y datos mock
 */

const LONVITAL_API_BASE = 'https://api.lonvital.com/v1/health';
const API_KEY = process.env.LONVITAL_FIREBASE_API_TOKEN || 'mock-api-key';

// Datos mock para desarrollo/fallback
const MOCK_DATA = {
  weight: [
    { date: '2024-01-01', weight: 70.5, muscle: 35.2, fat: 15.8 },
    { date: '2024-01-02', weight: 70.3, muscle: 35.1, fat: 15.9 },
    { date: '2024-01-03', weight: 70.1, muscle: 35.0, fat: 16.0 },
    { date: '2024-01-04', weight: 69.8, muscle: 34.9, fat: 16.1 },
    { date: '2024-01-05', weight: 69.6, muscle: 34.8, fat: 16.2 }
  ],
  sleep: [
    { date: '2024-01-01', duration: 7.5, deepSleep: 2.1, quality: 'good' },
    { date: '2024-01-02', duration: 8.0, deepSleep: 2.3, quality: 'excellent' },
    { date: '2024-01-03', duration: 6.8, deepSleep: 1.9, quality: 'fair' },
    { date: '2024-01-04', duration: 7.2, deepSleep: 2.0, quality: 'good' },
    { date: '2024-01-05', duration: 7.8, deepSleep: 2.2, quality: 'good' }
  ],
  waist: [
    { date: '2024-01-01', measurement: 85.2 },
    { date: '2024-01-02', measurement: 85.0 },
    { date: '2024-01-03', measurement: 84.8 },
    { date: '2024-01-04', measurement: 84.5 },
    { date: '2024-01-05', measurement: 84.3 }
  ],
  analytics: [
    {
      id: '1',
      date: '2024-01-01',
      type: 'blood_test',
      markers: [
        { name: 'Glucose', value: 95, unit: 'mg/dL', reference: '70-100' },
        { name: 'Cholesterol', value: 180, unit: 'mg/dL', reference: '<200' }
      ]
    }
  ],
  steps: [
    { date: '2024-01-01', steps: 8500 },
    { date: '2024-01-02', steps: 9200 },
    { date: '2024-01-03', steps: 7800 },
    { date: '2024-01-04', steps: 8900 },
    { date: '2024-01-05', steps: 8300 }
  ]
};

/**
 * Realiza una petición HTTP con manejo de errores
 */
async function makeRequest(endpoint, params = {}) {
  try {
    const url = new URL(`${LONVITAL_API_BASE}${endpoint}`);
    
    // Agregar parámetros de consulta
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`API request failed for ${endpoint}:`, error.message);
    return null;
  }
}

/**
 * Filtra datos por rango de fechas
 */
function filterByDateRange(data, startDate, endDate) {
  if (!data || !Array.isArray(data)) return [];
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
}

/**
 * Obtiene datos de peso, masa muscular y masa grasa
 */
export async function getWeightData(userId, startDate = null, endDate = null) {
  const params = { userId };
  if (startDate) params.from = startDate;
  if (endDate) params.to = endDate;

  let data = await makeRequest(`/weight/${userId}`, params);
  
  // Fallback a datos mock
  if (!data) {
    console.log('Using mock weight data');
    data = { data: MOCK_DATA.weight };
  }

  const weightData = data.data || [];
  
  if (startDate && endDate) {
    return filterByDateRange(weightData, startDate, endDate);
  }
  
  return weightData;
}

/**
 * Obtiene datos de sueño
 */
export async function getSleepData(userId, startDate = null, endDate = null) {
  const params = { userId };
  if (startDate) params.from = startDate;
  if (endDate) params.to = endDate;

  let data = await makeRequest(`/sleep/${userId}`, params);
  
  // Fallback a datos mock
  if (!data) {
    console.log('Using mock sleep data');
    data = { data: MOCK_DATA.sleep };
  }

  const sleepData = data.data || [];
  
  if (startDate && endDate) {
    return filterByDateRange(sleepData, startDate, endDate);
  }
  
  return sleepData;
}

/**
 * Obtiene datos de medición de cintura
 */
export async function getWaistData(userId, startDate = null, endDate = null) {
  const params = { userId };
  if (startDate) params.from = startDate;
  if (endDate) params.to = endDate;

  let data = await makeRequest(`/waist/${userId}`, params);
  
  // Fallback a datos mock
  if (!data) {
    console.log('Using mock waist data');
    data = { data: MOCK_DATA.waist };
  }

  const waistData = data.data || [];
  
  if (startDate && endDate) {
    return filterByDateRange(waistData, startDate, endDate);
  }
  
  return waistData;
}

/**
 * Obtiene listado de analíticas OCR
 */
export async function getAnalyticsData(userId, startDate = null, endDate = null) {
  const params = { userId };
  if (startDate) params.from = startDate;
  if (endDate) params.to = endDate;

  let data = await makeRequest(`/analytics/${userId}`, params);
  
  // Fallback a datos mock
  if (!data) {
    console.log('Using mock analytics data');
    data = { data: MOCK_DATA.analytics };
  }

  const analyticsData = data.data || [];
  
  if (startDate && endDate) {
    return filterByDateRange(analyticsData, startDate, endDate);
  }
  
  return analyticsData;
}

/**
 * Obtiene detalle de una analítica específica
 */
export async function getAnalyticsDetail(userId, documentId) {
  let data = await makeRequest(`/analytics/${userId}/${documentId}`);
  
  // Fallback a datos mock
  if (!data) {
    console.log('Using mock analytics detail data');
    const mockAnalytic = MOCK_DATA.analytics.find(a => a.id === documentId);
    data = mockAnalytic || { markers: [] };
  }

  return data;
}

/**
 * Obtiene datos de pasos (mock - no está en la API especificada)
 */
export async function getStepsData(userId, startDate = null, endDate = null) {
  // Como no está en la API, siempre usamos datos mock
  console.log('Using mock steps data (not available in API)');
  
  let stepsData = MOCK_DATA.steps;
  
  if (startDate && endDate) {
    return filterByDateRange(stepsData, startDate, endDate);
  }
  
  return stepsData;
}

/**
 * Obtiene todos los datos de salud para un usuario en un rango de fechas
 */
export async function getAllHealthData(userId, startDate = null, endDate = null) {
  try {
    const [weight, sleep, waist, analytics, steps] = await Promise.all([
      getWeightData(userId, startDate, endDate),
      getSleepData(userId, startDate, endDate),
      getWaistData(userId, startDate, endDate),
      getAnalyticsData(userId, startDate, endDate),
      getStepsData(userId, startDate, endDate)
    ]);

    return {
      weight,
      sleep,
      waist,
      analytics,
      steps
    };
  } catch (error) {
    console.error('Error fetching all health data:', error);
    return {
      weight: [],
      sleep: [],
      waist: [],
      analytics: [],
      steps: []
    };
  }
}

/**
 * Calcula KPIs con comparación de períodos
 */
export function calculateKPIs(currentData, previousData) {
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

  // KPIs de peso
  const currentWeight = calculateAverage(currentData.weight, 'weight');
  const previousWeight = calculateAverage(previousData.weight, 'weight');
  
  const currentMuscle = calculateAverage(currentData.weight, 'muscle');
  const previousMuscle = calculateAverage(previousData.weight, 'muscle');
  
  const currentFat = calculateAverage(currentData.weight, 'fat');
  const previousFat = calculateAverage(previousData.weight, 'fat');
  
  // KPIs de sueño
  const currentTotalSleep = calculateAverage(currentData.sleep, 'duration');
  const previousTotalSleep = calculateAverage(previousData.sleep, 'duration');
  
  const currentDeepSleep = calculateAverage(currentData.sleep, 'deepSleep');
  const previousDeepSleep = calculateAverage(previousData.sleep, 'deepSleep');
  
  // KPI de pasos
  const currentSteps = calculateAverage(currentData.steps, 'steps');
  const previousSteps = calculateAverage(previousData.steps, 'steps');

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
