import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentCardEntity } from '../common/entities/PaymentCardEntity';
import { SubscriptionEntity } from '../common/entities/SubscriptionEntity';
import { TransactionEntity } from '../common/entities/TransactionEntity';
import { UserEntity } from '../common/entities/UserEntity';
import { HttpModule } from '@nestjs/axios';
import { HTTP_MODULE_TIMEOUT_MS } from '../common/Constants';
import { PaymentsApiService } from './paymentsApi.service';
import { BillingService } from './billing.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ExpiredTransactionsService } from './expired-transactions.service';
import { PaymentsGateway } from './payments.gateway';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsApiService,
    BillingService,
    ExpiredTransactionsService,
    PaymentsGateway,
  ],
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PaymentCardEntity,
      SubscriptionEntity,
      TransactionEntity,
      UserEntity,
    ]),
    HttpModule.register({
      timeout: HTTP_MODULE_TIMEOUT_MS,
    }),
    CacheModule.register(),
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
