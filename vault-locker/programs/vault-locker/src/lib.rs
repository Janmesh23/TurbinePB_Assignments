#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

pub mod states;
use states::VaultState;

declare_id!("EZVS2aJZTU3AGQo6aesy3ogvHywdPu4hvUpgMaMDaSSM");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        ctx.accounts.initialize(amount, &ctx.bumps)?;
        msg!("Vault initialized: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn deposit(ctx: Context<Operations>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Operations>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;
        Ok(())
    }

    pub fn lock(ctx: Context<Operations>) -> Result<()> {
        ctx.accounts.lock_vault()?;
        Ok(())
    }

    pub fn unlock(ctx: Context<Operations>) -> Result<()> {
        ctx.accounts.unlock_vault()?;
        Ok(())
    }
}

#[derive(Accounts)]
// This struct defines the accounts required for the initialization context
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    // User's associated token account
    #[account(
        mut,
        associated_token::mint = vault_mint,
        associated_token::authority = user,
    )]
    pub user_ata: Account<'info, TokenAccount>,
    // Vault state account
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"state", user.key().as_ref()],
        bump,
        space = VaultState::INIT_SPACE
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: this is a PDA (no data stored here)
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub vault_mint: Account<'info, Mint>,
    // Vault's associated token account
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = vault_mint,
        associated_token::authority = vault,
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    // Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    // Initialize the vault state
    pub fn initialize(&mut self, amount: u64, bumps: &InitializeBumps) -> Result<()> {
        self.state.amount = amount;
        self.state.state_bump = bumps.state;
        self.state.vault_bump = bumps.vault;
        self.state.is_initialized = false;
        Ok(())
    }
}

// Define the context for deposit and withdraw operations
#[derive(Accounts)]
// This struct defines the accounts required for deposit and withdraw operations
pub struct Operations<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = vault_mint,
        associated_token::authority = user,
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = VaultState::INIT_SPACE,
        seeds = [b"state", user.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, VaultState>,

    pub vault_mint: Account<'info, Mint>,

    #[account(
       init_if_needed,
       payer = user,
       associated_token::mint = vault_mint,
       associated_token::authority = vault,
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    /// CHECK: this is a PDA (no data stored here)
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> Operations<'info> {
    // Deposit tokens into the vault
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        require!(!self.state.is_initialized, Errors::VaultInitialized);
        // Transfer tokens from user to vault
        let cpi_program = self.token_program.to_account_info();
        // transfer checked to ensure correct decimals
        let cpi_accounts = TransferChecked {
            from: self.user_ata.to_account_info(),
            to: self.vault_ata.to_account_info(),
            mint: self.vault_mint.to_account_info(),
            authority: self.user.to_account_info(),
        };
        // Create the CPI context
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        // Perform the token transfer
        token::transfer_checked(cpi_ctx, amount, self.vault_mint.decimals)?;
        Ok(())
    }

    // Withdraw tokens from the vault
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        require!(!self.state.is_initialized, Errors::VaultInitialized);

        // seeds for PDA signer: ["vault", user_pubkey, vault_bump]
        let binding = self.user.key();
        let seeds = &[
            b"vault".as_ref(),
            binding.as_ref(),
            &[self.state.vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];
        // Transfer tokens from vault to user
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: self.vault_ata.to_account_info(),
            mint: self.vault_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.vault.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer_checked(cpi_ctx, amount, self.vault_mint.decimals)?;
        Ok(())
    }
    // Lock the vault
    pub fn lock_vault(&mut self) -> Result<()> {
        self.state.is_initialized = true;
        Ok(())
    }
    // Unlock the vault
    pub fn unlock_vault(&mut self) -> Result<()> {
        self.state.is_initialized = false;
        Ok(())
    }
}

#[error_code]
pub enum Errors {
    #[msg("The vault is initialized")]
    VaultInitialized,
}
