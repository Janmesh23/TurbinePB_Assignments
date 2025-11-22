use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use super::shared::transfer_tokens;
use crate::{error::ErrorCode, state::NftOffer};

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct MakeOffer<'info> {
    /// Program for managing associated token accounts
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Token program (SPL Token or Token-2022)
    pub token_program: Interface<'info, TokenInterface>,

    /// System program for creating accounts
    pub system_program: Program<'info, System>,

    /// The user creating the offer (pays rent, signs transaction)
    #[account(mut)]
    pub maker: Signer<'info>,

    /// The NFT mint being offered
    #[account(
        mint::token_program = token_program,
    )]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    /// The token mint that maker wants in payment
    #[account(
        mint::token_program = token_program,
    )]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    /// Maker's NFT token account (must have exactly 1 NFT)
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_nft_account: InterfaceAccount<'info, TokenAccount>,

    /// The offer account (PDA) storing offer details
    #[account(
        init,
        payer = maker,
        space = 8 + NftOffer::INIT_SPACE,
        seeds = [b"nft_offer", offer_id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, NftOffer>,

    /// Vault to hold the NFT (owned by offer PDA)
    #[account(
        init,
        payer = maker,
        associated_token::mint = nft_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub nft_vault: InterfaceAccount<'info, TokenAccount>,
}

/// Create an NFT offer by escrowing an NFT in exchange for tokens
pub fn make_offer(
    ctx: Context<MakeOffer>,
    offer_id: u64,
    token_amount: u64,
) -> Result<()> {
    // Validate token amount is greater than zero
    require!(token_amount > 0, ErrorCode::InvalidTokenAmount);

    // Validate maker has exactly 1 NFT (standard NFT has amount = 1)
    require!(
        ctx.accounts.maker_nft_account.amount == 1,
        ErrorCode::FailedNftTransfer
    );

    // Transfer NFT from maker to vault (escrow it)
    transfer_tokens(
        &ctx.accounts.maker_nft_account,
        &ctx.accounts.nft_vault,
        1, // NFTs have amount = 1
        &ctx.accounts.nft_mint,
        &ctx.accounts.maker.to_account_info(),
        &ctx.accounts.token_program,
        None, // Maker is regular signer, not PDA
    )
    .map_err(|_| ErrorCode::FailedNftTransfer)?;

    // Save offer details to offer account
    ctx.accounts.offer.set_inner(NftOffer {
        offer_id,
        maker: ctx.accounts.maker.key(),
        nft_mint: ctx.accounts.nft_mint.key(),
        payment_mint: ctx.accounts.payment_mint.key(),
        token_amount,
        bump: ctx.bumps.offer,
    });

    msg!("NFT offer created: ID={}, Payment={}tokens", offer_id, token_amount);
    Ok(())
}