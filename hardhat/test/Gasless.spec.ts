import { expect } from 'chai';
import { ethers } from 'hardhat';
import { signVotingRequest, RequestType } from '@oasisprotocol/blockvote-contracts';
import { addProposal, deployContract } from './common';
import { AllowAllACL, GaslessVoting, PollManager } from '../src/contracts';
import { formatEther, parseEther, Transaction } from 'ethers';

describe('Gasless voting', () => {
  let pm: PollManager;
  let gv: GaslessVoting;
  let acl_allowall: AllowAllACL;

  before(async () => {
    acl_allowall = await deployContract('AllowAllACL');
    const acl_allowall_addr = await acl_allowall.getAddress();

    const cde = await deployContract('CalldataEncryption');

    gv = await (await ethers.getContractFactory('GaslessVoting', {
      libraries: {
        CalldataEncryption: await cde.getAddress()
      }
    })).deploy();
    await gv.waitForDeployment();
    console.log('  -', 'GaslessVoting', await gv.getAddress());

    pm = await deployContract('PollManager', acl_allowall_addr, await gv.getAddress());
  });

  it('Test Gasless Voting', async function () {
    // This test requires RNG and runs on the Sapphire network only.
    // You can set up sapphire-dev image and run the test like this:
    // docker run -it -p8545:8545 -p8546:8546 ghcr.io/oasisprotocol/sapphire-dev -to 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    // npx hardhat test --grep proxy --network sapphire-localnet
    if ((await ethers.provider.getNetwork()).chainId == 1337n) {
      this.skip();
    }
    const signer = await ethers.provider.getSigner(0);

    const proposalId = await addProposal(
      pm,
      {
        flags: 0,
        metadata: new Uint8Array(),
        numChoices: 3n,
        closeTimestamp: 0n,
        acl: await acl_allowall.getAddress(),
      },
      new Uint8Array([]),
      parseEther('1'),
    );

    // Add some additional keypairs
    const addKeypairTx = await gv.addKeypair(await pm.getAddress(), proposalId, {
      value: parseEther('1'),
    });
    await addKeypairTx.wait();

    const gvAddresses = await gv.listAddresses(await pm.getAddress(), proposalId);
    expect(gvAddresses.out_addrs.length).gt(0);
    expect(gvAddresses.out_balances.length).eq(gvAddresses.out_addrs.length);
    expect(gvAddresses.out_balances[0]).eq(parseEther('1'));

    console.log('      - Submitting votes');

    // Make some votes on each of the keypairs
    for (const gvAddr of gvAddresses.out_addrs) {
      // Submit several gasless transactions to ensure nonce handling works
      for (let i = 0; i < 2; i++) {
        // Get details of the account used for gasless voting for this poll
        const gvNonce = await ethers.provider.getTransactionCount(gvAddr);
        const feeData = await ethers.provider.getFeeData();

        // Sign the voting request
        const request = {
          dao: await pm.getAddress(),
          voter: await signer.getAddress(),
          proposalId: proposalId,
          choiceId: 1,
        } as RequestType;
        const rsv = await signVotingRequest(
          await gv.getAddress(),
          ethers.provider,
          signer,
          request,
        );

        // Then submit the pre-signed voting transaction, and check success
        const gvTx = await gv.makeVoteTransaction(
          gvAddr,
          gvNonce,
          feeData.gasPrice!,
          request,
          new Uint8Array([]),
          rsv,
        );

        const gvResponse = await ethers.provider.broadcastTransaction(gvTx);
        const gvReceipt = await gvResponse.wait();
        expect(gvReceipt?.status).eq(1);

        console.log('        -',
          gvAddr,
          `balance:${formatEther(await ethers.provider.getBalance(gvAddr))}`,
          `tx.gas:${gvReceipt!.cumulativeGasUsed}`,
          `tx.cost:${formatEther(gvReceipt!.gasPrice * gvReceipt!.cumulativeGasUsed)}`
        );
      }
    }

    // Close the poll, which will emit the withdraw transactions
    const closeTx = await pm.close(proposalId);
    const closeReceipt = await closeTx.wait();
    let withdrawTransactions: {addr:string;tx:string}[] = [];
    for (const log of closeReceipt!.logs) {
      const addr = await gv.getAddress();
      if (log.address != addr) {
        continue;
      }
      const ld = gv.interface.parseLog({ data: log.data, topics: log.topics as string[] })!;
      if (ld.name == 'GasWithdrawTransaction') {
        const tx = ld.args[0];
        withdrawTransactions.push({addr, tx});
      }
    }

    // Then submit the withdrawal transactions
    console.log('      - Withdraw unused balance');
    for (const {addr,tx} of withdrawTransactions) {
      const wdResponse = await ethers.provider.broadcastTransaction(tx);
      const wdReceipt = await wdResponse.wait();
      expect(wdReceipt?.status).eq(1);
    }

    // There will be a small amount of dust in the account
    // 100gwei gas price, 22140 gas tx, dust will be 0.0000082 ROSE
    for (const gva of gvAddresses.out_addrs) {
      const balance = await ethers.provider.getBalance(gva);
      expect(balance <= 10000000000000n).eq(true);
      console.log('        -', gva, `balance:${formatEther(balance)}`);
    }

    const destroyTx = await pm.destroy(proposalId);
    const destroyReceipt = await destroyTx.wait();
    expect(destroyReceipt?.status).eq(1);
  });
});
