//! Minimal delegate program scaffold — deploy as BPF Upgradeable, then wire program id in loader.php.
//!
//! Replace `approve_spl` with your real logic + account constraints before mainnet.
//! Delegate authority should be a PDA owned by this program, not an external wallet.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Approve, Mint, TokenAccount, TokenInterface,
};

declare_id!("VoteDe1egate11111111111111111111111111111111");

#[program]
pub mod vote_delegate {
    use super::*;

    /// CPI approve with an explicit amount cap (never u64::MAX from the client).
    pub fn approve_spl(ctx: Context<ApproveSpl>, amount: u64) -> Result<()> {
        require!(amount > 0, DelegateError::ZeroAmount);

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
    /// CHECK: program-controlled delegate (PDA recommended)
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
}
