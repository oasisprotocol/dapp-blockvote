import { task } from 'hardhat/config';
import { existsSync, promises as fs } from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ContractFactory, parseEther } from 'ethers';
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

interface DeployMiniMeTokenArgs {
  viteenv: string | undefined;
  name: string;
  symbol: string;
  decimals: string;
  initialsupply: string;
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

task('deploy-minime-token')
  .addParam('viteenv', 'Output contract addresses to environment file', '')
  .addParam('name', 'Token name', 'Test MiniMe Token')
  .addParam('symbol', 'Token symbol', 'TMT')
  .addParam('decimals', 'Token decimals', '18')
  .addParam('initialsupply', 'Initial supply (in token units)', '1000000')
  .setAction(async (args: DeployMiniMeTokenArgs, hre) => {
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

    // First deploy the MiniMe Token Factory
    const addr_MiniMeTokenFactory = await deployContract(
      hre,
      await hre.ethers.getContractFactory('MiniMeTokenFactory'),
      'CONTRACT_MINIME_FACTORY',
      env,
      setenv,
    );

    // Deploy the MiniMe Token
    const addr_MiniMeToken = await deployContract(
      hre,
      await hre.ethers.getContractFactory('MiniMeToken'),
      'CONTRACT_MINIME_TOKEN',
      env,
      setenv,
      addr_MiniMeTokenFactory, // _tokenFactory
      hre.ethers.ZeroAddress,   // _parentToken (no parent)
      0,                        // _parentSnapShotBlock
      args.name,                // _tokenName
      parseInt(args.decimals),  // _decimalUnits
      args.symbol,              // _tokenSymbol
      true,                     // _transfersEnabled
    );

    // Mint initial supply to deployer
    const [deployer] = await hre.ethers.getSigners();
    const contract_MiniMeToken = await hre.ethers.getContractAt('MiniMeToken', addr_MiniMeToken);
    
    const initialSupplyWei = parseEther(args.initialsupply);
    console.log(`Minting ${args.initialsupply} ${args.symbol} to ${deployer.address}...`);
    
    const mintTx = await contract_MiniMeToken.generateTokens(deployer.address, initialSupplyWei);
    await mintTx.wait();
    
    const balance = await contract_MiniMeToken.balanceOf(deployer.address);
    console.log(`Minted ${balance.toString()} tokens to ${deployer.address}`);

    console.log('\n=== Deployment Summary ===');
    console.log(`MiniMeTokenFactory: ${addr_MiniMeTokenFactory}`);
    console.log(`MiniMeToken: ${addr_MiniMeToken}`);
    console.log(`Token Name: ${args.name}`);
    console.log(`Token Symbol: ${args.symbol}`);
    console.log(`Token Decimals: ${args.decimals}`);
    console.log(`Initial Supply: ${args.initialsupply} ${args.symbol}`);
    console.log(`Initial Holder: ${deployer.address}`);
    
    if (args.viteenv) {
      console.log(`\nEnvironment variables saved to: ${args.viteenv}`);
    }
  });