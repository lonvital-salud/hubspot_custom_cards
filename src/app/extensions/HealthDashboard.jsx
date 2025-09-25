import {
  BarChart,
  Box,
  Button,
  ButtonRow,
  Divider,
  EmptyState,
  Flex,
  Heading,
  hubspot,
  Input,
  LineChart,
  LoadingSpinner,
  Panel,
  PanelBody,
  PanelSection,
  PanelFooter,
  Select,
  Text,
  Tile,
  Statistics,
  StatisticsItem,
  StatisticsTrend,
  LoadingButton,
  Stack
} from "@hubspot/ui-extensions";
import React, { useCallback, useEffect, useState, useRef } from "react";

// Los servicios van directo en el componente porque HubSpot a veces se pone raro con las importaciones externas

// Aquí le decimos a HubSpot cómo ejecutar nuestra extensión dentro del CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
    actions={actions}
  />
));

// Estos son los períodos que puede elegir el usuario en el dashboard
const DATE_FILTER_OPTIONS = [
  { label: 'Últimos 15 días', value: 15 },
  { label: 'Últimos 30 días', value: 30 },
  { label: 'Últimos 60 días', value: 60 },
  { label: 'Últimos 90 días', value: 90 },
  // TODO QUITAR ESTO
  { label: 'Últimos 180 días', value: 200 },
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
    if (change === null || change === undefined) return 'green';
    if (title.toLowerCase().includes('peso') || title.toLowerCase().includes('grasa') || title.toLowerCase().includes('cintura')) {
      // Con la grasa es al revés: que baje es bueno, que suba mucho es malo
      return change < 0 ? 'green' : 'red';
    } else {
      // Para el resto de KPIs, que suban un poco está bien, que bajen mucho está mal
      return change > 0 ? 'green' : 'red';
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

  const formatChange = (value) => {
    if (value === null || value === undefined) return false;
    const change = typeof value === 'number' ? Math.abs(value).toFixed(1) : value;
    return `${change}%`;
  }

  const getTrendIcon = (change) => {
    if (change === null || change === undefined) return 'increase';
    if (trend === undefined || trend === 'up') {
      return change >= 0 ? 'increase' : 'decrease';
    } else {
      return change < 0 ? 'decrease' : 'increase';
    }
  }

  return (

    <StatisticsItem label={title} number={formatValue(current)} >
      {change !== null && change !== undefined && (
        <StatisticsTrend
          direction={getTrendIcon(change)}
          value={formatChange(change)}
          color={getChangeColor(change)} />
      )}
    </StatisticsItem>
  );
};

// Este componente maneja todo el chat interactivo con la IA para consultas médicas
const AIChatPanel = ({ onClose, currentData, kpis, context, sendAlert, actions }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sendEnabled, setSendEnabled] = useState(false);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = { role: 'user', content: inputMessage, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await hubspot.serverless('aiChat', {
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
      <PanelBody>
        <PanelSection>
          <Flex direction="column" gap="medium" justify="end">
            <Box style={{ height: '400px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #e1e4e8', borderRadius: '4px', padding: '12px' }}>
              {messages.length === 0 ? (
                <Text format={{ color: 'secondary' }}>
                  ¡Hola! Soy tu asistente de IA especializado en salud. Puedo ayudarte a analizar los datos del paciente.
                  Pregúntame sobre tendencias, interpretación de métricas, o cualquier aspecto de los datos de salud.
                </Text>
              ) : (
                messages.map((message, index) => (
                  <Box key={index} style={{ marginBottom: '12px' }}>
                    <Text format={{ fontWeight: 'bold', color: message.role === 'user' ? 'primary' : 'secondary' }}>
                      {message.role === 'user' ? '👤 Tú:' : '🤖 IA:'}
                    </Text>
                    <Text style={{ marginTop: '4px' }}>{message.content}</Text>
                    <Text format={{ fontSize: 'small', color: 'secondary' }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Text>
                    <Divider />
                  </Box>
                ))
              )}
              {isLoading && (
                <Flex align="center" gap="small">
                  <LoadingSpinner />
                  <Text format={{ color: 'secondary' }}>IA está escribiendo...</Text>
                </Flex>
              )}
            </Box>

          </Flex>
        </PanelSection>
      </PanelBody>
      <PanelFooter>
        <Flex gap="small" justify="between">
              <Input
                name="chatMessage"
                value={inputMessage}
                placeholder="Escribe tu pregunta sobre los datos de salud..."
                disabled={isLoading}
                onChange={(value) => {
                  setInputMessage(value);
                }}
                onInput={(e) => {
                  setSendEnabled(e != '')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <LoadingButton
                onClick={handleSendMessage}
                disabled={!sendEnabled || isLoading}
                type="primary"
                loading={isLoading}
              >
                Enviar
              </LoadingButton>
            </Flex>
        <Button onClick={() => {
          actions.closeOverlay('ai-chat-panel');
        }}>Cerrar Chat</Button>
      </PanelFooter>
    </Panel>
  );
};

// Este panel muestra los resúmenes automáticos que genera la IA
const AISummaryPanel = ({ summary }) => {

  const text = summary?.content || '';

  const paragraphs = text.split('\n\n').filter(p => p.trim() !== '');

  return (
    <Panel
      id="ai-summary-panel"
      title={summary?.title || 'Resumen de IA'}
      variant={'modal'}
    >
      <PanelBody>
        <PanelSection>
          {summary ? (
            <>
              {summary.dateRange && (
                <>
                  <Text format={{ fontSize: 'small', color: 'secondary' }}>
                    Período: {summary.dateRange.label}
                  </Text>
                  <Divider />
                </>
              )}
              <Flex gap="sm">
                {paragraphs.map((paragraph, index) => (
                  <Text key={index}>
                    {paragraph}
                  </Text>
                ))}
              </Flex>
            </>
          ) : (
            <EmptyState title="No hay resumen disponible" />
          )}
        </PanelSection>
      </PanelBody>
      <PanelFooter></PanelFooter>
    </Panel>
  );
};

// El componente principal que junta todo el dashboard de salud
const Extension = ({ context, runServerless, sendAlert, actions }) => {
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
  const [isGeneratingSummaryGeneral, setIsGeneratingSummaryGeneral] = useState(false);

  // Estados para el chat interactivo con la IA
  const [showChatPanel, setShowChatPanel] = useState(false);

  // Ref para manejar el cleanup del polling de resúmenes IA
  const pollingCleanupRef = useRef(null);

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

    // Calculamos qué fechas necesitamos para el período actual
    const currentRange = calculateDateRange(period);

    // Y también las fechas del período anterior para poder hacer comparaciones
    const previousRange = calculateDateRange(period * 2);
    const previousStart = previousRange.startDate;
    const previousEnd = currentRange.startDate;
    try {

      // Usamos nuestra función serverless que ya está hecha para traer los datos
      const response = await hubspot
        .serverless('healthDashboard', {
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

      console.log('response', response);
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

  // Función para cancelar una solicitud de resumen en OpenAI
  const cancelSummaryRequest = async (summaryRequestId) => {
    try {
      await hubspot.serverless('generateAISummary', {
        propertiesToSend: ['hs_object_id'],
        parameters: {
          action: 'cancel',
          summaryRequestId: summaryRequestId,
          objectType: context.crm.objectTypeId,
          objectId: context.crm.objectId
        }
      });
      console.log(`Solicitud de resumen ${summaryRequestId} cancelada en OpenAI`);
    } catch (error) {
      console.error('Error al cancelar la solicitud de resumen:', error);
      // No lanzamos el error para evitar interrumpir el flujo de cancelación
    }
  };

  // Cleanup del polling cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
      }
    };
  }, []);

  // Función helper para manejar estados de carga de resúmenes
  const setLoadingState = (summaryType, isLoading) => {
    if (summaryType === 'general') {
      setIsGeneratingSummaryGeneral(isLoading);
    } else {
      setIsGeneratingSummary(isLoading);
    }
  };

  // Función helper para resetear estados después de completar/cancelar resumen
  const resetSummaryStates = (summaryType) => {
    console.log('resetSummaryStates', summaryType);
    setLoadingState(summaryType, false);
    pollingCleanupRef.current = null;
  };

  // Función helper para cleanup completo con cancelación
  const cleanupSummaryGeneration = (summaryType, summaryRequestId = null) => {
    resetSummaryStates(summaryType);
    if (summaryRequestId) {
      cancelSummaryRequest(summaryRequestId);
    }
  };

  // Esta función le pide a la IA que genere un resumen médico de los datos
  const generateAISummary = async (summaryType) => {
    // Evitar solicitar un resumen mientras otro está en curso
    if (isGeneratingSummary || isGeneratingSummaryGeneral) {
      sendAlert({
        type: 'warning',
        message: 'Ya se está generando otro resumen. Por favor espere.'
      });
      return;
    }

    if (!currentData) {
      sendAlert({
        type: 'warning',
        message: 'No hay datos disponibles para generar el resumen.'
      });
      return;
    }

    // Limpiar cualquier polling anterior
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current();
      pollingCleanupRef.current = null;
    }

    setLoadingState(summaryType, true);
    setShowSummaryPanel(true);

    try {
      const dateRange = summaryType === 'current' ? calculateDateRange(selectedPeriod) : null;
      const dataToAnalyze = summaryType === 'current' ? currentData : {
        ...currentData,
        // Para resumen general, incluir más datos si están disponibles
      };

      // Usar la función serverless generateAISummary existente
      const response = await hubspot.serverless('generateAISummary', {
        propertiesToSend: ['hs_object_id'],
        parameters: {
          method: 'generate',
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

      if (response && response.success && response.summaryRequest) {
        // Hacer polling con el ID de la solicitud
        const summaryRequestId = response.summaryRequest;
        let attempt = 0;
        const maxAttempts = 30;
        let delay = 1000; // Empezar con 1 segundo
        let timeoutId = null;
        let isCancelled = false;

        const pollForSummary = async () => {
          try {
            if (isCancelled) return;

            const pollResponse = await hubspot.serverless('generateAISummary', {
              propertiesToSend: ['hs_object_id'],
              parameters: {
                method: 'poll',
                summaryRequestId: summaryRequestId,
                objectType: context.crm.objectTypeId,
                objectId: context.crm.objectId
              }
            });

            if (isCancelled) return;

            if (pollResponse && pollResponse.success && pollResponse.status === 'completed') {
              // El resumen está listo
              const titleMap = {
                current: `Resumen del Período Actual (${selectedPeriod} días)`,
                general: 'Resumen General del Historial'
              };

              const formattedSummary = {
                title: titleMap[summaryType],
                content: pollResponse.summaryText,
                type: 'success',
                dateRange: summaryType === 'current' ? calculateDateRange(selectedPeriod) : null
              };

              if (!isCancelled) {
                setAiSummary(formattedSummary);

                resetSummaryStates(summaryType);
              }
              return;
            } else if (pollResponse && !pollResponse.success && pollResponse.status === 'error') {
              // Hubo un error al generar el resumen, finaliza
              if (!isCancelled) {
                console.log(pollResponse.error);
                resetSummaryStates(summaryType);
                sendAlert({
                  type: 'error',
                  message: 'Hubo un error al generar el resumen con IA.'
                });
              }
              return;
            }

            attempt++;
            if (attempt >= maxAttempts) {
              // Timeout: cancelar la solicitud en OpenAI antes de lanzar el error
              cancelSummaryRequest(summaryRequestId);
              throw new Error('Timeout: El resumen tardó demasiado en generarse');
            }

            // Expandir el tiempo de espera gradualmente
            if (attempt > 5) delay = 2000;
            if (attempt > 15) delay = 3000;

            if (!isCancelled) {
              timeoutId = setTimeout(pollForSummary, delay);
            }

          } catch (pollError) {
            if (!isCancelled) {
              console.error('Error during polling:', pollError);
              resetSummaryStates(summaryType);
              throw pollError;
            }
          }
        };

        // Función de cleanup optimizada
        const cleanup = () => {
          isCancelled = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          // Usar helper para cleanup completo
          cleanupSummaryGeneration(summaryType, summaryRequestId);
        };

        // Guardar la función de cleanup en el ref
        pollingCleanupRef.current = cleanup;

        // Iniciar el polling
        timeoutId = setTimeout(pollForSummary, delay);

      } else {
        throw new Error(response?.error || 'No se recibió ID de solicitud válido');
      }

    } catch (error) {
      console.error('Error generating AI summary:', error);

      // Asegurarse de que el estado se resetee en caso de error
      resetSummaryStates(summaryType);

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

  const prepareChartSleepData = (sleepData) => {
    if (!sleepData || !Array.isArray(sleepData)) return [];
    return {
      data: sleepData.flatMap(item => [
        {
          date: new Date(item.date || item.datetime).toISOString().split('T')[0],
          duration: item.duration,
          breakdown: 'sleep'
        },
        {
          date: new Date(item.date || item.datetime).toISOString().split('T')[0],
          duration: item.deepSleep,
          breakdown: 'deep'
        }
      ]).filter(item => item.duration != null),
      options: {
        propertyLabels: {
          breakdown: {
            sleep: 'Sueño',
            deep: 'Sueño Profundo'
          }
        },
        showLegends: true
      }
    }
  }

  // Preparar datos específicos para gráficos de composición corporal
  const prepareCompositionData = (weightData) => {
    if (!weightData || !Array.isArray(weightData)) return [];

    const muscleData = weightData.map(item => ({
      date: new Date(item.date).toISOString().split('T')[0],
      value: item.muscle,
      type: 'Masa Muscular',
      breakdown: 'muscle_mass' // Para que la IA lo identifique mejor
    })).filter(item => item.value != null);

    const fatData = weightData.map(item => ({
      date: new Date(item.date).toISOString().split('T')[0],
      value: item.fat,
      type: 'Masa Grasa',
      breakdown: 'fat_mass_weight' // Para que la IA lo identifique mejor
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
      <Flex direction="column" gap="large">
        <Flex justify="between" align="center">
          <Box>
            <Heading>Indicadores Clave de Salud</Heading>
            <Text>Los valores se muestran en un promedio del período seleccionado.</Text>
          </Box>
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
        {/* KPIs Grid */}
        <>
          {/* Header con filtros */}
          <Flex justify="between" align="end">
            <Box>
              <Heading>Indicadores Clave de Salud</Heading>
              <Text>Los valores se muestran en un promedio del período seleccionado.</Text>
            </Box>
            <Select
              label="Período"
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={DATE_FILTER_OPTIONS}
            />
          </Flex>
          <Divider distance={'extra-small'} />

          <Statistics>
            <KPICard
              title="Peso Corporal (Kg)"
              current={kpis.weight.current}
              previous={kpis.weight.previous}
              change={kpis.weight.change}
              unit="kg"
              trend={'down'}
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
              trend={'down'}
            />
          </Statistics>
          <Statistics>
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
                trend={'down'}
              />
            )}
          </Statistics>

        </>

        {/* Gráficos de Tendencias */}
        <>
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
                    showDataLabels: true,
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
                  data={{
                    data: currentData.compositionData,
                    options: {
                      propertyLabels: {
                        breakdown: {
                          muscle_mass: 'Masa Muscular',
                          fat_mass_weight: 'Masa Grasa'
                        },
                      },
                    },
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'value', fieldType: 'linear', label: 'Valor (kg)' },
                    options: { groupFieldByColor: 'breakdown', stacking: false },
                  }}
                  options={{
                    title: 'Masa Muscular vs Masa Grasa',
                    showLegend: true,
                    showDataLabels: true,
                    showTooltips: true,
                    showLegends: true
                  }}

                />
              </Flex>
            </Tile>
          )}

          {/* Gráfico de Sueño */}
          {currentData.sleepData && currentData.sleepData.length > 0 && (
            <Tile>
              <Flex direction="column" gap="small">
                <Text format={{ fontWeight: 'bold' }}>Patrones de Sueño vs Sueño profundo</Text>
                <BarChart
                  data={prepareChartSleepData(currentData.sleepData, 'duration', 'Duración')}
                  options={{
                    title: 'Minutos de Sueño por Día',
                    showLegend: true,
                    showDataLabels: true,
                    showTooltips: true,
                  }}
                  axes={{
                    x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
                    y: { field: 'duration', fieldType: 'linear', label: 'Minutos' },
                    options: { groupFieldByColor: 'breakdown', stacking: false },
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
                    showDataLabels: true,
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
                    showDataLabels: true,
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
        </>

        {/* Módulo de Resúmenes con IA */}
        <>
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
                <LoadingButton
                  type="primary"
                  onClick={() => generateAISummary('current')}
                  loading={isGeneratingSummary}
                  disabled={isGeneratingSummaryGeneral}
                  overlayOptions={{ openBehavior: 'onLoadingFinish' }}
                  overlay={<AISummaryPanel
                    summary={aiSummary}
                  />}
                >
                  Resumen Actual ({selectedPeriod} días)
                </LoadingButton>
                <LoadingButton
                  type="secondary"
                  onClick={() => generateAISummary('general')}
                  loading={isGeneratingSummaryGeneral}
                  disabled={isGeneratingSummary}
                  overlayOptions={{ openBehavior: 'onLoadingFinish' }}
                  overlay={<AISummaryPanel
                    summary={aiSummary}
                  />}
                >
                  Resumen General
                </LoadingButton>
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
                overlay={<AIChatPanel
                  currentData={currentData}
                  kpis={kpis}
                  context={context}
                  sendAlert={sendAlert}
                  actions={actions}
                />}
              >
                🤖 Abrir Chat con IA
              </Button>
            </Flex>
          </Tile>
        </>

        {/* Información adicional */}
        <>
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
        </>
      </Flex >

    </>
  );
};
