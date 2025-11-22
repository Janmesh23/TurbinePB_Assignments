import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftEscrow } from "../target/types/nft_escrow";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("NFT Escrow Tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftEscrow as Program<NftEscrow>;
  
  // Test accounts
  let maker: Keypair;
  let taker: Keypair;
  let mintAuthority: Keypair;
  
  // NFT and Token mints
  let nftMint: PublicKey;
  let paymentMint: PublicKey;
  
  // Token accounts
  let makerNftAccount: PublicKey;
  let takerNftAccount: PublicKey;
  let makerPaymentAccount: PublicKey;
  let takerPaymentAccount: PublicKey;
  
  // Program accounts
  let offerAccount: PublicKey;
  let nftVault: PublicKey;
  
  // Test parameters
  const offerId = new anchor.BN(1);
  const paymentAmount = new anchor.BN(100 * 1_000_000); // 100 tokens with 6 decimals

  /**
   * Helper: Create an NFT (mint with supply 1, decimals 0)
   */
  async function createNFT(owner: PublicKey): Promise<PublicKey> {
    const mint = await createMint(
      provider.connection,
      maker, // Payer
      mintAuthority.publicKey, // Mint authority
      null, // Freeze authority
      0 // Decimals = 0 for NFT
    );

    // Create token account for owner
    const tokenAccount = await createAccount(
      provider.connection,
      maker,
      mint,
      owner
    );

    // Mint 1 NFT to owner
    await mintTo(
      provider.connection,
      maker,
      mint,
      tokenAccount,
      mintAuthority,
      1 // Amount = 1 for NFT
    );

    return mint;
  }

  /**
   * Helper: Create a fungible token mint
   */
  async function createToken(): Promise<PublicKey> {
    const mint = await createMint(
      provider.connection,
      maker,
      mintAuthority.publicKey,
      null,
      6 // 6 decimals (like USDC)
    );

    return mint;
  }

  /**
   * Helper: Airdrop SOL to an account
   */
  async function airdrop(publicKey: PublicKey, amount: number = 1) {
    const signature = await provider.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  }

  /**
   * Setup: Run before all tests
   */
  before(async () => {
    console.log("\n🔧 Setting up test environment...\n");

    // Create keypairs
    maker = Keypair.generate();
    taker = Keypair.generate();
    mintAuthority = Keypair.generate();

    // Airdrop SOL to test accounts
    await airdrop(maker.publicKey);
    await airdrop(taker.publicKey);
    await airdrop(mintAuthority.publicKey);

    console.log("✅ Maker:", maker.publicKey.toString());
    console.log("✅ Taker:", taker.publicKey.toString());
    console.log("✅ Mint Authority:", mintAuthority.publicKey.toString());
  });

  /**
   * Test 1: Successfully create an NFT offer
   */
  describe("Make Offer", () => {
    it("Should successfully create an NFT offer", async () => {
      console.log("\n📝 Test: Create NFT Offer");

      // Create NFT and payment token
      nftMint = await createNFT(maker.publicKey);
      paymentMint = await createToken();

      console.log("  NFT Mint:", nftMint.toString());
      console.log("  Payment Mint:", paymentMint.toString());

      // Get maker's NFT account (already created in createNFT)
      makerNftAccount = await getAssociatedTokenAddress(
        nftMint,
        maker.publicKey
      );

      // Verify maker has the NFT
      const makerNftAccountInfo = await getAccount(
        provider.connection,
        makerNftAccount
      );
      assert.equal(
        makerNftAccountInfo.amount.toString(),
        "1",
        "Maker should have 1 NFT"
      );
      console.log("  ✅ Maker has NFT");

      // Derive PDA accounts
      [offerAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("nft_offer"),
          offerId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      nftVault = await getAssociatedTokenAddress(
        nftMint,
        offerAccount,
        true // Allow PDA
      );

      console.log("  Offer Account:", offerAccount.toString());
      console.log("  NFT Vault:", nftVault.toString());

      // Create the offer
      const tx = await program.methods
        .makeOffer(offerId, paymentAmount)
        .accounts({
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          maker: maker.publicKey,
          nftMint: nftMint,
          paymentMint: paymentMint,
          makerNftAccount: makerNftAccount,
          offer: offerAccount,
          nftVault: nftVault,
        })
        .signers([maker])
        .rpc();

      console.log("  Transaction:", tx);

      // Verify offer account was created
      const offerAccountInfo = await program.account.nftOffer.fetch(
        offerAccount
      );
      assert.equal(
        offerAccountInfo.offerId.toString(),
        offerId.toString(),
        "Offer ID should match"
      );
      assert.equal(
        offerAccountInfo.maker.toString(),
        maker.publicKey.toString(),
        "Maker should match"
      );
      assert.equal(
        offerAccountInfo.nftMint.toString(),
        nftMint.toString(),
        "NFT mint should match"
      );
      assert.equal(
        offerAccountInfo.paymentMint.toString(),
        paymentMint.toString(),
        "Payment mint should match"
      );
      assert.equal(
        offerAccountInfo.tokenAmount.toString(),
        paymentAmount.toString(),
        "Token amount should match"
      );
      console.log("  ✅ Offer account created correctly");

      // Verify NFT was transferred to vault
      const vaultInfo = await getAccount(provider.connection, nftVault);
      assert.equal(
        vaultInfo.amount.toString(),
        "1",
        "Vault should have 1 NFT"
      );
      console.log("  ✅ NFT transferred to vault");

      // Verify maker no longer has NFT
      const makerNftAccountAfter = await getAccount(
        provider.connection,
        makerNftAccount
      );
      assert.equal(
        makerNftAccountAfter.amount.toString(),
        "0",
        "Maker should have 0 NFTs"
      );
      console.log("  ✅ NFT removed from maker's account");

      console.log("\n✅ Make offer test passed!\n");
    });

    it("Should fail when token amount is zero", async () => {
      console.log("\n📝 Test: Fail on zero token amount");

      const newOfferId = new anchor.BN(999);
      const [newOfferAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_offer"), newOfferId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Create another NFT for this test
      const testNftMint = await createNFT(maker.publicKey);
      const testMakerNftAccount = await getAssociatedTokenAddress(
        testNftMint,
        maker.publicKey
      );
      const testNftVault = await getAssociatedTokenAddress(
        testNftMint,
        newOfferAccount,
        true
      );

      try {
        await program.methods
          .makeOffer(newOfferId, new anchor.BN(0)) // Zero amount
          .accounts({
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            maker: maker.publicKey,
            nftMint: testNftMint,
            paymentMint: paymentMint,
            makerNftAccount: testMakerNftAccount,
            offer: newOfferAccount,
            nftVault: testNftVault,
          })
          .signers([maker])
          .rpc();

        assert.fail("Should have thrown error for zero amount");
      } catch (error) {
        assert.include(
          error.toString(),
          "InvalidTokenAmount",
          "Should fail with InvalidTokenAmount error"
        );
        console.log("  ✅ Correctly rejected zero token amount");
      }

      console.log("\n✅ Zero amount validation test passed!\n");
    });
  });

  /**
   * Test 2: Successfully take an NFT offer
   */
  describe("Take Offer", () => {
    it("Should successfully take an NFT offer", async () => {
      console.log("\n📝 Test: Take NFT Offer");

      // Create payment token accounts for maker and taker
      makerPaymentAccount = await createAssociatedTokenAccount(
        provider.connection,
        taker, // Payer
        paymentMint,
        maker.publicKey
      );

      takerPaymentAccount = await createAssociatedTokenAccount(
        provider.connection,
        taker,
        paymentMint,
        taker.publicKey
      );

      // Mint payment tokens to taker
      await mintTo(
        provider.connection,
        taker,
        paymentMint,
        takerPaymentAccount,
        mintAuthority,
        200 * 1_000_000 // 200 tokens (more than needed)
      );

      const takerPaymentBefore = await getAccount(
        provider.connection,
        takerPaymentAccount
      );
      console.log(
        "  Taker payment balance before:",
        takerPaymentBefore.amount.toString()
      );

      // Derive taker's NFT account address (doesn't exist yet)
      takerNftAccount = await getAssociatedTokenAddress(
        nftMint,
        taker.publicKey
      );

      // Take the offer
      const tx = await program.methods
        .takeOffer()
        .accounts({
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          taker: taker.publicKey,
          maker: maker.publicKey,
          nftMint: nftMint,
          paymentMint: paymentMint,
          takerPaymentAccount: takerPaymentAccount,
          takerNftAccount: takerNftAccount,
          makerPaymentAccount: makerPaymentAccount,
          offer: offerAccount,
          nftVault: nftVault,
        })
        .signers([taker])
        .rpc();

      console.log("  Transaction:", tx);

      // Verify taker received NFT
      const takerNftAccountInfo = await getAccount(
        provider.connection,
        takerNftAccount
      );
      assert.equal(
        takerNftAccountInfo.amount.toString(),
        "1",
        "Taker should have 1 NFT"
      );
      console.log("  ✅ Taker received NFT");

      // Verify taker paid tokens
      const takerPaymentAfter = await getAccount(
        provider.connection,
        takerPaymentAccount
      );
      const expectedBalance = 200 * 1_000_000 - Number(paymentAmount);
      assert.equal(
        takerPaymentAfter.amount.toString(),
        expectedBalance.toString(),
        "Taker should have paid correct amount"
      );
      console.log("  ✅ Taker paid correct amount");

      // Verify maker received payment
      const makerPaymentAccountInfo = await getAccount(
        provider.connection,
        makerPaymentAccount
      );
      assert.equal(
        makerPaymentAccountInfo.amount.toString(),
        paymentAmount.toString(),
        "Maker should receive payment"
      );
      console.log("  ✅ Maker received payment");

      // Verify vault is closed
      try {
        await getAccount(provider.connection, nftVault);
        assert.fail("Vault should be closed");
      } catch (error) {
        console.log("  ✅ Vault closed successfully");
      }

      // Verify offer account is closed
      try {
        await program.account.nftOffer.fetch(offerAccount);
        assert.fail("Offer account should be closed");
      } catch (error) {
        console.log("  ✅ Offer account closed successfully");
      }

      console.log("\n✅ Take offer test passed!\n");
    });
  });

  /**
   * Test 3: Successfully cancel an NFT offer
   */
  describe("Cancel Offer", () => {
    it("Should successfully cancel an NFT offer and return NFT", async () => {
      console.log("\n📝 Test: Cancel NFT Offer");

      // Create a new offer to cancel
      const cancelOfferId = new anchor.BN(3);
      const cancelNftMint = await createNFT(maker.publicKey);
      const cancelMakerNftAccount = await getAssociatedTokenAddress(
        cancelNftMint,
        maker.publicKey
      );

      const [cancelOfferAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("nft_offer"),
          cancelOfferId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const cancelNftVault = await getAssociatedTokenAddress(
        cancelNftMint,
        cancelOfferAccount,
        true
      );

      // Create the offer
      await program.methods
        .makeOffer(cancelOfferId, paymentAmount)
        .accounts({
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          maker: maker.publicKey,
          nftMint: cancelNftMint,
          paymentMint: paymentMint,
          makerNftAccount: cancelMakerNftAccount,
          offer: cancelOfferAccount,
          nftVault: cancelNftVault,
        })
        .signers([maker])
        .rpc();

      console.log("  Created offer to cancel");

      // Verify vault has NFT before cancellation
      const vaultBefore = await getAccount(
        provider.connection,
        cancelNftVault
      );
      assert.equal(vaultBefore.amount.toString(), "1");
      console.log("  ✅ Vault has NFT before cancellation");

      // Cancel the offer
      const tx = await program.methods
        .cancelOffer()
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          maker: maker.publicKey,
          nftMint: cancelNftMint,
          makerNftAccount: cancelMakerNftAccount,
          offer: cancelOfferAccount,
          nftVault: cancelNftVault,
        })
        .signers([maker])
        .rpc();

      console.log("  Transaction:", tx);

      // Verify maker got NFT back
      const makerNftAfter = await getAccount(
        provider.connection,
        cancelMakerNftAccount
      );
      assert.equal(
        makerNftAfter.amount.toString(),
        "1",
        "Maker should have NFT back"
      );
      console.log("  ✅ Maker received NFT back");

      // Verify vault is closed
      try {
        await getAccount(provider.connection, cancelNftVault);
        assert.fail("Vault should be closed");
      } catch (error) {
        console.log("  ✅ Vault closed successfully");
      }

      // Verify offer account is closed
      try {
        await program.account.nftOffer.fetch(cancelOfferAccount);
        assert.fail("Offer account should be closed");
      } catch (error) {
        console.log("  ✅ Offer account closed successfully");
      }

      console.log("\n✅ Cancel offer test passed!\n");
    });
  });

  /**
   * Summary
   */
  after(() => {
    console.log("\n" + "=".repeat(60));
    console.log("🎉 All tests passed successfully!");
    console.log("=".repeat(60) + "\n");
  });
});