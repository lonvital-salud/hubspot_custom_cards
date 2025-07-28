import React, { useEffect, useState } from "react";
import {
  Divider,
  Link,
  Button,
  Text,
  EmptyState,
  Flex,
  LoadingSpinner,
  hubspot,
  Table,
  TableHead,
  TableRow, TableHeader, TableBody, TableCell, TableFooter,
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {

    // Fetch data from the serverless function
    const fetchData = async () => {
      setIsLoading(true);
      const response = await hubspot
        .serverless('sleepRegistries', {
          propertiesToSend: ['hs_object_id'],
          parameters: {
            objectType: context.crm.objectTypeId,
            objectId: context.crm.objectId,
            page,
            length,
            sortState
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

      setData(response);
    };
    fetchData();
  }, [page, length, sortState]);

  if (!isLoading && (!data || !data.length)) {
    return (
      <EmptyState title="Aún nada por aquí" layout="vertical" reverseOrder={true}>
        <Text>Espere mientras los pacientes comienzan a compartir su información!</Text>
      </EmptyState>
    )
  }

  const formatDate = function (date) {
    const newDate = new Date(date._seconds * 1000);
    var year = newDate.getFullYear();
    var month = newDate.getMonth() + 1; // Los meses empiezan en 0
    var day = newDate.getDate();

    // Asegurarse de que el mes y el día tengan dos dígitos
    if (month < 10) {
      month = '0' + month;
    }
    if (day < 10) {
      day = '0' + day;
    }

    return year + '-' + month + '-' + day;
  }

  return (
    <>
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
            <TableHeader width={"min"}>Total sueño (min)</TableHeader>
            <TableHeader width={"min"}>Total en cama</TableHeader>
            <TableHeader width={"min"}>Sueño profundo</TableHeader>
            <TableHeader width={"min"}>Sueño ligero</TableHeader>
            <TableHeader width={"min"}>Sueño REM</TableHeader>
            <TableHeader width={"min"}>Despierto</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Flex justify="center" align="center" gap="large">
                  <LoadingSpinner label="Loading..." />
                </Flex>
              </TableCell>
            </TableRow>
          ) : (

            data.map(({ datetime, id, totalMinutesAsleep, totalTimeInBed, stages }) => {
              return (
                <TableRow key={id}>
                  <TableCell width={"min"}>{formatDate(datetime)}</TableCell>
                  <TableCell>{totalMinutesAsleep}</TableCell>
                  <TableCell>{totalTimeInBed}</TableCell>
                  <TableCell>{stages.deep}</TableCell>
                  <TableCell>{stages.light}</TableCell>
                  <TableCell>{stages.rem}</TableCell>
                  <TableCell>{stages.wake}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </>
  );
};
