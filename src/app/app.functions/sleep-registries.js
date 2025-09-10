const axios = require("axios");
const hubspot = require('@hubspot/api-client');

function formatDateObj(dateObj) {
  if (!dateObj) return undefined;
  const year = dateObj.year;
  // Los meses en JavaScript van de 0-11, pero parece que aquí ya vienen en base 1, así que sumamos 1 por las dudas
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

  const response = await hubspotClient.crm.objects.associationsApi.getAll(
    context.parameters.objectType,
    context.parameters.objectId,
    'contacts'
  );

  const associatedContactId = response.results[0].id;
  const contact = await hubspotClient.crm.contacts.basicApi.getById(associatedContactId, ['firstname', 'lastname', 'email']);

  const params = {
    key: firebaseApiToken,
    userId: contact.properties.email,
    page: context.parameters.page,
    pageSize: context.parameters.length,
    order: context.parameters.sortState === 'ascending' ? 'asc' : 'desc',
  };

  const startDate = formatDateObj(context.parameters.startDate);
  const endDate = formatDateObj(context.parameters.endDate);
  if (startDate) {
    params.from = `${startDate}T00:00:00.000Z`; // Le agregamos la hora de inicio del día
  }
  if (endDate) {
    params.to = `${endDate}T23:59:59.000Z`; // Y la hora de fin del día para incluir todo el último día
  }

  return await axios.get(`${firebaseApiUrl}/firebase_get-sleep-registries`, {
    params
  }).then((response) => {
    return response.data;
  });
};

