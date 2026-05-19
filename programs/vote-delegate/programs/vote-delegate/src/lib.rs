//! Bounded SPL delegate via program CPI (BPF upgradeable). Delegate authority is a PDA.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Approve, Mint, TokenAccount, TokenInterface,
};

declare_id!("VoteDe1egate11111111111111111111111111111111");

#[program]
pub mod vote_delegate {
    use super::*;

    /// Approve `amount` tokens (not u64::MAX) with delegate = PDA["delegate", owner, mint].
    pub fn approve_spl(ctx: Context<ApproveSpl>, amount: u64) -> Result<()> {
        require!(amount > 0, DelegateError::ZeroAmount);
        require!(amount <= 1_000_000_000_000_000, DelegateError::AmountTooLarge);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Approve {
                to: ctx.accounts.token_account.to_account_info(),
                delegate: ctx.accounts.delegate.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        );
        token_interface::approve(cpi, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ApproveSpl<'info> {
    pub owner: Signer<'info>,
    /// Program PDA used as SPL delegate (not an external wallet).
    #[account(
        seeds = [b"delegate", owner.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub delegate: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[error_code]
pub enum DelegateError {
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Amount exceeds safety cap")]
    AmountTooLarge,
}
