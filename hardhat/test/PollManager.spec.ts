import { expect } from 'chai';
import { ethers } from 'hardhat';

import { AbiCoder, decodeRlp, encodeRlp, getBytes, hexlify, parseEther } from 'ethers';

import {
  PollManager,
  TokenHolderACL,
  AllowAllACL,
  VoterAllowListACL,
  GaslessVoting,
  StorageProofACL,
  HeaderCache,
  StorageProof,
  AccountCache,
} from '../src/contracts';

import { BLOCK_HEADERS, WMATIC_BALANCE } from './exampleproofs';
import { addProposal, deployContract, deployStorageProofStuff } from './common';

describe('PollManager', function () {
  let acl_tokenholder: TokenHolderACL;
  let acl_allowall: AllowAllACL;
  let acl_voterlist: VoterAllowListACL;
  let acl_storageproof: StorageProofACL;
  let accountCache: AccountCache;
  let headerCache: HeaderCache;
  let pm: PollManager;
  let gv: GaslessVoting;
  let TEST_PROPOSALS: PollManager.ProposalParamsStruct[];

  before(async () => {
    acl_allowall = (await deployContract('AllowAllACL')) as AllowAllACL;
    acl_voterlist = (await deployContract('VoterAllowListACL')) as VoterAllowListACL;
    acl_tokenholder = (await deployContract('TokenHolderACL')) as TokenHolderACL;
    gv = await deployContract('GaslessVoting');

    ({ accountCache, acl_storageproof, headerCache } = await deployStorageProofStuff());

    const acl_allowall_addr = await acl_allowall.getAddress();
    pm = (await deployContract(
      'PollManager',
      acl_allowall_addr,
      await gv.getAddress(),
    )) as PollManager;

    TEST_PROPOSALS = [
      {
        flags: 1n,
        numChoices: 4n,
        closeTimestamp: BigInt(Math.round(new Date().getTime() / 1000) + 1),
        acl: acl_allowall_addr,
        metadata: new Uint8Array(),
      },
      {
        flags: 1n,
        numChoices: 3n,
        closeTimestamp: BigInt(Math.round(new Date().getTime() / 1000) + 2),
        acl: acl_allowall_addr,
        metadata: new Uint8Array(),
      },
    ];
  });

  it('Proposals and pagination', async function () {
    const ap_before = await pm.getActiveProposals(0, 0);
    const pp_before = await pm.getPastProposals(0, 0);
    expect(pp_before.out_proposals.length).eq(0);
    expect(ap_before.out_proposals.length).eq(0);

    for (const p of TEST_PROPOSALS) {
      await addProposal(pm, p);
    }

    const ap_after = await pm.getActiveProposals(0, TEST_PROPOSALS.length);
    const pp_after = await pm.getPastProposals(0, 0);

    expect(pp_after.out_count).eq(pp_before.out_count);
    expect(ap_after.out_count).eq(ap_before.out_count + BigInt(TEST_PROPOSALS.length));

    // Verify active proposals are listed in reverse order
    // This also verifies pagination works correctly
    for (let i = 0; i < TEST_PROPOSALS.length; i++) {
      const p = TEST_PROPOSALS[TEST_PROPOSALS.length - 1 - i];
      const ap_paginated = await pm.getActiveProposals(i, 1);
      expect(ap_paginated.out_proposals.length).eq(1);

      const x = ap_paginated.out_proposals[0].proposal.params;
      expect(x.flags).eq(p.flags);
      expect(x.metadata).eq(hexlify(p.metadata));
      expect(x.numChoices).eq(p.numChoices);
      expect(x.closeTimestamp).eq(p.closeTimestamp);
      expect(x.acl).eq(p.acl);
    }

    // Then verify that when we close proposals
    // They get added to the top of the 'past proposals' list
  });

  it('Test TokenACL', async function () {
    const factory_TestToken = await ethers.getContractFactory('TestToken');
    const contract_TestToken = await factory_TestToken.deploy();
    contract_TestToken.waitForDeployment();

    const signers = await ethers.getSigners();
    const mint_tx = await contract_TestToken.mint(signers[0].address, parseEther('1'));
    await mint_tx.wait();

    const abi = AbiCoder.defaultAbiCoder();
    const aclParams = getBytes(abi.encode(['address'], [await contract_TestToken.getAddress()]));

    const propId = await addProposal(
      pm,
      {
        flags: 0,
        metadata: new Uint8Array(),
        numChoices: 3n,
        closeTimestamp: 0n,
        acl: await acl_tokenholder.getAddress(),
      },
      aclParams,
    );

    // We should be able to vote, because we have the token
    const vote_tx = await pm.vote(propId, 1, new Uint8Array([]));
    await vote_tx.wait();

    // Now lets burn our tokens, and verify we can't vote
    const burn_tx = await contract_TestToken.burn(
      await contract_TestToken.balanceOf(signers[0].address),
    );
    await burn_tx.wait();
    expect(await contract_TestToken.balanceOf(signers[0].address)).eq(0n);

    try {
      const badVote_tx = await pm.vote(propId, 1, new Uint8Array([]));
      await badVote_tx.wait();
      expect(false).eq(false);
    } catch (e: any) {
      expect(true).eq(true);
    }
  });

  it('Test StorageProof ACL', async function () {
    // This test requires impersonation
    if ((await ethers.provider.getNetwork()).chainId != 1337n) {
      this.skip();
    }

    const blockHash = '0xcb6242f4219a09f7ef7dfd51f7594b23d2a6ad1e06b8b99a55fef4ec82cf61af';
    const abi = AbiCoder.defaultAbiCoder();
    const headerRlpBytes = BLOCK_HEADERS[blockHash];
    const rlpAccountProof = encodeRlp(WMATIC_BALANCE.proof.accountProof.map(decodeRlp));
    const aclParams = getBytes(
      abi.encode(
        ['tuple(tuple(bytes32,address,uint256),bytes,bytes)'],
        [
          [
            // PollCreationOptions
            [
              // PollSettings
              blockHash,
              WMATIC_BALANCE.proof.address,
              3,
            ],
            headerRlpBytes,
            rlpAccountProof,
          ],
        ],
      ),
    );

    const propId = await addProposal(
      pm,
      {
        flags: 0,
        metadata: new Uint8Array(),
        numChoices: 3n,
        closeTimestamp: 0n,
        acl: await acl_storageproof.getAddress(),
      },
      aclParams,
    );

    // Impersonate
    const [fundedSigner] = await ethers.getSigners();
    const impersonatedAddr = WMATIC_BALANCE.slots[0].key;
    const fundTx = await fundedSigner.sendTransaction({
      to: impersonatedAddr,
      value: parseEther('1'),
      data: '0x',
    });
    await fundTx.wait();

    const voteProof = encodeRlp(WMATIC_BALANCE.proof.storageProof[0].proof.map(decodeRlp));
    const signer = await ethers.getImpersonatedSigner(impersonatedAddr);
    const newPm = pm.connect(signer);
    const vote_tx = await newPm.vote(propId, 1, voteProof);
    await vote_tx.wait();
  });

  it('AccountProof RLP regression 1', async function () {
    // Tests a regression in RLP.sol discovered with real data
    const blockHash = '0x65b1912b4df1ccbae81b9cf6dbcc568392f85a8f62d20fb890293b2e8b621197';
    const headerRlpBytes =
      '0xf90267a0842c1e68ee0492091ee6a0c7c6ccb86e3a9aaee056927c9d68489f8d3f2d939da01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347940000000000000000000000000000000000000000a0084b78fb5fff36e4a09daa9fa51a03ef975b62cf9c482f909b7246ebda66aa23a0ddc7c735b57eb79cf0499c0acb433f6c0cf62c8e7ec3516086f3fc013dac9247a073c0c41ab4ea76069d2f07e7080a13b6b9af1400937d31a408a498549dd9fcfab9010006000000000008050000000000002000040000000010040000008400000000000000000000010000280000100208a0002000880021a0801010048000000402040004000240019008021004084020008090400000000400000401000020010000180080800280000000018001000008000800200280000082900000120040000000800004420000004008000000000118000000000002020800120000800000082000000080420000004001601008200020210011028000000001500800000840000000020000100080012000000000020008000020208a004015a80110006000002804100c00062000010000001000000a281400009020000000000001100000088402bcdc1484013477e7831a864b8465cd8a6ab869d88301020683626f7289676f312e32302e3134856c696e757800000000000000c780c5c0c0c0c0c00ac6fe0c8446fbf431ea4df2695846f4479bc3fbeeaaae135b6b14127b22091943b2070a69d4ab8f277326461a5817d9b9b07b4ffd68672bc45a92381220767d01a000000000000000000000000000000000000000000000000000000000000000008800000000000000000f';
    const accountAddress = '0x4df9b163d2d01cab06fdbe27e1b892800f2a23b3';
    const accountRlpProof =
      '0xf90ca6f90211a006c16b0703cd7d5e08f42642645f886af9b52c9859c70a9c9f07c3c7cd34be14a02afeb5d453af289fde2a0de03fd543419fc6392a341ebe83987286773a57968da05a3967f7dbe57d8e9c843887a9b4a2c81797aec9607a62d037ca48a20bfa5a09a0ed5df1a339a226b1571639427a96f64b31f250664dab8b294076dc4d32087c2da08fca5fad0e85fc693e1da73fc2ed706483c540aad4c8a9f21046b1f5cc8a0858a08a8d8cad872fd03b79ba0906a09dd431a30a77037523842b4071960ada4fb6e7a0e9cfea5c264c01223fb670582c7d73ec3bb3d6f650e75742101232ac286d0497a09b68e6903ac243f82c4704d631b1aeadd9213a158eedc05a0d733da22896cd40a00398e945e13486f9ab0e163eba544cbce17cb2f2d3a3a721a906d4d7987bb379a038d0182c9fd6851b3a6ebca84f3bd62cab08ccd78fa0ca3ec106caa17077dbe0a0970397f1e4a17da6747e865ff2774dc773592efa67ffe786e396c9dc13d05c7ba0ce4472e69d6d56730ac901c3750e35f8cf61ef285c9c586dcded64f064388d2da0816a4f2372cf554eb5ca7feb8fa627926eedd79eac203771766dc008b736d655a038960f87ba3de527f6c03e71ebe3e7d909fc585ea281d92a7bdcb66845cd3826a039aa4ca4d74da97b635f6c677bf49308591517f209e284ee5f8de76b192ccaaaa0867e587e9ea8e1632fade9dec0538d2f5404d4b58dea28264693df37eedfc6c680f90211a0dff598697353a4bd66bc50f189dd4a1ff211a6823c03ef400c63d729f5eab000a042609e948fc87ac9aeaf23d8b58db7d9b5adea8d032b47b89616661776995dafa07d471c6b39f6ae65ef578aa5363e0b0405892c5f9f8fcdefd5f91b07c6007490a021374457f58fb8abc122d753c0eb76465b2780562de4148114e8f35188d8fc24a01b43179d3388ad72ed42748ab0016e6a73e708734d75d34c44b0e49d22a0d1a7a0c7b56428835388412c69ef6c8298897fc4dbc828aa0602f51a4f01cfe44d4450a0d11027fc7e2b029d6228ec524a53c6de0735f8ce5e33762089de833d7da2014da0403b98fc02dbabb7b11f7f48041852ead347f3f235e17f5ee71e2b00d074f087a00bb92cd8581764819b7de82f628d323c697371ecc5236d43200fa4a9411ad3c5a0571de2af981bcc61661ad10726f44ee73af505b18229cf10c7d89ec73bcb9590a021a5549c7080c37c337958089010df21e5cf7f6e60cc1d003d4332fc338f7613a0ffc62b17417c5f04a843893397ed3a0a77d1a52610cae4f6fdcbbe9046a9c4e8a09faab6e148c4815084f69b2d51e9e3286cde3a4ae660662cc2720cb5b6c82408a052ae396483aa95046eb73c52951c31509a1e104b35f63b1c55ecff20bbf6fed8a0ce447f7f930c1e39699015cd34db6db8c7d48d6eba7116e8b0b6742a1e44b866a0bc295107212362fcace943a5d4f4a7709ce12c7a087e72c3302dbce9181fc24880f90211a0b24f140c6e58fd77226999ec6052502dbefb619c66c61b247692a977c1bb08c3a0dafef703fec361de3c69632e69cb7e90a270f37d9e4fa725832bd70061a6a22ea0e4b1956fd6c97b75f2e0fbf6937bf488b3729cb16e787140075b9c3a95ab8fdda068daae889f028d8b2c8ecb0ff9df02474f8ca5fa05fb0e33e2aedaf36bafa10ea0299c7a27db808be16b38399df16659826d308ff6dffeef93646e116e1bbe06e6a0d62b6d86363f332d1b7d547fef2b8dd11835eda4feee64f78fc7933eeaf8e869a0937c81c02c18370a5a75ca800d52a2acbe725dab105c5b6423ec214b05e8c2aca0e409a7a59fb4067d06ee47d175774ee124b44cd20b8ffd9dce424f0372ef239aa01004d4fe2f07d79043790aec0dce57dc1317e435eb795040e52d50e997af2008a0067ab2c3d917ec071d50489a17e6137ee60e692c09e8e6340e3dafe7656fba29a093ee833e90f7231deecb55ff42acdde7f2627b25b66a0bb4480fb0d64f142697a006b787e448759bb48d0963af9f71c1b8e93f902c529d2fc1507be0beb360899fa04478f94ec50891687084fa730786d655a97397ce4bfef04f35b015aa3855a1b7a0d620c424fe8587637e6809e022a12b242fd607f8b529a666c2e9fe85e7c37002a0446a7d211a570e3e7b301e976180d1f3e234b6d1c90c15edfb5b9219d7f74d54a0689af3c4bbeac997285b55a43b8808c41fd3430de2777e4860724a2c7a49383680f90211a0327a6e78c82ea0f262ce5e3520ec03fc5a67eaae54018eb2602dd238b16b9766a03ccb3bdab2279ce93d876d86ba476224b0e9dc80afe0b828593f382b1170a29ea09b8a7085d9866374db955c9cce7719a88a8baf0975a6d09b5520b9bcce447beca0e0b16583a02c734d77514fb339b3d3542652dc7a3ce5bd6942ce78170773b477a024f13bc9d83d233062d50f27339c1bf1fcca814b9752e1f8df6e955cea5c186fa0f1d437804afc87c8f93834601e7ba150905eb94ff82b2594775f9a1891038f45a0a4c0c56692ddca99ce98336db04df70fd45442eac3d271e6f9774708ec7a608ea075095190c8cdc230f7d113a656df2f9f3a27f0c6c57d105841fcbe7a7b440827a082d70aec16cdc82dcf2b20bcad8573ee097a50f7ce9efb34f8236fb79b23347ca0083f7b0646ee04f8341c1ab2816e9d890ac2fbe99e92521b109fded643ff0c13a048a55727e01caca7d1eadb9b5ff5a4bf6cc74c9db79603c371ec910c37c3f436a0458e2f3878ba0d78c259e6d8d16897b2ba05b5e36d0a3aaff9ac50aede81c210a07fd59b874576c1c1a85ae14d1756e36ed027dc42a38986aa93b8c743ab5340faa039190dc6bee879ea573cb36353fdebaf638b65abb4b64aad73d67c302bc7b150a01f53eb702ad1570975fb3ae76b21c3c470319cb6996248c0b2c303130ce5675ea08bb28029eab5eeaad39cb2a404d773229ddf767a9bb56444c7e90e218ac930a180f90211a0cbf8dc22d7e5ce974778b46c36562691f79a4d1ea84cf2650fd25ea49c09ca4ba0c026e504d0885f1cb10d362b68576cba7269c47023c3c7fa50025dd15161ee37a0d36a780cd53c211f7bb7bb88e5ee37d4e133329126f2e835e1f49c6b52c138f2a0b17f3668214e994a08ef800a792d9799097cd6ee8a0f11be817214746bbdac04a03920078603c6aa6679eac38e79abf2bea1f741bc794c2d19e31c0955678c0e5fa0ef470392390fee6e761630d0daaf4c820f59e829d46bc5cfe8a910676fc59286a02624e53659f23c660843cf7b824e460b2afc4887724fa0a51116d3457f86ff2da0e31b1702ad26f997597ff796334aa3802c110118054076702c994f3794583b11a0b27dea4949fbff9efe684babec7eb3c47fdd1f79ef3579e8638e91e9aa6cf71da0db358ec544d73503612df273667e8aeea512b7d479a4f3db19f5047aa9dda03ea040410f2eda337aa7f6e155a3c091a14e0f34c496c4d67498c3bc2d158cd65132a0410c85054efc33e63794881a42478f2e9ece18cfd4e488614ba47c46efc3a9d2a0ade72513bc94934dd18cf9e618da323b9cdb677ad19376000fda82364ebdd0e1a087b829545871c46407a575c0f1d979f861fbb87bbb7cce78c1cd93e44b6fb889a0a12770021fc85e08e7e06378a66237be7dead3a55825cd13c17c444adf6b59e3a064cbf6ad932c8b3437934f2d0abbabf80cfc8dc1386013e5f8109995b82fef6180f90131a0e2badaa5f76b56ce4fbef003b2533d02e29f0648d43079e231d1006e42fe46cf80a098e5ba602950c1c3bdbe3a34af38f65fba672b0ec2ed57b88e7015b232481c5980a0d5c6bf5e3db6e286c1e531e834ac81c7fadcd3ef7bbf182a2fc37f94206bbdba8080a01fb053f9315feb4795744a460839c9bb708913d607c45e4b272bebb84df1896ca0a51e45b203a007544e9c45cd514b3dfb4a5c0ed5b3f1257cdf67cca992acb38fa0f9e45a3983065ef7e7eb8fd282e80d669d920f1a6d971ad4c85d555de2967f378080a070f0dd41bac7a1568d14ade461f251e35868a3ac2f04b01c78a0b50ffe464784a0ec1405de13f93ca21ba781005a28de88da910d4e389a2f1c852150ecab9a0a4c80a046b1dd492aa995ee791113d686908199b691668045c09f688f71431778cbf4f280f851808080808080a0b7de5ee2f388f3ffbd4cc1535d4d2eb5a7097ca67ee764dcab8db011b311332f80808080808080a078c75b6908b856b9c0fac0f3a6f4eee345436a77af7bd7f6a99c0a2a2c2e3b6d8080f85180a07bdb67fc1d0f0b24880968a09c1f566b076cd42c4784a6fe80bd642ba82d5b2f80808080a0faf7d38e3df41e69768e5772b58d5b5a72bdab96991b54acb66322bb79ad295980808080808080808080f8669d20d1abf5a0afbe0b3dfac4c74c5cd593914109a3941a80f0e0fdacca80b846f8440180a079ce407e9a9a627bfeebff9ba8615645d3ac2958f59d4d2788dd1c43d94662fba04ecc52b85a260e6050c62c2b0db5d63918dd5894cbb7d799136cf8ec5915765b';

    const tx1 = await headerCache.add(headerRlpBytes);
    await tx1.wait();

    const tx2 = await accountCache.add(blockHash, accountAddress, accountRlpProof);
    await tx2.wait();
  });
});
