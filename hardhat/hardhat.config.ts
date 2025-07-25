// Don't import sapphire-hardhat, as it encrypts deployment transactions
//import '@oasisprotocol/sapphire-hardhat';
import '@nomicfoundation/hardhat-ethers';
import 'hardhat-tracer';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import canonicalize from 'canonicalize';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { HardhatUserConfig, task } from 'hardhat/config';

// Load environment variables
dotenv.config();

import '@typechain/hardhat';

import './tasks/deploy';
import './tasks/poll-close';
import './tasks/deploy-minime-acl';
import './tasks/deploy-minime-token';
import './tasks/create-transfers';

const TASK_EXPORT_ABIS = 'export-abis';

task(TASK_COMPILE, async (_args, hre, runSuper) => {
  await runSuper();
  await hre.run(TASK_EXPORT_ABIS);
});

task(TASK_EXPORT_ABIS, async (_args, hre) => {
  const srcDir = path.basename(hre.config.paths.sources);
  const outDir = path.join(hre.config.paths.root, 'abis');

  const [artifactNames] = await Promise.all([
    hre.artifacts.getAllFullyQualifiedNames(),
    fs.mkdir(outDir, { recursive: true }),
  ]);

  await Promise.all(
    artifactNames.map(async (fqn) => {
      const { abi, bytecode, contractName, sourceName } = await hre.artifacts.readArtifact(fqn);
      if (abi.length === 0 || !sourceName.startsWith(srcDir) || contractName.endsWith('Test')) {
        return;
      }
      await fs.writeFile(`${path.join(outDir, contractName)}.json`, `${canonicalize(abi)}\n`);
      await fs.writeFile(`${path.join(outDir, contractName)}.bin`, bytecode);
    }),
  );
}).setDescription('Saves ABI and bytecode to the "abis" directory');

const TEST_HDWALLET = {
  mnemonic: 'test test test test test test test test test test test junk',
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: '',
};

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : TEST_HDWALLET;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      chainId: 1337, // @see https://hardhat.org/metamask-issue.html
    },
    hardhat_local: {
      url: 'http://127.0.0.1:8545/',
    },
    sapphire: {
      url: 'https://sapphire.oasis.io',
      chainId: 0x5afe,
      accounts,
    },
    'sapphire-testnet': {
      url: 'https://testnet.sapphire.oasis.dev',
      chainId: 0x5aff,
      accounts,
    },
    'sapphire-localnet': {
      url: 'http://127.0.0.1:8545',
      chainId: 0x5afd,
      accounts,
    },
    'pontusx-testnet': {
      url: 'https://rpc.test.pontus-x.eu',
      chainId: 0x7ec9,
      accounts,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.28',
        settings: {
          evmVersion: "paris",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: '0.4.24',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  typechain: {
    target: 'ethers-v6',
    outDir: 'src/contracts',
  },
  mocha: {
    require: ['ts-node/register/files'],
    timeout: 50_000,
  },
};

export default config;
