import { expect } from 'chai';
import { ethers } from 'hardhat';

import {
  chain_info,
  erc20TokenDetailsFromProvider,
  getHolderBalance,
  guessStorageSlot,
  xchainRPC,
} from '@oasisprotocol/blockvote-contracts';

interface WellKnownToken {
  holder: string;
  symbol: string;
  slot: number;
}

describe('Tokens', function () {
  it.skip('Detect known ERC-20 tokens', async () => {
    const known_tokens_for_chains: Record<number, Record<string, WellKnownToken>> = {
      137: {
        '0x2ee3d302ea6f8bda4b2a08261d59e8e3d579cc00': {
          holder: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          symbol: 'TOK',
          slot: 101,
        },
      },
      80002: {
        '0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904': {
          holder: '0xbc1Be4cC8790b0C99cff76100E0e6d01E32C6A2C',
          symbol: 'LINK',
          slot: 0,
        },
      },
    };

    for (const k of Object.keys(chain_info)) {
      const chainId = Number(k);
      if (!(chainId in known_tokens_for_chains)) {
        continue;
      }

      const chain = chain_info[chainId];
      const rpc = xchainRPC(chainId);

      const known_tokens = known_tokens_for_chains[chainId];
      for (const token_address of Object.keys(known_tokens)) {
        const info = known_tokens[token_address];
        const tokenInfo = await erc20TokenDetailsFromProvider(token_address, rpc);
        expect(tokenInfo.symbol).eq(info.symbol);
        const balance = await getHolderBalance(token_address, info.holder, rpc);
        expect(balance > 0n).eq(true);

        const storageSlot = await guessStorageSlot(rpc, token_address, 'ERC-20', info.holder);
        expect(storageSlot).not.null;
        if (storageSlot !== null) {
          expect(storageSlot.index).eq(info.slot);
        }
      }
    }
  });
});
