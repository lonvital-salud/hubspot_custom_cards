import {
    BarChart,
    Button,
    ButtonRow,
    Divider,
    EmptyState,
    Flex,
    hubspot,
    Input,
    LineChart,
    LoadingSpinner,
    Panel,
    Select,
    Text,
    Tile
} from "@hubspot/ui-extensions";
import React, { useCallback, useEffect, useState } from "react";

// Los servicios van directo en el componente porque HubSpot a veces se pone raro con las importaciones externas

// Aquí le decimos a HubSpot cómo ejecutar nuestra extensión dentro del CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

// Estos son los períodos que puede elegir el usuario en el dashboard
const DATE_FILTER_OPTIONS = [
  { label: 'Últimos 15 días', value: 15 },
  { label: 'Últimos 30 días', value: 30 },
  { label: 'Últimos 60 días', value: 60 },
  { label: 'Últimos 90 días', value: 90 },
];

// Esta función calcula las fechas de inicio y fin según los días que elija el usuario
const calculateDateRange = (days) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    label: `Últimos ${days} días`
  };
};

// Este componente muestra cada indicador de salud (peso, músculo, grasa, etc.) con su valor y cambio
const KPICard = ({ title, current, previous, change, unit, trend }) => {
  const getChangeColor = (change) => {
    if (change === null || change === undefined) return 'default';
    if (title.toLowerCase().includes('grasa')) {
      // Con la grasa es al revés: que baje es bueno, que suba mucho es malo
      return change < 0 ? 'success' : change > 5 ? 'danger' : 'default';
    } else {
      // Para el resto de KPIs, que suban un poco está bien, que bajen mucho está mal
      return change > 0 && change < 10 ? 'success' : change < -5 ? 'danger' : 'default';
    }
  };

  const getChangeIcon = (change) => {
    if (change === null || change === undefined) return '';
    return change > 0 ? '↑' : change < 0 ? '↓' : '→';
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return typeof value === 'number' ? value.toFixed(1) : value;
  };

  return (
    <Tile>
      <Flex direction="column" gap="small">
        <Text format={{ fontWeight: 'bold' }}>{title}</Text>
        <Text format={{ fontSize: 'large' }}>
          {formatValue(current)} {unit}
        </Text>
        {change !== null && change !== undefined && (
          <Text format={{ color: getChangeColor(change), fontSize: 'small' }}>
            {getChangeIcon(change)} {Math.abs(change).toFixed(1)}% vs período anterior
          </Text>
        )}
        {trend && (
          <Text format={{ fontSize: 'small', color: 'secondary' }}>
            Tendencia: {trend}
          </Text>
        )}
      </Flex>
    </Tile>
  );
};

// Este componente maneja todo el chat interactivo con la IA para consultas médicas
const AIChatPanel = ({ isOpen, onClose, currentData, kpis, context, runServerless, sendAlert }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = { role: 'user', content: inputMessage, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await runServerless('aiChat', {
        propertiesToSend: ['hs_object_id'],
        parameters: {
          objectType: context.crm.objectTypeId,
          objectId: context.crm.objectId,
          message: inputMessage,
          healthData: { data: currentData, kpis: kpis },
            chatHistory: messages.slice(-10) // Solo mandamos los últimos 10 mensajes para que la IA tenga contexto pero no se pase de tokens
        }
      });

      if (response && response.success) {
        const aiMessage = { 
          role: 'assistant', 
          content: response.reply, 
          timestamp: new Date().toISOString() 
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('No se recibió respuesta válida del servicio de IA');
      }
    } catch (error) {
      console.error('Error in AI chat:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: 'Lo siento, no pude procesar tu consulta en este momento. Por favor, inténtalo de nuevo más tarde.',
        timestamp: new Date().toISOString() 
      };
      setMessages(prev => [...prev, errorMessage]);
      
      sendAlert({
        type: 'warning',
        message: 'Error en el chat de IA. Usando respuesta de fallback.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Panel 
      id="ai-chat-panel" 
      title="Consulta con IA sobre los datos de salud"
      onClose={onClose}
    >
      <Flex direction="column" gap="medium">
        <div style={{ height: '400px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #e1e4e8', borderRadius: '4px', padding: '12px' }}>
          {messages.length === 0 ? (
            <Text format={{ color: 'secondary' }}>
              ¡Hola! Soy tu asistente de IA especializado en salud. Puedo ayudarte a analizar los datos del paciente. 
              Pregúntame sobre tendencias, interpretación de métricas, o cualquier aspecto de los datos de salud.
            </Text>
          ) : (
            messages.map((message, index) => (
              <div key={index} style={{ marginBottom: '12px' }}>
                <Text format={{ fontWeight: 'bold', color: message.role === 'user' ? 'primary' : 'secondary' }}>
                  {message.role === 'user' ? '👤 Tú:' : '🤖 IA:'}
                </Text>
                <Text style={{ marginTop: '4px' }}>{message.content}</Text>
                <Text format={{ fontSize: 'small', color: 'secondary' }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Text>
                <Divider />
              </div>
            ))
          )}
          {isLoading && (
            <Flex align="center" gap="small">
              <LoadingSpinner />
              <Text format={{ color: 'secondary' }}>IA está escribiendo...</Text>
            </Flex>
          )}
        </div>
        
        <Flex gap="small">
          <Input
            name="chatMessage"
            value={inputMessage}
            onChange={setInputMessage}
            placeholder="Escribe tu pregunta sobre los datos de salud..."
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            type="primary"
          >
            Enviar
          </Button>
        </Flex>
        
        <Button onClick={onClose}>Cerrar Chat</Button>
      </Flex>
    </Panel>
  );
};

// Este panel muestra los resúmenes automáticos que genera la IA
const AISummaryPanel = ({ isOpen, onClose, summary, isLoading }) => {
  return (
    <Panel 
      id="ai-summary-panel" 
      title={summary?.title || 'Resumen de IA'}
      onClose={onClose}
    >
      <Flex direction="column" gap="medium">
        {isLoading ? (
          <Flex justify="center" align="center" direction="column" gap="medium">
            <LoadingSpinner />
            <Text>Generando resumen con IA...</Text>
          </Flex>
        ) : summary ? (
          <div>
            {summary.dateRange && (
              <Text format={{ fontSize: 'small', color: 'secondary' }}>
                Período: {summary.dateRange.label}
              </Text>
            )}
            <Divider />
            <Text>{summary.content}</Text>
          </div>
        ) : (
          <EmptyState title="No hay resumen disponible" />
        )}
        
        <Button onClick={onClose}>Cerrar</Button>
      </Flex>
    </Panel>
  );
};

// El componente principal que junta todo el dashboard de salud
const Extension = ({ context, runServerless, sendAlert }) => {
  // Estados básicos para manejar los datos y la carga
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [currentData, setCurrentData] = useState(null);
  const [previousData, setPreviousData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [userId, setUserId] = useState('');
  
  // Estados para manejar los resúmenes que genera la IA
  const [aiSummary, setAiSummary] = useState(null);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Estados para el chat interactivo con la IA
  const [showChatPanel, setShowChatPanel] = useState(false);

  // Sacamos el ID del usuario desde el contexto de HubSpot
  useEffect(() => {
    if (context?.crm?.objectId) {
      setUserId(context.crm.objectId);
    }
  }, [context]);

  // Esta función trae todos los datos de salud del paciente usando nuestras funciones serverless
  const loadHealthData = useCallback(async (period) => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Calculamos qué fechas necesitamos para el período actual
      const currentRange = calculateDateRange(period);
      
      // Y también las fechas del período anterior para poder hacer comparaciones
      const previousRange = calculateDateRange(period * 2);
      const previousStart = previousRange.startDate;
      const previousEnd = currentRange.startDate;

      // Usamos nuestra función serverless que ya está hecha para traer los datos
      const response = await runServerless('healthDashboard', {
        propertiesToSend: ['hs_object_id'],
        parameters: {
          objectType: context.crm.objectTypeId,
          objectId: context.crm.objectId,
          period: period,
          currentStart: currentRange.startDate,
          currentEnd: currentRange.endDate,
          previousStart: previousStart,
          previousEnd: previousEnd
        }
      });

      if (response && response.success) {
        setCurrentData(response.data);
        setKpis(response.kpis);
        // Los datos anteriores ya vienen calculados en los KPIs, así que no necesitamos otra llamada
        setPreviousData({}); // Los KPIs ya incluyen la comparación
      } else {
        throw new Error('No se pudieron cargar los datos');
      }

    } catch (error) {
      console.error('Error loading health data:', error);
      
      // Si algo falla, usamos datos de ejemplo para que el equipo pueda seguir desarrollando
      const mockWeightData = [
        { date: currentRange.startDate, weight: 70.5, muscle: 35.2, fat: 15.8 },
        { date: currentRange.endDate, weight: 70.1, muscle: 35.0, fat: 16.0 }
      ];
      
      const mockSleepData = [
        { date: currentRange.startDate, duration: 7.5, deepSleep: 2.1, quality: 'good' },
        { date: currentRange.endDate, duration: 7.8, deepSleep: 2.2, quality: 'good' }
      ];

      const mockData = {
        weightData: mockWeightData,
        compositionData: prepareCompositionData(mockWeightData),
        sleepData: mockSleepData,
        stepsData: [
          { date: currentRange.startDate, steps: 8500 },
          { date: currentRange.endDate, steps: 8300 }
        ],
        waistData: [
          { date: currentRange.startDate, measurement: 85.2 }
        ],
        analytics: []
      };
      
      const mockKPIs = {
        weight: { current: 70.3, previous: 70.8, change: -0.7 },
        muscle: { current: 35.1, previous: 34.9, change: 0.6 },
        fat: { current: 15.9, previous: 16.2, change: -1.9 },
        totalSleep: { current: 7.6, previous: 7.2, change: 5.6 },
        deepSleep: { current: 2.1, previous: 2.0, change: 5.0 },
        steps: { current: 8400, previous: 8200, change: 2.4 },
        waist: { current: 85.2, previous: 85.8, change: -0.7 }
      };
      
      setCurrentData(mockData);
      setKpis(mockKPIs);
      setPreviousData({});
      
      sendAlert({
        type: 'warning',
        message: 'Usando datos de ejemplo. Verifique la conectividad con los servicios.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, context, runServerless, sendAlert]);

  // Cada vez que el usuario cambie el período o cambie de paciente, volvemos a cargar los datos
  useEffect(() => {
    if (userId && selectedPeriod) {
      loadHealthData(selectedPeriod);
    }
  }, [userId, selectedPeriod, loadHealthData]);

  // Esta función le pide a la IA que genere un resumen médico de los datos
  const generateAISummary = async (summaryType) => {
    if (!currentData) {
      sendAlert({
        type: 'warning',
        message: 'No hay datos disponibles para generar el resumen.'
      });
      return;
    }

    setIsGeneratingSummary(true);
    setShowSummaryPanel(true);
    
    try {
      const dateRange = summaryType === 'current' ? calculateDateRange(selectedPeriod) : null;
      const dataToAnalyze = summaryType === 'current' ? currentData : {
        ...currentData,
        // Para resumen general, incluir más datos si están disponibles
      };

      // Usar la función serverless generateAISummary existente
      const response = await runServerless('generateAISummary', {
        propertiesToSend: ['hs_object_id'],
        parameters: {
          summaryType: summaryType,
          period: selectedPeriod,
          objectType: context.crm.objectTypeId,
          objectId: context.crm.objectId,
          healthData: {
            data: currentData,
            kpis: kpis
          }
        }
      });

      if (response && response.success) {
        const titleMap = {
          current: `Resumen del Período Actual (${selectedPeriod} días)`,
          general: 'Resumen General del Historial'
        };

        const formattedSummary = {
          title: titleMap[summaryType],
          content: response.summary,
          type: 'success',
          dateRange: summaryType === 'current' ? calculateDateRange(selectedPeriod) : null
        };
      
        setAiSummary(formattedSummary);
      } else {
        throw new Error(response?.error || 'Error desconocido');
      }
      
    } catch (error) {
      console.error('Error generating AI summary:', error);
      
      // Fallback con resumen mock
      const mockSummaries = {
        current: `Resumen del período de ${selectedPeriod} días:

🔍 ANÁLISIS GENERAL:
El paciente muestra una evolución positiva en sus métricas de salud durante este período.

📊 MÉTRICAS CLAVE:
• Peso corporal: Tendencia estable con ligera mejora en composición
• Masa muscular: Mantenimiento adecuado 
• Masa grasa: Reducción gradual dentro de parámetros saludables
• Sueño: Patrones regulares con buena calidad de descanso
• Actividad física: Nivel de pasos dentro del rango recomendado

💡 RECOMENDACIONES:
1. Continuar con el plan actual de seguimiento
2. Mantener rutina de ejercicio regular
3. Preservar hábitos de sueño establecidos
4. Seguimiento en 2-3 semanas

⚠️ NOTA: Este es un resumen generado con datos de ejemplo.`,
        
        general: `Resumen general del historial del paciente:

🔍 EVOLUCIÓN A LARGO PLAZO:
El historial muestra un patrón consistente de seguimiento de salud y bienestar.

📈 TENDENCIAS IDENTIFICADAS:
• Composición corporal: Evolución gradual y sostenible
• Patrones de sueño: Consistencia en horarios y calidad
• Actividad física: Mantenimiento de niveles de actividad regulares
• Seguimiento médico: Registro continuo de métricas importantes

🎯 OBJETIVOS ALCANZADOS:
• Establecimiento de rutinas saludables
• Monitoreo regular de indicadores clave
• Mantenimiento de parámetros dentro de rangos normales

🔮 RECOMENDACIONES FUTURAS:
1. Continuar con el seguimiento regular
2. Considerar evaluaciones trimestrales
3. Ajustar objetivos según evolución
4. Mantener comunicación con equipo médico

⚠️ NOTA: Este es un resumen generado con datos de ejemplo.`
      };

      setAiSummary({
        title: summaryType === 'current' ? `Resumen del Período (${selectedPeriod} días)` : 'Resumen General',
        content: mockSummaries[summaryType],
        type: 'warning'
      });
      
      sendAlert({
        type: 'warning',
        message: 'Se generó un resumen de ejemplo. Verifique la conectividad con los servicios de IA.'
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Preparar datos para gráficos
  const prepareChartData = (data, field, label) => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: new Date(item.date).toISOString().split('T')[0], // Format as YYYY-MM-DD
      [field]: item[field],
      label: label
    })).filter(item => item[field] != null);
  };

  // Preparar datos específicos para gráficos de composición corporal
  const prepareCompositionData = (weightData) => {
    if (!weightData || !Array.isArray(weightData)) return [];
    
    const muscleData = weightData.map(item => ({
      date: new Date(item.date).toISOString().split('T')[0],
      value: item.muscle,
      type: 'Masa Muscular'
    })).filter(item => item.value != null);
    
    const fatData = weightData.map(item => ({
      date: new Date(item.date).toISOString().split('T')[0],
      value: item.fat,
      type: 'Masa Grasa'
    })).filter(item => item.value != null);
    
    return [...muscleData, ...fatData];
  };

  // Renderizar estado de carga
  if (isLoading && !currentData) {
    return (
      <Flex justify="center" align="center" direction="column" gap="large">
        <LoadingSpinner label="Cargando datos de salud..." />
        <Text>Obteniendo información del paciente...</Text>
      </Flex>
    );
  }

  // Renderizar estado vacío
  if (!currentData || !kpis) {
    return (
      <Flex direction="column" gap="medium">
        <Flex justify="space-between" align="center">
          <Text format={{ fontWeight: 'bold', fontSize: 'large' }}>
            Dashboard General de Salud
          </Text>
          <Select
            label="Período"
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={DATE_FILTER_OPTIONS}
          />
        </Flex>
        <EmptyState 
          title="No hay datos de salud disponibles" 
          layout="vertical"
        >
          <Text>
            No se encontraron datos para el período seleccionado. 
            Verifique que el paciente tenga información registrada.
          </Text>
        </EmptyState>
      </Flex>
    );
  }

  return (
    <>
      <Flex direction="column" gap="large">
        {/* Header con filtros */}
        <Flex justify="space-between" align="center">
          <Text format={{ fontWeight: 'bold', fontSize: 'large' }}>
            Dashboard General de Salud
          </Text>
          <Select
            label="Período"
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={DATE_FILTER_OPTIONS}
          />
        </Flex>

        {/* KPIs Grid */}
        <div>
          <Text format={{ fontWeight: 'bold' }}>Indicadores Clave de Salud</Text>
          <Divider />
          <Flex wrap="wrap" gap="medium">
            <KPICard
              title="Peso Corporal"
              current={kpis.weight.current}
              previous={kpis.weight.previous}
              change={kpis.weight.change}
              unit="kg"
            />
            <KPICard
              title="Masa Muscular"
              current={kpis.muscle.current}
              previous={kpis.muscle.previous}
              change={kpis.muscle.change}
              unit="kg"
            />
            <KPICard
              title="Masa Grasa"
              current={kpis.fat.current}
              previous={kpis.fat.previous}
              change={kpis.fat.change}
              unit="kg"
            />
            <KPICard
              title="Sueño Total"
              current={kpis.totalSleep.current}
              previous={kpis.totalSleep.previous}
              change={kpis.totalSleep.change}
              unit="hrs"
            />
            <KPICard
              title="Sueño Profundo"
              current={kpis.deepSleep.current}
              previous={kpis.deepSleep.previous}
              change={kpis.deepSleep.change}
              unit="hrs"
            />
            <KPICard
              title="Pasos Diarios"
              current={kpis.steps.current}
              previous={kpis.steps.previous}
              change={kpis.steps.change}
              unit="pasos"
            />
            {kpis.waist && (
              <KPICard
                title="Cintura"
                current={kpis.waist.current}
                previous={kpis.waist.previous}
                change={kpis.waist.change}
                unit="cm"
              />
            )}
          </Flex>
        </div>

        {/* Gráficos de Tendencias */}
        <div>
          <Text format={{ fontWeight: 'bold' }}>Tendencias y Visualizaciones</Text>
          <Divider />
          
          {/* Gráfico de Peso */}
          {currentData.weightData && currentData.weightData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Evolución del Peso</Text>
                <LineChart
                  data={prepareChartData(currentData.weightData, 'weight', 'Peso')}
                  options={{
                    title: 'Tendencia de Peso Corporal',
                    showLegend: true,
                    showDataLabels: false,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'weight', fieldType: 'linear', label: 'Peso (kg)' },
                  }}
                />
              </Flex>
            </Tile>
          )}

          {/* Gráfico de Composición Corporal */}
          {currentData.compositionData && currentData.compositionData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Composición Corporal</Text>
                <LineChart
                  data={currentData.compositionData}
                  options={{
                    title: 'Masa Muscular vs Masa Grasa',
                    showLegend: true,
                    showDataLabels: false,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'value', fieldType: 'linear', label: 'Valor (kg)' },
                  }}
                />
              </Flex>
            </Tile>
          )}

          {/* Gráfico de Sueño */}
          {currentData.sleepData && currentData.sleepData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Patrones de Sueño</Text>
                <BarChart
                  data={prepareChartData(currentData.sleepData, 'duration', 'Duración')}
                  options={{
                    title: 'Horas de Sueño por Día',
                    showLegend: true,
                    showDataLabels: true,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'duration', fieldType: 'linear', label: 'Horas' },
                  }}
                />
              </Flex>
            </Tile>
          )}

          {/* Gráfico de Sueño Profundo */}
          {currentData.sleepData && currentData.sleepData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Sueño Profundo</Text>
                <BarChart
                  data={prepareChartData(currentData.sleepData, 'deepSleep', 'Sueño Profundo')}
                  options={{
                    title: 'Horas de Sueño Profundo por Día',
                    showLegend: true,
                    showDataLabels: true,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'deepSleep', fieldType: 'linear', label: 'Horas' },
                  }}
                />
              </Flex>
            </Tile>
          )}

          {/* Gráfico de Actividad */}
          {currentData.stepsData && currentData.stepsData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Actividad Física</Text>
                <LineChart
                  data={prepareChartData(currentData.stepsData, 'steps', 'Pasos')}
                  options={{
                    title: 'Pasos Diarios',
                    showLegend: true,
                    showDataLabels: false,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'steps', fieldType: 'linear', label: 'Pasos' },
                  }}
                />
              </Flex>
            </Tile>
          )}

          {/* Gráfico de Cintura */}
          {currentData.waistData && currentData.waistData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Medición de Cintura</Text>
                <LineChart
                  data={prepareChartData(currentData.waistData, 'measurement', 'Cintura')}
                  options={{
                    title: 'Evolución de la Medida de Cintura',
                    showLegend: true,
                    showDataLabels: false,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'measurement', fieldType: 'linear', label: 'Centímetros' },
                  }}
                />
              </Flex>
            </Tile>
          )}
        </div>

        {/* Módulo de Resúmenes con IA */}
        <div>
          <Text format={{ fontWeight: 'bold' }}>Análisis con Inteligencia Artificial</Text>
          <Divider />
          
          {/* Resúmenes Automáticos */}
          <Tile>
            <Flex direction="column" gap="small">
              <Text>Resúmenes Médicos Automatizados</Text>
              <Text format={{ fontSize: 'small', color: 'secondary' }}>
                Genere resúmenes médicos automáticos basados en los datos de salud del paciente.
              </Text>
              <ButtonRow>
                <Button
                  type="primary"
                  onClick={() => generateAISummary('current')}
                  disabled={isGeneratingSummary}
                >
                  Resumen Actual ({selectedPeriod} días)
                </Button>
                <Button
                  type="secondary"
                  onClick={() => generateAISummary('general')}
                  disabled={isGeneratingSummary}
                >
                  Resumen General
                </Button>
              </ButtonRow>
            </Flex>
          </Tile>

          {/* Chat Interactivo con IA */}
          <Tile>
            <Flex direction="column" gap="small">
              <Text>Consulta Interactiva con IA</Text>
              <Text format={{ fontSize: 'small', color: 'secondary' }}>
                Haga preguntas específicas sobre los datos de salud del paciente y reciba respuestas personalizadas.
              </Text>
              <Button
                type="primary"
                onClick={() => setShowChatPanel(true)}
              >
                🤖 Abrir Chat con IA
              </Button>
            </Flex>
          </Tile>
        </div>

        {/* Información adicional */}
        <div>
          <Text format={{ fontWeight: 'bold' }}>Información del Período</Text>
          <Divider />
          <Flex gap="medium" wrap="wrap">
            <Text format={{ fontSize: 'small' }}>
              📊 Registros de peso: {currentData.weightData?.length || 0}
            </Text>
            <Text format={{ fontSize: 'small' }}>
              😴 Registros de sueño: {currentData.sleepData?.length || 0}
            </Text>
            <Text format={{ fontSize: 'small' }}>
              🚶 Registros de actividad: {currentData.stepsData?.length || 0}
            </Text>
            <Text format={{ fontSize: 'small' }}>
              📏 Mediciones de cintura: {currentData.waistData?.length || 0}
            </Text>
            <Text format={{ fontSize: 'small' }}>
              🧪 Analíticas: {currentData.analytics?.length || 0}
            </Text>
          </Flex>
        </div>
      </Flex>

      {/* Panel de Resumen de IA */}
      {showSummaryPanel && (
        <AISummaryPanel
          isOpen={showSummaryPanel}
          onClose={() => setShowSummaryPanel(false)}
          summary={aiSummary}
          isLoading={isGeneratingSummary}
        />
      )}

      {/* Panel de Chat con IA */}
      {showChatPanel && (
        <AIChatPanel
          isOpen={showChatPanel}
          onClose={() => setShowChatPanel(false)}
          currentData={currentData}
          kpis={kpis}
          context={context}
          runServerless={runServerless}
          sendAlert={sendAlert}
        />
      )}
    </>
  );
};
