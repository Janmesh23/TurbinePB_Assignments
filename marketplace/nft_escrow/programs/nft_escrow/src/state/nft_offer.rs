use anchor_lang::prelude::*;

/// Stores details of an NFT-for-token offer
#[account]
#[derive(InitSpace)]
pub struct NftOffer {
    /// Unique identifier for this offer
    pub offer_id: u64,
    
    /// Public key of the user who created the offer
    pub maker: Pubkey,
    
    /// The NFT mint being offered
    pub nft_mint: Pubkey,
    
    /// The token mint that the maker wants in exchange
    pub payment_mint: Pubkey,
    
    /// Amount of payment tokens required to take the offer
    pub token_amount: u64,
    
    /// PDA bump seed (stored for efficiency)
    pub bump: u8,
}