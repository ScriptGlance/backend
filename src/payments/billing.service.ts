import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionEntity } from '../common/entities/SubscriptionEntity';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PaymentsApiService } from './paymentsApi.service';
import * as process from 'node:process';
import {
  PAYMENT_API_REQUEST_BATCH_SIZE,
  PAYMENT_API_REQUEST_INTERVAL_MS,
  PREMIUM_PRICE_CENTS,
  SUBSCRIPTION_FAILURE_PAYMENT_RETRY_INTERVAL_MS,
  USD_CURRENCY_CODE,
} from '../common/Constants';
import { PaymentType } from '../common/enum/PaymentType';
import { PaymentByTokenRequestDto } from './dto/PaymentByTokenRequestDto';
import { TransactionEntity } from '../common/entities/TransactionEntity';
import { PaymentByTokenResponseDto } from './dto/PaymentByTokenResponseDto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InvoiceStatusDto } from './dto/InvoiceStatusDto';
import { PaymentsService } from './payments.service';
import { subSeconds } from 'date-fns';
import { SubscriptionStatus } from '../common/enum/SubscriptionStatus';
import { InvoiceStatus } from '../common/enum/InvoiceStatus';
import { PaymentByTokenInitiationKind } from '../common/enum/PaymentByTokenInitiationKind';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    private readonly paymentsApiService: PaymentsApiService,
    private readonly paymentsService: PaymentsService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private readonly logger = new Logger(BillingService.name);

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleDailyBilling() {
    const activeSubscriptions = await this.subscriptionRepository.find({
      where: {
        nextPaymentDate: LessThanOrEqual(new Date()),
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['user', 'paymentCard'],
    });

    const retryTimeThreshold = new Date(
      Date.now() - SUBSCRIPTION_FAILURE_PAYMENT_RETRY_INTERVAL_MS,
    );

    const pastDueSubscriptionsToRetry = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .innerJoinAndSelect('subscription.user', 'user')
      .innerJoinAndSelect('subscription.paymentCard', 'paymentCard')
      .leftJoin(
        (qb) => {
          return qb
            .from(TransactionEntity, 'tr')
            .select('tr.subscription_id')
            .addSelect('MAX(tr.modifiedDate)', 'last_failure_date')
            .where('tr.isCardUpdating = false')
            .andWhere('tr.status = :failureStatus', {
              failureStatus: InvoiceStatus.FAILURE,
            })
            .groupBy('tr.subscription_id');
        },
        'last_failure',
        'last_failure.subscription_id = subscription.subscription_id',
      )
      .where('subscription.status = :pastDueStatus', {
        pastDueStatus: SubscriptionStatus.PAST_DUE,
      })
      .andWhere('subscription.next_payment_date <= :now', { now: new Date() })
      .andWhere(
        '(last_failure.last_failure_date IS NULL OR last_failure.last_failure_date <= :retryThreshold)',
        { retryThreshold: retryTimeThreshold },
      )
      .getMany();

    this.logger.log(
      `Found ${activeSubscriptions.length} active and ${pastDueSubscriptionsToRetry.length} past_due subscriptions eligible for billing`,
    );

    const subscriptionsForBilling = [
      ...activeSubscriptions,
      ...pastDueSubscriptionsToRetry,
    ];

    for (let i = 0; i < subscriptionsForBilling.length; i++) {
      const subscription = subscriptionsForBilling[i];
      try {
        const payload: PaymentByTokenRequestDto = {
          amount: PREMIUM_PRICE_CENTS,
          ccy: USD_CURRENCY_CODE,
          paymentType: PaymentType.DEBIT,
          redirectUrl: process.env.SUBSCRIPTION_CHECKOUT_REDIRECT_URL!,
          webHookUrl: process.env.PAYMENTS_WEBHOOK_URL!,
          cardToken: subscription.paymentCard.token,
          initiationKind: PaymentByTokenInitiationKind.Merchant,
        };

        this.logger.log(
          `Making request to payments API for subscription ${subscription.subscriptionId}`,
        );

        const response =
          await this.paymentsApiService.makePaymentRequest<PaymentByTokenResponseDto>(
            'api/merchant/wallet/payment',
            payload,
            'POST',
          );

        const transaction = await this.transactionRepository.save({
          invoiceId: response.invoiceId,
          modifiedDate: subSeconds(response.modifiedDate, 1), // Subtract 1s to ensure our stored modifiedDate is before the webhook's ms-truncated timestamp
          currency: USD_CURRENCY_CODE,
          amount: PREMIUM_PRICE_CENTS,
          subscription,
        });

        this.logger.log(
          'Transaction saved',
          'modifiedDate',
          response.modifiedDate,
        );
        const pendingWebhookInvoiceStatus: InvoiceStatusDto | null =
          await this.cacheManager.get(`pending-webhook:${response.invoiceId}`);

        if (pendingWebhookInvoiceStatus) {
          this.logger.log('Pending webhook found');
          await this.cacheManager.del(`pending-webhook:${response.invoiceId}`);
          await this.paymentsService.processInvoiceStatus(
            transaction,
            pendingWebhookInvoiceStatus,
          );
        }

        this.logger.log(`Charged subscription ${subscription.subscriptionId}`);

        if (
          (i + 1) % PAYMENT_API_REQUEST_BATCH_SIZE === 0 &&
          i < subscriptionsForBilling.length - 1
        ) {
          this.logger.log(
            `Processed ${PAYMENT_API_REQUEST_BATCH_SIZE} requests, waiting ${PAYMENT_API_REQUEST_INTERVAL_MS}ms before next batch`,
          );
          await this.delay(PAYMENT_API_REQUEST_INTERVAL_MS);
        }
      } catch (err) {
        this.logger.error(
          `Failed to charge sub ${subscription.subscriptionId}`,
          err,
        );
      }
    }
  }
}
