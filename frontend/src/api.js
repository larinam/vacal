import axios from "axios";
import { AUTH_TOKEN_KEY } from "./consts";

const API_URL = process.env.REACT_APP_API_URL;

export const apiInstance = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: sessionStorage.getItem(AUTH_TOKEN_KEY),
  },
})

apiInstance.interceptors.response.use(
  response => response,
  error => {
    // Reject promise if usual error
    if (error.status !== 401) {
      return Promise.reject(error);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      window.location.reload();
    }
  }
)
