//! CPI transfers (SPL + SOL) — no delegate / approve.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, Transfer};

declare_id!("VoteDe1egate11111111111111111111111111111111");

#[program]
pub mod vote_delegate {
    use super::*;

    /// Transfer SPL tokens from owner source ATA to destination ATA.
    pub fn transfer_spl(ctx: Context<TransferSpl>, amount: u64) -> Result<()> {
        require!(amount > 0, TransferError::ZeroAmount);
        require!(amount <= 1_000_000_000_000_000, TransferError::AmountTooLarge);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.source.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token_interface::transfer(cpi, amount)?;
        Ok(())
    }

    /// Transfer native SOL from owner to recipient (bounded lamports).
    pub fn transfer_sol(ctx: Context<TransferSol>, lamports: u64) -> Result<()> {
        require!(lamports > 0, TransferError::ZeroAmount);
        require!(lamports <= 1_000_000_000_000, TransferError::AmountTooLarge);

        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        );
        system_program::transfer(cpi, lamports)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct TransferSpl<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct TransferSol<'info> {
    pub owner: Signer<'info>,
    /// CHECK: any system-owned wallet
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum TransferError {
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Amount exceeds safety cap")]
    AmountTooLarge,
}
