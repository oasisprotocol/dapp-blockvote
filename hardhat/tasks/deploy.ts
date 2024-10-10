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

interface DeployArgs {
  viteenv: string | undefined;
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
          return varval;
        }
      }
    }
  }

  // Otherwise, deploy new contract and update env
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  await setenv(varname_tx, contract.deploymentTransaction()?.hash!);
  await setenv(varname, await contract.getAddress());

  return await contract.getAddress();
}

async function deploy_xchain(
  hre: HardhatRuntimeEnvironment,
  env: dotenv.DotenvParseOutput,
  setenv: ReturnType<typeof makeEnvUpdater>,
) {
  const addr_HeaderCache = await deployContract(
    hre,
    await hre.ethers.getContractFactory('HeaderCache'),
    'CONTRACT_XCHAIN_HEADERCACHE',
    env,
    setenv,
  );

  const addr_AccountCache = await deployContract(
    hre,
    await hre.ethers.getContractFactory('AccountCache'),
    'CONTRACT_XCHAIN_ACCOUNTCACHE',
    env,
    setenv,
    addr_HeaderCache,
  );

  const addr_StorageProof = await deployContract(
    hre,
    await hre.ethers.getContractFactory('StorageProof'),
    'CONTRACT_XCHAIN_STORAGEPROOF',
    env,
    setenv,
    addr_AccountCache,
  );

  const addr_StorageProofACL = await deployContract(
    hre,
    await hre.ethers.getContractFactory('StorageProofACL'),
    'CONTRACT_ACL_STORAGEPROOF',
    env,
    setenv,
    addr_StorageProof,
  );

  return { addr_AccountCache, addr_HeaderCache, addr_StorageProof, addr_StorageProofACL };
}

async function deploy_acls(
  hre: HardhatRuntimeEnvironment,
  env: dotenv.DotenvParseOutput,
  setenv: ReturnType<typeof makeEnvUpdater>,
) {
  const addr_AllowAllACL = await deployContract(
    hre,
    await hre.ethers.getContractFactory('AllowAllACL'),
    'CONTRACT_ACL_ALLOWALL',
    env,
    setenv,
  );

  const addr_VoterAllowListACL = await deployContract(
    hre,
    await hre.ethers.getContractFactory('VoterAllowListACL'),
    'CONTRACT_ACL_VOTERALLOWLIST',
    env,
    setenv,
  );

  const addr_TokenHolderACL = await deployContract(
    hre,
    await hre.ethers.getContractFactory('TokenHolderACL'),
    'CONTRACT_ACL_TOKENHOLDER',
    env,
    setenv,
  );

  return { addr_AllowAllACL };
}

// Default DAO deployment, no permissions.
task('deploy')
  .addParam('viteenv', 'Output contract addresses to environment file', '')
  .setAction(async (args: DeployArgs, hre) => {
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

    // Export RPC info etc. from current hardhat config
    const currentNetwork = Object.values(hre.config.networks).find(
      (x) => x.chainId === hre.network.config.chainId,
    );
    const currentNetworkUrl = (currentNetwork as any).url;
    if (!env['VITE_APP_ROOT_URL']) {
      setenv('VITE_APP_ROOT_URL', 'http://vote.oasis.io');
    }
    setenv('VITE_NETWORK', String(hre.network.config.chainId!));
    if (!currentNetworkUrl) {
      setenv('VITE_WEB3_GATEWAY', 'http://localhost:8545');
    } else {
      setenv('VITE_WEB3_GATEWAY', currentNetworkUrl);
    }

    await deploy_xchain(hre, env, setenv);
    const { addr_AllowAllACL } = await deploy_acls(hre, env, setenv);

    const addr_TestToken = await deployContract(
      hre,
      await hre.ethers.getContractFactory('TestToken'),
      'VITE_CONTRACT_TESTTOKEN',
      env,
      setenv,
    );
    const contract_TestToken = await hre.ethers.getContractAt('TestToken', addr_TestToken);
    const signerZero = (await hre.ethers.getSigners())[0].address;
    if ((await contract_TestToken.balanceOf(signerZero)) < parseEther('5')) {
      const mint_tx = await contract_TestToken.mint(signerZero, parseEther('5'));
      await mint_tx.wait();
    }

    const addr_GaslessVoting = await deployContract(
      hre,
      await hre.ethers.getContractFactory('GaslessVoting'),
      'CONTRACT_GASLESSVOTING',
      env,
      setenv,
    );

    const addr_PollManager = await deployContract(
      hre,
      await hre.ethers.getContractFactory('PollManager'),
      'CONTRACT_POLLMANAGER',
      env,
      setenv,
      addr_AllowAllACL,
      addr_GaslessVoting,
    );

    // Set the default PollManager ACL, so frontend doesn't have to query contract
    await setenv('VITE_CONTRACT_POLLMANAGER_ACL', addr_AllowAllACL);
  });
