// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { SignatureRSV } from '@oasisprotocol/sapphire-contracts/contracts/EthereumUtils.sol';

struct VotingRequest {
    address voter;
    address dao;
    bytes32 proposalId;
    uint8 choiceId;
}

interface IGaslessVoter {
    function onPollCreated(bytes32 proposalId, address creator) external payable;

    function onPollClosed(bytes32 proposalId) external;

    function onPollDestroyed(bytes32 proposalId) external;

    function makeVoteTransaction(
        address addr,
        uint64 nonce,
        uint256 gasPrice,
        VotingRequest calldata request,
        bytes calldata in_data,
        SignatureRSV calldata rsv
    ) external view returns (bytes memory output);
}
