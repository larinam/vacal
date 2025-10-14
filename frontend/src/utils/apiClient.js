import {API_URL} from './apiConfig';

const serializeBody = (body) => {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  return JSON.stringify(body);
};

export const authedRequest = async ({
  endpoint,
  method = 'GET',
  body = null,
  isBlob = false,
  authHeader,
  currentTenant,
  signal,
}) => {
  const headers = {
    ...(authHeader ? {'Authorization': authHeader} : {}),
    ...(currentTenant ? {'Tenant-ID': currentTenant} : {}),
    ...(!isBlob ? {'Content-Type': 'application/json'} : {}),
  };

  const options = {
    method,
    headers,
    signal,
  };

  const serializedBody = serializeBody(body);
  if (serializedBody !== undefined) {
    options.body = serializedBody;
  }

  return fetch(`${API_URL}${endpoint}`, options);
};
