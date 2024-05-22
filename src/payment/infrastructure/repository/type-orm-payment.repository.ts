import { PaymentEntity as DomainPaymentEntity } from '@/payment/domain/entity/payment.entity';
import { PaymentStatusEnum } from '@/payment/domain/enum/payment-status.enum';
import { PaymentRepository } from '@/payment/domain/repository/payment.repository.interface';
import { In, Repository } from 'typeorm';
import { PaymentEntity as InfrastructurePaymentEntity } from '../entity/payment.entity';
import { MoneyValueObject } from '@/shared/domain/value-object/money.value-object';
import { EntityIdValueObject } from '@/shared/domain/value-object/entity-id.value-object';
import { PaymentMethodEnum } from '@/payment/domain/enum/payment-method.enum';
import { InjectRepository } from '@nestjs/typeorm';

export class TypeOrmPaymentRepository implements PaymentRepository {
  constructor(
    @InjectRepository(InfrastructurePaymentEntity)
    private readonly typeOrmRepository: Repository<InfrastructurePaymentEntity>,
  ) {}

  async existsWithOrderIdAndNotFailed(orderId: string): Promise<boolean> {
    return await this.typeOrmRepository.exists({
      where: {
        orderId,
        status: In([PaymentStatusEnum.PENDING, PaymentStatusEnum.PAID]),
      },
    });
  }
  async save(payment: DomainPaymentEntity): Promise<DomainPaymentEntity> {
    const dbEntity = await this.typeOrmRepository.save(
      this.mapToDbEntity(payment),
    );

    return this.mapToDomainEntity(dbEntity);
  }

  private mapToDomainEntity(
    entity: InfrastructurePaymentEntity,
  ): DomainPaymentEntity {
    return new DomainPaymentEntity({
      id: EntityIdValueObject.create(entity.id),
      orderId: entity.orderId,
      total: MoneyValueObject.create(entity.total),
      paymentMethod: entity.paymentMethod as PaymentMethodEnum,
      status: entity.status as PaymentStatusEnum,
      externalPaymentId: entity.externalPaymentId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private mapToDbEntity(
    entity: DomainPaymentEntity,
  ): InfrastructurePaymentEntity {
    return {
      id: entity.id.value,
      orderId: entity.orderId,
      total: entity.total.value,
      paymentMethod: entity.paymentMethod,
      status: entity.status,
      externalPaymentId: entity.externalPaymentId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
