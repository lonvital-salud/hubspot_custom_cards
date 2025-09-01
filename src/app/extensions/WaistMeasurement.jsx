import React, { useEffect, useState } from "react";
import {
  Text,
  EmptyState,
  Flex,
  LoadingSpinner,
  hubspot,
  Table,
  TableHead,
  TableRow, TableHeader, TableBody, TableCell, TableFooter,
  LineChart,
  DateInput,
  Button
} from "@hubspot/ui-extensions";

// Define the extension to be run within the Hubspot CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

// Define the Extension component, taking in runServerless, context, & sendAlert as props
const Extension = ({ context, runServerless, sendAlert }) => {
  const [text, setText] = useState("");

  const [page, setPage] = useState(1);
  const [length, setLength] = useState(10);
  const [sortState, setSortState] = useState("descending");
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isComponentLoaded, setIsComponentLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadedChart, setIsLoadedChart] = useState(false);
  const [dataChart, setDataChart] = useState([]);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [filterApplied, setFilterApplied] = useState(false);

  useEffect(() => {
    // Fetch data from the serverless function
    const fetchData = async () => {
      setIsComponentLoaded(true);
      setIsLoading(true);
      const response = await hubspot
        .serverless('waistMeasurement', {
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
          setTotalPages(Math.ceil(response.recordsTotal / length));
          setIsLoading(false);
          return response.data;
          // handle response, which is the value returned from the function on success
        })
        .catch((error) => {
          console.log(error);
          // handle error, which is an Error object if the function failed to execute
        });

      //console.log("response", response);

      setData(response);
    };

    fetchData();
  }, [page, length, sortState, filterApplied]);

  useEffect(() => {
    setIsLoadedChart(false);
    if (data && data.length) {
      const chartData = data.map(({ ica, measurementTimeStamp, measurementWaistCm }) => {
        const fecha = new Date(measurementTimeStamp._seconds * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const fechaSinSegundos = fecha.split(' ')[1].split(':')[0] + ':' + fecha.split(' ')[1].split(':')[1];
        return {
          waistMeasurement: measurementWaistCm,
          label: `${measurementWaistCm} (${ica})`,
          date: `${fecha.split(' ')[0]} ${fechaSinSegundos}`, // new Date(measurementTimeStamp._seconds * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, ''), // quita los segundos y microsegundos
        }
      }).sort((a, b) => // Sort descencing by date
        new Date(b.date) - new Date(a.date)
      );
      // Set the chart data
      // console.log("chartData", chartData);
      setDataChart(chartData);
      setIsLoadedChart(true);
    }
  }, [data])

  if (!isComponentLoaded) {
    return <LoadingSpinner />
  }

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
              setPage(1); // Reinicia la paginación al aplicar filtro
              setFilterApplied((prev) => !prev); // Fuerza el useEffect
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
              setPage(1); // Reinicia la paginación al aplicar filtro
              setFilterApplied((prev) => !prev); // Fuerza el useEffect
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

        {(isLoadedChart && dataChart && dataChart.length) ? (
          <LineChart
            data={dataChart}
            options={{
              title: 'Evolución de la Medición de Cintura',
              showLegend: true,
              showDataLabels: true,
              showTooltips: true,
            }}
            axes={{
              x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
              y: { field: 'waistMeasurement', fieldType: 'linear', label: 'Medición de Cintura (cm)' },
            }}
          />
        ) : ''}

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
              <TableHeader width={"min"}>Circunferencia de cintura (cms.)</TableHeader>
              <TableHeader width={"min"}>ICA</TableHeader>
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

              data.map(({ id, ica, measurementTimeStamp, measurementWaistCm }) => {
                return (
                  <TableRow key={id}>
                    <TableCell width={"min"}>{new Date(measurementTimeStamp._seconds * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</TableCell>
                    <TableCell width={"min"}>{measurementWaistCm}</TableCell>
                    <TableCell width={"min"}>{ica}</TableCell>
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
