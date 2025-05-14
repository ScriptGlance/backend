import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../common/decorators/get-user.decorator';
import { PaymentsService } from './payments.service';
import { InvoiceStatusDto } from './dto/InvoiceStatusDto';
import { Request } from 'express';
import { Roles } from '../auth/roles.decorator';

@Controller('payments')
@ApiTags('Payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('subscription/checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @ApiBearerAuth()
  async checkoutSubscription(@GetUser('id') userId: number) {
    return await this.service.checkoutSubscription(userId);
  }

  @Post('webhook')
  @ApiBody({ type: InvoiceStatusDto })
  @HttpCode(HttpStatus.OK)
  async handleInvoiceStatus(
    @Req() req: Request & { rawBody: string },
    @Headers('x-sign') xSign: string,
    @Body() body: InvoiceStatusDto,
  ) {
    await this.service.handleInvoiceStatus(body, req.rawBody, xSign);
    return {};
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @ApiBearerAuth()
  async getSubscription(@GetUser('id') userId: number) {
    return await this.service.getSubscription(userId);
  }

  @Delete('subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @ApiBearerAuth()
  async cancelSubscription(@GetUser('id') userId: number) {
    return await this.service.cancelSubscription(userId);
  }

  @Get('subscription/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @ApiBearerAuth()
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    example: 0,
  })
  async getTransactions(
    @GetUser('id') userId: number,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
  ) {
    return await this.service.getTransactions(userId, limit, offset);
  }

  @Post('subscription/card/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  @ApiBearerAuth()
  async updateCard(@GetUser('id') userId: number) {
    return await this.service.updateCard(userId);
  }
}
