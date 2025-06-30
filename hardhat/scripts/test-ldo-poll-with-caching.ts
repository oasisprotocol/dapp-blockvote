import { ethers } from 'hardhat';
import { JsonRpcProvider } from 'ethers';

// Configuration
const ARCHIVE_RPC = process.env.ARCHIVE_RPC;
const LDO_TOKEN_ADDRESS = '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32';
const LDO_BALANCE_SLOT = 8;
const SNAPSHOT_BLOCK = 22800000;
const BLOCK_HASH = '0x70a1d9f40f5d5e28a20c6e058c78ce310337fd7b4c8866d02fa0751a1caa14f3';

// Sapphire Testnet contracts
const POLL_MANAGER_ADDRESS = '0x51a101CDbfEF708b5B512A2e03Ff492859c30162';
const MINIME_ACL_ADDRESS = '0x99Cb8D3614Cc7D7945996071Aa5dFA73039eaf40';

async function main() {
  console.log('=== Test LDO Voting with MiniMe ACL (with inline caching) ===\n');
  
  const [deployer] = await ethers.getSigners();
  const provider = new JsonRpcProvider(ARCHIVE_RPC);
  const pollManager = await ethers.getContractAt('PollManager', POLL_MANAGER_ADDRESS);
  
  console.log('📋 Configuration:');
  console.log(`LDO Token: ${LDO_TOKEN_ADDRESS}`);
  console.log(`MiniMe ACL: ${MINIME_ACL_ADDRESS}`);
  console.log(`Snapshot Block: ${SNAPSHOT_BLOCK}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log('');
  
  // Check deployer's LDO balance
  console.log('🔍 Checking deployer LDO balance...');
  const baseSlot = ethers.solidityPackedKeccak256(
    ['bytes', 'uint256'],
    [ethers.zeroPadValue(deployer.address, 32), LDO_BALANCE_SLOT]
  );
  
  const lengthValue = await provider.send('eth_getStorageAt', [
    LDO_TOKEN_ADDRESS,
    baseSlot,
    ethers.toQuantity(SNAPSHOT_BLOCK)
  ]);
  
  if (ethers.toBigInt(lengthValue) === 0n) {
    console.log('❌ Deployer has no LDO checkpoints');
    return;
  }
  
  const checkpointValue = await provider.send('eth_getStorageAt', [
    LDO_TOKEN_ADDRESS,
    ethers.keccak256(baseSlot),
    ethers.toQuantity(SNAPSHOT_BLOCK)
  ]);
  const balance = ethers.toBigInt(checkpointValue) >> 128n;
  console.log(`✅ Deployer balance: ${ethers.formatEther(balance)} LDO`);
  console.log('');
  
  // Step 1: Get block header and account proof for caching
  console.log('📦 Preparing cache data...');
  
  // Get block header
  const block = await provider.send('eth_getBlockByNumber', [
    ethers.toQuantity(SNAPSHOT_BLOCK),
    false
  ]);
  
  const RLP = require('rlp');
  const headerArray = [
    block.parentHash,
    block.sha3Uncles,
    block.miner,
    block.stateRoot,
    block.transactionsRoot,
    block.receiptsRoot,
    block.logsBloom,
    ethers.toBeHex(block.difficulty),
    ethers.toBeHex(block.number),
    ethers.toBeHex(block.gasLimit),
    ethers.toBeHex(block.gasUsed),
    ethers.toBeHex(block.timestamp),
    block.extraData,
    block.mixHash,
    block.nonce,
    ethers.toBeHex(block.baseFeePerGas || 0)
  ];
  
  const headerRlpBytes = '0x' + RLP.encode(headerArray).toString('hex');
  console.log(`Block header RLP length: ${headerRlpBytes.length / 2 - 1} bytes`);
  
  // Get account proof
  const accountProof = await provider.send('eth_getProof', [
    LDO_TOKEN_ADDRESS,
    [],
    ethers.toQuantity(SNAPSHOT_BLOCK)
  ]);
  
  const decodedAccountNodes = accountProof.accountProof.map((node: string) => RLP.decode(node));
  const rlpAccountProof = '0x' + RLP.encode(decodedAccountNodes).toString('hex');
  console.log(`Account proof RLP length: ${rlpAccountProof.length / 2 - 1} bytes`);
  console.log('');
  
  // Step 2: Create poll with inline caching
  console.log('🗳️ Creating Poll with MiniMe ACL (caching inline)...');
  
  const pollMetadata = {
    name: 'LDO Voting Test with Inline Caching',
    description: 'Testing MiniMe token voting with cache data provided at poll creation',
    discussionUrl: 'https://example.com',
    options: ['Option A', 'Option B', 'Option C'],
  };
  
  // Encode poll creation data WITH cache data
  const pollCreationData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(tuple(bytes32,address,uint256,bool),bytes,bytes)'],
    [
      [
        [BLOCK_HASH, LDO_TOKEN_ADDRESS, LDO_BALANCE_SLOT, true], // PollConfig
        headerRlpBytes,    // Block header for caching
        rlpAccountProof,   // Account proof for caching
      ],
    ],
  );
  
  const currentTime = Math.floor(Date.now() / 1000);
  const closeTime = currentTime + 7 * 24 * 60 * 60; // 7 days
  
  const proposalParams = {
    numChoices: pollMetadata.options.length,
    flags: 1, // FLAG_ACTIVE
    closeTimestamp: closeTime,
    acl: MINIME_ACL_ADDRESS,
    metadata: ethers.toUtf8Bytes(JSON.stringify(pollMetadata)),
  };
  
  console.log('Creating poll transaction (this will cache the data)...');
  const createTx = await pollManager.create(proposalParams, pollCreationData);
  console.log(`Transaction sent: ${createTx.hash}`);
  
  const createReceipt = await createTx.wait();
  console.log(`✅ Poll created! Gas used: ${createReceipt?.gasUsed.toString()}`);
  
  // Get poll ID from events
  const pollManagerInterface = pollManager.interface;
  const pollCreatedEvent = createReceipt?.logs.find((log: any) => {
    try {
      const parsed = pollManagerInterface.parseLog({ topics: log.topics, data: log.data });
      return parsed?.name === 'ProposalCreated';
    } catch {
      return false;
    }
  });
  
  if (!pollCreatedEvent) {
    console.log('❌ Could not find poll ID in events');
    return;
  }
  
  const parsed = pollManagerInterface.parseLog({ 
    topics: pollCreatedEvent.topics as string[], 
    data: pollCreatedEvent.data 
  });
  const pollId = parsed?.args.id;
  console.log(`📊 Poll ID: ${pollId}`);
  console.log('');
  
  // Step 3: Generate proofs and vote
  console.log('🗳️ Voting on the poll...');
  
  // Generate storage proofs
  const checkpointSlot = ethers.keccak256(baseSlot);
  const storageKeys = [baseSlot, checkpointSlot];
  
  const proof = await provider.send('eth_getProof', [
    LDO_TOKEN_ADDRESS,
    storageKeys,
    ethers.toQuantity(SNAPSHOT_BLOCK)
  ]);
  
  const encodedProofs = proof.storageProof.map((p: any) => 
    '0x' + RLP.encode(p.proof.map((node: string) => RLP.decode(node))).toString('hex')
  );
  
  // Encode vote data
  const voteData = ethers.AbiCoder.defaultAbiCoder().encode(['bytes[]'], [encodedProofs]);
  console.log(`Vote data length: ${voteData.length / 2 - 1} bytes`);
  
  // Check if can vote
  const canVote = await pollManager.canVoteOnPoll(pollId, deployer.address, voteData);
  console.log(`Can vote: ${canVote > 0} (weight: ${ethers.formatEther(canVote)} LDO)`);
  
  if (canVote > 0) {
    // Submit vote for option 0
    console.log('Submitting vote for option 0...');
    const voteTx = await pollManager.vote(pollId, 0, voteData);
    console.log(`Transaction sent: ${voteTx.hash}`);
    
    const voteReceipt = await voteTx.wait();
    console.log(`✅ Vote submitted! Gas used: ${voteReceipt?.gasUsed.toString()}`);
    
    // Get vote counts
    try {
      const voteCounts = await pollManager.getVoteCounts(pollId);
      console.log('\n📊 Vote counts:');
      voteCounts.forEach((count, index) => {
        console.log(`  ${pollMetadata.options[index]}: ${count} votes`);
      });
    } catch (error) {
      console.log('\n📊 Vote submitted successfully!');
      console.log('(Vote counts may not be available if vote privacy is enabled)');
    }
  } else {
    console.log('❌ Cannot vote - no voting weight');
  }
  
  console.log('\n✅ Test complete!');
  console.log('Successfully created a poll with inline caching and voted using MiniMe ACL.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });