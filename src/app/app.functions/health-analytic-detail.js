const axios = require("axios");
const hubspot = require('@hubspot/api-client');

exports.main = async (context = {}) => {

  const firebaseApiUrl = process.env['LONVITAL_FIREBASE_API_URL'];
  const firebaseApiToken = process.env['LONVITAL_FIREBASE_API_TOKEN'];

  const params = {
    key: firebaseApiToken,
    userId: context.parameters.userId,
    documentId: context.parameters.documentId
  };

  return await axios.get(`${firebaseApiUrl}/firebase_get-health-analytic-detail`, {
    params
  }).then((response) => {
    return response.data;
  });
};

