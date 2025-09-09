import {
    Accordion,
    Button,
    DateInput,
    Divider,
    EmptyState,
    Flex,
    hubspot,
    LoadingSpinner,
    Panel, PanelBody,
    PanelFooter,
    PanelSection,
    Table,
    TableBody, TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Text
} from "@hubspot/ui-extensions";
import React, { useCallback, useEffect, useState } from "react";

// Le decimos a HubSpot cómo ejecutar esta extensión dentro del CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

const formatDate = function (date) {
  const newDate = new Date(date._seconds * 1000);
  var year = newDate.getFullYear();
  var month = newDate.getMonth() + 1; // Los meses en JS van de 0-11, por eso sumamos 1
  var day = newDate.getDate();

  // Le agregamos un cero adelante si es necesario para que siempre tenga 2 dígitos
  if (month < 10) {
    month = '0' + month;
  }
  if (day < 10) {
    day = '0' + day;
  }

  return year + '-' + month + '-' + day;
}

const HealthAnalyticContent = ({ analytic, userId }) => {

  const [isLoading, setIsLoading] = useState(false);
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      console.log('CONTEXTO', analytic);
      setIsLoading(true);
      const response = await hubspot
        .serverless('healthAnalyticDetail', {
          propertiesToSend: ['hs_object_id'],
          parameters: {
            userId: userId,
            documentId: analytic.id,
          },
        })
        .then((response) => {
          setIsLoading(false);
          return response.data;
        })
        .catch((error) => {
          console.log(error);
        });

      setMarkers(response);

    };
    fetchData();

  }, []);

  const getCategories = useCallback(() => {
    const uniqueCategories = [];
    const seenCategories = new Set();

    markers.forEach(marker => {
      if (!seenCategories.has(marker.category)) {
        uniqueCategories.push({
          category: marker.category,
          catDisplayName: marker.catDisplayName, // Usamos el nombre que viene del marker para mostrar
          markers: []
        });
        seenCategories.add(marker.category);
      }

      uniqueCategories.find(cat => cat.category === marker.category).markers.push(marker);
    });

    console.log(uniqueCategories);

    return uniqueCategories;
  }, [markers]);

  const outOfRange = (marker) => {
    if (!marker.reference) {
      return false;
    }

    if (String(marker.reference).startsWith('<')) {
      return parseFloat(marker.value) > parseFloat(marker.reference.substring(1).trim());
    }

    if (String(marker.reference).startsWith('>')) {
      return parseFloat(marker.value) < parseFloat(marker.reference.substring(1).trim());
    }

    if (String(marker.reference).includes('-')) {
      const [min, max] = marker.reference.split('-').map(Number);
      return parseFloat(marker.value) < min || parseFloat(marker.value) > max;
    }

    return false;
  }

  return (
    <>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {getCategories().map(category => (
            <Accordion title={category.catDisplayName}>
              <Table bordered={false}>
                <TableHead>
                  <TableRow>
                    <TableHeader width="min">Analítica</TableHeader>
                    <TableHeader width="min">Valor</TableHeader>
                    <TableHeader width="min">Referencia</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {category.markers.map(marker => (
                    <TableRow>
                      <TableCell width="min">
                        <Text format={outOfRange(marker) ? { fontWeight: 'bold' } : {}}>{marker.analytic}{outOfRange(marker) ? '*' : ''}</Text>
                      </TableCell>
                      <TableCell width="min">
                        <Text>{`${marker.value} ${marker.unit}` || marker.value}</Text>
                      </TableCell>
                      <TableCell width="min">{marker.reference || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Accordion>
          ))}
        </>
      )}
    </>
  )
}

const HealthAnalyticDetails = ({ analytic, userId }) => {

  const [title, setTitle] = useState('Detalles de la Analítica');
  const [contentLoaded, setContentLoaded] = useState(false); // Estado local


  useEffect(() => {
    if (analytic?.fechaSubida) {
      setTitle(`Detalles de la Analítica ${formatDate(analytic.fechaSubida)}`);
    }

  }, [analytic]);

    const handlePanelOpen = () => {
    setContentLoaded(true); // Solo cargamos el contenido cuando el usuario abre el panel
  };

  return (
    <Panel id="lonvital-analytics-panel" title={title}
      onOpen={handlePanelOpen}
      variant="modal"
      width="md"
    >
      <PanelBody>
        <PanelSection>
          {
            analytic.respuestaChatgpt ? (
              <>
                <Text format={{ fontWeight: 'bold' }}>Resumen</Text>
                <Text>{analytic.respuestaChatgpt}</Text>
                <Divider />
              </>
            ) : ''
          }

          {contentLoaded ? (
            <HealthAnalyticContent analytic={analytic} userId={userId} />
          ) : null}
        </PanelSection>
      </PanelBody>
      <PanelFooter></PanelFooter>
    </Panel>

  )
}

// El componente principal que maneja toda la tabla de analíticas
const Extension = ({ context, runServerless, sendAlert }) => {
  const [text, setText] = useState("");

  const [page, setPage] = useState(1);
  const [length, setLength] = useState(10);
  const [sortState, setSortState] = useState("descending");
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('');

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filterApplied, setFilterApplied] = useState(false);

  useEffect(() => {

    // Traemos los datos desde nuestra función serverless
    const fetchData = async () => {
      setIsLoading(true);
      const response = await hubspot
        .serverless('healthAnalytics', {
          propertiesToSend: ['hs_object_id'],
          parameters: {
            objectType: context.crm.objectTypeId,
            objectId: context.crm.objectId,
            page,
            length,
            sortState,
            startDate: startDate ? startDate : undefined,
            endDate: endDate ? endDate : undefined,
          },
        })
        .then((response) => {
          setUserId(response.userId);
          setTotalPages(Math.ceil(response.recordsTotal / length));
          setIsLoading(false);
          return response.data;
        })
        .catch((error) => {
          console.log(error);
        });

      console.log('DATA', response);
      setData(response);
    };
    fetchData();
  }, [page, length, sortState, filterApplied]);

  if (!isLoading && (!data || !data.length)) {
    return (
      <Flex gap="medium" direction="column">
        <Flex gap="medium" align="end">
          <DateInput
            label="Desde"
            value={startDate}
            onChange={setStartDate}
            placeholder="YYYY-MM-DD"
            max={endDate || undefined}
          />
          <DateInput
            label="Hasta"
            value={endDate}
            onChange={setEndDate}
            placeholder="YYYY-MM-DD"
            min={startDate || undefined}
          />
          <Button
            type="primary"
            onClick={() => {
              setPage(1); // Volvemos a la primera página cuando aplicamos un filtro nuevo
              setFilterApplied((prev) => !prev); // Esto fuerza el useEffect para que recargue los datos
            }}
            disabled={!startDate && !endDate}
          >
            Filtrar
          </Button>
          {(startDate || endDate) && (
            <Button
              type="secondary"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setPage(1);
                setFilterApplied((prev) => !prev);
              }}
            >
              Limpiar filtro
            </Button>
          )}
        </Flex>

        <EmptyState title="Aún nada por aquí" layout="vertical" reverseOrder={true}>
          <Text>Espere mientras los pacientes comienzan a compartir su información!</Text>
        </EmptyState>
      </Flex>
    )
  }

  return (
    <>
      <Flex gap="medium" direction="column">
        <Flex gap="medium" align="end">
          <DateInput
            label="Desde"
            value={startDate}
            onChange={setStartDate}
            placeholder="YYYY-MM-DD"
            max={endDate || undefined}
          />
          <DateInput
            label="Hasta"
            value={endDate}
            onChange={setEndDate}
            placeholder="YYYY-MM-DD"
            min={startDate || undefined}
          />
          <Button
            type="primary"
            onClick={() => {
              setPage(1); // Volvemos a la primera página cuando aplicamos un filtro nuevo
              setFilterApplied((prev) => !prev); // Esto fuerza el useEffect para que recargue los datos
            }}
            disabled={!startDate && !endDate}
          >
            Filtrar
          </Button>
          {(startDate || endDate) && (
            <Button
              type="secondary"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setPage(1);
                setFilterApplied((prev) => !prev);
              }}
            >
              Limpiar filtro
            </Button>
          )}
        </Flex>

        <Table paginated={true} page={page} pageCount={totalPages} onPageChange={(page) => {
          setPage(page);
        }}>
          <TableHead>
            <TableRow>
              <TableHeader width={"min"}
                sortDirection={sortState}
                onSortChange={(sortDirection) =>
                  setSortState(sortDirection)
                }
              >
                Fecha
              </TableHeader>
              <TableHeader>Resumen</TableHeader>
              <TableHeader width={"min"}>Acción</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Flex justify="center" align="center" gap="large">
                    <LoadingSpinner label="Loading..." />
                  </Flex>
                </TableCell>
              </TableRow>
            ) : (

              data.map((analytic) => {
                return (
                  <TableRow key={analytic.id}>
                    <TableCell width={"min"}>{formatDate(analytic.fechaSubida)}</TableCell>
                    <TableCell>{analytic.respuestaChatgpt}</TableCell>
                    <TableCell>
                      <Button
                        overlay={<HealthAnalyticDetails
                          analytic={analytic}
                          userId={userId} />}
                      >
                        Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Flex>
    </>
  );
};