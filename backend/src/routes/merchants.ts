import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import { z } from 'zod';
import { PayoutService } from '../services/PayoutService';

const router = Router();
const payoutService = new PayoutService();

// Validation schemas
const createMerchantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  payout_chain: z.enum(['SOLANA', 'ETHEREUM', 'BASE']),
  payout_address: z.string().min(1),
});

const updateMerchantSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  payout_chain: z.enum(['SOLANA', 'ETHEREUM', 'BASE']).optional(),
  payout_address: z.string().min(1).optional(),
});

const payoutSchema = z.object({
  amountUsdc: z.union([z.string(), z.number()]),
});

/**
 * POST /api/merchants
 * Create a new merchant
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = createMerchantSchema.parse(req.body);
    
    const merchant = await prisma.merchant.create({
      data: validated,
    });

    res.status(201).json({
      success: true,
      merchant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error creating merchant:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create merchant',
    });
  }
});

/**
 * GET /api/merchants/:id
 * Get merchant by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        payments: {
          take: 10,
          orderBy: { created_at: 'desc' },
        },
        payouts: {
          take: 10,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({ success: true, merchant });
  } catch (error) {
    console.error('Error fetching merchant:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch merchant',
    });
  }
});

/**
 * GET /api/merchants
 * List all merchants
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const merchants = await prisma.merchant.findMany({
      orderBy: { created_at: 'desc' },
    });

    res.json({
      success: true,
      merchants,
      count: merchants.length,
    });
  } catch (error) {
    console.error('Error listing merchants:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list merchants',
    });
  }
});

/**
 * PUT /api/merchants/:id
 * Update merchant
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateMerchantSchema.parse(req.body);

    const merchant = await prisma.merchant.update({
      where: { id },
      data: validated,
    });

    res.json({
      success: true,
      merchant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error updating merchant:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update merchant',
    });
  }
});

/**
 * POST /api/merchants/:id/payout
 * Create and send payout to merchant
 */
router.post('/:id/payout', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = payoutSchema.parse(req.body);

    const merchant = await prisma.merchant.findUnique({
      where: { id },
    });

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const { Decimal } = await import('@prisma/client/runtime/library');
    const amountUsdc = new Decimal(validated.amountUsdc);

    const payout = await payoutService.createAndSendPayout(
      id,
      merchant.payout_chain,
      amountUsdc
    );

    res.json({
      success: true,
      payout,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error creating payout:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create payout',
    });
  }
});

export default router;

