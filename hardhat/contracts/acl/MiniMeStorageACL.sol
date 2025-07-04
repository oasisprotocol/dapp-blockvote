// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { IPollACL } from "../../interfaces/IPollACL.sol";
import { MiniMeStorageOracle } from "../xchain/MiniMeStorageOracle.sol";

/**
 * @title MiniMe Token Storage Proof ACL
 * @notice Enables cross-chain voting for MiniMe token holders using storage proofs
 * @dev Uses MiniMeStorageOracle for proper checkpoint verification
 */
contract MiniMeStorageACL is IPollACL {
    struct PollConfig {
        bytes32 blockHash;          // Block hash for snapshot
        address tokenAddress;       // MiniMe token contract address
        uint256 balanceSlot;        // Storage slot for balances mapping
        bool initialized;
    }

    struct PollCreationOptions {
        PollConfig config;
        bytes headerRlpBytes;       // RLP encoded block header (optional)
        bytes rlpAccountProof;      // RLP encoded account proof (optional)
    }

    mapping(bytes32 => PollConfig) private s_polls;
    MiniMeStorageOracle public immutable storageOracle;

    event PollConfigured(bytes32 indexed proposalId, address tokenAddress, bytes32 blockHash);

    constructor(MiniMeStorageOracle _storageOracle) {
        storageOracle = _storageOracle;
    }

    function internal_id(address dao, bytes32 proposalId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(dao, proposalId));
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IPollACL).interfaceId;
    }

    function onPollCreated(bytes32 proposalId, address, bytes calldata data) external {
        bytes32 id = internal_id(msg.sender, proposalId);
        
        require(s_polls[id].blockHash == 0, "MiniMeACL: Poll already configured");

        PollCreationOptions memory options = abi.decode(data, (PollCreationOptions));
        s_polls[id] = options.config;
        s_polls[id].initialized = true;

        // Cache block header and account proof if provided
        if (options.headerRlpBytes.length > 0 || options.rlpAccountProof.length > 0) {
            _cacheProofData(options);
        }

        emit PollConfigured(proposalId, options.config.tokenAddress, options.config.blockHash);
    }

    function onPollClosed(bytes32 proposalId) external {
        delete s_polls[internal_id(msg.sender, proposalId)];
    }

    function onPollDestroyed(bytes32 proposalId) external {
        delete s_polls[internal_id(msg.sender, proposalId)];
    }

    function canVoteOnPoll(
        address dao,
        bytes32 proposalId,
        address user,
        bytes calldata proofData
    ) external view returns (uint256) {
        bytes32 id = internal_id(dao, proposalId);
        PollConfig memory config = s_polls[id];
        
        require(config.initialized, "MiniMeACL: Poll not configured");
        
        if (proofData.length == 0) {
            return 0;
        }

        // Use the storage oracle to get the balance
        try storageOracle.getBalance(
            config.blockHash,
            config.tokenAddress,
            user,
            config.balanceSlot,
            proofData
        ) returns (uint256 balance) {
            return balance;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Cache block header and account proof data
     */
    function _cacheProofData(PollCreationOptions memory options) internal {
        if (options.headerRlpBytes.length > 0) {
            // Cache block header if not already cached
            if (!storageOracle.headerCache().exists(options.config.blockHash)) {
                storageOracle.headerCache().add(options.headerRlpBytes);
            }
        } else {
            // Block header must exist
            require(
                storageOracle.headerCache().exists(options.config.blockHash),
                "MiniMeACL: Block header not cached"
            );
        }

        if (options.rlpAccountProof.length > 0) {
            // Cache account proof if not already cached
            if (!storageOracle.accountCache().exists(options.config.blockHash, options.config.tokenAddress)) {
                storageOracle.accountCache().add(
                    options.config.blockHash,
                    options.config.tokenAddress,
                    options.rlpAccountProof
                );
            }
        } else {
            // Account must be proven to exist
            require(
                storageOracle.accountCache().exists(options.config.blockHash, options.config.tokenAddress),
                "MiniMeACL: Account not proven"
            );
        }
    }
}