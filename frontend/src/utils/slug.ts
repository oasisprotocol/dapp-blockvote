import { BytesLike, getBytes, hexlify } from "ethers";

// https://en.wikipedia.org/wiki/Base32#z-base-32
const BASE32_ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';

function base32Decode (src: string) {
    const srcSize = src.length;
    let srcPtr = 0;

    const dst = new Uint8Array(srcSize * 5 / 8);
    let dstPtr = 0;

    let value = 0;
    for (let i = 0; i < srcSize; i++) {
      value = (value << 5) | BASE32_ALPHABET.indexOf(src[i]);
      srcPtr += 5;

      if (srcPtr >= 8) {
        dst[dstPtr++] = (value >>> (srcPtr - 8)) & 0xFF;
        srcPtr -= 8;
      }
    }

    return dst;
};

function base32Encode (src: Uint8Array) {
    const srcSize = src.byteLength;
    let srcPtr = 0;

    let dst = '';

    let value = 0;
    for (let i = 0; i < srcSize; i++) {
      value = (value << 8) | src[i];
      srcPtr += 8;
      while (srcPtr >= 5) {
        dst += BASE32_ALPHABET[(value >>> (srcPtr - 5)) & 31];
        srcPtr -= 5;
      }
    }

    if (srcPtr > 0)
      dst += BASE32_ALPHABET[(value << (5 - srcPtr)) & 31];

    return dst;
};

// ----------------------------------------------------------------------------

const SLUG_BYTES = 8;

function ensureMinLength(array: Uint8Array, minLength: number): Uint8Array {
    if (array.length >= minLength) {
      return array;
    }
    const paddedArray = new Uint8Array(minLength);
    paddedArray.set(array, 0);
    return paddedArray;
}

function removeTrailingZeros (arr: Uint8Array): Uint8Array {
    let lastNonZeroIndex = arr.length - 1;
    while (lastNonZeroIndex >= 0 && arr[lastNonZeroIndex] === 0) {
      lastNonZeroIndex--;
    }
    return arr.slice(0, lastNonZeroIndex + 1);
}

export function proposalIdToSlug(proposalId:BytesLike) {
    const bytes = removeTrailingZeros(getBytes(proposalId));
    return base32Encode(ensureMinLength(bytes, SLUG_BYTES));
}

export function slugToProposalId(slug:string) {
    // Special case for demo poll
    if( slug === 'demo' ) {
      return slug;
    }
    return hexlify(base32Decode(slug.toLowerCase())).substring(2).padEnd(64, '0');
}
