![deployed to devnet](image.png)

Solana NFT Escrow Program

A simple NFT escrow program built with Anchor.

This program allows a Maker to deposit an NFT into a secure vault and set a price in a specific SPL token. A Taker can then accept this offer by paying the set amount, which automatically transfers the NFT to them and the payment to the Maker.

Features

Make Offer: Deposit an NFT into escrow.

Take Offer: Pay to receive the NFT, completing the trade.

Cancel Offer: The original maker can cancel their offer at any time to reclaim their NFT.

Testing

The program was fully tested on localnet using the anchor test framework. All 4 tests passed, covering the make_offer, take_offer, and cancel_offer instructions, as well as error handling.

  NFT Escrow Tests

  Make Offer
    ✔ Should successfully create an NFT offer (2332ms)
    ✔ Should fail when token amount is zero (1408ms)

  Take Offer
    ✔ Should successfully take an NFT offer (1844ms)

  Cancel Offer
    ✔ Should successfully cancel an NFT offer and return NFT (2329ms)

  4 passing (9s)


Deployment

This program was deployed to Devnet. Testing was performed on localnet due to Devnet faucet issues (server request failed to get airdrop).

Program ID: 9QAQvv6ritDHHTcctxYnPdBgPXb7G3bZeTWkZYdg1moJ

Devnet Deployment Signature: 3fKjb9kGmuStsTR2BATpgmgMr91kqUN6JhoXdaXJDpxg4ULfJz2FLtMTwMKv4uxr2kLTmjoccaDs8SJ3dmvixqXw

Completed Escrow Transaction (Localnet)

This is the transaction hash from a successful take_offer test on localnet, where the Taker paid the SPL tokens and received the NFT.

Transaction Hash: 4PsGSURDrduVoCq1oruF32h3MdpG99NqtCcjwCA6g6GRnCEdwcwf8KMJTDeGWRpW8qUFFVoXhozJ4yY2QBjybqhf