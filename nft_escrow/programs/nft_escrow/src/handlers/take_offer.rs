use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use super::shared::{close_token_account, transfer_tokens};
use crate::{error::ErrorCode, state::NftOffer};

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    /// Program for managing associated token accounts
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Token program (SPL Token or Token-2022)
    pub token_program: Interface<'info, TokenInterface>,

    /// System program for creating accounts
    pub system_program: Program<'info, System>,

    /// The user accepting the offer (pays tokens, receives NFT)
    #[account(mut)]
    pub taker: Signer<'info>,

    /// The original offer creator (receives payment)
    /// CHECK: Validated via has_one constraint on offer account
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    /// The NFT mint being transferred
    #[account(
        mint::token_program = token_program,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    /// The payment token mint
    #[account(
        mint::token_program = token_program,
    )]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    /// Taker's payment token account (source of payment)
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_payment_account: InterfaceAccount<'info, TokenAccount>,

    /// Taker's NFT account (receives the NFT)
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = nft_mint,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_nft_account: InterfaceAccount<'info, TokenAccount>,

    /// Maker's payment token account (receives payment)
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = payment_mint,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_payment_account: InterfaceAccount<'info, TokenAccount>,

    /// The offer account (will be closed)
    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = nft_mint,
        has_one = payment_mint,
        seeds = [b"nft_offer", offer.offer_id.to_le_bytes().as_ref()],
        bump = offer.bump
    )]
    pub offer: Account<'info, NftOffer>,

    /// Vault holding the escrowed NFT
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub nft_vault: InterfaceAccount<'info, TokenAccount>,
}

/// Accept an NFT offer by paying tokens to receive the NFT
pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
    // Validate vault has the NFT
    require!(
        ctx.accounts.nft_vault.amount == 1,
        ErrorCode::EmptyVault
    );

    // Prepare PDA signer seeds for vault operations
    let offer_seeds = &[
        b"nft_offer",
        &ctx.accounts.offer.offer_id.to_le_bytes()[..],
        &[ctx.accounts.offer.bump],
    ];
    let signer_seeds = &[&offer_seeds[..]];

    // Step 1: Transfer NFT from vault to taker
    transfer_tokens(
        &ctx.accounts.nft_vault,
        &ctx.accounts.taker_nft_account,
        1, // NFTs have amount = 1
        &ctx.accounts.nft_mint,
        &ctx.accounts.offer.to_account_info(),
        &ctx.accounts.token_program,
        Some(signer_seeds),
    )
    .map_err(|_| ErrorCode::FailedVaultNftTransfer)?;

    // Step 2: Close the NFT vault (return rent to taker)
    close_token_account(
        &ctx.accounts.nft_vault,
        &ctx.accounts.taker.to_account_info(),
        &ctx.accounts.offer.to_account_info(),
        &ctx.accounts.token_program,
        Some(signer_seeds),
    )
    .map_err(|_| ErrorCode::FailedVaultClosure)?;

    // Step 3: Transfer payment tokens from taker to maker
    transfer_tokens(
        &ctx.accounts.taker_payment_account,
        &ctx.accounts.maker_payment_account,
        ctx.accounts.offer.token_amount,
        &ctx.accounts.payment_mint,
        &ctx.accounts.taker.to_account_info(),
        &ctx.accounts.token_program,
        None, // Taker is regular signer
    )
    .map_err(|_| ErrorCode::InsufficientPaymentBalance)?;

    msg!(
        "Offer taken: NFT transferred to taker, {} tokens paid to maker",
        ctx.accounts.offer.token_amount
    );

    // Offer account automatically closes (close = maker constraint)
    Ok(())
}