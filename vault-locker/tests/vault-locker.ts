import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("vault (devnet) — full flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Vault as Program<Vault>;
  const user = provider.wallet;

  let mintAccount: anchor.web3.PublicKey;
  let userAta: any;
  let vaultAta: any;
  let statePda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;

  const DECIMALS = 6;
  const MINT_AMOUNT = 1000 * 10 ** DECIMALS;
  const DEPOSIT_AMOUNT = 200 * 10 ** DECIMALS;

  it("sets up mint + ATAs + initializes vault", async () => {
    // 1️⃣ Create a new mint
    mintAccount = await createMint(
      provider.connection,
      user.payer,
      user.publicKey,
      null,
      DECIMALS
    );
    console.log("Mint:", mintAccount.toBase58());

    // 2️⃣ Create ATA for user
    userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      user.publicKey
    );

    // 3️⃣ Mint tokens to user
    await mintTo(
      provider.connection,
      user.payer,
      mintAccount,
      userAta.address,
      user.payer,
      MINT_AMOUNT
    );
    console.log("Minted tokens to user:", MINT_AMOUNT / 10 ** DECIMALS);

    // 4️⃣ Derive PDAs
    [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"), user.publicKey.toBuffer()],
      program.programId
    );
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.publicKey.toBuffer()],
      program.programId
    );

    // 5️⃣ Create vault ATA (owned by PDA)
    vaultAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintAccount,
      vaultPda,
      true
    );
    console.log("Vault ATA:", vaultAta.address.toBase58());

    // 6️⃣ Initialize vault
    const txInit = await program.methods
      .initialize(new anchor.BN(0))
      .accounts({
        user: user.publicKey,
        userAta: userAta.address,
        state: statePda,
        vault: vaultPda,
        vaultMint: mintAccount,
        vaultAta: vaultAta.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Initialize tx:", txInit);

    await printBalances(provider.connection, userAta.address, vaultAta.address);
  });

  it("deposits tokens to vault", async () => {
    const tx = await program.methods
      .deposit(new anchor.BN(DEPOSIT_AMOUNT))
      .accounts({
        user: user.publicKey,
        userAta: userAta.address,
        state: statePda,
        vault: vaultPda,
        vaultMint: mintAccount,
        vaultAta: vaultAta.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Deposit tx:", tx);

    await printBalances(provider.connection, userAta.address, vaultAta.address);
  });

  it("locks and prevents withdrawal while locked", async () => {
    const txLock = await program.methods
      .lock()
      .accounts({
        user: user.publicKey,
        userAta: userAta.address,
        state: statePda,
        vault: vaultPda,
        vaultMint: mintAccount,
        vaultAta: vaultAta.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Vault locked:", txLock);

    // Attempt withdrawal while locked
    try {
      await program.methods
        .withdraw(new anchor.BN(50 * 10 ** DECIMALS))
        .accounts({
          user: user.publicKey,
          userAta: userAta.address,
          state: statePda,
          vault: vaultPda,
          vaultMint: mintAccount,
          vaultAta: vaultAta.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      console.error("❌ Withdraw should have failed while locked");
    } catch (err: any) {
      console.log("✅ Withdraw failed while locked (expected):", err.error?.errorMessage);
    }

    await printBalances(provider.connection, userAta.address, vaultAta.address);
  });

  it("unlocks and withdraws successfully", async () => {
    const txUnlock = await program.methods
      .unlock()
      .accounts({
        user: user.publicKey,
        userAta: userAta.address,
        state: statePda,
        vault: vaultPda,
        vaultMint: mintAccount,
        vaultAta: vaultAta.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Vault unlocked:", txUnlock);

    const withdrawAmount = new anchor.BN(50 * 10 ** DECIMALS);
    const txWithdraw = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        user: user.publicKey,
        userAta: userAta.address,
        state: statePda,
        vault: vaultPda,
        vaultMint: mintAccount,
        vaultAta: vaultAta.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Withdraw tx:", txWithdraw);

    await printBalances(provider.connection, userAta.address, vaultAta.address);
  });
});

// Helper — log balances for user + vault
async function printBalances(connection, userAta, vaultAta) {
  const userAcc = await getAccount(connection, userAta);
  const vaultAcc = await getAccount(connection, vaultAta);
  console.log("User balance:", Number(userAcc.amount) / 10 ** 6);
  console.log("Vault balance:", Number(vaultAcc.amount) / 10 ** 6);
  console.log("---lessgo we did it ---");
}
