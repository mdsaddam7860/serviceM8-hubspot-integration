import axios from "axios";

const serviceM8Client = axios.create({
  baseURL: process.env.SERVICEM8_BASE_URL,
  headers: {
    accept: "application/json",
    "X-Api-Key": process.env.SERVICEM8_API_KEY,
  },
});

export { serviceM8Client };
