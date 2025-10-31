// mint.js — create a mint, ATA, mint tokens, save meta.json with creative name
import fs from "fs";
import {
  Connection,
  Keypair,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";


const CREATIVE_NAME = "lovesucks"; // <-- your creative token name
const DECIMALS = 6;
const MINT_AMOUNT_TOKENS = 1000; // tokens to mint
const MINT_AMOUNT_BASE = BigInt(MINT_AMOUNT_TOKENS) * BigInt(10 ** DECIMALS);
const WALLET_FILE = "./wallet.json";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");


// Load existing wallet or create a new one
async function loadOrCreateWallet() {
  if (fs.existsSync(WALLET_FILE)) {
    const secret = JSON.parse(fs.readFileSync(WALLET_FILE));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(Array.from(kp.secretKey)));
  console.log("Saved wallet secret to", WALLET_FILE);
  return kp;
}

async function main() {
  const payer = await loadOrCreateWallet();
  console.log("Payer Public Key :", payer.publicKey.toBase58());

  // Airdrop if needed (devnet)
  const bal = await connection.getBalance(payer.publicKey);
  if (bal < 0.5 * LAMPORTS_PER_SOL) {
    console.log("Airdropping 1 SOL to payer...");
    const sig = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log("Airdrop done.");
  }

  // Create mint
  console.log("Creating mint...");
  const mint = await createMint(
    connection,
    payer,                 // payer (also payer for account creation)
    payer.publicKey,       // mint authority
    null,                  // freeze authority
    DECIMALS               // decimals
  );
  console.log("Mint address is :", mint.toBase58());

  // Create/get associated token account for payer
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,         // payer
    mint,          // mint
    payer.publicKey // owner
  );
  console.log("Associated Token Account address is :", ata.address.toBase58());

  // Mint tokens into ATA
  console.log(`Minting ${MINT_AMOUNT_TOKENS} ${CREATIVE_NAME} tokens...`);
  const sig = await mintTo(
    connection,
    payer,         // payer
    mint,          // mint
    ata.address,   // destination
    payer.publicKey,// authority
    MINT_AMOUNT_BASE // amount (base units)
  );
  console.log("Mint tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // Fetch balance for confirmation
  const info = await getAccount(connection, ata.address);
  console.log("Raw balance (base units):", info.amount.toString());
  console.log("Human Readable balance is :", Number(info.amount) / 10 ** DECIMALS);

  // Save metadata (including creative name)
  const meta = {
    name: CREATIVE_NAME,
    mint: mint.toBase58(),
    ata: ata.address.toBase58(),
    decimals: DECIMALS,
    mintedTokens: MINT_AMOUNT_TOKENS,
    explorerMint: `https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`,
  };
  fs.writeFileSync("meta.json", JSON.stringify(meta, null, 2));
  console.log("Wrote meta.json");
}

main().catch((e)=>{ console.error(e); process.exit(1); });
