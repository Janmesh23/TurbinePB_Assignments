use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

/// Transfer tokens from one account to another
/// Supports both regular signers and PDA signers
pub fn transfer_tokens<'info>(
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    amount: u64,
    mint: &InterfaceAccount<'info, Mint>,
    authority: &AccountInfo<'info>,
    token_program: &Interface<'info, TokenInterface>,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let transfer_accounts = TransferChecked {
        from: from.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: authority.to_account_info(),
    };

    let cpi_context = if let Some(seeds) = signer_seeds {
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            transfer_accounts,
            seeds,
        )
    } else {
        CpiContext::new(token_program.to_account_info(), transfer_accounts)
    };

    transfer_checked(cpi_context, amount, mint.decimals)
}

/// Close a token account and return rent to destination
/// Supports both regular signers and PDA signers
pub fn close_token_account<'info>(
    token_account: &InterfaceAccount<'info, TokenAccount>,
    destination: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    token_program: &Interface<'info, TokenInterface>,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let close_accounts = CloseAccount {
        account: token_account.to_account_info(),
        destination: destination.to_account_info(),
        authority: authority.to_account_info(),
    };

    let cpi_context = if let Some(seeds) = signer_seeds {
        CpiContext::new_with_signer(token_program.to_account_info(), close_accounts, seeds)
    } else {
        CpiContext::new(token_program.to_account_info(), close_accounts)
    };

    close_account(cpi_context)
}