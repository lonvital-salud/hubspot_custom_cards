import {
    Button,
    DateInput,
    EmptyState,
    Flex,
    hubspot,
    LineChart,
    LoadingSpinner,
    Table,
    TableBody, TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Text
} from "@hubspot/ui-extensions";
import React, { useEffect, useState } from "react";

// Le decimos a HubSpot cómo ejecutar esta extensión dentro del CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

// El componente principal que maneja los registros de peso y composición corporal
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
    // Traemos los datos de peso desde nuestra función serverless
    const fetchData = async () => {
      setIsComponentLoaded(true);
      setIsLoading(true);
      const response = await hubspot
        .serverless('weightRegistries', {
          propertiesToSend: ['hs_object_id'],
          parameters: {
            objectType: context.crm.objectTypeId,
            objectId: context.crm.objectId,
            page,
            length,
            sortState,
            startDate: startDate ? startDate : undefined,
            endDate: endDate ? endDate : undefined
          },
        })
        .then((response) => {
          setTotalPages(Math.ceil(response.recordsTotal / length));
          setIsLoading(false);
          return response.data;
          // Manejamos la respuesta exitosa de la función
        })
        .catch((error) => {
          console.log(error);
          // Si algo falla, lo registramos en el log
        });

      setData(response);
    };

    fetchData();
  }, [page, length, sortState, filterApplied]);

  useEffect(() => {
    setIsLoadedChart(false);
    if (data && data.length) {
      const chartData = data.map(({ date, weight }) => ({
        date: new Date(date._seconds * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, ''),
        weight: weight
      })).sort((a, b) => // Ordenamos por fecha descendente (más reciente primero)
        new Date(b.date) - new Date(a.date)
      );
      // Guardamos los datos formateados para el gráfico
      // console.log("chartData", chartData);
      setDataChart(chartData);
      console.log("chartData", chartData);
      setIsLoadedChart(true);
    }
  }, [data])

  // Esta función llama a nuestra función serverless con los parámetros necesarios
  // El nombre de la función está configurado en el archivo serverless.json
  const handleClick = async () => {
    const { response } = await runServerless({ name: "weightRegistries", parameters: { text: text } });
    sendAlert({ message: response });
  };

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
        {(isLoadedChart && dataChart && dataChart.length) ? (
          <LineChart
            data={dataChart}
            options={{
              title: 'Evolución del Peso',
              showLegend: true,
              showDataLabels: true,
              showTooltips: true,
            }}
            axes={{
              x: { field: 'date', fieldType: 'datetime', label: 'Fecha' },
              y: { field: 'weight', fieldType: 'linear', label: 'Peso (kg)' },
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
              <TableHeader width={"min"}>Peso</TableHeader>
              <TableHeader width={"min"}>Masa Muscular</TableHeader>
              <TableHeader width={"min"}>Masa Grasa</TableHeader>
              <TableHeader width={"min"}>Masa Ósea</TableHeader>
              <TableHeader width={"min"}>Grasa Visceral</TableHeader>
              <TableHeader width={"min"}>Hidratación</TableHeader>
              <TableHeader width={"min"}>Tasa Metabólica Basal</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Flex justify="center" align="center" gap="large">
                    <LoadingSpinner label="Loading..." />
                  </Flex>
                </TableCell>
              </TableRow>
            ) : (

              data.map(({ date, id, weight, muscle_mass, fat_mass_weight, bone_mass, visceral_fat, hydration, basal_metabolic_rate }) => {
                return (
                  <TableRow key={id}>
                    <TableCell width={"min"}>{new Date(date._seconds * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, '')}</TableCell>
                    <TableCell width={"min"}>{weight}</TableCell>
                    <TableCell width={"min"}>{muscle_mass}</TableCell>
                    <TableCell width={"min"}>{fat_mass_weight}</TableCell>
                    <TableCell width={"min"}>{bone_mass}</TableCell>
                    <TableCell width={"min"}>{visceral_fat}</TableCell>
                    <TableCell width={"min"}>{hydration}</TableCell>
                    <TableCell width={"min"}>{basal_metabolic_rate}</TableCell>
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
