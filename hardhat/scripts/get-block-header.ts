import { ethers, JsonRpcProvider } from 'ethers';
import { RLP } from '@ethereumjs/rlp';
import hre from 'hardhat';

/**
 * Fetch and RLP-encode block headers for cross-chain storage proofs
 *
 * This script fetches block headers from Ethereum mainnet and encodes them
 * in the format required by the HeaderCache contract on Sapphire.
 *
 * Usage:
 * npx hardhat run scripts/get-block-header.ts
 */

interface BlockHeaderData {
  blockNumber: number;
  blockHash: string;
  rlpEncodedHeader: string;
  parentHash: string;
  stateRoot: string;
  timestamp: number;
}

class BlockHeaderFetcher {
  private provider: JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  /**
   * Convert BigInt to unpaddedBytes for RLP encoding
   */
  private bigIntToUnpaddedBytes(value: bigint): Uint8Array {
    if (value === 0n) {
      return new Uint8Array([]);
    }

    const hex = value.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    return ethers.getBytes('0x' + paddedHex);
  }

  /**
   * Get block header items in the correct order for RLP encoding
   */
  private getBlockHeaderItems(block: any, hardfork: string = 'london'): any[] {
    const items = [
      ethers.getBytes(block.parentHash),
      ethers.getBytes(block.sha3Uncles),
      ethers.getBytes(block.miner),
      ethers.getBytes(block.stateRoot),
      ethers.getBytes(block.transactionsRoot),
      ethers.getBytes(block.receiptsRoot),
      ethers.getBytes(block.logsBloom),
      this.bigIntToUnpaddedBytes(BigInt(block.difficulty)),
      this.bigIntToUnpaddedBytes(BigInt(block.number)),
      this.bigIntToUnpaddedBytes(BigInt(block.gasLimit)),
      this.bigIntToUnpaddedBytes(BigInt(block.gasUsed)),
      this.bigIntToUnpaddedBytes(BigInt(block.timestamp)),
      ethers.getBytes(block.extraData),
      ethers.getBytes(
        block.mixHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
      ),
      ethers.getBytes(block.nonce || '0x0000000000000000'),
    ];

    // Add EIP-1559 base fee for London+ hardfork
    if (hardfork === 'london' || hardfork === 'cancun') {
      if (block.baseFeePerGas) {
        items.push(this.bigIntToUnpaddedBytes(BigInt(block.baseFeePerGas)));
      }
    }

    // Add Cancun-specific fields
    if (hardfork === 'cancun') {
      // withdrawalsRoot (required for Cancun)
      if (block.withdrawalsRoot) {
        items.push(ethers.getBytes(block.withdrawalsRoot));
      }
      
      // blobGasUsed and excessBlobGas (required for Cancun)
      items.push(this.bigIntToUnpaddedBytes(BigInt(block.blobGasUsed || 0)));
      items.push(this.bigIntToUnpaddedBytes(BigInt(block.excessBlobGas || 0)));
      
      // parentBeaconBlockRoot (required for Cancun)
      if (block.parentBeaconBlockRoot) {
        items.push(ethers.getBytes(block.parentBeaconBlockRoot));
      }
    }

    return items;
  }

  /**
   * Fetch block and encode header as RLP
   */
  async getBlockHeader(blockNumber: number, hardfork: string = 'london'): Promise<BlockHeaderData> {
    console.log(`🔍 Fetching block ${blockNumber}...`);

    // Get block data
    const block = await this.provider.send('eth_getBlockByNumber', [
      ethers.toBeHex(blockNumber),
      false,
    ]);

    if (!block) {
      throw new Error(`Block ${blockNumber} not found`);
    }

    console.log(`  Block Hash: ${block.hash}`);
    console.log(`  Parent Hash: ${block.parentHash}`);
    console.log(`  State Root: ${block.stateRoot}`);
    console.log(
      `  Timestamp: ${block.timestamp} (${new Date(parseInt(block.timestamp, 16) * 1000).toISOString()})`,
    );
    console.log(`  Gas Used: ${parseInt(block.gasUsed, 16).toLocaleString()}`);
    console.log(`  Gas Limit: ${parseInt(block.gasLimit, 16).toLocaleString()}`);

    if (block.baseFeePerGas) {
      console.log(`  Base Fee: ${ethers.formatUnits(block.baseFeePerGas, 'gwei')} gwei`);
    }

    // Encode header items
    console.log('📦 Encoding block header...');
    const headerItems = this.getBlockHeaderItems(block, hardfork);
    const rlpEncodedHeader = ethers.hexlify(RLP.encode(headerItems));

    console.log(`  RLP Header Length: ${rlpEncodedHeader.length / 2 - 1} bytes`);
    console.log(`  RLP Header: ${rlpEncodedHeader.substring(0, 66)}...`);

    const computedHash = ethers.keccak256(rlpEncodedHeader);

    return {
      blockNumber: parseInt(block.number, 16),
      blockHash: computedHash,
      rlpEncodedHeader,
      parentHash: block.parentHash,
      stateRoot: block.stateRoot,
      timestamp: parseInt(block.timestamp, 16),
    };
  }

  /**
   * Determine hardfork based on block number
   */
  private getHardforkForBlock(blockNumber: number, chainId: number): string {
    if (chainId === 1) {
      // Ethereum mainnet hardfork blocks
      if (blockNumber >= 19426587) return 'cancun';  // Cancun (March 13, 2024)
      if (blockNumber >= 12965000) return 'london';  // London (August 5, 2021)
      return 'pre-london';
    }
    
    // Default to london for other chains
    return 'london';
  }

  /**
   * Get network info and determine appropriate hardfork
   */
  async getNetworkInfo(): Promise<{ chainId: number; hardfork: string }> {
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);

    // Get current block number
    const currentBlock = await this.provider.getBlockNumber();
    const hardfork = this.getHardforkForBlock(currentBlock, chainId);

    console.log(`🌐 Network: Chain ID ${chainId}`);
    console.log(`📊 Current Block: ${currentBlock}`);
    console.log(`⚙️  Detected Hardfork: ${hardfork}`);

    return { chainId, hardfork };
  }
}

async function main() {
  console.log('=== Block Header Fetcher ===\n');

  // Configuration
  const config = {
    rpcUrl: process.env.ARCHIVE_RPC,
    blockNumber: process.env.BLOCK_NUMBER ? parseInt(process.env.BLOCK_NUMBER) : undefined,
  };

  if (!config.rpcUrl) {
    console.log(
      '❌ Please set ARCHIVE_RPC environment variable with a valid archive node RPC URL',
    );
    console.log(
      '   Example: export ARCHIVE_RPC="https://your-archive-node-url"',
    );
    return;
  }

  console.log('📋 Configuration:');
  console.log(`  RPC URL: ${config.rpcUrl.substring(0, 50)}...`);
  console.log(`  Block Number: ${config.blockNumber || 'Latest - 10'}`);
  console.log('');

  const fetcher = new BlockHeaderFetcher(config.rpcUrl);

  try {
    // Get network info
    const { chainId } = await fetcher.getNetworkInfo();
    console.log('');

    // Determine block number
    let blockNumber = config.blockNumber;
    if (!blockNumber) {
      const currentBlock = await new JsonRpcProvider(config.rpcUrl).getBlockNumber();
      blockNumber = currentBlock - 10; // Use a recent but not latest block
      console.log(`📊 Using block ${blockNumber} (current - 10)`);
    }

    // Determine hardfork for the specific block
    const hardfork = fetcher['getHardforkForBlock'](blockNumber, chainId);
    console.log(`⚙️  Block ${blockNumber} uses hardfork: ${hardfork}`);
    console.log('');

    // Fetch and encode block header
    const headerData = await fetcher.getBlockHeader(blockNumber, hardfork);

    console.log('\n🎉 Block Header Fetch Complete!');
    console.log('');
    console.log('📋 Results:');
    console.log(`  Block Number: ${headerData.blockNumber}`);
    console.log(`  Block Hash: ${headerData.blockHash}`);
    console.log(`  Parent Hash: ${headerData.parentHash}`);
    console.log(`  State Root: ${headerData.stateRoot}`);
    console.log(`  Timestamp: ${headerData.timestamp}`);
    console.log(`  RLP Header: ${headerData.rlpEncodedHeader}`);
    console.log('');

    console.log('💡 Usage in HeaderCache.add():');
    console.log(`  headerCache.add("${headerData.rlpEncodedHeader}");`);
    console.log('');

    console.log('💡 Usage in JavaScript:');
    console.log('  const headerRlpBytes = "' + headerData.rlpEncodedHeader + '";');
    console.log('  const blockHash = "' + headerData.blockHash + '";');
    
    // Check if we should add to cache
    if (process.env.ADD_TO_CACHE === 'true') {
      console.log('\n📝 Adding header to cache on Sapphire...');
      const HEADER_CACHE_ADDRESS = '0xe65522DEcB8450F98a895f279b1446f6F3Ff80be';
      const headerCache = await hre.ethers.getContractAt('HeaderCache', HEADER_CACHE_ADDRESS);
      
      // Check if already cached
      const exists = await headerCache.exists(headerData.blockHash);
      if (exists) {
        console.log('✅ Header already cached!');
      } else {
        const tx = await headerCache.add(headerData.rlpEncodedHeader);
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Header cached! Gas used: ${receipt?.gasUsed.toString()}`);
      }
    } else {
      console.log('\n💡 To add this header to the cache, run:');
      console.log('   ADD_TO_CACHE=true ARCHIVE_RPC=... BLOCK_NUMBER=... npx hardhat run scripts/get-block-header.ts --network sapphire-testnet');
    }
  } catch (error) {
    console.error(`❌ Error fetching block header: ${error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
