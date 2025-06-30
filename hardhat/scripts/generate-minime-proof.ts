import { ethers } from 'hardhat';
import { JsonRpcProvider } from 'ethers';
import { RLP } from '@ethereumjs/rlp';

/**
 * Generate storage proofs for MiniMe token balances
 *
 * This script generates the dual storage proofs required for MiniMe tokens:
 * 1. Proof for the checkpoint array length
 * 2. Proof for the last checkpoint value
 *
 * Usage:
 * npx hardhat run scripts/generate-minime-proof.ts
 */

interface GenerateProofParams {
  rpcUrl: string;
  tokenAddress: string;
  holderAddress: string;
  blockNumber: number;
  balanceMappingSlot: number;
}

interface MiniMeProofResult {
  proofs: string[];
  balance: string;
  blockHash: string;
  checkpointsLength: number;
}

class MiniMeProofGenerator {
  private provider: JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  /**
   * Calculate the storage slot for a MiniMe checkpoints array
   */
  private getCheckpointsSlot(holderAddress: string, balanceMappingSlot: number): string {
    return ethers.solidityPackedKeccak256(
      ['bytes', 'uint256'],
      [ethers.zeroPadValue(holderAddress, 32), balanceMappingSlot],
    );
  }

  /**
   * Calculate the storage slot for a specific checkpoint in the array
   */
  private getCheckpointSlot(baseSlot: string, checkpointIndex: number): string {
    const hashedBase = ethers.keccak256(baseSlot);
    return ethers.toBeHex(ethers.toBigInt(hashedBase) + ethers.toBigInt(checkpointIndex), 32);
  }

  /**
   * Extract balance from checkpoint value
   * MiniMe checkpoint: [fromBlock (128 bits) | value (128 bits)]
   */
  private extractBalance(checkpointValue: string): string {
    const value = ethers.toBigInt(checkpointValue);
    return (value >> 128n).toString();
  }

  /**
   * Generate storage proofs for MiniMe token balance
   */
  async generateProof(params: GenerateProofParams): Promise<MiniMeProofResult> {
    const blockTag = `0x${params.blockNumber.toString(16)}`;

    console.log(`🔍 Generating MiniMe proof for:`);
    console.log(`  Token: ${params.tokenAddress}`);
    console.log(`  Holder: ${params.holderAddress}`);
    console.log(`  Block: ${params.blockNumber}`);
    console.log(`  Storage Slot: ${params.balanceMappingSlot}`);

    // Get block info
    const block = await this.provider.getBlock(params.blockNumber);
    if (!block) {
      throw new Error(`Block ${params.blockNumber} not found`);
    }
    const blockHash = block.hash;
    console.log(`  Block Hash: ${blockHash}`);

    // Calculate storage slot for checkpoints array
    const checkpointsSlot = this.getCheckpointsSlot(
      params.holderAddress,
      params.balanceMappingSlot,
    );
    console.log(`  Checkpoints Slot: ${checkpointsSlot}`);

    // 1. Get proof for checkpoints array length
    console.log('\n📊 Getting checkpoint array length proof...');
    const lengthProofResponse = await this.provider.send('eth_getProof', [
      params.tokenAddress,
      [checkpointsSlot],
      blockTag,
    ]);

    const checkpointsLength = ethers.toBigInt(lengthProofResponse.storageProof[0].value).toString();
    console.log(`  Checkpoints Length: ${checkpointsLength}`);

    if (checkpointsLength === '0') {
      console.log('  ✅ No checkpoints found, balance is 0');
      return {
        proofs: [this.encodeProof(lengthProofResponse.storageProof[0].proof)],
        balance: '0',
        blockHash,
        checkpointsLength: 0,
      };
    }

    // 2. Get proof for the last checkpoint value
    console.log('\n📋 Getting last checkpoint proof...');
    const lastCheckpointIndex = parseInt(checkpointsLength) - 1;
    const checkpointSlot = this.getCheckpointSlot(checkpointsSlot, lastCheckpointIndex);
    console.log(`  Last Checkpoint Index: ${lastCheckpointIndex}`);
    console.log(`  Checkpoint Slot: ${checkpointSlot}`);

    const checkpointProofResponse = await this.provider.send('eth_getProof', [
      params.tokenAddress,
      [checkpointSlot],
      blockTag,
    ]);

    const checkpointValue = checkpointProofResponse.storageProof[0].value;
    const balance = this.extractBalance(checkpointValue);

    console.log(`  Checkpoint Value: ${checkpointValue}`);
    console.log(`  Extracted Balance: ${balance}`);

    // 3. Encode both proofs
    const lengthProof = this.encodeProof(lengthProofResponse.storageProof[0].proof);
    const checkpointProof = this.encodeProof(checkpointProofResponse.storageProof[0].proof);

    console.log('\n✅ Proofs generated successfully!');

    return {
      proofs: [lengthProof, checkpointProof],
      balance,
      blockHash,
      checkpointsLength: parseInt(checkpointsLength),
    };
  }

  /**
   * Encode a Merkle proof as RLP bytes
   */
  private encodeProof(proof: string[]): string {
    const rlpEncoded = RLP.encode(proof.map((p) => RLP.decode(p)));
    return ethers.hexlify(rlpEncoded);
  }

  /**
   * Verify token contract and get basic info
   */
  async getTokenInfo(tokenAddress: string) {
    const contract = new ethers.Contract(
      tokenAddress,
      [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address) view returns (uint256)',
      ],
      this.provider,
    );

    try {
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);

      return { name, symbol, decimals };
    } catch (error) {
      throw new Error(`Invalid token contract: ${error}`);
    }
  }
}

async function main() {
  console.log('=== MiniMe Storage Proof Generator ===\n');

  // Configuration
  const config = {
    rpcUrl: process.env.ARCHIVE_RPC || '',
    tokenAddress: process.env.TOKEN_ADDRESS || '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', // LDO
    holderAddress: process.env.HOLDER_ADDRESS || '0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c',
    balanceMappingSlot: parseInt(process.env.BALANCE_SLOT || '8'),
  };

  if (!config.rpcUrl) {
    console.log(
      '❌ Please set ARCHIVE_RPC environment variable with a valid archive node RPC URL',
    );
    return;
  }

  console.log('📋 Configuration:');
  console.log(`  RPC URL: ${config.rpcUrl.substring(0, 50)}...`);
  console.log(`  Token: ${config.tokenAddress}`);
  console.log(`  Holder: ${config.holderAddress}`);
  console.log(`  Balance Slot: ${config.balanceMappingSlot}`);
  console.log('');

  const generator = new MiniMeProofGenerator(config.rpcUrl);

  // Get token info
  console.log('🔍 Verifying token contract...');
  try {
    const tokenInfo = await generator.getTokenInfo(config.tokenAddress);
    console.log(`  Name: ${tokenInfo.name}`);
    console.log(`  Symbol: ${tokenInfo.symbol}`);
    console.log(`  Decimals: ${tokenInfo.decimals}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Token verification failed: ${error}`);
    return;
  }

  // Use historical block where we know checkpoints exist
  const provider = new JsonRpcProvider(config.rpcUrl);
  const currentBlock = await provider.getBlockNumber();
  const proofBlock = 22000000; // Use block 22000000 where checkpoints exist

  console.log(`📊 Block Information:`);
  console.log(`  Current Block: ${currentBlock}`);
  console.log(`  Proof Block: ${proofBlock}`);
  console.log('');

  // Generate proof
  try {
    const result = await generator.generateProof({
      ...config,
      blockNumber: proofBlock,
    });

    console.log('\n🎉 Proof Generation Complete!');
    console.log('');
    console.log('📋 Results:');
    console.log(`  Block Hash: ${result.blockHash}`);
    console.log(`  Checkpoints Length: ${result.checkpointsLength}`);
    console.log(`  Balance: ${result.balance}`);
    console.log(`  Number of Proofs: ${result.proofs.length}`);
    console.log('');

    console.log('🔐 Generated Proofs:');
    result.proofs.forEach((proof, index) => {
      const proofType = index === 0 ? 'Length Proof' : 'Checkpoint Proof';
      console.log(`  ${proofType}: ${proof.substring(0, 66)}...`);
    });

    console.log('');
    console.log('💡 Usage in smart contract:');
    console.log('  bytes[] memory proofs = new bytes[](2);');
    result.proofs.forEach((proof, index) => {
      console.log(`  proofs[${index}] = hex"${proof.substring(2)}";`);
    });
  } catch (error) {
    console.error(`❌ Proof generation failed: ${error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
