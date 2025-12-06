import { Router, Request, Response } from 'express';
import { BridgeService } from '../services/BridgeService';

const router = Router();
const bridgeService = new BridgeService();

/**
 * POST /api/transfers/:id/mint
 * Poll attestation and complete mint for a transfer
 */
router.post('/:id/mint', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await bridgeService.pollAttestationAndMint(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error completing mint:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to complete mint',
    });
  }
});

export default router;

