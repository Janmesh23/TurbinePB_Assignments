use anchor_lang::prelude::*;


// Define the VaultState account structure
#[account]
pub struct VaultState {
    pub is_initialized: bool,
    pub amount: u64, // Amount of tokens locked
    pub vault_bump: u8, // Bump for PDA
    pub state_bump: u8, // Bump for state PDA
}

impl Space for VaultState {
    const INIT_SPACE: usize = 8 + 1 + 8 + 1 + 1; // Discriminator + is_initialized + amount + vault_bump + state_bump
}
