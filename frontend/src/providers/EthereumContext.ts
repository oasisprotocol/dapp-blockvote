import { JsonRpcProvider, JsonRpcSigner } from 'ethers'
import { createContext } from 'react'
import { ConnectionStatus } from '../utils/crypto.demo'

export interface EthereumState {
  signer: JsonRpcSigner | undefined
  provider: JsonRpcProvider
  chainId: number
  address: string | undefined
  status: ConnectionStatus
}

export interface EthereumContext {
  readonly state: EthereumState
  readonly isHomeChain: boolean
  readonly userAddress: string
  readonly isProviderAvailable: boolean
  readonly isConnected: boolean
  readonly explorerBaseUrl: string | undefined
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  addNetwork: (network: number | undefined) => Promise<void>
  switchNetwork: (network?: number | undefined) => Promise<void>
}

export const EthereumContext = createContext<EthereumContext>({} as EthereumContext)
