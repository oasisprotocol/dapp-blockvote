import {
  Contract,
  decodeRlp,
  encodeRlp,
  ethers, formatEther,
  hexlify,
  JsonRpcProvider,
  keccak256,
  solidityPackedKeccak256,
  toBeHex, toBigInt,
  toQuantity,
  zeroPadValue,
} from 'ethers';
import { RLP } from '@ethereumjs/rlp';
import { GetProofResponse, TokenInfo } from './types';

/**
 * We need to support the MiniMeToken, because of LIDO.
 * See the token contract here:
 * https://github.com/aragon/minime/blob/master/contracts/MiniMeToken.sol#L293-L312
 */
const MiniMeTokenAbi = [
  'function name() public view returns (string)',
  'function symbol() public view returns (string)',
  'function decimals() public view returns (uint8)',
  'function totalSupply() public view returns (uint256)',
  `function balanceOfAt(address _owner, uint _blockNumber) public constant returns (uint)`
];

const testMiniMeOwner = '0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c'
const testMiniMeBlock = 21672028

export async function miniMeTokenDetailsFromProvider(
  addr: string,
  provider: JsonRpcProvider,
): Promise<TokenInfo> {
  const c = new Contract(addr, MiniMeTokenAbi, provider);
  const network = await provider.getNetwork();
  // Test the presence of this specific function
  await c.balanceOfAt(testMiniMeOwner, testMiniMeBlock)
  return {
    addr: addr,
    chainId: network.chainId,
    name: await c.name(),
    symbol: await c.symbol(),
    decimals: await c.decimals(),
    totalSupply: await c.totalSupply(),
    type: 'MiniMe',
  };
}

export async function getMiniMeStorageSlot(
  provider: JsonRpcProvider,
  account: string,
  holder: string,
  _isStillFresh: () => boolean = () => true,
  progressCallback?: (progress: string) => void | undefined,
): Promise<{
  index: number;
  balance: bigint;
  balanceDecimal?: string;
} | null> {
  if (progressCallback) progressCallback("Getting latest block...");
  const block = await provider.getBlock('latest')
  if (!block) throw new Error("Can't get latest block")
  if (progressCallback) progressCallback("Checking balance...");
  const contract = new Contract(account, MiniMeTokenAbi, provider);
  const balance = await contract.balanceOfAt(holder, block.number)
  return {index: 8, balance, balanceDecimal: formatEther(balance)}
}

/// Retrieve RLP encoded block header
export async function getMiniMeBlockHeaderRLP(provider: JsonRpcProvider, wantedBlock: { number?: number; hash?: string}) {

  if (!wantedBlock.number && !wantedBlock.hash) throw new Error("Please supply either block number or block hash!")

  // Get block data
  const block = wantedBlock.hash
    ? await provider.send('eth_getBlockByHash', [wantedBlock.hash, false])
    : await provider.send('eth_getBlockByNumber', [toBeHex(wantedBlock.number!), false])

  if (!block) {
    throw new Error(`Block ${JSON.stringify(wantedBlock)} not found`)
  }

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
    ethers.toBeHex(block.baseFeePerGas || 0),
    // Cancun-specific fields
    ethers.toBeHex(block.withdrawalsRoot || '0x'),
    ethers.toBeHex(block.blobGasUsed || 0),
    ethers.toBeHex(block.excessBlobGas || 0),
    ethers.toBeHex(block.parentBeaconBlockRoot || '0x')
  ];

  return hexlify(RLP.encode(headerArray));
}

export async function fetchMiniMeAccountProof(
  provider: JsonRpcProvider,
  wantedBlock: { number?: number; hash?: string },
  address: string,
) {
  if (!wantedBlock.number && !wantedBlock.hash) throw new Error("Please supply either block number or block hash!")
  const response = (await provider.send('eth_getProof', [
    address,
    [],
    wantedBlock.hash ?? toQuantity(wantedBlock.number!)
  ])) as GetProofResponse;

  return encodeRlp(response.accountProof.map(decodeRlp));
}

export async function getMiniMeAccountBalance(
  provider: JsonRpcProvider,
  contractAddress: string,
  accountAddress: string,
  slotNumber: number,
  wantedBlock: { number?: number; hash?: string },
  withVoteData?: boolean
): Promise<{ balance: bigint, balanceString?: string, voteData?: string }> {
  if (!wantedBlock.number && !wantedBlock.hash) throw new Error("Please supply either block number or block hash!")
  const baseSlot = solidityPackedKeccak256(
    ['bytes', 'uint256'],
    [zeroPadValue(accountAddress, 32), slotNumber]
  );

  const blockNumber = wantedBlock.number ?? (await provider.getBlock(wantedBlock.hash!))?.number
  if (!blockNumber) {
    console.log("Block not found", wantedBlock.hash);
    return { balance: 0n }
  }

  const lengthValue = await provider.send('eth_getStorageAt', [
    contractAddress,
    baseSlot,
    ethers.toQuantity(blockNumber)
  ]);

  if (toBigInt(lengthValue) === 0n) {
    // No checkpoints, no balance
    return { balance: 0n };
  }

  const checkpointValue = await provider.send('eth_getStorageAt', [
    contractAddress,
    keccak256(baseSlot),
    toQuantity(blockNumber)
  ]);
  const balance = toBigInt(checkpointValue) >> 128n;
  const balanceString = formatEther(balance)
  if (!withVoteData) return { balance, balanceString }

  // Generate storage proofs
  const checkpointSlot = keccak256(baseSlot);
  const storageKeys = [baseSlot, checkpointSlot];

  const proof = await provider.send('eth_getProof', [
    contractAddress,
    storageKeys,
    ethers.toQuantity(blockNumber)
  ]);

  // return encodeRlp(response.accountProof.map(decodeRlp));
  const encodedProofs = proof.storageProof.map((p: any) =>
    hexlify(encodeRlp(p.proof.map(decodeRlp)))
  );

  // Encode vote data
  const voteData = ethers.AbiCoder.defaultAbiCoder().encode(['bytes[]'], [encodedProofs]);

  return { balance, balanceString, voteData }
}
