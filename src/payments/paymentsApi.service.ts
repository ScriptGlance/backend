import { lastValueFrom, Observable } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import * as process from 'node:process';

@Injectable()
export class PaymentsApiService {
  private readonly logger = new Logger(PaymentsApiService.name);
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 300;

  constructor(private readonly httpService: HttpService) {}

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async makePaymentRequest<T>(
    urlPart: string,
    payload: any = null,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    retryCount = 0,
  ): Promise<T> {
    const url = `${process.env.PAYMENTS_API_URL}/${urlPart}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Token': process.env.PAYMENTS_API_TOKEN,
    };

    try {
      let response: Observable<AxiosResponse<T>>;
      switch (method) {
        case 'GET':
          response = this.httpService.get(url, { headers });
          break;
        case 'POST':
          response = this.httpService.post(url, payload, { headers });
          break;
        case 'DELETE':
          response = this.httpService.delete(url, { headers });
          break;
        default:
          response = this.httpService.put(url, payload, { headers });
          break;
      }
      return (await lastValueFrom(response)).data;
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        const isNetworkError =
          (error as AxiosError).isAxiosError && !(error as AxiosError).response;
        const status = (error as AxiosError).response?.status;

        if (
          isNetworkError ||
          status === 429 ||
          status === 503 ||
          status === 500
        ) {
          const delayTime = this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          this.logger.warn(
            `Request to ${urlPart} failed. Retrying in ${delayTime}ms... (${retryCount + 1}/${this.MAX_RETRIES})`,
          );

          await this.delay(delayTime);
          return this.makePaymentRequest<T>(
            urlPart,
            payload,
            method,
            retryCount + 1,
          );
        }
      }

      throw error;
    }
  }
}
