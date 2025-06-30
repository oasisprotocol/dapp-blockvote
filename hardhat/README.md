# Hardhat - Oasis Blockvote Smart Contracts

This directory contains the smart contracts and deployment infrastructure for the Oasis Blockvote dApp.

## MiniMe Token Voting Guide

This guide explains how to set up and test MiniMe token voting (specifically LDO) using cross-chain storage proofs on Sapphire testnet.

### Prerequisites

1. Set up environment variables:
   ```bash
   export PRIVATE_KEY="your-private-key"
   export ARCHIVE_RPC="your-ethereum-archive-node-rpc-url"
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Step 1: Deploy Infrastructure

Deploy the MiniMe Storage Oracle and ACL contracts:

```bash
npx hardhat deploy-minime-acl --network sapphire-testnet --viteenv ../frontend/.env.staging
```

This will deploy:
- `MiniMeStorageOracle`: Verifies storage proofs for MiniMe token checkpoints
- `MiniMeStorageACL`: Access control list for MiniMe token voting

### Step 2: Test End-to-End LDO Voting

You have two options for handling the required cache data:

#### Option A: Pre-cache data (recommended for production)

Pre-cache the block header and account proof before creating polls:

```bash
# 1. Cache block header for snapshot block
ADD_TO_CACHE=true npx hardhat run scripts/get-block-header.ts --network sapphire-testnet

# 2. Cache LDO token account proof
npx hardhat run scripts/cache-ldo-account.ts --network sapphire-testnet

# 3. Run the test (uses pre-cached data)
npx hardhat run scripts/test-ldo-poll.ts --network sapphire-testnet
```

#### Option B: Cache at poll creation time

Provide the cache data when creating the poll (higher gas cost, but simpler):

```bash
# Run test with inline caching
npx hardhat run scripts/test-ldo-poll-with-caching.ts --network sapphire-testnet
```

### Why Two Approaches?

- **Pre-caching (Option A)**: Lower gas costs for poll creation, data can be reused across multiple polls
- **Inline caching (Option B)**: Simpler workflow, everything happens in one transaction, but higher gas cost

The test scripts will:
1. Check your LDO balance at the snapshot block (22800000)
2. Create a poll with MiniMe ACL
3. Generate storage proofs for your balance
4. Submit a vote using the proofs

**Note**: You need to have LDO tokens in your wallet at block 22800000 for this test to work.


### Utility Scripts

#### Generate Storage Proofs

Generate storage proofs for any MiniMe token holder:

```bash
# Set environment variables
export ARCHIVE_RPC="your-archive-rpc-url"
export TOKEN_ADDRESS="0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32"  # LDO
export HOLDER_ADDRESS="0xYourAddress"
export BLOCK_NUMBER=22800000

npx hardhat run scripts/generate-minime-proof.ts
```

#### Test Oracle Functionality

Test the MiniMe storage oracle with various scenarios:

```bash
npx hardhat run scripts/test-minime-oracle.ts --network sapphire-testnet
```

### Troubleshooting

1. **"Block header not cached" error**: Run the cache block header command (Step 2.1)
2. **"Account not proven" error**: Run the cache account command (Step 2.2)
3. **"No LDO checkpoints" error**: The address has no LDO tokens at the snapshot block
4. **Out of memory errors**: The generic StorageProof.sol is incompatible with MiniMe tokens; ensure you're using MiniMeStorageACL

### Technical Details

The MiniMe token voting system uses:
- **Checkpoint-based balances**: MiniMe tokens store historical balances at specific blocks
- **Storage proofs**: Cryptographic proofs of Ethereum state from Sapphire
- **Custom oracle**: MiniMeStorageOracle handles the specific storage layout of MiniMe tokens

For more technical details about the storage proof incompatibility with the generic StorageProof.sol, see [notes.md](./notes.md).

### Contract Addresses (Sapphire Testnet)

These addresses are automatically saved to your `.env` file during deployment:
- PollManager: Check `VITE_DAO_V1_ADDR`
- MiniMeStorageACL: Check `VITE_CONTRACT_ACL_MINIME_STORAGE`
- MiniMeStorageOracle: Check `VITE_CONTRACT_MINIME_STORAGE_ORACLE`
- HeaderCache: `0xe65522DEcB8450F98a895f279b1446f6F3Ff80be`
- AccountCache: `0x7Daf15Cab39f670F8E5B1dc91b5abA864568A7A4`