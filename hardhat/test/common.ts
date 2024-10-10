import { expect } from 'chai';
import { ethers } from 'hardhat';

import { BaseContract, BytesLike, EventLog } from 'ethers';

import { AccountCache, HeaderCache, PollManager, StorageProof, StorageProofACL } from '../src/contracts';

export async function addProposal(
    dao: PollManager,
    proposal: PollManager.ProposalParamsStruct,
    aclData?: Uint8Array,
    value?: bigint,
  ) {
    if (!value) {
      value = 0n;
    }
    const tx = await dao.create(proposal, aclData ?? new Uint8Array([]), { value });
    const receipt = await tx.wait();
    expect(receipt!.logs).to.not.be.undefined;
    const createEvent = receipt!.logs.find(
      (event) => (event as EventLog).fragment.name === 'ProposalCreated',
    ) as EventLog;
    expect(createEvent).to.not.be.undefined;
    expect(createEvent!.args).to.not.be.undefined;
    return createEvent!.args![0] as BytesLike;
}

export async function closeProposal(dao: PollManager, proposalId: BytesLike) {
    const tx = await dao.close(proposalId);
    const receipt = await tx.wait();
    expect(receipt!.logs).to.not.be.undefined;
    const closeEvent = receipt!.logs.find(
      (event) => (event as EventLog).fragment.name === 'ProposalClosed',
    ) as EventLog | undefined;
    expect(closeEvent).to.not.be.undefined;
    expect(closeEvent!.args).to.not.be.undefined;
    const [_, topChoice] = closeEvent!.args;
    return topChoice as bigint;
  }

export async function deployContract<T extends BaseContract>(name: string, ...args: any[]) {
    const c = await (await ethers.getContractFactory(name)).deploy(...args);
    await c.waitForDeployment();
    console.log('  -', name, await c.getAddress());
    return c as T;
}

export async function deployStorageProofStuff() {
    const headerCache = (await deployContract('HeaderCache')) as HeaderCache;
    const accountCache = (await deployContract(
      'AccountCache',
      await headerCache.getAddress(),
    )) as AccountCache;
    const storageProof = (await deployContract(
      'StorageProof',
      await accountCache.getAddress(),
    )) as StorageProof;
    const acl_storageproof = (await deployContract(
      'StorageProofACL',
      await storageProof.getAddress(),
    )) as StorageProofACL;

    return {headerCache, accountCache, storageProof, acl_storageproof};
}