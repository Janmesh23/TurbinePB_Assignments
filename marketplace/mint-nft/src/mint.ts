import { mplCore } from "@metaplex-foundation/mpl-core";
import { createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  IRYS_DEVNET,
  loadPhantomWallet,
  requestAirdropIfNeeded,
  uploadImage,
  uploadMetadata,
  createMetadata,
  mintNft,
} from "./utilities";

const nftList = [
  {
    "name": "Data Sentinel Ape",
    "imagePath": "./assets/data_sentinel_ape.png",
    "description": "A formidable guardian, built from reinforced cyber-bricks and infused with a potent data-stream core. Wielding a plasma katana, it protects the neon-lit sectors from digital incursions and rogue AI.",
    "attributes": [
      { "trait_type": "Rarity", "value": "Epic" },
      { "trait_type": "Role", "value": "Guardian" },
      { "trait_type": "Body Material", "value": "Reinforced Carbon-Chrome" },
      { "trait_type": "Eye Color", "value": "Crimson Visor" },
      { "trait_type": "Weapon", "value": "Plasma Katana" },
      { "trait_type": "Environment", "value": "Neon Alley" }
    ]
},
  {
    "name": "Glitch Runner Primate",
    "imagePath": "./assets/glitch_runner_primate.png",
    "description": "An incredibly swift Cyber-Brick Ape, optimized for traversal through the intricate data streams of the digital realm. Its modular frame is light, infused with mossy-tech, and its movements leave trails of neon energy.",
    "attributes": [
      { "trait_type": "Rarity", "value": "Rare" },
      { "trait_type": "Role", "value": "Scout" },
      { "trait_type": "Body Material", "value": "Lightweight Alloy" },
      { "trait_type": "Eye Color", "value": "Aqua Visor" },
      { "trait_type": "Enhancement", "value": "Mossy Integration" },
      { "trait_type": "Environment", "value": "Digital Highway" }
    ]
},
  {
    "name": "Bio-Mech Zen Ape",
    "imagePath": "./assets/bio_mech_zen_ape.png",
    "description": "A sagely Cyber-Brick Ape, embodying harmony between nature and technology. Its modular form integrates ancient moss and carved natural elements with advanced cybernetics, channeling bio-luminescent energy for profound meditation.",
    "attributes": [
      { "trait_type": "Rarity", "value": "Legendary" },
      { "trait_type": "Role", "value": "Philosopher" },
      { "trait_type": "Body Material", "value": "Bio-Integrated Timber" },
      { "trait_type": "Eye Color", "value": "Serene Green" },
      { "trait_type": "Enhancement", "value": "Moss Infusion" },
      { "trait_type": "Environment", "value": "Futuristic Jungle" }
    ]
}
];

async function run() {
  const umi = createUmi("https://api.devnet.solana.com")
    .use(mplCore())
    .use(irysUploader({ address: IRYS_DEVNET }));
 
  const wallet = loadPhantomWallet(umi);
  umi.use(signerIdentity(createSignerFromKeypair(umi, wallet)));

  console.log("🔑 Using Phantom Wallet:", wallet.publicKey.toString());

  await requestAirdropIfNeeded(umi);

  for (const nft of nftList) {
    const imageUri = await uploadImage(nft.imagePath, umi);
    const metadata = createMetadata(nft.name, nft.description, imageUri, nft.attributes);
    const metadataUri = await uploadMetadata(metadata, umi);
    await mintNft(metadataUri, nft.name, umi);
  }

  console.log("🎉 All NFTs minted successfully!");
}

run();
