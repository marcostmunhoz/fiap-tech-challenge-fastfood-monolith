import { PaymentMethodEnum } from '@/payment/domain/enum/payment-method.enum';
import { PaymentStatusEnum } from '@/payment/domain/enum/payment-status.enum';
import { PaymentFactory } from '@/payment/domain/factory/payment.factory';
import { PaymentRepository } from '@/payment/domain/repository/payment.repository.interface';
import { OrderRepository } from '@/shared/domain/repository/order.repository.interface';
import {
  getDomainCompletePaymentEntityProps,
  getDomainPaymentEntity,
  getValidOrderEntityId,
} from '@/testing/payment/helpers';
import { getPaymentGatewayServiceMock } from '@/testing/payment/mock/payment-gateway-service.mock';
import { getPaymentFactoryMock } from '@/testing/payment/mock/payment.factory.mock';
import { getPaymentRepositoryMock } from '@/testing/payment/mock/payment.repository.mock';
import { getDomainOrderEntity } from '@/testing/shared/helpers';
import { mockUser } from '@/testing/shared/mock/auth.guard.mock';
import { getOrderRepositoryMock } from '@/testing/shared/mock/order.repository.mock';
import { PaymentGatewayService } from '../service/payment-gateway.service.interface';
import { CreatePaymentUseCase, Input, Output } from './create-payment.use-case';

describe('CreatePaymentUseCase', () => {
  let paymentGatewayServiceMock: jest.Mocked<PaymentGatewayService>;
  let paymentRepositoryMock: jest.Mocked<PaymentRepository>;
  let orderRepositoryMock: jest.Mocked<OrderRepository>;
  let paymentFactoryMock: jest.Mocked<PaymentFactory>;
  let sut: CreatePaymentUseCase;

  beforeEach(() => {
    paymentGatewayServiceMock = getPaymentGatewayServiceMock();
    paymentRepositoryMock = getPaymentRepositoryMock();
    orderRepositoryMock = getOrderRepositoryMock();
    paymentFactoryMock = getPaymentFactoryMock();
    sut = new CreatePaymentUseCase(
      paymentGatewayServiceMock,
      paymentRepositoryMock,
      orderRepositoryMock,
      paymentFactoryMock,
    );
  });

  describe('execute', () => {
    it('should throw if a valid payment already exists with given order ID', () => {
      // Arrange
      const input: Input = {
        orderId: getValidOrderEntityId(),
        user: mockUser,
        paymentMethod: PaymentMethodEnum.PIX,
      };
      paymentRepositoryMock.existsWithOrderIdAndNotFailed.mockResolvedValue(
        true,
      );

      // Act
      const act = () => sut.execute(input);

      // Assert
      expect(act).rejects.toThrow(
        'A pending or paid payment already exists for the given order ID.',
      );
    });

    it('should throw if the order can not be found with given ID', () => {
      // Arrange
      const input: Input = {
        orderId: getValidOrderEntityId(),
        user: mockUser,
        paymentMethod: PaymentMethodEnum.PIX,
      };
      paymentRepositoryMock.existsWithOrderIdAndNotFailed.mockResolvedValue(
        false,
      );
      orderRepositoryMock.findById.mockResolvedValue(null);

      // Act
      const act = () => sut.execute(input);

      // Assert
      expect(act).rejects.toThrow('Order not found with given ID.');
    });

    it('should throw an error if order belongs to another user', async () => {
      // Arrange
      const order = getDomainOrderEntity({
        customerId: 'another-user-id',
      });
      const input: Input = {
        orderId: getValidOrderEntityId(),
        user: mockUser,
        paymentMethod: PaymentMethodEnum.PIX,
      };
      paymentRepositoryMock.existsWithOrderIdAndNotFailed.mockResolvedValue(
        false,
      );
      orderRepositoryMock.findById.mockResolvedValue(order);

      // Act
      const result = sut.execute(input);

      // Assert
      await expect(result).rejects.toThrow('Unauthorized resource.');
    });

    it('should return a PixPaymentOutput if payment method is PIX', async () => {
      // Arrange
      const order = getDomainOrderEntity();
      const paymentProps = getDomainCompletePaymentEntityProps();
      const payment = getDomainPaymentEntity({
        ...paymentProps,
        orderId: order.id.value,
        total: order.total,
        paymentMethod: PaymentMethodEnum.PIX,
      });
      const input: Input = {
        orderId: order.id.value,
        user: mockUser,
        paymentMethod: PaymentMethodEnum.PIX,
      };
      const output: Output = {
        id: payment.id,
        status: PaymentStatusEnum.PENDING,
        paymentData: {
          qrCode: 'qr-code-url',
          qrCodeText: 'qr-code-text',
        },
      };
      const paymentSetExternalPaymentIdSpy = jest.spyOn(
        payment,
        'setExternalPaymentId',
      );
      const orderMarkAsPaidSpy = jest.spyOn(order, 'markAsPaid');
      paymentRepositoryMock.existsWithOrderIdAndNotFailed.mockResolvedValueOnce(
        false,
      );
      orderRepositoryMock.findById.mockResolvedValueOnce(order);
      // using mockImplementation instead of mockResolvedValue because of some odd behavior in the type
      // hiting. The return type is being inferred as never instead of PaymentEntity, and the mock is
      // returning a Promise instead of the actual value passed to it.
      paymentFactoryMock.createPayment.mockImplementation(() => payment);
      paymentGatewayServiceMock.createPixPayment.mockResolvedValueOnce({
        id: 'external-payment-id',
        qrCode: 'qr-code-url',
        qrCodeText: 'qr-code-text',
      });

      // Act
      const result = await sut.execute(input);

      // Assert
      expect(
        paymentRepositoryMock.existsWithOrderIdAndNotFailed,
      ).toHaveBeenCalledTimes(1);
      expect(
        paymentRepositoryMock.existsWithOrderIdAndNotFailed,
      ).toHaveBeenCalledWith(order.id.value);
      expect(orderRepositoryMock.findById).toHaveBeenCalledTimes(1);
      expect(orderRepositoryMock.findById).toHaveBeenCalledWith(order.id);
      expect(paymentFactoryMock.createPayment).toHaveBeenCalledTimes(1);
      expect(paymentFactoryMock.createPayment).toHaveBeenCalledWith({
        orderId: order.id.value,
        total: order.total,
        paymentMethod: PaymentMethodEnum.PIX,
      });
      expect(paymentGatewayServiceMock.createPixPayment).toHaveBeenCalledTimes(
        1,
      );
      expect(paymentGatewayServiceMock.createPixPayment).toHaveBeenCalledWith({
        amount: payment.total,
      });
      expect(paymentSetExternalPaymentIdSpy).toHaveBeenCalledTimes(1);
      expect(paymentSetExternalPaymentIdSpy).toHaveBeenCalledWith(
        'external-payment-id',
      );
      expect(orderMarkAsPaidSpy).not.toHaveBeenCalled();
      expect(paymentRepositoryMock.save).toHaveBeenCalledTimes(1);
      expect(paymentRepositoryMock.save).toHaveBeenCalledWith(payment);
      expect(orderRepositoryMock.save).toHaveBeenCalledTimes(1);
      expect(orderRepositoryMock.save).toHaveBeenCalledWith(order);
      expect(result).toEqual(output);
    });

    const cardPaymentDataset = [
      [PaymentMethodEnum.CREDIT_CARD, 'createCreditCardPayment'],
      [PaymentMethodEnum.DEBIT_CARD, 'createDebitCardPayment'],
      [PaymentMethodEnum.VOUCHER, 'createVoucherPayment'],
    ];

    it.each(cardPaymentDataset)(
      'should return a CardPaymentOutput if payment method is with any kind of card',
      async (
        paymentMethod:
          | PaymentMethodEnum.CREDIT_CARD
          | PaymentMethodEnum.DEBIT_CARD
          | PaymentMethodEnum.VOUCHER,
        expectedGatewayMethod:
          | 'createCreditCardPayment'
          | 'createDebitCardPayment'
          | 'createVoucherPayment',
      ) => {
        // Arrange
        const order = getDomainOrderEntity();
        const paymentProps = getDomainCompletePaymentEntityProps();
        const payment = getDomainPaymentEntity({
          ...paymentProps,
          orderId: order.id.value,
          total: order.total,
          paymentMethod,
        });
        const input: Input = {
          orderId: order.id.value,
          user: mockUser,
          paymentMethod,
          cardData: {
            number: '1111222233334444',
            expiration: '12/30',
            verificationCode: '111',
          },
        };
        const output: Output = {
          id: payment.id,
          status: PaymentStatusEnum.PAID,
        };
        const paymentSetExternalPaymentIdSpy = jest.spyOn(
          payment,
          'setExternalPaymentId',
        );
        const paymentMarkAsPaidSpy = jest.spyOn(payment, 'markAsPaid');
        const orderMarkAsPaidSpy = jest.spyOn(order, 'markAsPaid');
        paymentRepositoryMock.existsWithOrderIdAndNotFailed.mockResolvedValueOnce(
          false,
        );
        orderRepositoryMock.findById.mockResolvedValueOnce(order);
        // using mockImplementation instead of mockResolvedValue because of some odd behavior in the type
        // hiting. The return type is being inferred as never instead of PaymentEntity, and the mock is
        // returning a Promise instead of the actual value passed to it.
        paymentFactoryMock.createPayment.mockImplementation(() => payment);
        paymentGatewayServiceMock[expectedGatewayMethod].mockResolvedValueOnce({
          id: 'external-payment-id',
        });

        // Act
        const result = await sut.execute(input);

        // Assert
        expect(
          paymentGatewayServiceMock[expectedGatewayMethod],
        ).toHaveBeenCalledTimes(1);
        expect(
          paymentGatewayServiceMock[expectedGatewayMethod],
        ).toHaveBeenCalledWith({
          amount: payment.total,
          cardNumber: input.cardData.number,
          cardExpirationDate: input.cardData.expiration,
          cardVerificationCode: input.cardData.verificationCode,
        });
        expect(paymentSetExternalPaymentIdSpy).toHaveBeenCalledTimes(1);
        expect(paymentSetExternalPaymentIdSpy).toHaveBeenCalledWith(
          'external-payment-id',
        );
        expect(paymentMarkAsPaidSpy).toHaveBeenCalledTimes(1);
        expect(orderMarkAsPaidSpy).toHaveBeenCalledTimes(1);
        expect(paymentRepositoryMock.save).toHaveBeenCalledTimes(1);
        expect(paymentRepositoryMock.save).toHaveBeenCalledWith(payment);
        expect(orderRepositoryMock.save).toHaveBeenCalledTimes(1);
        expect(orderRepositoryMock.save).toHaveBeenCalledWith(order);
        expect(result).toEqual(output);
      },
    );

    it('should throw mark payment as failed and throw error when payment gateway throws', async () => {
      // Arrange
      const order = getDomainOrderEntity();
      const paymentProps = getDomainCompletePaymentEntityProps();
      const payment = getDomainPaymentEntity({
        ...paymentProps,
        orderId: order.id.value,
        total: order.total,
        paymentMethod: PaymentMethodEnum.PIX,
      });
      const input: Input = {
        orderId: order.id.value,
        user: mockUser,
        paymentMethod: PaymentMethodEnum.PIX,
      };
      const paymentMarkAsFailedSpy = jest.spyOn(payment, 'markAsFailed');
      const orderMarkAsCanceledSpy = jest.spyOn(order, 'markAsCanceled');
      paymentRepositoryMock.existsWithOrderIdAndNotFailed.mockResolvedValueOnce(
        false,
      );
      orderRepositoryMock.findById.mockResolvedValueOnce(order);
      // using mockImplementation instead of mockResolvedValue because of some odd behavior in the type
      // hiting. The return type is being inferred as never instead of PaymentEntity, and the mock is
      // returning a Promise instead of the actual value passed to it.
      paymentFactoryMock.createPayment.mockImplementation(() => payment);
      paymentGatewayServiceMock.createPixPayment.mockImplementation(() => {
        throw new Error('Some error message.');
      });

      // Act
      let caughtError;
      try {
        await sut.execute(input);
      } catch (error) {
        caughtError = error;
      }

      // Assert
      expect(caughtError.message).toEqual(
        'There was an error processing the payment: Some error message.',
      );
      expect(paymentMarkAsFailedSpy).toHaveBeenCalledTimes(1);
      expect(orderMarkAsCanceledSpy).toHaveBeenCalledTimes(1);
      expect(paymentRepositoryMock.save).toHaveBeenCalledTimes(1);
      expect(paymentRepositoryMock.save).toHaveBeenCalledWith(payment);
      expect(orderRepositoryMock.save).toHaveBeenCalledTimes(1);
      expect(orderRepositoryMock.save).toHaveBeenCalledWith(order);
    });
  });
});
