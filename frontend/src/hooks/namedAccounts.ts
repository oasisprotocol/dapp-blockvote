// import { hasTextMatch } from '../components/HighlightedText/text-matching'
import { ChainAccountsMetaData, AccountMap, AccountMetadata } from '../types/account-names'
import { StoredLRUCache } from '../utils/StoredLRUCache'
import { useEffect, useState } from 'react'

const PONTUSX_ACCOUNT_DATA_SOURCE_URL =
  'https://raw.githubusercontent.com/deltaDAO/mvg-portal/main/pontusxAddresses.json'

const noNamedAccounts: ChainAccountsMetaData = {
  list: [],
  map: new Map(),
}

const getPontusXAccountsMetadata = async (): Promise<ChainAccountsMetaData> => {
  const response = await fetch(PONTUSX_ACCOUNT_DATA_SOURCE_URL)
  if (response.status !== 200) throw new Error("Couldn't load names")
  const namedAccounts = await response.json()
  if (!namedAccounts) throw new Error("Couldn't load names")
  const map: AccountMap = new Map()
  const list: AccountMetadata[] = []
  Object.entries(namedAccounts).forEach(([evmAddress, name]) => {
    const account: AccountMetadata = {
      address: evmAddress, // getOasisAddress(evmAddress),
      name: name as string,
    }
    map.set(evmAddress, account)
    list.push(account)
  })
  return {
    map,
    list,
  }
}

abstract class NamedAccountsCache {
  static #cache = new StoredLRUCache<number, ChainAccountsMetaData, void>({
    max: 10,
    ttl: 1000 * 3600,
    name: 'account name cache',
    storageKey: 'blockvote-AccountNames',
    fetcher: async input => {
      switch (input) {
        case 32457: // Pontus-X
          return await getPontusXAccountsMetadata()
        default:
          return noNamedAccounts
      }
    },
    transformValues: {
      encode: data => JSON.stringify(data.list),
      decode: dataString => {
        const list: AccountMetadata[] = JSON.parse(dataString)
        const map: AccountMap = new Map()
        list.forEach(account => map.set(account.address, account))
        return {
          map,
          list,
        }
      },
    },
  })

  static fetch = (chainId: number) => this.#cache.fetch(chainId, {})
}

export const useAllAccountsMetadata = (chainId: number, really: boolean) => {
  const [isLoading, setIsLoading] = useState(false)
  const [allData, setAllData] = useState<ChainAccountsMetaData>()

  const getAccounts = async () => {
    setIsLoading(true)
    setAllData(await NamedAccountsCache.fetch(chainId))
    setIsLoading(false)
  }

  useEffect(() => {
    if (really && !isLoading && !allData) {
      void getAccounts()
    }
  }, [really, isLoading])

  return allData
}

export const useAccountMetadata = (
  chainId: number,
  address: string,
  really: boolean,
): AccountMetadata | undefined => useAllAccountsMetadata(chainId, really)?.map.get(address)
