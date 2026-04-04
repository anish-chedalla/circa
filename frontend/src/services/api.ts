/**
 * Centralised Axios instance and typed HTTP helper functions.
 *
 * - Automatically attaches the JWT from `localStorage` on every request.
 * - Provides `get`, `post`, `put`, and `del` helpers that unwrap `response.data`.
 */

import axios, { type AxiosRequestConfig } from 'axios';

import logger from './logger';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

/* ------------------------------------------------------------------ */
/*  Request interceptor – attach JWT bearer token                     */
/* ------------------------------------------------------------------ */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => {
    logger.error('Request interceptor error', error);
    return Promise.reject(error);
  },
);

/* ------------------------------------------------------------------ */
/*  Response interceptor – centralised error handling                 */
/* ------------------------------------------------------------------ */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 401) {
        logger.warn('Unauthorised – clearing stored token');
        localStorage.removeItem('token');
      }

      const message =
        (error.response?.data as Record<string, unknown> | undefined)?.detail ??
        error.message;

      logger.error(`API error (${status ?? 'unknown'}):`, message);
    } else {
      logger.error('Unexpected error', error);
    }

    return Promise.reject(error);
  },
);

/* ------------------------------------------------------------------ */
/*  Typed helper functions                                            */
/* ------------------------------------------------------------------ */

/**
 * Perform a GET request and return the response body.
 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<T>(url, config);
  return response.data;
}

/**
 * Perform a POST request and return the response body.
 */
export async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.post<T>(url, data, config);
  return response.data;
}

/**
 * Perform a PUT request and return the response body.
 */
export async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.put<T>(url, data, config);
  return response.data;
}

/**
 * Perform a DELETE request and return the response body.
 */
export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.delete<T>(url, config);
  return response.data;
}

export default api;
