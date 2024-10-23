import { AccountCache, HeaderCache } from '../src/contracts';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import crypto from 'node:crypto';
import { Trie } from '@ethereumjs/trie';
import { decodeRlp, encodeRlp, getBytes, hexlify, randomBytes, toBeHex, toBigInt } from 'ethers';

function randomBigInt64(): bigint {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  return (BigInt(array[0]) << 32n) | BigInt(array[1]);
}

function random256BitBigInt(): bigint {
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);

  let result = 0n;
  for (let i = 0; i < 8; i++) {
    result = (result << 32n) | BigInt(array[i]);
  }

  return result;
}

describe('Merkle Patricia Trie', () => {
  let headerCache: HeaderCache;
  let accountCache: AccountCache;

  before(async () => {
    const headerCacheFactory = await ethers.getContractFactory('HeaderCache');
    headerCache = await headerCacheFactory.deploy();

    const accountCacheFactory = await ethers.getContractFactory('AccountCache');
    accountCache = await accountCacheFactory.deploy(await headerCache.getAddress());
  });

  it('Accounts Tree', async () => {
    const t = new Trie({ useKeyHashing: true, useRootPersistence: true });

    let skip = 1;
    const total = 10000;

    for (let i = 0; i < total; i += 1) {
      // Create some random account data & put into our ever growing tree
      const randAddress = randomBytes(20);
      const accountData = [
        toBeHex(randomBigInt64()), // nonce
        toBeHex(random256BitBigInt()), // balance
        hexlify(randomBytes(32)), // storageRoot
        hexlify(randomBytes(32)), // codeHash
      ];
      const randAcctEncoded = encodeRlp(accountData);
      await t.put(randAddress, getBytes(randAcctEncoded));

      // Every N items, verify proofs
      if (i == 0 || i % skip != 0) {
        continue;
      }
      // Increase the number of items inserted in between checks
      // To progressively check deeper & deeper trees
      skip = Math.round(skip + skip / 10) + 1;

      const proof = await t.createProof(randAddress);

      // Re-encode proof to the same format returned from ETH JSON-RPC eth_getProof
      // NOTE: decode then re-encode works, maybe `Trie` implementation is broken?
      const rpcEncodedAccountProof = proof.map(decodeRlp).map(encodeRlp);

      // Then recover the trees from both encodings
      const proofTree = await Trie.createFromProof(
        rpcEncodedAccountProof.map((_) => getBytes(_)),
        { useKeyHashing: true },
      );
      const proofTree2 = await Trie.createFromProof(proof, { useKeyHashing: true });
      expect(hexlify(proofTree.root())).equal(hexlify(proofTree2.root()));

      // Verify the proof can be verified on-chain
      const contractEncodedProof = encodeRlp(rpcEncodedAccountProof.map(decodeRlp));
      const onChainAccountData = await accountCache.verifyAccount(
        proofTree.root(),
        hexlify(randAddress),
        contractEncodedProof,
      );

      // Verify the returned account data is the same as our local data
      expect(toBigInt(accountData[0])).eq(onChainAccountData[0]);
      expect(toBigInt(accountData[1])).eq(onChainAccountData[1]);
      expect(accountData[2]).eq(onChainAccountData[2]);
      expect(accountData[3]).eq(onChainAccountData[3]);
    }
  });
});
