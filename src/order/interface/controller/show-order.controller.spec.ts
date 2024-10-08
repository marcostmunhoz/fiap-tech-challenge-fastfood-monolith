import {
  Output,
  ShowOrderUseCase,
} from '@/order/application/use-case/show-order.use-case';
import { AuthGuard } from '@/shared/infrastructure/guard/auth.guard';
import {
  getDomainCompleteOrderEntityProps,
  getDomainOrderEntity,
  getValidOrderItem,
} from '@/testing/shared/helpers';
import {
  createMockGuard,
  mockUser,
} from '@/testing/shared/mock/auth.guard.mock';
import { Test, TestingModule } from '@nestjs/testing';
import { ShowOrderController } from './show-order.controller';

describe('ShowOrderController', () => {
  let useCaseMock: jest.Mocked<ShowOrderUseCase>;
  let controller: ShowOrderController;

  beforeEach(async () => {
    useCaseMock = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ShowOrderUseCase>;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ShowOrderUseCase,
          useValue: useCaseMock,
        },
      ],
      controllers: [ShowOrderController],
    })
      .overrideGuard(AuthGuard)
      .useValue(createMockGuard())
      .compile();

    controller = module.get<ShowOrderController>(ShowOrderController);
  });

  describe('execute', () => {
    it('should return an existing order', async () => {
      // Arrange
      const user = mockUser;
      const props = getDomainCompleteOrderEntityProps();
      const item = getValidOrderItem();
      const order = getDomainOrderEntity({
        ...props,
        items: [item],
      });
      const { id } = order;
      const output: Output = {
        items: order.items,
        total: order.total,
        status: order.status,
      };
      useCaseMock.execute.mockResolvedValue(output);

      // Act
      const response = await controller.execute(user, { id });

      // Assert
      expect(useCaseMock.execute).toHaveBeenCalledTimes(1);
      expect(useCaseMock.execute).toHaveBeenCalledWith({ id, user });
      expect(response).toEqual({
        items: [
          {
            code: item.code,
            name: item.name,
            price: item.price.valueAsFloat,
            quantity: item.quantity.value,
          },
        ],
        total: order.total.valueAsFloat,
        status: order.status,
      });
    });
  });
});
