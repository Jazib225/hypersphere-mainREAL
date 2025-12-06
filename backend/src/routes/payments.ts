import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { BridgeService } from '../services/BridgeService';
import { z } from 'zod';

const router = Router();
const paymentService = new PaymentService();
const bridgeService = new BridgeService();

// Validation schemas
const incomingPaymentSchema = z.object({
  merchantId: z.string().uuid(),
  sourceChain: z.enum(['SOLANA', 'ETHEREUM', 'BASE']),
  sourceTxHash: z.string().min(1),
  amountUsdc: z.union([z.string(), z.number()]),
  custodialSourceAddress: z.string().min(1),
});

/**
 * POST /api/payments/incoming
 * Register an incoming payment received on custodial address
 */
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    const validated = incomingPaymentSchema.parse(req.body);
    
    const result = await paymentService.registerIncomingPayment({
      merchantId: validated.merchantId,
      sourceChain: validated.sourceChain,
      sourceTxHash: validated.sourceTxHash,
      amountUsdc: validated.amountUsdc,
      custodialSourceAddress: validated.custodialSourceAddress,
    });

    res.status(201).json({
      success: true,
      payment: result.payment,
      transfer: result.transfer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error registering incoming payment:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to register payment',
    });
  }
});

/**
 * POST /api/payments/:id/bridge
 * Start bridge process for a payment
 */
router.post('/:id/bridge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await bridgeService.startBridgeForPayment(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error starting bridge:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start bridge',
    });
  }
});

/**
 * GET /api/payments/:id
 * Get payment by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await paymentService.getPaymentById(id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch payment',
    });
  }
});

export default router;

