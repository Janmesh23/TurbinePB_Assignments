use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use super::shared::{close_token_account, transfer_tokens};
use crate::{error::ErrorCode, state::NftOffer};

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    /// Token program (SPL Token or Token-2022)
    pub token_program: Interface<'info, TokenInterface>,

    /// System program for account management
    pub system_program: Program<'info, System>,

    /// The original offer creator (only they can cancel)
    #[account(mut)]
    pub maker: Signer<'info>,

    /// The NFT mint
    #[account(
        mint::token_program = token_program,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    /// Maker's NFT account (receives refunded NFT)
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_nft_account: InterfaceAccount<'info, TokenAccount>,

    /// The offer account (will be closed)
    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = nft_mint,
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

/// Cancel an NFT offer and return the NFT to the maker
pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
    // Validate vault has the NFT
    require!(
        ctx.accounts.nft_vault.amount == 1,
        ErrorCode::EmptyVault
    );

    // Prepare PDA signer seeds
    let offer_seeds = &[
        b"nft_offer",
        &ctx.accounts.offer.offer_id.to_le_bytes()[..],
        &[ctx.accounts.offer.bump],
    ];
    let signer_seeds = &[&offer_seeds[..]];

    // Step 1: Return NFT from vault to maker
    transfer_tokens(
        &ctx.accounts.nft_vault,
        &ctx.accounts.maker_nft_account,
        1, // NFTs have amount = 1
        &ctx.accounts.nft_mint,
        &ctx.accounts.offer.to_account_info(),
        &ctx.accounts.token_program,
        Some(signer_seeds),
    )
    .map_err(|_| ErrorCode::FailedNftReturn)?;

    // Step 2: Close the NFT vault (return rent to maker)
    close_token_account(
        &ctx.accounts.nft_vault,
        &ctx.accounts.maker.to_account_info(),
        &ctx.accounts.offer.to_account_info(),
        &ctx.accounts.token_program,
        Some(signer_seeds),
    )
    .map_err(|_| ErrorCode::FailedCancelClosure)?;

    msg!("Offer cancelled: NFT returned to maker");

    // Offer account automatically closes (close = maker constraint)
    Ok(())
}