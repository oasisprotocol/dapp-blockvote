// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { IPollACL } from "../../interfaces/IPollACL.sol";
import { IPollManagerACL } from "../../interfaces/IPollManagerACL.sol";

// Restrict access to a poll with a password
contract PasswordACL is IPollACL
{
    mapping(bytes32 => bytes32) private s_passwords;

    function supportsInterface(bytes4 interfaceId)
        public pure
        returns(bool)
    {
        return interfaceId == type(IPollACL).interfaceId;
    }

    function internal_id(address in_dao, bytes32 in_proposalId)
        internal pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(in_dao, in_proposalId));
    }

    function onPollCreated(bytes32 in_proposalId, address, bytes calldata in_password)
        external
    {
        bytes32 id = internal_id(msg.sender, in_proposalId);

        require( s_passwords[id] == 0 );

        s_passwords[id] = keccak256(in_password);
    }

    function onPollClosed(bytes32 in_proposalId) external
    {
        // Do nothing
    }

    function onPollDestroyed(bytes32 in_proposalId) external
    {
        bytes32 id = internal_id(msg.sender, in_proposalId);

        s_passwords[id] = 0;
    }

    function canVoteOnPoll(address in_dao, bytes32 in_proposalId, address, bytes calldata in_password)
        external view
        returns(uint)
    {
        bytes32 id = internal_id(in_dao, in_proposalId);

        return keccak256(in_password) == s_passwords[id] ? 1 : 0;
    }
}
