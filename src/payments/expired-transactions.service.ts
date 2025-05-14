import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '../common/entities/TransactionEntity';
import { InvoiceStatus } from '../common/enum/InvoiceStatus';
import { INVOICE_VALIDITY_SECONDS } from '../common/Constants';
import { subSeconds } from 'date-fns';

@Injectable()
export class ExpiredTransactionsService {
  private readonly logger = new Logger(ExpiredTransactionsService.name);

  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'expiredTransactions' })
  async markExpiredTransactions() {
    this.logger.log('Running expired transactions check');

    const expirationThreshold = subSeconds(
      new Date(),
      INVOICE_VALIDITY_SECONDS,
    );

    try {
      const expiredTransactions = await this.transactionRepository
        .createQueryBuilder('transaction')
        .leftJoinAndSelect('transaction.subscription', 'subscription')
        .where(
          '(transaction.status = :createdStatus OR transaction.status IS NULL)' +
            ' AND transaction.modifiedDate < :threshold',
          {
            createdStatus: InvoiceStatus.CREATED,
            threshold: expirationThreshold,
          },
        )
        .getMany();

      if (expiredTransactions.length === 0) {
        this.logger.log('No expired transactions found');
        return;
      }

      this.logger.log(
        `Found ${expiredTransactions.length} expired transactions to update`,
      );

      for (const transaction of expiredTransactions) {
        transaction.status = InvoiceStatus.EXPIRED;
        await this.transactionRepository.save(transaction);

        this.logger.log(
          `Marked transaction ${transaction.invoiceId} as EXPIRED (ID: ${transaction.transactionId})`,
        );
      }

      this.logger.log(
        `Successfully marked ${expiredTransactions.length} transactions as expired`,
      );
    } catch (error) {
      this.logger.error('Failed to mark expired transactions', error);
    }
  }
}
