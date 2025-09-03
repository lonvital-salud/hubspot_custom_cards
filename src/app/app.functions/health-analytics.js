const axios = require("axios");
const hubspot = require('@hubspot/api-client');

function formatDateObj(dateObj) {
  if (!dateObj) return undefined;
  const year = dateObj.year;
  // Sumar 1 al mes si viene en base 0, pero según tu ejemplo parece que ya es base 1
  const month = String(dateObj.month + 1).padStart(2, '0');
  const day = String(dateObj.date).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

exports.main = async (context = {}) => {

  const firebaseApiUrl = process.env['LONVITAL_FIREBASE_API_URL'];
  const firebaseApiToken = process.env['LONVITAL_FIREBASE_API_TOKEN'];

  const hubspotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN']
  });

  // Obtiene contacto de la HC
  const response = await hubspotClient.crm.objects.associationsApi.getAll(
    context.parameters.objectType,
    context.parameters.objectId,
    'contacts'
  );

  const associatedContactId = response.results[0].id;
  const contact = await hubspotClient.crm.contacts.basicApi.getById(associatedContactId, ['firstname', 'lastname', 'email', 'lonvital_app_uid']);

  const params = {
    key: firebaseApiToken,
    userEmail: contact.properties.email,
    userId: contact.properties.lonvital_app_uid,
    page: context.parameters.page,
    pageSize: context.parameters.length,
    order: context.parameters.sortState === 'ascending' ? 'asc' : 'desc',
  };

  const startDate = formatDateObj(context.parameters.startDate);
  const endDate = formatDateObj(context.parameters.endDate);
  if (startDate) {
    params.from = `${startDate}T00:00:00.000Z`; // Agregar 'T00:00:00.000Z' al final de la fecha startDate;
  }
  if (endDate) {
    params.to = `${endDate}T23:59:59.000Z`; // Agregar 'T23:59:59.000Z' al final de la fecha endDate;
  }

  return await axios.get(`${firebaseApiUrl}/firebase_get-health-analytics`, {
    params
  }).then((response) => {
    return response.data;
  });
};

