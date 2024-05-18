import {
  CustomerEntityPropsWithId as DomainCustomerEntityPropsWithId,
  CustomerEntity as DomainCustomerEntity,
  EssentialCustomerEntityProps as DomainEssentialCustomerEntityProps,
} from '@/customer/domain/entity/customer.entity';
import {
  EssentialCustomerEntityProps as InfrastructureEssentialCustomerEntityProps,
  CustomerEntity as InfrastructureCustomerEntity,
} from '../entity/customer.entity';
import { CustomerRepository } from '@/customer/domain/repository/customer.repository.interface';
import { CpfValueObject } from '@/customer/domain/value-object/cpf.value-object';
import { Repository } from 'typeorm';
import { EntityIdValueObject } from '@/shared/domain/value-object/entity-id.value-object';
import { FullNameValueObject } from '@/customer/domain/value-object/full-name.value-object';
import { EmailValueObject } from '@/customer/domain/value-object/email.value-object';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityIdGeneratorHelper } from '@/shared/domain/helper/entity-id-generator.helper.interface';
import { Inject } from '@nestjs/common';
import { EntityIdGeneratorHelperToken } from '@/shared/tokens';

export class TypeOrmCustomerRepository implements CustomerRepository {
  constructor(
    @Inject(EntityIdGeneratorHelperToken)
    private readonly entityIdGenerator: EntityIdGeneratorHelper,
    @InjectRepository(InfrastructureCustomerEntity)
    private readonly typeOrmRepository: Repository<InfrastructureCustomerEntity>,
  ) {}

  async findByCpf(cpf: CpfValueObject): Promise<DomainCustomerEntity> {
    const dbEntity = await this.typeOrmRepository.findOneBy({ cpf: cpf.value });

    if (!dbEntity) {
      return null;
    }

    return this.mapToDomainEntity(dbEntity);
  }

  async create(
    props: DomainEssentialCustomerEntityProps,
  ): Promise<DomainCustomerEntity> {
    const dbProps = this.mapToDbProps(props);
    const dbEntity = await this.typeOrmRepository.save(
      this.typeOrmRepository.create(dbProps),
    );

    return this.mapToDomainEntity(dbEntity);
  }

  async existsWithCpf(cpf: CpfValueObject): Promise<boolean> {
    return await this.typeOrmRepository.existsBy({ cpf: cpf.value });
  }

  private mapToDbProps(
    props: DomainEssentialCustomerEntityProps,
  ): InfrastructureEssentialCustomerEntityProps {
    return {
      id: this.entityIdGenerator.generate().value,
      name: props.name?.value,
      email: props.email?.value,
      cpf: props.cpf?.value,
    };
  }

  private mapToDomainEntity(
    entity: InfrastructureCustomerEntity,
  ): DomainCustomerEntity {
    const props: DomainCustomerEntityPropsWithId = {
      id: EntityIdValueObject.create(entity.id),
      name: entity.name
        ? FullNameValueObject.createFromFullName(entity.name)
        : null,
      email: entity.email ? EmailValueObject.create(entity.email) : null,
      cpf: entity.cpf ? CpfValueObject.create(entity.cpf) : null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return DomainCustomerEntity.create(props);
  }
}
