interface PaymentPayer {
  name: string;
  email: string;
  cpf: string;
}

interface PaymentMetadata {
  companyId: string;
  userId?: string;
  orderId?: string;
  planType?: string;
  [key: string]: any;
}

export type PaymentType = 'subscription' | 'order';

export interface PaymentResponse {
  id: number;
  status: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
}

class PaymentService {
  private apiUrl = '/api/payments';

  async createPayment(
    type: PaymentType,
    amount: number,
    metadata: PaymentMetadata,
    payer: PaymentPayer
  ): Promise<PaymentResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, amount, metadata, payer }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar pagamento');
      }

      return await response.json();
    } catch (error) {
      console.error('PaymentService error:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
