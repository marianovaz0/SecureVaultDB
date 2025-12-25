# SecureVaultDB

SecureVaultDB is a privacy-first on-chain database that stores encrypted numeric records while preserving
selective access control. It uses Zama FHEVM to keep sensitive values encrypted on-chain and allows
owners to grant decryption rights to collaborators without exposing plaintext to the chain.

## Overview

SecureVaultDB lets a user create an encrypted database anchored to the blockchain. The user generates a
random EVM address (access key) in the frontend, encrypts it with Zama FHE, and stores the encrypted
access key on-chain together with the database name. All numeric records are encrypted client-side with
that access key before being written on-chain. Authorized users decrypt the access key and then decrypt
the stored records locally.

## Problems This Solves

- Public blockchains expose all stored data; this project keeps record values encrypted end-to-end.
- Traditional off-chain databases require trust in the operator; this design anchors encrypted data on-chain.
- Sharing sensitive data usually requires copying plaintext; this project enables permissioned decryption.
- Audit trails are often external; this project provides an immutable on-chain history of encrypted writes.

## Advantages

- End-to-end encryption: records never appear on-chain in plaintext.
- Fine-grained sharing: owners can grant decryption rights to specific addresses.
- Minimal trust: encryption and decryption happen client-side using FHE-compatible tooling.
- Auditable metadata: database ownership, names, and timestamps are public for accountability.
- Simple integration: numeric records use a compact euint32 format for efficient storage.

## Core Workflow

1. Create a database
   - Frontend generates a random EVM address (access key A).
   - A is encrypted with Zama FHE and stored on-chain together with the database name.
2. Use a database
   - Authorized user decrypts the encrypted access key A.
3. Store records
   - User encrypts a number with access key A and submits the encrypted value + proof.
4. Read records
   - Authorized user decrypts access key A and then decrypts all stored records locally.
5. Share access
   - Owner grants access to another address; the contract propagates decryption permissions.

## How It Works (On-Chain)

The `SecureVaultDB` contract stores:

- Public metadata: database name, owner, created timestamp.
- Encrypted access key: `eaddress` representing the sealed access key.
- Encrypted records: array of `euint32` values per database.

The contract uses FHEVM permissions (`FHE.allow`) to ensure only authorized addresses can decrypt the
encrypted access key and the encrypted records.

## Tech Stack

- Smart contracts: Solidity + Hardhat
- FHE layer: Zama FHEVM (`@fhevm/solidity`)
- Frontend: React + Vite
- Wallet UX: RainbowKit
- Read calls: viem
- Write calls: ethers
- Package manager: npm

## Repository Structure

- `contracts/` Smart contracts
- `deploy/` Deployment scripts
- `tasks/` Hardhat tasks
- `test/` Tests
- `deployments/` Deployment artifacts (including Sepolia ABI)
- `docs/` Zama references (`docs/zama_llm.md`, `docs/zama_doc_relayer.md`)
- `src/` Frontend source

## Setup

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Compile and Test

```bash
npm run compile
npm run test
```

## Deployment Flow

1. Deploy locally for validation
   - Start a local FHEVM-ready node: `npx hardhat node`
   - Deploy locally: `npx hardhat deploy --network localhost`
2. Deploy to Sepolia
   - Ensure `.env` contains `INFURA_API_KEY` and `PRIVATE_KEY`
   - Deploy: `npx hardhat deploy --network sepolia`

Notes:
- Deployment uses a private key, not a mnemonic.
- The frontend must use the ABI generated under `deployments/sepolia`.

## Frontend Integration Notes

- The UI reads contract data with `viem` and writes with `ethers`.
- Do not use Tailwind CSS.
- Do not use `localStorage`.
- Do not use frontend environment variables.
- The frontend should target Sepolia (avoid localhost networks).

## Usage Walkthrough (Frontend)

1. Connect a wallet and create a database.
2. Decrypt the database access key when prompted.
3. Encrypt and submit numeric records.
4. Decrypt and read records.
5. Grant access to another address and let them decrypt.

## Security and Privacy Notes

- Only encrypted values are stored on-chain; plaintext never leaves the client.
- The access key is encrypted on-chain; authorized users decrypt it locally.
- The contract explicitly authorizes decryption per address.
- Record size is `uint32` for efficiency; extendability is part of future work.

## Future Roadmap

- Support larger numeric types and structured data schemas.
- Batch encryption and pagination for large datasets.
- Rich access roles (read-only vs. write).
- Better activity feeds and audit tooling in the UI.
- Multi-chain deployment beyond Sepolia.
- Optional indexing service for faster history queries.

## License

BSD-3-Clause-Clear. See `LICENSE`.
