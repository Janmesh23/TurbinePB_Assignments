use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Token amount must be greater than zero")]
    InvalidTokenAmount,

    #[msg("Failed to transfer NFT to vault")]
    FailedNftTransfer,

    #[msg("Failed to transfer NFT from vault")]
    FailedVaultNftTransfer,

    #[msg("Failed to close NFT vault account")]
    FailedVaultClosure,

    #[msg("Failed to transfer payment tokens")]
    FailedPaymentTransfer,

    #[msg("Insufficient token balance for payment")]
    InsufficientPaymentBalance,

    #[msg("Failed to transfer NFT back to maker")]
    FailedNftReturn,

    #[msg("Failed to close vault during cancellation")]
    FailedCancelClosure,

    #[msg("NFT vault is empty - cannot complete offer")]
    EmptyVault,
}