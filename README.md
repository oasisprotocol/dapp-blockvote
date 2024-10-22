# Oasis Blockvote: Private Sidekick for DAOs

This is a dApp for running ad-hoc unofficial opinion polls for DAO members, or any other group.

The app is a fork of the [Oasis Demo Voting App],
which is in turn a fork of the [OPL Secret Ballot].

[Oasis Demo Voting App]: https://github.com/oasisprotocol/demo-voting/tree/CedarMist/per-dao-stuff
[OPL Secret Ballot]: https://github.com/oasisprotocol/playground/tree/main/opl-secret-ballot

This monorepo is set up for `pnpm`. Install dependencies by running:

```sh
pnpm install
```

## Backend

Move to the `contracts` folder and build smart contracts:

```sh
pnpm build
```

Next, deploy the contract.

### Basic Local Hardhat Deployment

Move to the `hardhat` folder and build smart contracts:

Start the hardhat node:

```sh
make build
```

Deploy smart contracts to that local network:

```sh
make deploy-localnet
```

You can use the `--gaslessAccounts` and `--gaslessFunds` parameters to set
the number of proxy accounts that can be used to pay for the gas for voters
and the amount of tokens each of those accounts will be initially funded.

The deployed DAO contract addresses will be stored
inside the `frontend` folder's `.env.development`, for example:

```
VITE_DAO_V1_ADDR=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Monitoring Signer Accounts

To monitor accounts, use `gv-topup` providing DAO address which will show the
balances:

```shell
pnpm hardhat --network localhost gv-topup --dryrun 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

To specify minimum balance for `gv-topup` use `--min`, remove `--dryrun` to
submit the transactions. For example, to top up the accounts so that each
account will have 10 tokens, run:

```shell
pnpm hardhat --network localhost gv-topup 0x5FbDB2315678afecb367f032d93F642f64180aa3 --min 10000000000
```

### Adding Signer Accounts

To add more signer accounts:

```shell
pnpm hardhat --network localhost gv-newkp 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Access Control Lists (ACL)

Use `--acl` deployment parameter to define the ACL contract policy to use. Supported
values:

- `AllowAllACLv1`: anyone can create a new poll, anyone can close any poll,
  anyone can vote on any poll
- `AllowVoterACLv1`: anyone can create a new poll, only contract authors can
  close the poll, anyone can vote
- `WhitelistVotersACLv1`: anyone can create a new poll, only contract authors
  can close the poll, only whitelisted accounts can vote

```shell
npx hardhat --network localhost deploy --acl AllowVoterACLv1
```

#### Whitelisting the Voters (WhitelistVotersACLv1 only)

To whitelist voters for a specific ballot, gather the following information:

- DAO contract address (reported `VITE_DAO_V1_ADDR`)
- poll ID (you can copy it from the URL when clicking on a poll)
- hex-encoded private key of the poll manager (the one that created a poll)
  stored as `PRIVATE_KEY` environment variable: `export PRIVATE_KEY=0x...`

Then, prepare a file containing whitelisted voters addresses, one per line. This
list will overwrite any existing whitelisted users. For example:

``` voters.txt
0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199
0xDce075E1C39b1ae0b75D554558b6451A226ffe00
```

Then, execute the following hardhat task:

```shell
npx hardhat --network localhost whitelist-voters 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 e386cceaa6ceea2f935d89951e522ac6d7ac777503b234d61b193439de571cfc voters.txt
```

### Deploying to Sapphire Localnet, Testnet and Mainnet

Prepare your hex-encoded private key and store it as an environment variable:

```shell
export PRIVATE_KEY=0x...
```

To deploy the contracts to the [Sapphire Localnet], Testnet or Mainnet, use the
following commands respectively:

```shell
npx hardhat deploy --network sapphire-localnet
npx hardhat deploy --network sapphire-testnet
npx hardhat deploy --network sapphire
```

[Sapphire Localnet]: https://github.com/oasisprotocol/oasis-web3-gateway/pkgs/container/sapphire-dev

## Frontend

After compiling the backend, updating `.env.development` with the corresponding
DAO address and chain ID, move to the `frontend` folder to compile and
Hot-Reload frontend for Development:

```sh
pnpm dev
```

This will start the React app, using the contracts deployed to Sapphire Localnet.

Or, you can do:

```sh
pnpm dev-staging
```

This will also start the React app, but it will use the contracts deployed to Sapphire teestnet.

Whichever backend you want to you, after starting the React app,
navigate to http://localhost:5173, and you should be able to create a new poll.


If running against localnet, 
you can use one of the deployed test accounts and associated private key with
MetaMask. If you use the same MetaMask accounts on fresh local networks, don't
forget to *clear your account's activity* each time or manually specify the
correct account nonce.

### Frontend Deployment

You can build assets for deployment by running:

```sh
pnpm build
```

`dist` folder will contain the generated HTML artifacts.

#### Different Website Base

If you are running dApp on a non-root base dir, add

```
BASE_DIR=/my/public/path
```

to `.env.production` and bundle the app with

```
pnpm build-only --base=/my/public/path/
```

Then copy the `dist` folder to a place of your `/my/public/path` location.

## Disclaimer

This is a demonstration project focused on the confidentiality features of the
Oasis network. The smart contract, backend and frontend code is not audited
neither can authors of this project, Oasis Foundation or Oasis Labs Inc. be held
responsible for any security vulnerabilities, financial and/or data loss or
theft.
