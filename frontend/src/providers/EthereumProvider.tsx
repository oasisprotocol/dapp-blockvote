import detectEthereumProvider from '@metamask/detect-provider'
import { chain_info } from '@oasisprotocol/blockvote-contracts'
import { EthereumContext, EthereumState } from './EthereumContext'
import { FC, PropsWithChildren, useEffect, useState } from 'react'
import { BrowserProvider, JsonRpcApiProvider, JsonRpcProvider, JsonRpcSigner, ZeroAddress } from 'ethers'
import {
  wrapEthersProvider,
  NETWORKS as SAPPHIRE_NETWORKS,
  wrapEthersSigner,
} from '@oasisprotocol/sapphire-ethers-v6'
import {
  ConfiguredNetwork,
  ConnectionStatus,
  getAddEthereumChainParameterFromDefinition,
  getChainIdAsNumber,
} from '../utils/crypto.demo'
import { EIP1193Provider } from '../utils/eip1193'
import { VITE_WEB3_GATEWAY } from '../constants/config'

const ethereumInitialState: EthereumState = {
  signer: undefined,
  provider: wrapEthersProvider(new JsonRpcProvider(VITE_WEB3_GATEWAY, 'any')),
  chainId: ConfiguredNetwork,
  address: undefined,
  status: ConnectionStatus.Unknown,
}

export const EthereumContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const [ethProvider, setEthProvider] = useState<EIP1193Provider | null>(null)
  const [userAddress, setUserAddress] = useState<string>(ZeroAddress)

  const [state, setState] = useState<EthereumState>({
    ...ethereumInitialState,
  })

  const _changeAccounts = async (accounts: string[]) => {
    if (accounts.length) {
      setState({
        ...state,
        status: ConnectionStatus.Connected,
      })
    } else {
      setState({
        ...state,
        status: ConnectionStatus.Disconnected,
        signer: undefined,
        chainId: 0,
        address: undefined,
      })
    }
  }

  useEffect(() => {
    detectEthereumProvider<EIP1193Provider>({
      mustBeMetaMask: false,
    }).then(provider => setEthProvider(provider))
  }, [])

  useEffect(() => {
    if (!ethProvider) {
      // console.log('No EIP-1193 provider discovered using detectEthereumProvider');
      return
    }

    // console.log("Reacting to new ethProvider")

    ethProvider.on('accountsChanged', async accounts => {
      console.log('Accounts changed!', accounts)
      await _changeAccounts(accounts)
      // console.log("Getting signer, so that we can have username")
      await getSigner(false, false, undefined, accounts)
    })

    ethProvider.on('chainChanged', async () => {
      // console.log('Chain Changed!', chainId);
      await getSigner()
      // console.log('chainChanged', chainId);
    })

    ethProvider.on('connect', info => {
      setState({
        ...state,
        chainId: getChainIdAsNumber(info.chainId),
        status: ConnectionStatus.Connected,
      })

      console.log('connect')
      // TODO: request accounts?
    })
    ethProvider.on('disconnect', () => {
      console.log('disconnect')
      void _changeAccounts([])
    })

    void getSigner(false, false)

    ethProvider.request({ method: 'eth_accounts' }).then(data => {
      // console.log("Selecting account from", data)
      void _changeAccounts(data)
    })
  }, [ethProvider])

  async function getSigner(
    in_doConnect?: boolean,
    in_doSwitch?: boolean,
    in_account?: string,
    forAccounts?: string[],
  ) {
    let l_signer: JsonRpcSigner | undefined
    let l_provider: JsonRpcApiProvider | undefined
    if (!state.signer || (in_account && (await state.signer.getAddress()) != in_account)) {
      if (!ethProvider) {
        console.log('getSigner, detectEthereumProvider empty!!')
        return undefined
      }
      l_provider = new BrowserProvider(ethProvider)
    } else {
      l_signer = state.signer
      if (l_signer) {
        l_provider = state.signer.provider
      }
    }

    // With no provider, do nothing
    if (!l_provider) {
      console.log('getSigner, no provider!')
      return
    }

    let l_accounts = forAccounts ?? (await l_provider.send('eth_accounts', []))

    // Check if we are already connecting before requesting accounts again
    if (in_doConnect) {
      if (!l_accounts.length) {
        l_accounts = await l_provider.send('eth_requestAccounts', [])
        await _changeAccounts(l_accounts)
      }
    }

    if (l_accounts.length) {
      l_signer = await l_provider.getSigner(in_account)
    }

    // Check if we're requested to switch networks
    let l_network = getChainIdAsNumber(await l_provider.send('eth_chainId', []))
    if (in_doSwitch && (l_network != state.chainId || l_network != ConfiguredNetwork)) {
      try {
        await l_provider.send('wallet_switchEthereumChain', [
          { chainId: `0x${ConfiguredNetwork.toString(16)}` },
        ])
        l_network = ConfiguredNetwork
      } catch (e: any) {
        if ((e as any).error?.code === 4902) {
          await addNetwork(ConfiguredNetwork)
        } else {
          throw e
        }
      }
    }

    // Sapphire signers are always wrapped
    const l_isSapphire = l_network in SAPPHIRE_NETWORKS
    if (l_isSapphire && l_signer) {
      l_signer = wrapEthersSigner(l_signer)
    }

    const hasAccount = l_accounts.length

    setState({
      ...state,
      signer: l_signer,
      chainId: l_network,
      address: hasAccount ? l_accounts[0] : state.address,
      status: hasAccount ? ConnectionStatus.Connected : state.status,
    })

    return l_signer
  }

  useEffect(() => {
    if (state.signer) {
      state.signer.getAddress().then(setUserAddress)
    } else {
      setUserAddress(ZeroAddress)
    }
  }, [state.signer])

  async function addNetwork(network: number = ConfiguredNetwork) {
    if (!ethProvider) {
      throw new Error('addNetwork detectEthereumProvider = null')
    }

    const chain = chain_info[network]
    if (!chain) {
      throw new Error(`Unknown network ${network}`)
    }

    const params = getAddEthereumChainParameterFromDefinition(chain)
    await ethProvider.request({
      method: 'wallet_addEthereumChain',
      params: [params],
    })
  }

  // Request that window.ethereum be connected to an account
  // Only sets `signer` value upon successful connection
  async function connect() {
    await getSigner(true, true)
  }

  async function switchNetwork(network: number = ConfiguredNetwork) {
    console.log(`Switching network: ${network}`)
    await getSigner(true, true)
  }

  const isHomeChain = state.chainId === ConfiguredNetwork

  const explorerBaseUrl = (chain_info[state.chainId]?.explorers || [])[0]?.url ?? null

  const providerState: EthereumContext = {
    state: {
      ...state,
    },
    userAddress,
    isProviderAvailable: !!ethProvider,
    isConnected: state.status === ConnectionStatus.Connected,
    isHomeChain,
    explorerBaseUrl,
    connectWallet: connect,
    addNetwork,
    switchNetwork,
  }

  return <EthereumContext.Provider value={providerState}>{children}</EthereumContext.Provider>
}
