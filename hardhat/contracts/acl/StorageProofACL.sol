// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { IPollACL } from "../../interfaces/IPollACL.sol";
import { IPollManagerACL } from "../../interfaces/IPollManagerACL.sol";
import { StorageProof } from "../xchain/StorageProof.sol";
import { AccountCache } from "../xchain/AccountCache.sol";
import { HeaderCache } from "../xchain/HeaderCache.sol";

// Restrict access to a poll using a storage proof for vote weight
contract StorageProofACL is IPollACL
{
    struct PollSettings {
        bytes32 block_hash;
        address account_address;
        uint256 slot;
    }

    struct PollCreationOptions {
        PollSettings settings;
        bytes headerRlpBytes;
        bytes rlpAccountProof;
    }

    mapping(bytes32 => PollSettings) private s_polls;

    StorageProof private immutable storageProof;

    function internal_id(address in_dao, bytes32 in_proposalId)
        internal pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(in_dao, in_proposalId));
    }

    constructor( StorageProof in_storageProof )
    {
        storageProof = in_storageProof;
    }

    function supportsInterface(bytes4 interfaceId)
        public pure
        returns(bool)
    {
        return interfaceId == type(IPollACL).interfaceId;
    }

    function onPollCreated(bytes32 in_proposalId, address, bytes calldata in_data)
        external
    {
        bytes32 id = internal_id(msg.sender, in_proposalId);

        require( s_polls[id].block_hash == 0, "xchain.onPollCreated.block_hash" );

        PollCreationOptions memory options = abi.decode(in_data, (PollCreationOptions));

        s_polls[id] = options.settings;

        AccountCache accountCache = storageProof.accountCache();

        HeaderCache headerCache = accountCache.headerCache();

        // Prime the header cache
        if( options.headerRlpBytes.length > 0 ) {
            if( ! headerCache.exists(options.settings.block_hash) ) {
                headerCache.add(options.headerRlpBytes);
            }
        }
        else {
            // Either way, the block header must exist, if it's not provided that's an error!
            require( headerCache.exists(options.settings.block_hash), "xchain.onPollCreated.header!" );
        }

        // Prime the account cache
        if( options.rlpAccountProof.length > 0 ) {
            if( ! accountCache.exists(options.settings.block_hash, options.settings.account_address) ) {
                accountCache.add(options.settings.block_hash, options.settings.account_address, options.rlpAccountProof);
            }
        }
        else {
            // The account must have been proven to exist within the block, otherwise that's an error!
            require( accountCache.exists(options.settings.block_hash, options.settings.account_address), "xchain.onPollCreated.account!" );
        }
    }

    function onPollClosed(bytes32 in_proposalId)
        external
    {
        delete s_polls[internal_id(msg.sender, in_proposalId)];
    }

    function onPollDestroyed(bytes32 in_proposalId) external {
        // Do nothing
    }

    function canVoteOnPoll(
        address in_dao,
        bytes32 in_proposalId,
        address in_user,
        bytes calldata in_rlpStorageProof
    )
        external view
        returns(uint out_weight)
    {
        bytes32 id = internal_id(in_dao, in_proposalId);

        require( s_polls[id].block_hash != 0, "xchain.canVoteOnPoll.emptyBlockhash" );

        PollSettings memory settings = s_polls[id];

        // No input, cannot vote
        if( in_rlpStorageProof.length == 0 ) {
            return 0;
        }

        out_weight = uint256(storageProof.verifyStorage(
            settings.block_hash,
            settings.account_address,
            settings.slot,
            in_user,
            in_rlpStorageProof
        ));
    }
}
