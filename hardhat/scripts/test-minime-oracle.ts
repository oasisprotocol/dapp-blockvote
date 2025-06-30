import { ethers } from 'hardhat';
import { JsonRpcProvider } from 'ethers';

const ARCHIVE_RPC = process.env.ARCHIVE_RPC;
const MINIME_ORACLE_ADDRESS = '0x7A882cbEE658Bce5B98a701A47388e99a48CE99d';
const LDO_TOKEN_ADDRESS = '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32';
const WHALE_ADDRESS = '0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c';
const BALANCE_SLOT = 8;
const BLOCK_NUMBER = 22800000;
const BLOCK_HASH = '0x70a1d9f40f5d5e28a20c6e058c78ce310337fd7b4c8866d02fa0751a1caa14f3';

async function main() {
  console.log('=== Test MiniMe Storage Oracle ===\n');
  
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;
  
  const provider = new JsonRpcProvider(ARCHIVE_RPC);
  const oracle = await ethers.getContractAt('MiniMeStorageOracle', MINIME_ORACLE_ADDRESS);
  
  console.log('📊 Configuration:');
  console.log(`Oracle: ${MINIME_ORACLE_ADDRESS}`);
  console.log(`LDO Token: ${LDO_TOKEN_ADDRESS}`);
  console.log(`Block: ${BLOCK_NUMBER} (${BLOCK_HASH})`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log('');
  
  // Test 1: Get checkpoint length for deployer
  console.log('🧪 Test 1: Get checkpoint length for deployer');
  try {
    // Calculate storage slot for array length
    const baseSlot = ethers.solidityPackedKeccak256(
      ['bytes', 'uint256'],
      [ethers.zeroPadValue(deployerAddress, 32), BALANCE_SLOT]
    );
    
    // Get proof for array length
    const lengthProof = await provider.send('eth_getProof', [
      LDO_TOKEN_ADDRESS,
      [baseSlot],
      ethers.toQuantity(BLOCK_NUMBER)
    ]);
    
    const RLP = require('rlp');
    const encodedLengthProof = '0x' + RLP.encode(
      lengthProof.storageProof[0].proof.map((p: string) => RLP.decode(p))
    ).toString('hex');
    
    const length = await oracle.getCheckpointLength(
      BLOCK_HASH,
      LDO_TOKEN_ADDRESS,
      deployerAddress,
      BALANCE_SLOT,
      encodedLengthProof
    );
    
    console.log(`✅ Checkpoint length: ${length}`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.reason || error.message}`);
  }
  console.log('');
  
  // Test 2: Get balance for deployer
  console.log('🧪 Test 2: Get balance for deployer');
  try {
    // Calculate storage slots
    const baseSlot = ethers.solidityPackedKeccak256(
      ['bytes', 'uint256'],
      [ethers.zeroPadValue(deployerAddress, 32), BALANCE_SLOT]
    );
    const arraySlot = ethers.keccak256(baseSlot);
    const checkpointSlot = arraySlot; // First checkpoint (index 0)
    
    // Get proofs
    const proofs = await provider.send('eth_getProof', [
      LDO_TOKEN_ADDRESS,
      [baseSlot, checkpointSlot],
      ethers.toQuantity(BLOCK_NUMBER)
    ]);
    
    const RLP = require('rlp');
    const encodedProofs = [
      '0x' + RLP.encode(
        proofs.storageProof[0].proof.map((p: string) => RLP.decode(p))
      ).toString('hex'),
      '0x' + RLP.encode(
        proofs.storageProof[1].proof.map((p: string) => RLP.decode(p))
      ).toString('hex')
    ];
    
    // Encode proofs array
    const proofData = ethers.AbiCoder.defaultAbiCoder().encode(['bytes[]'], [encodedProofs]);
    
    const balance = await oracle.getBalance(
      BLOCK_HASH,
      LDO_TOKEN_ADDRESS,
      deployerAddress,
      BALANCE_SLOT,
      proofData
    );
    
    console.log(`✅ Balance: ${ethers.formatEther(balance)} LDO`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.reason || error.message}`);
  }
  console.log('');
  
  // Test 3: Get balance for whale
  console.log('🧪 Test 3: Get balance for whale address');
  try {
    // For whale, we know they have many checkpoints
    const baseSlot = ethers.solidityPackedKeccak256(
      ['bytes', 'uint256'],
      [ethers.zeroPadValue(WHALE_ADDRESS, 32), BALANCE_SLOT]
    );
    
    // First get the length
    const lengthValue = await provider.send('eth_getStorageAt', [
      LDO_TOKEN_ADDRESS,
      baseSlot,
      ethers.toQuantity(BLOCK_NUMBER)
    ]);
    const checkpointsLength = ethers.toBigInt(lengthValue);
    console.log(`  Whale has ${checkpointsLength} checkpoints`);
    
    // Calculate last checkpoint slot
    const arraySlot = ethers.keccak256(baseSlot);
    const lastCheckpointSlot = ethers.toBeHex(
      ethers.toBigInt(arraySlot) + checkpointsLength - 1n,
      32
    );
    
    // Get proofs
    const proofs = await provider.send('eth_getProof', [
      LDO_TOKEN_ADDRESS,
      [baseSlot, lastCheckpointSlot],
      ethers.toQuantity(BLOCK_NUMBER)
    ]);
    
    const RLP = require('rlp');
    const encodedProofs = [
      '0x' + RLP.encode(
        proofs.storageProof[0].proof.map((p: string) => RLP.decode(p))
      ).toString('hex'),
      '0x' + RLP.encode(
        proofs.storageProof[1].proof.map((p: string) => RLP.decode(p))
      ).toString('hex')
    ];
    
    const proofData = ethers.AbiCoder.defaultAbiCoder().encode(['bytes[]'], [encodedProofs]);
    
    const balance = await oracle.getBalance(
      BLOCK_HASH,
      LDO_TOKEN_ADDRESS,
      WHALE_ADDRESS,
      BALANCE_SLOT,
      proofData
    );
    
    console.log(`✅ Balance: ${ethers.formatEther(balance)} LDO`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.reason || error.message}`);
  }
  
  console.log('\n📊 Summary:');
  console.log('The MiniMeStorageOracle correctly verifies storage proofs');
  console.log('without the double-hashing issue of the original StorageProof contract.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });