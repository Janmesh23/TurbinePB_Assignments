#![allow(unexpected_cfgs , deprecated)]

use anchor_lang::prelude::*;
use handlers::*;

pub mod error;
pub mod handlers;
pub mod state;

declare_id!("9QAQvv6ritDHHTcctxYnPdBgPXb7G3bZeTWkZYdg1moJ");

#[program]
pub mod nft_escrow {
    use super::*;

    /// Create an NFT offer - escrow an NFT in exchange for tokens
    pub fn make_offer(
        ctx: Context<MakeOffer>,
        offer_id: u64,
        token_amount: u64,
    ) -> Result<()> {
        handlers::make_offer::make_offer(ctx, offer_id, token_amount)
    }

    /// Accept an NFT offer - pay tokens to receive the NFT
    pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
        handlers::take_offer::take_offer(ctx)
    }

    /// Cancel an NFT offer - return the NFT to maker
    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        handlers::cancel_offer::cancel_offer(ctx)
    }
}