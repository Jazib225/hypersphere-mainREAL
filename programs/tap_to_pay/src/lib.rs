use anchor_lang::prelude::*;

declare_id!("3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR");

#[program]
pub mod tap_to_pay {
    use super::*;

    /// Creates a new PaymentIntent account on-chain
    pub fn create_payment_intent(
        ctx: Context<CreatePaymentIntent>,
        payment_intent_id: String,
        amount: u64,
        nonce: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        let payment_intent = &mut ctx.accounts.payment_intent;
        
        payment_intent.id = payment_intent_id;
        payment_intent.merchant = ctx.accounts.merchant.key();
        payment_intent.amount = amount;
        payment_intent.status = 0u8; // pending
        payment_intent.nonce = nonce;
        payment_intent.tx_signature = String::default();
        payment_intent.created_at = clock.unix_timestamp;

        emit!(PaymentIntentCreated {
            payment_intent_id: payment_intent.id.clone(),
            merchant_pubkey: payment_intent.merchant,
            amount: payment_intent.amount,
        });

        Ok(())
    }

    /// Processes a payment and marks the PaymentIntent as paid
    pub fn pay_invoice(
        ctx: Context<PayInvoice>,
        payment_intent_id: String,
        amount: u64,
        nonce: [u8; 32],
        bump: u8,
    ) -> Result<()> {
        let pi = &mut ctx.accounts.payment_intent;

        // Verify payment intent exists and is pending
        if pi.status != 0u8 {
            return err!(ErrorCode::PaymentAlreadyProcessed);
        }

        // Verify amount matches
        if pi.amount != amount {
            return err!(ErrorCode::InvalidAmount);
        }

        // Verify nonce matches
        if pi.nonce != nonce {
            return err!(ErrorCode::InvalidNonce);
        }

        // Mark paid
        pi.status = 1u8;

        // Record tx_signature as payer pubkey string (per requirements)
        pi.tx_signature = ctx.accounts.payer.key().to_string();

        // Emit event
        emit!(PaymentEvent {
            payment_intent_id: payment_intent_id.clone(),
            merchant_pubkey: pi.merchant,
            amount: pi.amount,
            tx_signature: pi.tx_signature.clone(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(payment_intent_id: String)]
pub struct CreatePaymentIntent<'info> {
    #[account(
        init,
        payer = merchant,
        space = 8 + // discriminator
                4 + payment_intent_id.len() + // id (String)
                32 + // merchant (Pubkey)
                8 + // amount (u64)
                1 + // status (u8)
                32 + // nonce ([u8; 32])
                4 + 44 + // tx_signature (String, max 44 chars for base58)
                8, // created_at (i64)
        seeds = [b"payment_intent", payment_intent_id.as_bytes()],
        bump
    )]
    pub payment_intent: Account<'info, PaymentIntent>,

    #[account(mut)]
    pub merchant: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(payment_intent_id: String, _amount: u64, _nonce: [u8; 32], bump: u8)]
pub struct PayInvoice<'info> {
    /// CHECK: PDA for the existing PaymentIntent
    #[account(mut, seeds = [b"payment_intent", payment_intent_id.as_ref()], bump = bump)]
    pub payment_intent: Account<'info, PaymentIntent>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct PaymentIntent {
    pub id: String,
    pub merchant: Pubkey,
    pub amount: u64,
    /// 0 = pending, 1 = paid, 2 = expired
    pub status: u8,
    pub nonce: [u8; 32],
    pub tx_signature: String,
    pub created_at: i64,
}

#[event]
pub struct PaymentIntentCreated {
    pub payment_intent_id: String,
    pub merchant_pubkey: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PaymentEvent {
    pub payment_intent_id: String,
    pub merchant_pubkey: Pubkey,
    pub amount: u64,
    pub tx_signature: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The provided amount does not match the payment intent amount")]
    InvalidAmount,
    #[msg("The provided nonce does not match the payment intent nonce")]
    InvalidNonce,
    #[msg("Payment has already been processed")]
    PaymentAlreadyProcessed,
}
