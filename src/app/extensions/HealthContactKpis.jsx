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
  DateInput,
  Panel, PanelBody, PanelSection, PanelFooter,
  Accordion,
} from "@hubspot/ui-extensions";
import { useCallback } from "react";

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

  return (
    <>
      <Text>KPIs</Text>
    </>
  );
};