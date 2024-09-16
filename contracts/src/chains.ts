
type IconT = string | { url: string; width: number; height: number; format: 'png'|'svg' };

export interface ChainDefinition {
    name: string;
    chain: string;
    icon?: IconT;
    nativeCurrency: {name:string; symbol:string; decimals:number;};
    infoURL: string;
    shortName: string;
    chainId: number;
    networkId: number;
    slip44?: number;  // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
    rpcUrls: string[];
    features?: {name:string}[];
    hardfork: string;
    explorers?: {name:string;url:string;standard:string;icon?:IconT;}[];
    faucets?: string[];
    ens?: {registry:string};
    customEIPs?: number[];
    parent?: {type:string; chain:string; bridges:{url:string}[];};
    isTestnet?:boolean;
    cannotMakeStorageProofs?:boolean;
}

const INFURA_API_KEY = 'e9b08cc1b55b430494f6cf5259b2a560';
const THIRDWEB_CLIENT_ID = '6699629aefc73887e7f962c5438dddd1';
const THIRDWEB_API_KEY = THIRDWEB_CLIENT_ID;
const THIRDWEB_CLIENT_SECRET = 'cq3cmTMjm5P7C0KwvH5E97MpMwbJajb5v9mkFgI175qh-Pzy--KLQ4rksftvTxsE-my-k07FO69mSBexa9n4ow';
const ALCHEMY_API_KEY = 'LTUd8wMSlbXxWBHpYyFE-WyOh2wud4Hb';

// NOTE: many chains are defined in https://github.com/thirdweb-dev/js/tree/main/legacy_packages/chains/chains

export const chain_info: Record<number,ChainDefinition> = {
    1: {
        "name": "Ethereum Mainnet",
        "chain": "ETH",
        "icon": "ethereum",
        "rpcUrls": [
            //`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
            //`https://1.rpc.thirdweb.com/${THIRDWEB_API_KEY}`,
            `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
        ],
        "features": [{ "name": "EIP155" }, { "name": "EIP1559" }],
        "hardfork": "cancun",
        "nativeCurrency": {
            "name": "Ether",
            "symbol": "ETH",
            "decimals": 18
        },
        "infoURL": "https://ethereum.org",
        "shortName": "eth",
        "chainId": 1,
        "networkId": 1,
        "slip44": 60,
        "ens": {
            "registry": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
        },
        "explorers": [
        {
            "name": "etherscan",
            "url": "https://etherscan.io",
            "standard": "EIP3091"
        },
        {
            "name": "blockscout",
            "url": "https://eth.blockscout.com",
            "icon": "blockscout",
            "standard": "EIP3091"
        },
        {
            "name": "dexguru",
            "url": "https://ethereum.dex.guru",
            "icon": "dexguru",
            "standard": "EIP3091"
        }
        ]
    },

    // Alchemy BNB Smart Chain requires upgraded plan
    /*
    56: {
        "name": "BNB Smart Chain Mainnet",
        "chain": "BSC",
        "hardfork": "shanghai",
        // Same as cancun, but without 4788
        "customEIPs": [1153, 4844, 5656, 6780, 7516],
        "rpcUrls": [
        "https://bsc-dataseed1.bnbchain.org",
        "https://bsc-dataseed2.bnbchain.org",
        "https://bsc-dataseed3.bnbchain.org",
        "https://bsc-dataseed4.bnbchain.org",
        "https://bsc-dataseed1.defibit.io",
        "https://bsc-dataseed2.defibit.io",
        "https://bsc-dataseed3.defibit.io",
        "https://bsc-dataseed4.defibit.io",
        "https://bsc-dataseed1.ninicoin.io",
        "https://bsc-dataseed2.ninicoin.io",
        "https://bsc-dataseed3.ninicoin.io",
        "https://bsc-dataseed4.ninicoin.io",
        "https://bsc.publicnode.com",
        //"wss://bsc.publicnode.com",
        //"wss://bsc-ws-node.nariox.org"
        ],
        "nativeCurrency": {
        "name": "BNB Chain Native Token",
        "symbol": "BNB",
        "decimals": 18
        },
        "infoURL": "https://www.bnbchain.org/en",
        "shortName": "bnb",
        "chainId": 56,
        "networkId": 56,
        "slip44": 714,
        "explorers": [
        {
            "name": "bscscan",
            "url": "https://bscscan.com",
            "standard": "EIP3091"
        },
        {
            "name": "dexguru",
            "url": "https://bnb.dex.guru",
            "icon": "dexguru",
            "standard": "EIP3091"
        }
        ]
    },
    */

    42161: {
        "name": "Arbitrum One",
        "chainId": 42161,
        "hardfork": "london",
        "shortName": "arb1",
        "chain": "ETH",
        "networkId": 42161,
        "slip44": 9001,
        "nativeCurrency": {
            "name": "Ether",
            "symbol": "ETH",
            "decimals": 18
        },
        "rpcUrls": [
            //`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            //`https://42161.rpc.thirdweb.com/${THIRDWEB_API_KEY}`
            `https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}`
        ],
        "explorers": [
            {
                "name": "Arbiscan",
                "url": "https://arbiscan.io",
                "standard": "EIP3091"
            },
            {
                "name": "Arbitrum Explorer",
                "url": "https://explorer.arbitrum.io",
                "standard": "EIP3091"
            },
            {
                "name": "dexguru",
                "url": "https://arbitrum.dex.guru",
                "icon": "dexguru",
                "standard": "EIP3091"
            }
        ],
        "infoURL": "https://arbitrum.io",
        "parent": {
            "type": "L2",
            "chain": "eip155-1",
            "bridges": [{ "url": "https://bridge.arbitrum.io" }]
        }
    },

    10: {
        "name": "Optimism Mainnet",
        "hardfork": "cancun",
        "chain": "ETH",
        "rpcUrls": [
            //`https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            //`https://10.rpc.thirdweb.com/${THIRDWEB_API_KEY}`,
            `https://optimism-mainnet.infura.io/v3/${INFURA_API_KEY}`
        ],
        "nativeCurrency": {
            "name": "Ether",
            "symbol": "ETH",
            "decimals": 18
        },
        "infoURL": "https://optimism.io",
        "shortName": "oeth",
        "chainId": 10,
        "networkId": 10,
        "slip44": 614,
        "explorers": [
            {
                "name": "etherscan",
                "url": "https://optimistic.etherscan.io",
                "standard": "EIP3091",
                "icon": "etherscan"
            },
            {
                "name": "blockscout",
                "url": "https://optimism.blockscout.com",
                "icon": "blockscout",
                "standard": "EIP3091"
            },
            {
                "name": "dexguru",
                "url": "https://optimism.dex.guru",
                "icon": "dexguru",
                "standard": "EIP3091"
            }
        ]
    },

    137: {
        "name": "Polygon Mainnet",
        "hardfork": "london",
        "chain": "Polygon",
        "icon": "polygon",
        "rpcUrls": [
            //`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            //`https://137.rpc.thirdweb.com/${THIRDWEB_API_KEY}`,
            `https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`
        ],
        "nativeCurrency": {
            "name": "POL",
            "symbol": "POL",
            "decimals": 18
        },
        "infoURL": "https://polygon.technology/",
        "shortName": "matic",
        "chainId": 137,
        "networkId": 137,
        "slip44": 966,
        "explorers": [
            {
                "name": "polygonscan",
                "url": "https://polygonscan.com",
                "standard": "EIP3091"
            },
            {
                "name": "dexguru",
                "url": "https://polygon.dex.guru",
                "icon": "dexguru",
                "standard": "EIP3091"
            }
        ]
    },

    80002: {
        "name": "Polygon Testnet (Amoy)",
        "hardfork": "london",
        "chain": "polygon-testnet",
        "icon": "polygon-testnet-amoy",
        "rpcUrls": [
            //`https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
            //`https://80002.rpc.thirdweb.com/${THIRDWEB_API_KEY}`
            `https://polygon-amoy.infura.io/v3/${INFURA_API_KEY}`
        ],
        "nativeCurrency": {
            "name": "testPOL",
            "symbol": "testPOL",
            "decimals": 18
        },
        "infoURL": "https://polygon.technology/blog/introducing-the-amoy-testnet-for-polygon-pos",
        "shortName": "polygon-amoy",
        "chainId": 80002,
        "networkId": 80002,
        "explorers": [
            {
            name: "polygonscan-amoy",
            url: "https://amoy.polygonscan.com/",
            standard: "EIP3091"
            }
        ],
        isTestnet: true,
    },

    // XXX: Base not supported by infura
    /*
    8453: {
        "hardfork": "cancun",
        "chain": "ETH",
        "chainId": 8453,
        "explorers": [
          {
            "name": "basescan",
            "url": "https://basescan.org",
            "standard": "none"
          },
          {
            "name": "basescout",
            "url": "https://base.blockscout.com",
            "standard": "EIP3091",
            "icon": {
              "url": "ipfs://QmYtUimyqHkkFxYdbXXRbUqNg2VLPUg6Uu2C2nmFWowiZM",
              "width": 551,
              "height": 540,
              "format": "png"
            }
          },
          {
            "name": "dexguru",
            "url": "https://base.dex.guru",
            "standard": "EIP3091",
            "icon": {
              "url": "ipfs://QmRaASKRSjQ5btoUQ2rNTJNxKtx2a2RoewgA7DMQkLVEne",
              "width": 83,
              "height": 82,
              "format": "svg"
            }
          }
        ],
        "faucets": [],
        "features": [],
        "icon": {
          "url": "ipfs://QmW5Vn15HeRkScMfPcW12ZdZcC2yUASpu6eCsECRdEmjjj/base-512.png",
          "width": 512,
          "height": 512,
          "format": "png"
        },
        "infoURL": "https://base.org",
        "name": "Base",
        "nativeCurrency": {
          "name": "Ether",
          "symbol": "ETH",
          "decimals": 18
        },
        "networkId": 8453,
        //"redFlags": [],
        "rpcUrls": [
            `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        ],
        "shortName": "base",
        //"slug": "base",
        //"status": "active",
        //"testnet": false
    },

    84532: {
        "hardfork": "cancun",
        "chain": "ETH",
        "chainId": 84532,
        "explorers": [
          {
            "name": "basescout",
            "url": "https://base-sepolia.blockscout.com",
            "standard": "EIP3091",
            "icon": {
              "url": "ipfs://QmYtUimyqHkkFxYdbXXRbUqNg2VLPUg6Uu2C2nmFWowiZM",
              "width": 551,
              "height": 540,
              "format": "png"
            }
          }
        ],
        "faucets": [],
        "icon": {
          "url": "ipfs://QmaxRoHpxZd8PqccAynherrMznMufG6sdmHZLihkECXmZv",
          "width": 1200,
          "height": 1200,
          "format": "png"
        },
        "infoURL": "https://base.org",
        "name": "Base Sepolia Testnet",
        "nativeCurrency": {
          "name": "Sepolia Ether",
          "symbol": "ETH",
          "decimals": 18
        },
        "networkId": 84532,
        "rpcUrls": [
            `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        ],
        "shortName": "basesep",
        "slip44": 1,
        //"slug": "base-sepolia-testnet",
        isTestnet: true
    },
    */

    23294: {
        chainId: 0x5afe,
        networkId: 0x5afe,
        hardfork: 'london',
        name: 'Oasis Sapphire',
        chain: 'oasis',
        shortName: 'sapphire',
        cannotMakeStorageProofs: true,
        infoURL: 'https://oasisprotocol.org/sapphire',
        icon: 'https://votee.oasis.io/rose.png',
        nativeCurrency: {
            name: 'ROSE',
            symbol: 'ROSE',
            decimals: 18,
        },
        rpcUrls: [
            'https://sapphire.oasis.io/',
            //'wss://sapphire.oasis.io/ws'
        ],
        explorers: [
            {
            name: 'Oasis Sapphire Mainnet Explorer',
            url: 'https://explorer.oasis.io/mainnet/sapphire',
            standard: 'EIP3091'
            }
        ],
    },
    23295: {
        chainId: 0x5aff,
        networkId: 0x5aff,
        hardfork: 'london',
        name: 'Oasis Sapphire Testnet',
        chain: 'oasis-testnet',
        shortName: 'sapphire-testnet',
        cannotMakeStorageProofs: true,
        infoURL: 'https://docs.oasis.io/node/testnet/',
        icon: 'https://votee.oasis.io/rose.png',
        nativeCurrency: { name: 'TEST', symbol: 'TEST', decimals: 18 },
        rpcUrls: [
            'https://testnet.sapphire.oasis.dev/',
            //'wss://testnet.sapphire.oasis.dev/ws'
        ],
        explorers: [
            {
            url: 'https://explorer.oasis.io/testnet/sapphire',
            name: 'Oasis Sapphire Testnet Explorer',
            standard: 'EIP3091'
            }
        ],
    },
    23293: {
        chainId: 0x5afd,
        networkId: 0x5afd,
        hardfork: 'london',
        chain: 'oasis-localnet',
        infoURL: 'https://github.com/oasisprotocol/oasis-web3-gateway/pkgs/container/sapphire-localnet',
        name: 'Sapphire Localnet',
        shortName: 'sapphire-localnet',
        cannotMakeStorageProofs: true,
        icon: 'https://votee.oasis.io/rose.png',
        nativeCurrency: {
            name: 'ROSE',
            symbol: 'ROSE',
            decimals: 18,
        },
        rpcUrls: [
            'http://localhost:8545/',
            //'ws://localhost:8546'
        ],
    },
} as const;
