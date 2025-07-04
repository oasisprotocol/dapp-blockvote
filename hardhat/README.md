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

The recommended approach is to cache data at poll creation time (inline caching):

```bash
# Run test with inline caching (recommended)
npx hardhat run scripts/test-ldo-poll-with-caching.ts --network sapphire-testnet
```

This script will:
1. Fetch the block header and account proof from Ethereum mainnet
2. Create a poll and cache the data in the same transaction
3. Generate storage proofs for your balance
4. Submit a vote using the cached data

### Why Inline Caching?

- **Single transaction**: Everything happens in one transaction, simplifying frontend integration
- **Fresh data**: Each poll can use a different snapshot block
- **No coordination**: No need to ensure data is pre-cached before poll creation
- **Better UX**: Users don't need to wait for multiple transactions

### Pre-caching (For Testing/Debugging Only)

Pre-caching is useful for testing and debugging scenarios:

```bash
# 1. Cache block header for a specific block
BLOCK_NUMBER=22837817 ADD_TO_CACHE=true npx hardhat run scripts/get-block-header.ts --network sapphire-testnet

# 2. Cache LDO token account proof
npx hardhat run scripts/cache-ldo-account.ts --network sapphire-testnet

# 3. Run test with pre-cached data
npx hardhat run scripts/test-ldo-poll.ts --network sapphire-testnet
```

Pre-caching allows you to:
- Debug caching issues separately from poll creation
- Test with specific blocks without re-fetching data
- Verify cached data before using it

**Note**: You need to have LDO tokens in your wallet at the snapshot block for the test to work.


### Utility Scripts

#### Get Block Headers

Fetch and encode block headers with proper hardfork detection:

```bash
# Fetch a specific block header
BLOCK_NUMBER=22837817 npx hardhat run scripts/get-block-header.ts

# The script automatically detects the correct hardfork:
# - Cancun: blocks >= 19426587 (includes all EIP-4844 fields)
# - London: blocks >= 12965000 (includes baseFeePerGas)
```

#### Generate Storage Proofs

Generate storage proofs for any MiniMe token holder:

```bash
# Set environment variables
export ARCHIVE_RPC="your-archive-rpc-url"
export TOKEN_ADDRESS="0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32"  # LDO
export HOLDER_ADDRESS="0xYourAddress"
export BLOCK_NUMBER=22837817

npx hardhat run scripts/generate-minime-proof.ts
```

#### Test Oracle Functionality

Test the MiniMe storage oracle with various scenarios:

```bash
npx hardhat run scripts/test-minime-oracle.ts --network sapphire-testnet
```

### Troubleshooting

1. **"Block header not cached" error**: Only occurs with pre-caching approach; use inline caching instead
2. **"Account not proven" error**: Only occurs with pre-caching approach; use inline caching instead
3. **"No LDO checkpoints" error**: The address has no LDO tokens at the snapshot block
4. **Out of memory errors**: The generic StorageProof.sol is incompatible with MiniMe tokens; ensure you're using MiniMeStorageACL
5. **Hash mismatch warnings**: Expected behavior; the script uses the computed hash for HeaderCache compatibility

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