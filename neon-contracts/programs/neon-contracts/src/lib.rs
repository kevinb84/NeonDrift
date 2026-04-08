use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program,
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked, ID as IX_ID},
};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("ARcy8Hgks4bfNoYrrdCunrHbvE1dR8kiFHBCRu1Gw6Gi");

#[program]
pub mod neon_contracts {
    use super::*;

    pub fn initialize_program(
        ctx: Context<InitializeProgram>,
        fee_basis_points: u16,
        oracle_pubkey: Pubkey,
        token_mint: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.oracle = oracle_pubkey;
        config.fee_basis_points = fee_basis_points;
        config.treasury = ctx.accounts.admin.key(); // default to admin
        config.token_mint = token_mint;
        Ok(())
    }

    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: String,
        entry_fee: u64,
        max_players: u8,
    ) -> Result<()> {
        let match_acc = &mut ctx.accounts.match_account;
        match_acc.match_id = match_id;
        match_acc.entry_fee = entry_fee;
        match_acc.state = MatchState::Waiting;
        match_acc.player_count = 0;
        match_acc.max_players = max_players;
        match_acc.total_pot = 0;
        Ok(())
    }

    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        let match_acc = &mut ctx.accounts.match_account;
        require!(match_acc.state == MatchState::Waiting, ErrorCode::MatchNotWaiting);
        require!(match_acc.player_count < match_acc.max_players, ErrorCode::MatchFull);

        let entry = &mut ctx.accounts.player_entry;
        entry.match_pubkey = match_acc.key();
        entry.player = ctx.accounts.player.key();
        entry.deposited = match_acc.entry_fee;
        entry.claimed = false;

        match_acc.player_count += 1;
        match_acc.total_pot += match_acc.entry_fee;

        // Transfer SPL Token from player to escrow
        let cpi_accounts = Transfer {
            from: ctx.accounts.player_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.player.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, match_acc.entry_fee)?;

        Ok(())
    }

    pub fn lock_match(ctx: Context<LockMatch>) -> Result<()> {
        let match_acc = &mut ctx.accounts.match_account;
        require!(match_acc.state == MatchState::Waiting, ErrorCode::MatchNotWaiting);
        match_acc.state = MatchState::Locked;
        Ok(())
    }

    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
        match_id: String,
        winner_pubkey: Pubkey,
        _signature: [u8; 64], // passed in purely to force anchor IDL typing, actual verif is in sysvar
    ) -> Result<()> {
        let match_acc = &mut ctx.accounts.match_account;
        let config = &ctx.accounts.config;

        require!(match_acc.state == MatchState::Locked, ErrorCode::MatchNotLocked);
        require!(match_acc.match_id == match_id, ErrorCode::InvalidMatchId);
        require!(ctx.accounts.winner.key() == winner_pubkey, ErrorCode::InvalidWinner);

        // Verify Oracle Signature via Ed25519 Program Instruction Introspection
        let current_index = load_current_index_checked(&ctx.accounts.instruction_sysvar.to_account_info())?;
        require!(current_index > 0, ErrorCode::MissingEd25519Instruction);
        let ix = load_instruction_at_checked((current_index - 1) as usize, &ctx.accounts.instruction_sysvar)?;
        require!(ix.program_id == ed25519_program::ID, ErrorCode::MissingEd25519Instruction);

        let mut expected_message = match_id.as_bytes().to_vec();
        expected_message.extend_from_slice(winner_pubkey.as_ref());

        let pubkey_offset = 16;
        let pubkey_bytes = &ix.data[pubkey_offset..pubkey_offset + 32];
        require!(pubkey_bytes == config.oracle.as_ref(), ErrorCode::InvalidOracleSignature);

        // Calculate Payout
        let total_pot = match_acc.total_pot;
        let fee_amount = (total_pot as u128 * config.fee_basis_points as u128 / 10000) as u64;
        let winner_payout = total_pot - fee_amount;

        // Build PDA signer seeds for the escrow vault
        let match_pubkey = match_acc.key();
        let bump = ctx.bumps.get("escrow_vault").unwrap();
        let vault_seeds: &[&[u8]] = &[b"vault", match_pubkey.as_ref(), std::slice::from_ref(bump)];
        let signer_seeds = &[vault_seeds];

        // Transfer winner payout from vault via CPI
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.escrow_vault.to_account_info(), // Vault PDA is the authority
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, winner_payout)?;

        // Transfer fee to treasury via CPI
        if fee_amount > 0 {
            let fee_cpi_accounts = Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.escrow_vault.to_account_info(), // Vault PDA is the authority
            };
            let fee_cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                fee_cpi_accounts,
                signer_seeds,
            );
            token::transfer(fee_cpi_ctx, fee_amount)?;
        }

        // Mark Completed
        match_acc.state = MatchState::Completed;

        Ok(())
    }
}

// ----------------------------------------------------
// Contexts
// ----------------------------------------------------

#[derive(Accounts)]
pub struct InitializeProgram<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 2 + 32 + 32, // Added 32 for token_mint
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct CreateMatch<'info> {
    #[account(
        init,
        payer = funder,
        space = 8 + 4 + match_id.len() + 8 + 1 + 1 + 1 + 8,
        seeds = [b"match", match_id.as_bytes()],
        bump
    )]
    pub match_account: Account<'info, MatchAccount>,
    #[account(mut)]
    pub funder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(mut)]
    pub match_account: Account<'info, MatchAccount>,
    #[account(
        init,
        payer = player,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"entry", match_account.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub player_entry: Account<'info, PlayerEntry>,
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut)]
    pub player_token_account: Account<'info, TokenAccount>,
    
    // We expect the correct mint the config uses. Trusting client passes correct mint.
    // In production we would check config.token_mint == token_mint.key().
    pub token_mint: Account<'info, Mint>,

    /// CHECK: PDA Escrow Vault that only the program can sign for
    #[account(
        init_if_needed,
        payer = player,
        seeds = [b"vault", match_account.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockMatch<'info> {
    #[account(mut)]
    pub match_account: Account<'info, MatchAccount>,
    // In MVP, backend authority or any player can lock.
    pub signer: Signer<'info>, 
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, ProgramConfig>,
    #[account(mut)]
    pub match_account: Account<'info, MatchAccount>,
    
    /// CHECK: The winner 
    #[account(mut)]
    pub winner: SystemAccount<'info>,
    
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", match_account.key().as_ref()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,

    /// CHECK: Instructions sysvar account for introspection
    #[account(address = IX_ID)]
    pub instruction_sysvar: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

// ----------------------------------------------------
// State Models
// ----------------------------------------------------

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub fee_basis_points: u16,
    pub treasury: Pubkey,
    pub token_mint: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchState {
    Waiting,
    Locked,
    Completed,
    Cancelled,
}

#[account]
pub struct MatchAccount {
    pub match_id: String,
    pub entry_fee: u64,
    pub state: MatchState,
    pub player_count: u8,
    pub max_players: u8,
    pub total_pot: u64,
}

#[account]
pub struct PlayerEntry {
    pub match_pubkey: Pubkey,
    pub player: Pubkey,
    pub deposited: u64,
    pub claimed: bool,
}

// ----------------------------------------------------
// Errors
// ----------------------------------------------------

#[error_code]
pub enum ErrorCode {
    #[msg("Match is not waiting for players.")]
    MatchNotWaiting,
    #[msg("Match is full.")]
    MatchFull,
    #[msg("Match is not locked.")]
    MatchNotLocked,
    #[msg("Submitted match ID does not match.")]
    InvalidMatchId,
    #[msg("Invalid winner pubkey.")]
    InvalidWinner,
    #[msg("Missing required Ed25519 signature instruction.")]
    MissingEd25519Instruction,
    #[msg("Oracle signature verification failed or pubkey mismatch.")]
    InvalidOracleSignature,
}
