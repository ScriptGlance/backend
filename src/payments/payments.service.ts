import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { StandardResponse } from '../common/interface/StandardResponse';
import { CheckoutSubscriptionResponseDto } from './dto/CheckoutSubscriptionResponseDto';
import {
  MIN_PAYMENT_AMOUNT,
  PAYMENT_API_REQUEST_BATCH_SIZE,
  PAYMENT_API_REQUEST_INTERVAL_MS,
  PREMIUM_PRICE_CENTS,
  SUBSCRIPTION_FAILURE_PAYMENT_RETRY_COUNT,
  INVOICE_VALIDITY_SECONDS,
  UAH_CURRENCY_CODE,
  USD_CURRENCY_CODE,
  WEBHOOK_CACHE_EXPIRATION_TIME_MS,
  WEBHOOK_PUBLIC_KEY_MIN_UPDATE_INTERVAL_MS,
} from '../common/Constants';
import { CreateInvoiceRequestDto } from './dto/CreateInvoiceRequestDto';
import { PaymentType } from '../common/enum/PaymentType';
import * as process from 'node:process';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionEntity } from '../common/entities/SubscriptionEntity';
import { In, LessThanOrEqual, Not, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { CreateInvoiceResponseDto } from './dto/CreateInvoiceResponseDto';
import { TransactionEntity } from '../common/entities/TransactionEntity';
import { InvoiceStatusDto } from './dto/InvoiceStatusDto';
import { createVerify } from 'node:crypto';
import { WebHookPublicKeyResponseDto } from './dto/WebHookPublicKeyResponseDto';
import { InvoiceStatus } from '../common/enum/InvoiceStatus';
import { SubscriptionStatus } from '../common/enum/SubscriptionStatus';
import { addMonths, lastDayOfMonth, subSeconds } from 'date-fns';
import { WalletStatus } from '../common/enum/WalletStatus';
import { PaymentCardEntity } from '../common/entities/PaymentCardEntity';
import { SubscriptionDto } from './dto/SubscriptionDto';
import { PaymentCardDto } from './dto/PaymentCardDto';
import { TransactionDto } from './dto/TransactionDto';
import { CancelInvoiceRequestDto } from './dto/CancelInvoiceRequestDto';
import { PaymentsApiService } from './paymentsApi.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(PaymentCardEntity)
    private readonly paymentCardRepository: Repository<PaymentCardEntity>,
    private readonly paymentsApiService: PaymentsApiService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private webhookPublicKey = '';
  private webhookPublicKeyFetchedAt = 0;

  async onModuleInit() {
    try {
      this.logger.log('Checking for pending transactions on startup...');
      await this.checkPendingTransactions();
    } catch (error) {
      this.logger.error(
        'Failed to check pending transactions on startup',
        error,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async checkPendingTransactions(): Promise<void> {
    const pendingTransactions = await this.transactionRepository.find({
      where: {
        status: Not(
          In([
            InvoiceStatus.SUCCESS,
            InvoiceStatus.FAILURE,
            InvoiceStatus.HOLD,
            InvoiceStatus.REVERSED,
          ]),
        ),
      },
      relations: ['subscription', 'subscription.paymentCard'],
    });

    if (pendingTransactions.length === 0) {
      this.logger.log('No pending transactions found');
      return;
    }

    this.logger.log(
      `Found ${pendingTransactions.length} pending transactions to check`,
    );

    for (let i = 0; i < pendingTransactions.length; i++) {
      const transaction = pendingTransactions[i];
      try {
        this.logger.log(
          `Checking transaction ${transaction.invoiceId} (${i + 1}/${pendingTransactions.length})`,
        );

        const invoiceStatus =
          await this.paymentsApiService.makePaymentRequest<InvoiceStatusDto>(
            `api/merchant/invoice/status?invoiceId=${transaction.invoiceId}`,
          );

        await this.processInvoiceStatus(transaction, invoiceStatus);

        this.logger.log(
          `Updated transaction ${transaction.invoiceId} status to ${invoiceStatus.status}`,
        );

        if (
          (i + 1) % PAYMENT_API_REQUEST_BATCH_SIZE === 0 &&
          i < pendingTransactions.length - 1
        ) {
          this.logger.log(
            `Processed ${PAYMENT_API_REQUEST_BATCH_SIZE} requests, waiting ${PAYMENT_API_REQUEST_INTERVAL_MS}ms before next batch`,
          );
          await this.delay(PAYMENT_API_REQUEST_INTERVAL_MS);
        }
      } catch (error) {
        this.logger.error(
          `Failed to check transaction ${transaction.invoiceId}:`,
          error,
        );
      }
    }

    this.logger.log('Finished checking pending transactions');
  }

  async checkoutSubscription(
    userId: number,
  ): Promise<StandardResponse<CheckoutSubscriptionResponseDto>> {
    let subscription = await this.subscriptionRepository.findOne({
      where: { user: { userId } },
    });

    if (subscription?.status == SubscriptionStatus.ACTIVE) {
      throw new ConflictException('Subscription already active');
    }

    if (!subscription) {
      subscription = (await this.subscriptionRepository.save({
        user: { userId },
        walletId: this.generateWalletId(),
      }))!;
    }

    const payload: CreateInvoiceRequestDto = {
      amount: PREMIUM_PRICE_CENTS,
      ccy: USD_CURRENCY_CODE,
      paymentType: PaymentType.DEBIT,
      redirectUrl: process.env.SUBSCRIPTION_CHECKOUT_REDIRECT_URL!,
      webHookUrl: process.env.PAYMENTS_WEBHOOK_URL!,
      validity: INVOICE_VALIDITY_SECONDS,
      saveCardData: {
        saveCard: true,
        walletId: subscription.walletId,
      },
    };

    const response =
      await this.paymentsApiService.makePaymentRequest<CreateInvoiceResponseDto>(
        'api/merchant/invoice/create',
        payload,
        'POST',
      );

    await this.transactionRepository.save({
      invoiceId: response.invoiceId,
      modifiedDate: subSeconds(Date.now(), 1), // Subtract 1s to ensure our stored modifiedDate is before the webhook's ms-truncated timestamp
      currency: USD_CURRENCY_CODE,
      amount: PREMIUM_PRICE_CENTS,
      subscription,
    });

    console.log('transaction saved', response.invoiceId);

    return {
      data: {
        checkout_url: response.pageUrl,
      },
      error: false,
    };
  }

  private generateWalletId(): string {
    return randomBytes(16).toString('hex');
  }

  async handleInvoiceStatus(
    data: InvoiceStatusDto,
    rawBody: string,
    xSign: string,
  ) {
    console.log('Webhook, modifiedDate', data.modifiedDate);
    if (!this.webhookPublicKey) {
      await this.fetchAndCachePublicKey();
    }

    let verified = this.verify(this.webhookPublicKey, rawBody, xSign);

    if (!verified) {
      await this.fetchAndCachePublicKey();
      verified = this.verify(this.webhookPublicKey, rawBody, xSign);
      if (!verified) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const transaction = await this.transactionRepository.findOne({
      where: {
        invoiceId: data.invoiceId,
        modifiedDate: LessThanOrEqual(new Date(data.modifiedDate)),
      },
      relations: ['subscription', 'subscription.paymentCard'],
    });

    if (!transaction) {
      const expiredTransaction = await this.transactionRepository.findOne({
        where: {
          invoiceId: data.invoiceId,
        },
      });
      console.log('expiredTransaction', expiredTransaction);
      return;
    }

    if (!transaction) {
      const cacheKey = `pending-webhook:${data.invoiceId}`;
      const cachedData: InvoiceStatusDto | null =
        await this.cacheManager.get(cacheKey);
      if (
        !cachedData ||
        new Date(cachedData.modifiedDate) <= new Date(data.modifiedDate)
      ) {
        await this.cacheManager.set(
          cacheKey,
          data,
          WEBHOOK_CACHE_EXPIRATION_TIME_MS,
        );
      }
      return;
    }

    await this.processInvoiceStatus(transaction, data);
  }

  async processInvoiceStatus(
    transaction: TransactionEntity,
    data: InvoiceStatusDto,
  ) {
    if (transaction.modifiedDate > new Date(data.modifiedDate)) {
      return;
    }

    transaction.modifiedDate = new Date(data.modifiedDate);

    const subscription = transaction.subscription;

    if (
      data.status === InvoiceStatus.SUCCESS &&
      subscription &&
      (subscription.status !== SubscriptionStatus.ACTIVE ||
        (subscription.nextPaymentDate &&
          subscription.nextPaymentDate.getTime() < new Date().getTime())) &&
      !transaction.isCardUpdating
    ) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.cancellationDate = null;
      if (!subscription.startDate) {
        subscription.startDate = new Date(data.modifiedDate);
      }

      const now = new Date();
      let paymentDate = addMonths(now, 1);

      if (paymentDate.getDate() !== now.getDate()) {
        paymentDate = lastDayOfMonth(paymentDate);
      }

      subscription.nextPaymentDate = paymentDate;
      await this.subscriptionRepository.save(subscription);
    }

    console.log('invoice', data);

    if (
      data.status === InvoiceStatus.FAILURE &&
      !transaction.isCardUpdating &&
      subscription.nextPaymentDate &&
      subscription.nextPaymentDate.getTime() < new Date().getTime()
    ) {
      if (subscription.status === SubscriptionStatus.ACTIVE) {
        subscription.status = SubscriptionStatus.PAST_DUE;
      } else if (subscription.status === SubscriptionStatus.PAST_DUE) {
        const lastSuccessfulTransaction =
          await this.transactionRepository.findOne({
            where: {
              subscription: { subscriptionId: subscription.subscriptionId },
              status: InvoiceStatus.SUCCESS,
              isCardUpdating: false,
            },
            order: { modifiedDate: 'DESC' },
          });

        const failedTransactionsQuery = this.transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.subscriptionId = :subscriptionId', {
            subscriptionId: subscription.subscriptionId,
          })
          .andWhere('transaction.status = :status', {
            status: InvoiceStatus.FAILURE,
          })
          .andWhere('transaction.isCardUpdating = false');

        if (lastSuccessfulTransaction) {
          failedTransactionsQuery.andWhere(
            'transaction.modifiedDate > :lastSuccessDate',
            {
              lastSuccessDate: lastSuccessfulTransaction.modifiedDate,
            },
          );
        }

        const failedTransactions = await failedTransactionsQuery.getCount();
        const totalFailedCount = failedTransactions + 1;

        if (totalFailedCount > SUBSCRIPTION_FAILURE_PAYMENT_RETRY_COUNT) {
          subscription.status = SubscriptionStatus.CANCELLED;
          subscription.cancellationDate = new Date();
          subscription.nextPaymentDate = null;
          subscription.startDate = null;
        }
      }
      await this.subscriptionRepository.save(subscription);
    }

    if (data.walletData?.status === WalletStatus.CREATED) {
      if (subscription.paymentCardId) {
        try {
          await this.paymentsApiService.makePaymentRequest<void>(
            `api/merchant/wallet/card?cardToken=${subscription.paymentCard.token}`,
            null,
            'DELETE',
          );
        } catch (error) {
          console.error('Error deleting card through API:', error);
        }
        await this.paymentCardRepository.delete(subscription.paymentCardId);
      }
      await this.paymentCardRepository.save({
        token: data.walletData.cardToken,
        paymentSystem: data.paymentInfo?.paymentSystem ?? '',
        maskedNumber: data.paymentInfo?.maskedPan ?? '',
        subscription,
      });
    }

    if (
      data.status === InvoiceStatus.HOLD &&
      transaction.isCardUpdating &&
      transaction.status !== InvoiceStatus.HOLD
    ) {
      const payload: CancelInvoiceRequestDto = {
        invoiceId: data.invoiceId,
      };

      await this.paymentsApiService.makePaymentRequest<void>(
        'api/merchant/invoice/cancel',
        payload,
        'POST',
      );
    }

    transaction.status = data.status;
    await this.transactionRepository.save(transaction);
  }

  private async fetchAndCachePublicKey(update: boolean = false): Promise<void> {
    if (
      update &&
      this.webhookPublicKeyFetchedAt >
        Date.now() - WEBHOOK_PUBLIC_KEY_MIN_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    const response =
      await this.paymentsApiService.makePaymentRequest<WebHookPublicKeyResponseDto>(
        `api/merchant/pubkey`,
      );
    this.webhookPublicKey = response.key;
    this.webhookPublicKeyFetchedAt = Date.now();
  }

  private verify(
    publicKeyBase64: string,
    rawBody: string,
    xSign: string,
  ): boolean {
    const signature = Buffer.from(xSign, 'base64');
    const publicKey = Buffer.from(publicKeyBase64, 'base64');

    const verifier = createVerify('SHA256');
    verifier.update(rawBody);
    verifier.end();

    return verifier.verify(publicKey, signature);
  }

  async getSubscription(
    userId: number,
  ): Promise<StandardResponse<SubscriptionDto | null>> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { user: { userId } },
      relations: ['paymentCard'],
    });
    if (!subscription) {
      return {
        data: null,
        error: false,
      };
    }
    return {
      data: {
        status: subscription.status,
        next_payment_date: subscription.nextPaymentDate,
        payment_card: subscription.paymentCard
          ? ({
              masked_number: subscription.paymentCard.maskedNumber,
              payment_system: subscription.paymentCard.paymentSystem,
            } as PaymentCardDto)
          : null,
      },
      error: false,
    };
  }

  async cancelSubscription(userId: number): Promise<StandardResponse<void>> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { user: { userId }, status: SubscriptionStatus.ACTIVE },
      relations: ['paymentCard'],
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancellationDate = new Date();
    subscription.startDate = null;
    subscription.nextPaymentDate = null;
    await this.subscriptionRepository.save(subscription);

    if (subscription.paymentCard) {
      try {
        await this.paymentsApiService.makePaymentRequest<void>(
          `api/merchant/wallet/card?cardToken=${subscription.paymentCard.token}`,
          null,
          'DELETE',
        );
      } catch (error) {
        console.error('Error deleting card through API:', error);
      }
      await this.paymentCardRepository.delete(subscription.paymentCardId);
    }

    return {
      error: false,
    };
  }

  async getTransactions(
    userId: number,
    limit: number,
    offset: number,
  ): Promise<StandardResponse<TransactionDto[]>> {
    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.subscription', 'subscription')
      .leftJoin('subscription.user', 'user')
      .where('user.userId = :userId', { userId })
      .andWhere('transaction.isCardUpdating = false')
      .orderBy('transaction.modifiedDate', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    const transactionDtos = transactions.map(
      (transaction) =>
        ({
          id: transaction.transactionId,
          date: transaction.modifiedDate,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
        }) as TransactionDto,
    );

    return {
      data: transactionDtos,
      error: false,
    };
  }

  async updateCard(
    userId: number,
  ): Promise<StandardResponse<CheckoutSubscriptionResponseDto>> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { user: { userId }, status: SubscriptionStatus.ACTIVE },
      relations: ['paymentCard'],
    });
    if (!subscription || !subscription.paymentCard) {
      throw new NotFoundException('Subscription not found');
    }

    const payload: CreateInvoiceRequestDto = {
      amount: MIN_PAYMENT_AMOUNT,
      ccy: UAH_CURRENCY_CODE,
      paymentType: PaymentType.HOLD,
      redirectUrl: process.env.SUBSCRIPTION_CHECKOUT_REDIRECT_URL!,
      webHookUrl: process.env.PAYMENTS_WEBHOOK_URL!,
      validity: INVOICE_VALIDITY_SECONDS,
      saveCardData: {
        saveCard: true,
        walletId: subscription.walletId,
      },
    };

    const response =
      await this.paymentsApiService.makePaymentRequest<CreateInvoiceResponseDto>(
        'api/merchant/invoice/create',
        payload,
        'POST',
      );

    await this.transactionRepository.save({
      invoiceId: response.invoiceId,
      modifiedDate: subSeconds(Date.now(), 1), // Subtract 1s to ensure our stored modifiedDate is before the webhook's ms-truncated timestamp
      currency: UAH_CURRENCY_CODE,
      amount: MIN_PAYMENT_AMOUNT,
      subscription,
      isCardUpdating: true,
    });

    return {
      data: {
        checkout_url: response.pageUrl,
      },
      error: false,
    };
  }
}
