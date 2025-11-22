import type { Keypair, Umi } from "@metaplex-foundation/umi";
import { createGenericFile, generateSigner, sol } from "@metaplex-foundation/umi";
import { create, type CreateArgs } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import fs from "fs";
import path from "path";


export const IRYS_DEVNET = "https://devnet.irys.xyz";

export function loadPhantomWallet(umi: Umi): Keypair {
  const secretArray = JSON.parse(fs.readFileSync("./wallet/phantom.json", "utf-8"));
  const secretKey = Uint8Array.from(secretArray);
  return umi.eddsa.createKeypairFromSecretKey(secretKey);
}

export async function requestAirdropIfNeeded(umi: Umi) {
  const publicKey = umi.identity.publicKey;
  const balance = await umi.rpc.getBalance(publicKey);
  const balanceSol = Number(balance.basisPoints) / 1_000_000_000;

  if (balanceSol < 0.2) {
    console.log(`Requesting airdrop for ${publicKey}...`);
    await umi.rpc.airdrop(publicKey, sol(0.5));
    console.log("Airdrop complete.");
  }
}


export async function uploadImage(imagePath: string, umi: Umi): Promise<string> {
  const file = fs.readFileSync(imagePath);
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  const genericFile = createGenericFile(file, path.basename(imagePath), {
    tags: [{ name: "Content-Type", value: mimeType }],
  });

  const uri = await umi.uploader.upload([genericFile]);
  return uri[0] as string;
}

export async function uploadMetadata(metadata: any, umi: Umi): Promise<string> {
  return await umi.uploader.uploadJson(metadata);
}

export function createMetadata(name: string, description: string, imageUri: string, attributes: any[]) {
  return {
    name,
    description,
    image: imageUri,
    attributes,
    properties: {
      files: [{ uri: imageUri, type: "image/jpg" }],
      category: "image",
    },
  };
}

export async function mintNft(metadataUri: string, name: string, umi: Umi) {
  const mintSigner = generateSigner(umi);

  const tx = await create(umi, {
    asset: mintSigner,
    name,
    uri: metadataUri,
  } as CreateArgs).sendAndConfirm(umi);

  const signature = base58.deserialize(tx.signature)[0];

  console.log(`✅ Minted NFT: ${name}`);
  console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log(`🔗 View NFT: https://core.metaplex.com/explorer/${mintSigner.publicKey}?env=devnet`);
}
