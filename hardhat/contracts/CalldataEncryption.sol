// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import { Sapphire } from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";

error CBOR_Error_BytesTooLong();

error CBOR_Error_UintTooLong();

function CBOR_encodeUint(uint256 value) pure returns (bytes memory) {
    if (value < 24) {
        return abi.encodePacked(uint8(value));
    } else if (value <= type(uint8).max) {
        return abi.encodePacked(uint8(24), uint8(value));
    } else if (value <= type(uint16).max) {
        return abi.encodePacked(uint8(25), uint16(value));
    } else if (value <= type(uint32).max) {
        return abi.encodePacked(uint8(26), uint32(value));
    } else if (value <= type(uint64).max) {
        return abi.encodePacked(uint8(27), uint64(value));
    }
    // XXX: encoding beyond 64bit uints isn't 100% supported
    revert CBOR_Error_UintTooLong();
}

function CBOR_encodeBytes(bytes memory in_bytes)
    pure
    returns (bytes memory out_cbor)
{
    /*
    0x40..0x57 	byte string (0x00..0x17 bytes follow)
    0x58 	byte string (one-byte uint8_t for n, and then n bytes follow)
    0x59 	byte string (two-byte uint16_t for n, and then n bytes follow)
    0x5a 	byte string (four-byte uint32_t for n, and then n bytes follow)
    0x5b 	byte string (eight-byte uint64_t for n, and then n bytes follow)
    */
    if (in_bytes.length <= 0x17) {
        return abi.encodePacked(uint8(0x40 + in_bytes.length), in_bytes);
    }
    if (in_bytes.length <= 0xFF) {
        return abi.encodePacked(uint8(0x58), uint8(in_bytes.length), in_bytes);
    }
    if (in_bytes.length <= 0xFFFF) {
        return abi.encodePacked(uint8(0x59), uint16(in_bytes.length), in_bytes);
    }
    // We assume Solidity won't be encoding anything larger than 64kb
    revert CBOR_Error_BytesTooLong();
}

// Address of the SUBCALL precompile
address constant SUBCALL = 0x0100000000000000000000000000000000000103;

/// Raised if the underlying subcall precompile does not succeed
error SubcallError();

function subcall_static(string memory method, bytes memory body)
    view
    returns (uint64 status, bytes memory data)
{
    (bool success, bytes memory tmp) = SUBCALL.staticcall(
        abi.encode(method, body)
    );

    if (!success) {
        revert SubcallError();
    }

    (status, data) = abi.decode(tmp, (uint64, bytes));
}

/// While parsing CBOR map, unexpected key
error CBOR_Error_InvalidKey();

function CBOR_parseKey(bytes memory result, uint256 offset)
    pure
    returns (uint256 newOffset, bytes32 keyDigest)
{
    if (result[offset] & 0x60 != 0x60) revert CBOR_Error_InvalidKey();

    uint8 len = uint8(result[offset++]) ^ 0x60;

    assembly {
        keyDigest := keccak256(add(add(0x20, result), offset), len)
    }

    newOffset = offset + len;
}

/// While parsing CBOR map, length is invalid, or other parse error
error CBOR_Error_InvalidMap();

function CBOR_parseMapStart(bytes memory in_data, uint256 in_offset)
    pure
    returns (uint256 n_entries, uint256 out_offset)
{
    uint256 b = uint256(uint8(in_data[in_offset]));
    if (b < 0xa0 || b > 0xb7) {
        revert CBOR_Error_InvalidMap();
    }

    n_entries = b - 0xa0;
    out_offset = in_offset + 1;
}

/// Unsigned integer of unknown size
error CBOR_Error_InvalidUintSize(uint8);

/// Value cannot be parsed as a uint
error CBOR_Error_InvalidUintPrefix(uint8);

/// While parsing CBOR structure, data length was unexpected
error CBOR_Error_InvalidLength(uint256);

function CBOR_parseUint(bytes memory result, uint256 offset)
    pure
    returns (uint256 newOffset, uint256 value)
{
    uint8 prefix = uint8(result[offset]);
    uint256 len;

    if (prefix <= 0x17) {
        return (offset + 1, prefix);
    }
    // Byte array(uint256), parsed as a big-endian integer.
    else if (prefix == 0x58) {
        len = uint8(result[++offset]);
        offset++;
    }
    // Byte array, parsed as a big-endian integer.
    else if (prefix & 0x40 == 0x40) {
        len = uint8(result[offset++]) ^ 0x40;
    }
    // Unsigned integer, CBOR encoded.
    else if (prefix & 0x10 == 0x10) {
        if (prefix == 0x18) {
            len = 1;
        } else if (prefix == 0x19) {
            len = 2;
        } else if (prefix == 0x1a) {
            len = 4;
        } else if (prefix == 0x1b) {
            len = 8;
        } else {
            revert CBOR_Error_InvalidUintSize(prefix);
        }
        offset += 1;
    }
    // Unknown...
    else {
        revert CBOR_Error_InvalidUintPrefix(prefix);
    }

    if (len > 0x20) revert CBOR_Error_InvalidLength(len);

    assembly {
        value := mload(add(add(0x20, result), offset))
    }

    value = value >> (256 - (len * 8));

    newOffset = offset + len;
}

function _parseCBORPublicKeyInner(bytes memory in_data, uint256 in_offset)
    pure
    returns (uint256 offset, CallDataPublicKey memory public_key)
{
    uint256 mapLen;

    (mapLen, offset) = CBOR_parseMapStart(in_data, in_offset);

    while (mapLen > 0) {
        mapLen -= 1;

        bytes32 keyDigest;

        (offset, keyDigest) = CBOR_parseKey(in_data, offset);

        if (keyDigest == keccak256("key")) {
            uint256 tmp;
            (offset, tmp) = CBOR_parseUint(in_data, offset);
            public_key.key = bytes32(tmp);
        } else if (keyDigest == keccak256("checksum")) {
            uint256 tmp;
            (offset, tmp) = CBOR_parseUint(in_data, offset);
            public_key.checksum = bytes32(tmp);
        } else if (keyDigest == keccak256("expiration")) {
            (offset, public_key.expiration) = CBOR_parseUint(
                in_data,
                offset
            );
        } else if (keyDigest == keccak256("signature")) {
            if (in_data[offset++] != 0x58) {
                revert CBOR_Error_InvalidUintPrefix(
                    uint8(in_data[offset - 1])
                );
            }
            if (in_data[offset++] != 0x40) {
                revert CBOR_Error_InvalidUintSize(
                    uint8(in_data[offset - 1])
                );
            }
            uint256 tmp;
            assembly {
                tmp := mload(add(in_data, add(offset, 0x20)))
            }
            public_key.signature[0] = bytes32(tmp);
            assembly {
                tmp := mload(add(in_data, add(offset, 0x40)))
            }
            public_key.signature[1] = bytes32(tmp);

            offset += 0x40;
        } else {
            revert CBOR_Error_InvalidKey();
        }
    }
}

function _parseCBORCallDataPublicKey(bytes memory in_data)
    pure
    returns (uint256 epoch, CallDataPublicKey memory public_key)
{
    (uint256 outerMapLen, uint256 offset) = CBOR_parseMapStart(in_data, 0);

    while (outerMapLen > 0) {
        bytes32 keyDigest;

        outerMapLen -= 1;

        (offset, keyDigest) = CBOR_parseKey(in_data, offset);

        if (keyDigest == keccak256("epoch")) {
            (offset, epoch) = CBOR_parseUint(in_data, offset);
        } else if (keyDigest == keccak256("public_key")) {
            (offset, public_key) = _parseCBORPublicKeyInner(
                in_data,
                offset
            );
        } else {
            revert CBOR_Error_InvalidKey();
        }
    }
}

/// Error while trying to retrieve the calldata public key
error CoreCallDataPublicKeyError(uint64);

struct CallDataPublicKey {
    bytes32 key;
    bytes32 checksum;
    bytes32[2] signature;
    uint256 expiration;
}

// core.CallDataPublicKey
function coreCallDataPublicKey()
    view
    returns (uint256 epoch, CallDataPublicKey memory public_key)
{
    (uint64 status, bytes memory data) = subcall_static(
        "core.CallDataPublicKey",
        hex"f6" // null
    );

    if (status != 0) {
        revert CoreCallDataPublicKeyError(status);
    }

    return _parseCBORCallDataPublicKey(data);
}

library CalldataEncryption {
    function _deriveKey(
        bytes32 in_peerPublicKey,
        Sapphire.Curve25519SecretKey in_x25519_secret
    ) internal view returns (bytes32) {
        return
            Sapphire.deriveSymmetricKey(
                Sapphire.Curve25519PublicKey.wrap(in_peerPublicKey),
                in_x25519_secret
            );
    }

    function _encryptInner(
        bytes memory in_data,
        Sapphire.Curve25519SecretKey in_x25519_secret,
        bytes15 nonce,
        bytes32 peerPublicKey
    ) internal view returns (bytes memory out_encrypted) {
        bytes memory plaintextEnvelope = abi.encodePacked(
            hex"a1", // map(1)
            hex"64", //     text(4) "body"
            "body",
            CBOR_encodeBytes(in_data)
        );

        out_encrypted = Sapphire.encrypt(
            _deriveKey(peerPublicKey, in_x25519_secret),
            nonce,
            plaintextEnvelope,
            ""
        );
    }

    function encryptCallData(bytes memory in_data)
        public
        view
        returns (bytes memory out_encrypted)
    {
        if (in_data.length == 0) {
            return "";
        }

        Sapphire.Curve25519PublicKey myPublic;
        Sapphire.Curve25519SecretKey mySecret;

        (myPublic, mySecret) = Sapphire.generateCurve25519KeyPair("");

        bytes15 nonce = bytes15(Sapphire.randomBytes(15, ""));

        CallDataPublicKey memory cdpk;
        uint256 epoch;

        (epoch, cdpk) = coreCallDataPublicKey();

        return
            encryptCallData(
                in_data,
                myPublic,
                mySecret,
                nonce,
                epoch,
                cdpk.key
            );
    }

    function encryptCallData(
        bytes memory in_data,
        Sapphire.Curve25519PublicKey myPublic,
        Sapphire.Curve25519SecretKey mySecret,
        bytes15 nonce,
        uint256 epoch,
        bytes32 peerPublicKey
    ) public view returns (bytes memory out_encrypted) {
        if (in_data.length == 0) {
            return "";
        }

        bytes memory inner = _encryptInner(
            in_data,
            mySecret,
            nonce,
            peerPublicKey
        );

        return
            abi.encodePacked(
                hex"a2", //  map(2)
                hex"64", //      text(4) "body"
                "body",
                hex"a4", //          map(4)
                hex"62", //              text(2) "pk"
                "pk",
                hex"5820", //                 bytes(32)
                myPublic,
                hex"64", //              text(4) "data"
                "data",
                CBOR_encodeBytes(inner), //     bytes(n) inner
                hex"65", //              text(5) "epoch"
                "epoch",
                CBOR_encodeUint(epoch), //      unsigned(epoch)
                hex"65", //              text(5) "nonce"
                "nonce",
                hex"4f", //                  bytes(15) nonce
                nonce,
                hex"66", //      text(6) "format"
                "format",
                hex"01" //      unsigned(1)
            );
    }
}
