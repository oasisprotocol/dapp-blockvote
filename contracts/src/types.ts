export type AclOptionsToken = {
  token: string;
};

export type AclOptionsAllowAll = {
  allowAll: true;
};

export type AclOptionsAllowList = {
  allowList: true;
};

export type AclOptionsXchain = {
  xchain: {
    c: number;      // chain Id
    b: Uint8Array;  // block hash
    a: Uint8Array;  // account / contract
    s: number;      // slot
  };
};

export type AclOptions = AclOptionsToken | AclOptionsAllowAll | AclOptionsAllowList | AclOptionsXchain;

// NOTE: this is stored on-chain, so it's essential to keep the encoded size
//       as small as possible! Such as using Uint8Array instead of hex encoded
//       addresses.
export type Poll = {
  n: string;      // name
  d: string;      // description
  o: string[];    // choices / options
  a: AclOptions;  // ACL options
};

export type StorageProof = {
  key: string;
  value: string;
  proof: string[];
};

export type GetProofResponse = {
  balance: string;
  codeHash: string;
  nonce: string;
  storageHash: string;
  accountProof: string[];
  storageProof: StorageProof[];
};

export type TokenType = 'ERC-20' | 'MiniMe';
export type NftType = 'ERC-721' | 'ERC-1155';
export type ContractType = TokenType | NftType;
export const isToken = (type: ContractType): boolean => type === 'ERC-20' || type === 'MiniMe';

export type TokenInfo = {
  chainId: bigint;
  addr: string;
  name: string;
  symbol: string;
  decimals: bigint;
  totalSupply: bigint;
  type: TokenType;
};

export type NFTInfo = {
  chainId: bigint;
  addr: string;
  name?: string;
  symbol?: string;
  type: NftType;
};
