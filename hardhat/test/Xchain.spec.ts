import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  Block,
  BlockParams,
  decodeRlp,
  encodeRlp,
  getBytes,
  getNumber,
  JsonRpcProvider,
  keccak256,
  toBeHex,
  toBigInt,
  toQuantity,
  ZeroAddress,
} from 'ethers';
import { Trie } from '@ethereumjs/trie';
import { AccountCache, HeaderCache, StorageProof } from '../src/contracts';
import {
  chain_info,
  fetchAccountProof,
  fetchStorageProof,
  getBlockHeaderRLP,
  getMapSlot,
  xchainRPC,
} from '@oasisprotocol/blockvote-contracts';

type BlockParamsExtra = BlockParams & { stateRoot: string };

// rather than using `rpc.getBlock`, retrieve the raw result then wrap
// ethers.Block hides a bunch of useful values... ;_;
async function fetchBlock(
  rpc: JsonRpcProvider,
  blockNumber: number,
): Promise<[Block, BlockParamsExtra]> {
  const rawBlockData = await rpc.send('eth_getBlockByNumber', [toQuantity(blockNumber), true]);
  const b = new Block(rawBlockData, rpc);
  return [b, rawBlockData as BlockParamsExtra];
}

function toBigIntFromPossiblyQuantity(x: string) {
  if (x === '0x') {
    return 0n;
  }
  return toBigInt(x);
}

async function verifyAccountProof(
  rpc: JsonRpcProvider,
  headerCache: HeaderCache,
  accountCache: AccountCache,
  block: BlockParamsExtra,
  testAccount: string,
) {
  if (!(await headerCache.exists(block.hash!))) {
    const headerRlpBytes = await getBlockHeaderRLP(rpc, block.hash!);
    await headerCache.add(headerRlpBytes);
  }

  console.log(
    `      - fetching proof (blockhash:${block.hash} block:${block.number} account:${testAccount})`,
  );
  const proof = await fetchAccountProof(rpc, block.hash!, testAccount);

  // Can @ethereumjs code verify the returned merkle proof?
  const rawProof = (decodeRlp(proof) as string[]).map(encodeRlp).map((_) => getBytes(_));
  const proofTree = await Trie.createFromProof(rawProof, { useKeyHashing: true });
  expect(await proofTree.checkRoot(getBytes(block.stateRoot))).eq(true);
  const accountData = decodeRlp((await proofTree.get(getBytes(testAccount)))!) as string[];

  // Add to the cache
  if (!(await accountCache.exists(block.hash!, testAccount))) {
    await accountCache.add(block.hash!, testAccount, proof);
  }

  // And that the on-chain contracts can verify the merkle proof
  const onChainAccountData = await accountCache.verifyAccount(block.stateRoot, testAccount, proof);

  // Verify our local decoding & on-chain decoding matches
  expect(toBigIntFromPossiblyQuantity(accountData[0])).eq(onChainAccountData[0]); // nonce
  expect(toBigIntFromPossiblyQuantity(accountData[1])).eq(onChainAccountData[1]); // balance
  expect(accountData[2]).eq(onChainAccountData[2]); // storageRoot
  expect(accountData[3]).eq(onChainAccountData[3]); // codeHash

  return onChainAccountData;
}

async function verifyStorageProof(
  rpc: JsonRpcProvider,
  storageProofContract: StorageProof,
  block: BlockParamsExtra,
  contractAddress: string,
  storageSlot: number,
  holderAddress: string,
) {
  const proof = await fetchStorageProof(
    rpc,
    block.hash!,
    contractAddress,
    storageSlot,
    holderAddress,
  );

  // Can @ethereumjs code verify the returned merkle proof?
  const rawProof = (decodeRlp(proof) as string[]).map(encodeRlp).map((_) => getBytes(_));
  const proofTree = await Trie.createFromProof(rawProof, { useKeyHashing: true });
  // TODO: fetch account?
  const leafKey = getMapSlot(holderAddress, storageSlot);
  const leafData = decodeRlp((await proofTree.get(getBytes(leafKey)))!) as string;

  const onChainLeafData = await storageProofContract[
    'verifyStorage(bytes32,address,uint256,address,bytes)'
  ](block.hash!, contractAddress, storageSlot, holderAddress, proof);

  expect(onChainLeafData).eq(toBeHex(leafData, 32));

  return onChainLeafData;
}

describe('Cross-chain', function () {
  let headerCache: HeaderCache;
  let accountCache: AccountCache;
  let storageProof: StorageProof;

  before(async () => {
    const headerCacheFactory = await ethers.getContractFactory('HeaderCache');
    headerCache = await headerCacheFactory.deploy();

    const accountCacheFactory = await ethers.getContractFactory('AccountCache');
    accountCache = await accountCacheFactory.deploy(await headerCache.getAddress());

    const storageProofFactory = await ethers.getContractFactory('StorageProof');
    storageProof = await storageProofFactory.deploy(await accountCache.getAddress());
  });

  it('Header Serialization', async () => {
    for (const k of Object.keys(chain_info)) {
      const chainId = Number(k);
      const chain = chain_info[chainId];

      if (chain.cannotMakeStorageProofs) {
        continue;
      }

      const rpc = xchainRPC(chainId);

      const block = await rpc.getBlock('latest', false);
      expect(block).to.not.be.null;

      // Verify the RLP encoded block header matches
      const headerRlp = await getBlockHeaderRLP(rpc, block!.hash!);
      const headerHash = keccak256(headerRlp);
      expect(headerHash).eq(block!.hash);

      // Verify header can be decoded by contract
      const header = await headerCache.extractHeader(headerRlp);
      expect(Number(header.blockTimestamp)).eq(block!.timestamp);

      // Add header to on-chain header cache
      const tx = await headerCache.add(headerRlp);
      await tx.wait();

      // Retrieve header from on-chain header cache
      const info = await headerCache.get(headerHash);
      expect(Number(info.blockTimestamp)).eq(Number(header.blockTimestamp));
    }
  });

  it('Token Proof Regression', async () => {
    const checkAddresses = [
      '0x48520fF9b32d8B5BF87Abf789Ea7B3c394c95ebe',
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    ];

    for (const holderAddress of checkAddresses) {
      const chainId = 80002;
      //const blockHash = '0xda03e597e10f764854118e66b258909398abbcf6ad31f0ba5e0eb24107bcfc66';
      const blockNumber = 11764736;
      const slot = 9;
      const tokenAddress = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';

      const rpc = xchainRPC(chainId);
      const [, block] = await fetchBlock(rpc, blockNumber);

      // Need to prime the account proof first, so storage proof can be verified
      await verifyAccountProof(rpc, headerCache, accountCache, block, tokenAddress);

      const leafData = await verifyStorageProof(
        rpc,
        storageProof,
        block,
        tokenAddress,
        slot,
        holderAddress,
      );
      const accountTokenBalance = toBigInt(leafData);

      expect(accountTokenBalance > 0n).eq(true);
    }
  });

  // Verifies that the RPC endpoints are archive nodes and can retrieve historic proofs
  it('Historic Proofs', async function () {
    // Allow roughly 3 seconds per supported chain
    this.timeout(Object.keys(chain_info).length * 1000 * 10);

    for (const k of Object.keys(chain_info)) {
      const chainId = Number(k);
      const chain = chain_info[chainId];
      if (chain.cannotMakeStorageProofs) {
        continue;
      }

      console.log(`    - testing chainId:${chainId} chain:${chain.name}`);
      const rpc = xchainRPC(chainId);

      // Walk backwards from most recent block, until we find one useful for testing
      // This includes finding an account which has a non-zero balance
      let blockNumber = getNumber(await rpc.send('eth_blockNumber', []));
      let block: Block;
      let blockRawData: BlockParamsExtra;
      let testAccount: string;
      let testAccountBalance: bigint;
      while (true) {
        // NOTE: Ethers `Block` object doesn't give us any way to retrieve additional fields
        //       such as `stateRoot`... and we need `stateRoot` to verify account proofs!
        //       So, must fetch the raw block data too
        const [b, rawBlockData] = await fetchBlock(rpc, blockNumber);

        // Find a block with transactions
        if (b.transactions.length == 0) {
          blockNumber -= 1;
          console.log(
            `      - skipping, no transactions (chainId:${chainId} chain:${chain.name} height:${blockNumber})`,
          );
          continue;
        }

        // Find an account which has a balance at this specific block
        let x: string | undefined = undefined;
        let balance: bigint = 0n;
        for (const t of b.prefetchedTransactions) {
          if (t.from != ZeroAddress) {
            const fromBalance = await rpc.getBalance(t.from, blockNumber);
            if (fromBalance > 0n) {
              x = t.from;
              balance = fromBalance;
              break;
            }
          }

          if (t.to && t.to != ZeroAddress) {
            const toBalance = await rpc.getBalance(t.to, blockNumber);
            if (toBalance > 0n) {
              x = t.to;
              balance = toBalance;
              break;
            }
          }
        }
        if (!x || balance === 0n) {
          console.log(
            `       - cannot find test account (chainId:${chainId} chain:${chain.name} height:${blockNumber})`,
          );
          blockNumber -= 1;
          continue;
        }

        block = b;
        testAccount = x;
        blockRawData = rawBlockData;
        testAccountBalance = balance;
        break;
      }

      // Fetch proofs for the chosen account, ensuring eth_getProof works
      // Ensure that on-chain contract can verify the account proof
      const proofInfo = await verifyAccountProof(
        rpc,
        headerCache,
        accountCache,
        blockRawData,
        testAccount,
      );
      expect(proofInfo.balance).eq(testAccountBalance);

      // Then, to verify archive node status...
      // Figure out number of seconds in between blocks (on average)
      const nBlockGap = 5;
      const prevBlockNumber = blockNumber - nBlockGap;
      const [prevBlock] = await fetchBlock(rpc, prevBlockNumber);

      // Then go back more than 512 blocks, or 1 day, whichever is greater
      // This ensures the data being retrieved is archived
      const nBlocksConsideredArchived = 512;
      const secondsPerBlockAvg = (block.timestamp - prevBlock.timestamp) / nBlockGap;
      const yesterdayTimestamp = block.timestamp - 60 * 60 * 24;
      const yesterdayBlockNumber = Math.min(
        blockNumber - Math.round((yesterdayTimestamp - block.timestamp) / secondsPerBlockAvg),
        blockNumber - nBlocksConsideredArchived,
      );
      const [yesterdayBlock, rawYesterdayBlockData] = await fetchBlock(rpc, yesterdayBlockNumber);
      if (!yesterdayBlock) {
        throw new Error(`Failed to retrieve yesterdays block: ${yesterdayBlockNumber}`);
      }

      // Then verify we can retrieve proofs for historic data, and verify on-chain
      await verifyAccountProof(rpc, headerCache, accountCache, rawYesterdayBlockData, testAccount);
    }
  });
});
