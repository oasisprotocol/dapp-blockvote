// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { MerklePatriciaProofVerifier } from "./lib/MerklePatriciaProofVerifier.sol";
import { RLPReader } from "./lib/RLPReader.sol";
import { HeaderCache } from "./HeaderCache.sol";
import { AccountCache } from "./AccountCache.sol";

/**
 * @title MiniMeStorageOracle
 * @notice Storage oracle specifically designed for MiniMe token checkpoint verification
 * @dev Verifies storage proofs for MiniMe token balances without the double-hashing issue
 */
contract MiniMeStorageOracle {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;

    HeaderCache public immutable headerCache;
    AccountCache public immutable accountCache;

    struct StorageProof {
        bytes accountProof;
        bytes[] storageProofs;
    }

    constructor(HeaderCache _headerCache, AccountCache _accountCache) {
        headerCache = _headerCache;
        accountCache = _accountCache;
    }

    /**
     * @notice Get the balance of a MiniMe token holder at a specific block
     * @param blockHash The block hash to query
     * @param token The MiniMe token address
     * @param holder The token holder address
     * @param balanceSlot The storage slot for the balances mapping
     * @param proofRlpBytes RLP encoded storage proofs
     * @return balance The token balance at the specified block
     */
    function getBalance(
        bytes32 blockHash,
        address token,
        address holder,
        uint256 balanceSlot,
        bytes memory proofRlpBytes
    ) external view returns (uint256 balance) {
        // Decode the proof data
        bytes[] memory proofs = abi.decode(proofRlpBytes, (bytes[]));
        
        // Get the account data from cache
        AccountCache.Account memory account = accountCache.get(blockHash, token);
        
        // Calculate the base slot for holder's checkpoints array
        bytes32 baseSlot = keccak256(abi.encode(holder, balanceSlot));
        
        // Get the length of checkpoints array
        uint256 checkpointsLength = uint256(_verifyStorageValue(
            account.storageRoot,
            baseSlot,
            proofs[0]
        ));
        
        if (checkpointsLength == 0) {
            return 0;
        }
        
        // Calculate slot for the last checkpoint
        bytes32 arraySlot = keccak256(abi.encode(baseSlot));
        bytes32 lastCheckpointSlot = bytes32(uint256(arraySlot) + checkpointsLength - 1);
        
        // Get the last checkpoint value
        bytes32 checkpointValue = _verifyStorageValue(
            account.storageRoot,
            lastCheckpointSlot,
            proofs[1]
        );
        
        // Extract balance from checkpoint (upper 128 bits)
        // MiniMe checkpoint format: [balance (128 bits) | fromBlock (128 bits)]
        balance = uint256(checkpointValue) >> 128;
    }

    /**
     * @notice Verify a storage value at a specific slot
     * @param storageRoot The storage root of the account
     * @param slot The storage slot to verify
     * @param rlpProof RLP encoded storage proof
     * @return value The storage value at the slot
     */
    function _verifyStorageValue(
        bytes32 storageRoot,
        bytes32 slot,
        bytes memory rlpProof
    ) internal pure returns (bytes32 value) {
        // Hash the storage slot to get the key in the storage trie
        bytes32 hashedSlot = keccak256(abi.encode(slot));
        
        // Decode the RLP proof
        RLPReader.RLPItem[] memory proof = rlpProof.toRlpItem().toList();
        
        // Extract the value from the proof
        bytes memory valueBytes = MerklePatriciaProofVerifier.extractProofValue(
            storageRoot,
            abi.encodePacked(hashedSlot),
            proof
        );
        
        if (valueBytes.length == 0) {
            return bytes32(0);
        }
        
        // Convert RLP encoded value to bytes32
        value = valueBytes.toRlpItem().toBytes32();
    }

    /**
     * @notice Get checkpoint data for a MiniMe token holder
     * @param blockHash The block hash to query
     * @param token The MiniMe token address
     * @param holder The token holder address
     * @param balanceSlot The storage slot for the balances mapping
     * @param checkpointIndex The checkpoint index to retrieve
     * @param rlpProof RLP encoded storage proof for the checkpoint
     * @return fromBlock The block number when the checkpoint was created
     * @return value The balance value at the checkpoint
     */
    function getCheckpoint(
        bytes32 blockHash,
        address token,
        address holder,
        uint256 balanceSlot,
        uint256 checkpointIndex,
        bytes memory rlpProof
    ) external view returns (uint128 fromBlock, uint128 value) {
        // Get the account data from cache
        AccountCache.Account memory account = accountCache.get(blockHash, token);
        
        // Calculate the storage slot for the specific checkpoint
        bytes32 baseSlot = keccak256(abi.encode(holder, balanceSlot));
        bytes32 arraySlot = keccak256(abi.encode(baseSlot));
        bytes32 checkpointSlot = bytes32(uint256(arraySlot) + checkpointIndex);
        
        // Get the checkpoint value
        bytes32 checkpointData = _verifyStorageValue(
            account.storageRoot,
            checkpointSlot,
            rlpProof
        );
        
        // Extract values from checkpoint
        uint256 data = uint256(checkpointData);
        value = uint128(data >> 128);      // Upper 128 bits
        fromBlock = uint128(data);         // Lower 128 bits
    }

    /**
     * @notice Get the number of checkpoints for a token holder
     * @param blockHash The block hash to query
     * @param token The MiniMe token address
     * @param holder The token holder address
     * @param balanceSlot The storage slot for the balances mapping
     * @param rlpProof RLP encoded storage proof for the array length
     * @return length The number of checkpoints
     */
    function getCheckpointLength(
        bytes32 blockHash,
        address token,
        address holder,
        uint256 balanceSlot,
        bytes memory rlpProof
    ) external view returns (uint256 length) {
        // Get the account data from cache
        AccountCache.Account memory account = accountCache.get(blockHash, token);
        
        // Calculate the base slot for holder's checkpoints array
        bytes32 baseSlot = keccak256(abi.encode(holder, balanceSlot));
        
        // Get the length of checkpoints array
        length = uint256(_verifyStorageValue(
            account.storageRoot,
            baseSlot,
            rlpProof
        ));
    }
}