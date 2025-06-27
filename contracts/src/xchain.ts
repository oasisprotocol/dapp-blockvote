import {
  Contract,
  JsonRpcProvider,
  toBeHex,
  ZeroHash,
  solidityPackedKeccak256,
  zeroPadValue,
  formatUnits,
  encodeRlp,
  decodeRlp,
  BytesLike,
  hexlify,
  getUint,
  getBytes,
  BigNumberish,
} from 'ethers';

import { ContractType, GetProofResponse, NFTInfo, NftType, TokenInfo } from './types.js';
import { chain_info } from './chains.js';
import { BIGINT_0, bigIntToUnpaddedBytes, PrefixedHexString } from './utils.js';
import { RLP } from '@ethereumjs/rlp';

export function randomchoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function _getNameAndChainidMap() {
  const res: Record<string, number> = {};
  for (const x in chain_info) {
    const y = chain_info[x];
    res[y.name] = y.chainId;
  }
  return res;
}

export const xchain_ChainNamesToChainId = _getNameAndChainidMap();

const CACHED_RPC_PROVIDERS = new Map<string, JsonRpcProvider>();

/**
 * Get an RPC provider connection
 *
 * If there are multiple RPC URLs in the chain definition, one will be chosen
 * at random.
 *
 * RPC providers with the same URLs are cached. So if there are 2 URLs then the
 * 2nd time it's called with the same chain ID there's a 50% chance of getting
 * an existing cached RPC connector, or a fresh one with the other URL.
 *
 * @param chainId Chain ID
 * @returns Ethers v6 JsonRpcProvider
 */
export function xchainRPC(chainId: number) {
  if (!(chainId in chain_info)) {
    throw new Error(`Unknown chain: ${chainId}`);
  }

  const info = chain_info[chainId];
  const rpc_url = randomchoice(info.rpcUrls as string[]);

  if (CACHED_RPC_PROVIDERS.has(rpc_url)) {
    return CACHED_RPC_PROVIDERS.get(rpc_url)!;
  }

  console.log(`RPC Connection, chain:${chainId} url:${rpc_url}`);
  const rpc = new JsonRpcProvider(rpc_url);

  CACHED_RPC_PROVIDERS.set(rpc_url, rpc);

  return rpc;
}

const ERC20Abi = [
  'function name() public view returns (string)',
  'function symbol() public view returns (string)',
  'function decimals() public view returns (uint8)',
  'function totalSupply() public view returns (uint256)',
];

export async function erc20TokenDetailsFromProvider(
  addr: string,
  provider: JsonRpcProvider,
): Promise<TokenInfo> {
  const c = new Contract(addr, ERC20Abi, provider);
  const network = await provider.getNetwork();
  return {
    addr: addr,
    chainId: network.chainId,
    name: await c.name(),
    symbol: await c.symbol(),
    decimals: await c.decimals(),
    totalSupply: await c.totalSupply(),
    type: 'ERC-20',
  };
}

const ERC721Abi = [
  'function balanceOf(address _owner) external view returns (uint256)',
  'function ownerOf(uint256 _tokenId) external view returns (address)',
  'function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes data) external payable',
  'function safeTransferFrom(address _from, address _to, uint256 _tokenId) external payable',
  'function transferFrom(address _from, address _to, uint256 _tokenId) external payable',
  'function approve(address _approved, uint256 _tokenId) external payable',
  'function setApprovalForAll(address _operator, bool _approved) external',
  'function getApproved(uint256 _tokenId) external view returns (address)',
  'function isApprovedForAll(address _owner, address _operator) external view returns (bool)',
  // Optional metadata
  'function name() public view returns (string)',
  'function symbol() external view returns (string _symbol)',
  'function tokenURI(uint256 _tokenId) external view returns (string)',
];

export async function erc712NftDetailsFromProvider(
  addr: string,
  provider: JsonRpcProvider,
): Promise<NFTInfo> {
  const c = new Contract(addr, ERC721Abi, provider);
  const network = await provider.getNetwork();

  const getName = async () => {
    try {
      return await c.name();
    } catch {
      return undefined;
    }
  };

  const getSymbol = async () => {
    try {
      return await c.symbol();
    } catch {
      return undefined;
    }
  };

  return {
    addr: addr,
    chainId: network.chainId,
    name: await getName(),
    symbol: await getSymbol(),
    type: 'ERC-721',
  };
}

const ERC1155Abi = [
  'function balanceOf(address _owner, uint256 _id) external view returns (uint256)',
  'function balanceOfBatch(address[] calldata _owners, uint256[] calldata _ids) external view returns (uint256[] memory)',
  'function setApprovalForAll(address _operator, bool _approved) external',
  'function isApprovedForAll(address _owner, address _operator) external view returns (bool)',
  'safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes calldata _data) external',
  'function safeBatchTransferFrom(address _from, address _to, uint256[] calldata _ids, uint256[] calldata _values, bytes calldata _data) external',
  // Optional metadata
  'function name() public view returns (string)',
  'function symbol() external view returns (string _symbol)',
  'function decimals() public view returns (uint8)',
  'function tokenURI(uint256 _tokenId) external view returns (string)',
]; // TODO: add support for metadata JSON

export async function erc1155NftDetailsFromProvider(
  addr: string,
  provider: JsonRpcProvider,
): Promise<NFTInfo> {
  const c = new Contract(addr, ERC1155Abi, provider);
  const network = await provider.getNetwork();

  const getName = async () => {
    try {
      return await c.name();
    } catch {
      return undefined;
    }
  };

  const getSymbol = async () => {
    try {
      return await c.symbol();
    } catch {
      return undefined;
    }
  };

  return {
    addr: addr,
    chainId: network.chainId,
    name: await getName(),
    symbol: await getSymbol(),
    type: 'ERC-1155',
  };
}

const ERC165Abi = ['function supportsInterface(bytes4) public view returns (bool)'];
const ERC721InterfaceId: string = '0x80ac58cd';
const ERC1155InterfaceId: string = '0xd9b67a26';

export async function getNftContractType(
  addr: string,
  provider: JsonRpcProvider,
): Promise<NftType | undefined> {
  try {
    const c = new Contract(addr, ERC165Abi, provider);
    const isERC721 = await c.supportsInterface(ERC721InterfaceId);
    if (isERC721) return 'ERC-721';
    const isERC1155 = await c.supportsInterface(ERC1155InterfaceId);
    if (isERC1155) return 'ERC-1155';
  } catch {
    // Doesn't support ERC-165, so definitely not am ERC-721 or an ERC-1155 NFT.
  }
}

export async function isNFTTokenContract(
  addr: string,
  provider: JsonRpcProvider,
): Promise<boolean> {
  return !!(await getNftContractType(addr, provider));
}

export async function nftDetailsFromProvider(
  addr: string,
  provider: JsonRpcProvider,
): Promise<NFTInfo | undefined> {
  const nftType = await getNftContractType(addr, provider);
  switch (nftType) {
    case 'ERC-721':
      return await erc712NftDetailsFromProvider(addr, provider);
    case 'ERC-1155':
      return await erc1155NftDetailsFromProvider(addr, provider);
    default:
      console.log('Unknown NFT type:', nftType);
  }
}

export async function getHolderBalance(
  token: string,
  holder: string,
  provider: JsonRpcProvider,
): Promise<bigint> {
  return await new Contract(
    token,
    ['function balanceOf(address) public view returns (uint256)'],
    provider,
  ).balanceOf(holder);
}

export function getMapSlot(holderAddress: string, mappingPosition: number): string {
  return solidityPackedKeccak256(
    ['bytes', 'uint256'],
    [zeroPadValue(holderAddress, 32), mappingPosition],
  );
}

export async function isERC20TokenContract(
  address: string,
  provider: JsonRpcProvider,
): Promise<boolean> {
  try {
    await erc20TokenDetailsFromProvider(address, provider);
  } catch (e) {
    return false;
  }

  return true;
}

export async function guessStorageSlot(
  provider: JsonRpcProvider,
  account: string,
  contractType: ContractType,
  decimals: bigint,
  holder: string,
  blockHash = 'latest',
  isStillFresh: () => boolean = () => true,
  progressCallback?: (progress: string) => void | undefined,
): Promise<{
  index: number;
  balance: bigint;
  balanceDecimal?: string;
} | null> {
  let balance: bigint = 0n;

  const getERC20Storage = async () => {
    const abi = ['function balanceOf(address account) view returns (uint256)'];
    const c = new Contract(account, abi, provider);
    balance = (await c.balanceOf(holder)) as bigint;
    const balanceInHex = toBeHex(balance, 32);
    // TODO: if balance is zero, this won't be a useful 'holder' account for testing
    return balanceInHex;
  };

  const getERC721Storage = async () => {
    const abi = ['function balanceOf(address _owner) external view returns (uint256)'];
    const c = new Contract(account, abi, provider);
    balance = (await c.balanceOf(holder)) as bigint;
    console.log('Balance seems to be', balance);
    // TODO: how is this stored?
    const balanceInHex = toBeHex(balance, 32);
    console.log('Should (maybe) look for', balanceInHex);
    return balanceInHex;
  };

  const getERC1155Storage = async () => {
    const abi = ['function balanceOf(address _owner, uint256 _id) external view returns (uint256)'];
    const c = new Contract(account, abi, provider);
    balance = (await c.balanceOf(holder, account)) as bigint;
    console.log('Balance seems to be', balance);
    // TODO: how is this stored?
    const balanceInHex = toBeHex(balance, 32);
    console.log('Should (maybe) look for', balanceInHex);
    return balanceInHex;
  };

  const getWantedStorage = async (): Promise<string> => {
    switch (contractType) {
      case 'ERC-20':
        return await getERC20Storage();
      case 'ERC-721':
        return await getERC721Storage();
      case 'ERC-1155':
        return await getERC1155Storage();
      default:
        throw new Error('not yet implemented');
    }
  };

  const wantedStorage = await getWantedStorage();

  // console.log('Looking for', wantedStorage);
  // if (!!tokenDetails) return null;

  // shortlist most frequently used slots, then do brute force
  let shortlist = [
    0x65, // Aragon Test Xi (Mumbai) 0xb707dfe506ce7e10374c14de6891da3059d989b2
    0x1, // Tally Compound (Ethereum) 0xc00e94Cb662C3520282E6f5717214004A7f26888
    0x33, // DAO Haus Test Xi (Polygon) 0x4d0a8159B88139341c1d1078C8A97ff6001dda91
    2, // USDT on Etheruem
    9, // USDC on Ethereum
  ];

  let restOfList = [...Array(256).keys()].filter((i) => !shortlist.includes(i));

  const allSlots = shortlist.concat(restOfList);
  // Query most likely range of slots
  for (const i of allSlots) {
    if (!isStillFresh()) break;
    if (progressCallback)
      progressCallback(`Checking slot #${i} (${allSlots.indexOf(i) + 1} of ${allSlots.length})`);
    const result = await provider.send('eth_getStorageAt', [
      account,
      getMapSlot(holder, i),
      blockHash,
    ]);

    if (result == wantedStorage && result != ZeroHash) {
      switch (contractType) {
        case 'ERC-20':
          return {
            index: i,
            balance,
            balanceDecimal: formatUnits(balance, decimals),
          };
        case 'ERC-721':
          return {
            index: i,
            balance,
            balanceDecimal: formatUnits(balance, 0),
          };
      }
    }
  }

  return null;
}

export async function fetchStorageProof(
  provider: JsonRpcProvider,
  blockHash: string,
  address: string,
  slot: number,
  holder: string,
): Promise<BytesLike> {
  // TODO Probably unpack and verify
  const response = (await provider.send('eth_getProof', [
    address,
    [getMapSlot(holder, slot)],
    blockHash,
  ])) as GetProofResponse;
  return encodeRlp(response.storageProof[0].proof.map(decodeRlp));
}

export async function fetchStorageValue(
  provider: JsonRpcProvider,
  blockHash: string,
  address: string,
  slot: number,
  holder: string,
): Promise<BigNumberish> {
  const args = [address, getMapSlot(holder, slot), blockHash];
  return await provider.send('eth_getStorageAt', args);
}

export async function fetchAccountProof(
  provider: JsonRpcProvider,
  blockHash: string,
  address: string,
): Promise<BytesLike> {
  const response = (await provider.send('eth_getProof', [
    address,
    [],
    blockHash,
  ])) as GetProofResponse;
  return encodeRlp(response.accountProof.map(decodeRlp));
}

export interface JsonRpcBlock {
  number: PrefixedHexString | string; // the block number. null when pending block.
  hash: PrefixedHexString | string; // hash of the block. null when pending block.
  parentHash: PrefixedHexString | string; // hash of the parent block.
  mixHash?: PrefixedHexString | string; // bit hash which proves combined with the nonce that a sufficient amount of computation has been carried out on this block.
  nonce: PrefixedHexString | string; // hash of the generated proof-of-work. null when pending block.
  sha3Uncles: PrefixedHexString | string; // SHA3 of the uncles data in the block.
  logsBloom: PrefixedHexString | string; // the bloom filter for the logs of the block. null when pending block.
  transactionsRoot: PrefixedHexString | string; // the root of the transaction trie of the block.
  stateRoot: PrefixedHexString | string; // the root of the final state trie of the block.
  receiptsRoot: PrefixedHexString | string; // the root of the receipts trie of the block.
  miner: PrefixedHexString | string; // the address of the beneficiary to whom the mining rewards were given.
  difficulty: PrefixedHexString | string; // integer of the difficulty for this block.
  totalDifficulty: PrefixedHexString | string; // integer of the total difficulty of the chain until this block.
  extraData: PrefixedHexString | string; // the “extra data” field of this block.
  size: PrefixedHexString | string; // integer the size of this block in bytes.
  gasLimit: PrefixedHexString | string; // the maximum gas allowed in this block.
  gasUsed: PrefixedHexString | string; // the total used gas by all transactions in this block.
  timestamp: PrefixedHexString | string; // the unix timestamp for when the block was collated.
  transactions: Array<any>; //<JsonRpcTx | PrefixedHexString | string> // Array of transaction objects, or 32 Bytes transaction hashes depending on the last given parameter.
  uncles: PrefixedHexString[] | string[]; // Array of uncle hashes
  baseFeePerGas?: PrefixedHexString | string; // If EIP-1559 is enabled for this block, returns the base fee per gas
  withdrawals?: Array<any>; //<JsonRpcWithdrawal> // If EIP-4895 is enabled for this block, array of withdrawals
  withdrawalsRoot?: PrefixedHexString | string; // If EIP-4895 is enabled for this block, the root of the withdrawal trie of the block.
  blobGasUsed?: PrefixedHexString | string; // If EIP-4844 is enabled for this block, returns the blob gas used for the block
  excessBlobGas?: PrefixedHexString | string; // If EIP-4844 is enabled for this block, returns the excess blob gas for the block
  parentBeaconBlockRoot?: PrefixedHexString | string; // If EIP-4788 is enabled for this block, returns parent beacon block root
  executionWitness?: unknown; //VerkleExecutionWitness | null // If Verkle is enabled for this block
  requestsRoot?: PrefixedHexString | string; // If EIP-7685 is enabled for this block, returns the requests root
  requests?: Array<PrefixedHexString | string>; // If EIP-7685 is enabled for this block, array of serialized CL requests
}

function getBlockHeaderItems(b: JsonRpcBlock, hardfork: string) {
  const rawItems = [
    getBytes(b.parentHash),
    getBytes(b.sha3Uncles),
    getBytes(b.miner),
    getBytes(b.stateRoot),
    getBytes(b.transactionsRoot),
    getBytes(b.receiptsRoot),
    getBytes(b.logsBloom),
    bigIntToUnpaddedBytes(getUint(b.difficulty)),
    bigIntToUnpaddedBytes(getUint(b.number)),
    bigIntToUnpaddedBytes(getUint(b.gasLimit)),
    bigIntToUnpaddedBytes(getUint(b.gasUsed)),
    bigIntToUnpaddedBytes(getUint(b.timestamp) ?? BIGINT_0),
    getBytes(b.extraData),
    getBytes(b.mixHash!),
    getBytes(b.nonce),
  ];

  if (hardfork === 'cancun' || hardfork === 'london') {
    rawItems.push(bigIntToUnpaddedBytes(getUint(b.baseFeePerGas!)));
  }

  if (hardfork === 'cancun') {
    rawItems.push(bigIntToUnpaddedBytes(getUint(b.withdrawalsRoot!)));
  }

  if (hardfork === 'cancun') {
    rawItems.push(bigIntToUnpaddedBytes(getUint(b.blobGasUsed!)));
    rawItems.push(bigIntToUnpaddedBytes(getUint(b.excessBlobGas!)));
  }

  if (hardfork === 'cancun') {
    rawItems.push(bigIntToUnpaddedBytes(getUint(b.parentBeaconBlockRoot!)));
  }

  return rawItems;
}

/// Retrieve RLP encoded block header
export async function getBlockHeaderRLP(provider: JsonRpcProvider, blockHash: string) {
  // Detect which chain RPC provider is, construct custom chain config with hardfork
  const net = await provider.getNetwork();
  const chainId = Number(net.chainId);
  if (!chainId) {
    throw new Error('Unable to determine chain ID!');
  }
  if (!(chainId in chain_info)) {
    throw new Error('Unsupported chain ID');
  }
  const chain = chain_info[chainId];
  if (!chain.hardfork) {
    throw new Error('Unknown hardfork for chain!');
  }

  const result = (await provider.send('eth_getBlockByHash', [blockHash, false])) as JsonRpcBlock;
  const headerItems = getBlockHeaderItems(result, chain.hardfork);
  return hexlify(RLP.encode(headerItems));
}
