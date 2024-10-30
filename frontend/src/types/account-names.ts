export type AccountMetadata = {
  address: string
  name?: string
  description?: string
}

export type AccountMap = Map<string, AccountMetadata>

export type ChainAccountsMetaData = {
  map: AccountMap
  list: AccountMetadata[]
}
