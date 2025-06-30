import { ethers } from 'hardhat';
import { JsonRpcProvider } from 'ethers';

const ARCHIVE_RPC = process.env.ARCHIVE_RPC;
const ACCOUNT_CACHE_ADDRESS = '0x7Daf15Cab39f670F8E5B1dc91b5abA864568A7A4';
const LDO_TOKEN_ADDRESS = '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32';
const BLOCK_HASH = '0x70a1d9f40f5d5e28a20c6e058c78ce310337fd7b4c8866d02fa0751a1caa14f3';
const BLOCK_NUMBER = 22800000;

async function main() {
  console.log('=== Cache LDO Account Proof ===\n');
  
  const [deployer] = await ethers.getSigners();
  const accountCache = await ethers.getContractAt('AccountCache', ACCOUNT_CACHE_ADDRESS);
  const mainnetProvider = new JsonRpcProvider(ARCHIVE_RPC);
  
  console.log('📊 Configuration:');
  console.log(`Block Number: ${BLOCK_NUMBER}`);
  console.log(`Block Hash: ${BLOCK_HASH}`);
  console.log(`LDO Token: ${LDO_TOKEN_ADDRESS}`);
  console.log('');
  
  // Check if already cached
  const exists = await accountCache.exists(BLOCK_HASH, LDO_TOKEN_ADDRESS);
  if (exists) {
    console.log('✅ Account already cached');
    return;
  }
  
  console.log('🔍 Generating account proof from Ethereum mainnet...');
  
  try {
    // Get account proof from mainnet
    const proof = await mainnetProvider.send('eth_getProof', [
      LDO_TOKEN_ADDRESS,
      [],
      ethers.toQuantity(BLOCK_NUMBER)  // Use toQuantity to avoid leading zeros
    ]);
    
    console.log('Account info:');
    console.log(`  Nonce: ${proof.nonce}`);
    console.log(`  Balance: ${proof.balance}`);
    console.log(`  Code Hash: ${proof.codeHash}`);
    console.log(`  Storage Hash: ${proof.storageHash}`);
    console.log(`  Account proof nodes: ${proof.accountProof.length}`);
    console.log('');
    
    // Encode the account proof - need to decode each node first then re-encode the array
    const RLP = require('rlp');
    const decodedNodes = proof.accountProof.map((node: string) => RLP.decode(node));
    const rlpEncodedProof = '0x' + RLP.encode(decodedNodes).toString('hex');
    console.log(`RLP encoded proof length: ${rlpEncodedProof.length / 2 - 1} bytes`);
    
    // Cache the account
    console.log('\n📤 Caching account on Sapphire...');
    const tx = await accountCache.add(BLOCK_HASH, LDO_TOKEN_ADDRESS, rlpEncodedProof);
    console.log(`Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Account cached! Gas used: ${receipt?.gasUsed.toString()}`);
    
    // Verify it's cached
    const nowExists = await accountCache.exists(BLOCK_HASH, LDO_TOKEN_ADDRESS);
    console.log(`\nVerification - Account cached: ${nowExists}`);
    
    if (nowExists) {
      const account = await accountCache.get(BLOCK_HASH, LDO_TOKEN_ADDRESS);
      console.log('Cached account details:');
      console.log(`  Storage Root: ${account.storageRoot}`);
      console.log(`  Code Hash: ${account.codeHash}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.reason || error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });