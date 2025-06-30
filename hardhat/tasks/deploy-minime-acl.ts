import { task } from 'hardhat/config';
import { existsSync, promises as fs } from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ContractFactory } from 'ethers';
import dotenv from 'dotenv';

function makeEnvUpdater(env: dotenv.DotenvParseOutput, filename?: string) {
  return async function updater(key: string, value: string) {
    env[key] = value;
    const line = `${key}=${value}`;
    console.log(line);
    if (filename) {
      await fs.writeFile(
        filename,
        Object.entries(env)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n') + '\n',
      );
    }
  };
}


async function deployContract<T extends ContractFactory>(
  hre: HardhatRuntimeEnvironment,
  factory: T,
  name: string,
  env: dotenv.DotenvParseOutput,
  setenv: ReturnType<typeof makeEnvUpdater>,
  ...args: Parameters<typeof factory.getDeployTransaction>
): Promise<string> {
  const varname = `VITE_${name}`;
  const varname_tx = `${varname}_TX`;
  if (varname in env) {
    const varval = env[varname];
    if (varname_tx in env) {
      // Retrieve previous deployment transaction
      const txid = env[varname_tx];
      const tx = await hre.ethers.provider.getTransaction(txid);

      if (tx) {
        // And compare it against the new deployment transaction
        // If they are the same, don't deploy the new contract
        const dt = await factory.getDeployTransaction(...args);
        if (dt.data === tx.data) {
          console.log(`${name} already deployed at ${varval}`);
          return varval;
        }
      }
    }
  }

  // Otherwise, deploy new contract and update env
  console.log(`Deploying ${name}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  await setenv(varname_tx, contract.deploymentTransaction()?.hash!);
  await setenv(varname, await contract.getAddress());

  console.log(`${name} deployed at ${await contract.getAddress()}`);
  return await contract.getAddress();
}

task('deploy-minime-acl')
  .addParam('viteenv', 'Output contract addresses to environment file', '')
  .setAction(async (args: { viteenv: string | undefined }, hre) => {
    await hre.run('compile', { quiet: true });

    let env: dotenv.DotenvParseOutput = {};
    if (args.viteenv && existsSync(args.viteenv)) {
      const envFileData = await fs.readFile(args.viteenv);
      env = dotenv.parse(envFileData);
    }

    if (args.viteenv) {
      console.log(`# Saving environment to ${args.viteenv}`);
    }

    const setenv = makeEnvUpdater(env, args.viteenv);

    // Get HeaderCache and AccountCache addresses from environment
    const headerCacheAddress = env['VITE_CONTRACT_XCHAIN_HEADERCACHE'] || '0xe65522DEcB8450F98a895f279b1446f6F3Ff80be';
    const accountCacheAddress = env['VITE_CONTRACT_XCHAIN_ACCOUNTCACHE'] || '0x7Daf15Cab39f670F8E5B1dc91b5abA864568A7A4';

    console.log(`Using HeaderCache at: ${headerCacheAddress}`);
    console.log(`Using AccountCache at: ${accountCacheAddress}`);

    // Deploy MiniMe Storage Oracle
    const addr_MiniMeStorageOracle = await deployContract(
      hre,
      await hre.ethers.getContractFactory('MiniMeStorageOracle'),
      'CONTRACT_MINIME_STORAGE_ORACLE',
      env,
      setenv,
      headerCacheAddress,
      accountCacheAddress,
    );

    // Deploy MiniMe Storage ACL
    const addr_MiniMeStorageACL = await deployContract(
      hre,
      await hre.ethers.getContractFactory('MiniMeStorageACL'),
      'CONTRACT_ACL_MINIME_STORAGE',
      env,
      setenv,
      addr_MiniMeStorageOracle,
    );

    console.log('\n=== Deployment Summary ===');
    console.log(`MiniMeStorageOracle: ${addr_MiniMeStorageOracle}`);
    console.log(`MiniMeStorageACL: ${addr_MiniMeStorageACL}`);
    console.log(`HeaderCache (existing): ${headerCacheAddress}`);
    console.log(`AccountCache (existing): ${accountCacheAddress}`);
    
    if (args.viteenv) {
      console.log(`\nEnvironment variables saved to: ${args.viteenv}`);
    }
  });