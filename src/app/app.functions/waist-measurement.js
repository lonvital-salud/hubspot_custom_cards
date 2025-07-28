const axios = require("axios");
const hubspot = require('@hubspot/api-client');

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
  console.log("associatedContactId", associatedContactId);
  const contact = await hubspotClient.crm.contacts.basicApi.getById(associatedContactId, ['firstname', 'lastname', 'email']);

  const params = {
    key: firebaseApiToken,
    userId: contact.properties.email,
    page: context.parameters.page,
    pageSize: context.parameters.length,
    order: context.parameters.sortState === 'ascending' ? 'asc' : 'desc',
  };
  console.log('PARAMS', params)
  return await axios.get(`${firebaseApiUrl}/firebase_get-waist-measurement`, {
    params
  }).then((response) => {
    return response.data;
  });
};

