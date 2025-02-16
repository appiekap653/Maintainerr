import axios, { AxiosInstance, RawAxiosRequestConfig } from 'axios';
import NodeCache from 'node-cache';

// 5 minute default TTL (in seconds)
const DEFAULT_TTL = 300;

// 10 seconds default rolling buffer (in ms)
const DEFAULT_ROLLING_BUFFER = 10000;

interface ExternalAPIOptions {
  nodeCache?: NodeCache;
  headers?: Record<string, unknown>;
}

export class ExternalApiService {
  protected axios: AxiosInstance;
  private baseUrl: string;
  private cache?: NodeCache;
  constructor(
    baseUrl: string,
    params: Record<string, unknown>,
    options: ExternalAPIOptions = {},
  ) {
    this.axios = axios.create({
      baseURL: baseUrl,
      params,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });
    this.baseUrl = baseUrl;
    this.cache = options.nodeCache;
  }
  public async get<T>(
    endpoint: string,
    config?: RawAxiosRequestConfig,
    ttl?: number,
  ): Promise<T> {
    try {
      const cacheKey = this.serializeCacheKey(endpoint, config?.params);
      const cachedItem = this.cache?.get<T>(cacheKey);
      if (cachedItem) {
        return cachedItem;
      }
      const response = await this.axios.get<T>(endpoint, config);

      if (this.cache) {
        this.cache.set(cacheKey, response.data, ttl ?? DEFAULT_TTL);
      }

      return response.data;
    } catch (err) {
      return undefined;
    }
  }

  public async delete<T>(
    endpoint: string,
    config?: RawAxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await this.axios.delete<T>(endpoint, config);
      return response.data;
    } catch (err) {
      return undefined;
    }
  }

  public async put<T>(
    endpoint: string,
    data: string,
    config?: RawAxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await this.axios.put<T>(endpoint, data, config);
      return response.data;
    } catch (err) {
      return undefined;
    }
  }

  public async post<T>(
    endpoint: string,
    data?: string,
    config?: RawAxiosRequestConfig,
  ): Promise<T> {
    try {
      const response = await this.axios.post<T>(endpoint, data, config);
      return response.data;
    } catch (err) {
      return undefined;
    }
  }

  public async getRolling<T>(
    endpoint: string,
    config?: RawAxiosRequestConfig,
    ttl?: number,
  ): Promise<T> {
    try {
      const cacheKey = this.serializeCacheKey(endpoint, config?.params);
      const cachedItem = this.cache?.get<T>(cacheKey);

      if (cachedItem) {
        const keyTtl = this.cache?.getTtl(cacheKey) ?? 0;

        // If the item has passed our rolling check, fetch again in background
        if (
          keyTtl - (ttl ?? DEFAULT_TTL) * 1000 <
          Date.now() - DEFAULT_ROLLING_BUFFER
        ) {
          this.axios.get<T>(endpoint, config).then((response) => {
            this.cache?.set(cacheKey, response.data, ttl ?? DEFAULT_TTL);
          });
        }
        return cachedItem;
      }

      const response = await this.axios.get<T>(endpoint, config);

      if (this.cache) {
        this.cache.set(cacheKey, response.data, ttl ?? DEFAULT_TTL);
      }

      return response.data;
    } catch (err) {
      return undefined;
    }
  }

  private serializeCacheKey(
    endpoint: string,
    params?: Record<string, unknown>,
  ) {
    try {
      if (!params) {
        return `${this.baseUrl}${endpoint}`;
      }

      return `${this.baseUrl}${endpoint}${JSON.stringify(params)}`;
    } catch (err) {
      return undefined;
    }
  }
}
