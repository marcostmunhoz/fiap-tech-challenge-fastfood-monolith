import { CustomerRepository } from '@/customer/domain/repository/customer.repository.interface';

export const getCustomerRepositoryMock =
  (): jest.Mocked<CustomerRepository> => ({
    findByCpf: jest.fn(),
    create: jest.fn(),
    existsWithCpf: jest.fn(),
  });
