import type { AptosReadGateway, AptosVotingCounters } from '../types'

export const DEFAULT_TESTNET_MODULE = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
export const TESTNET_RPC = 'https://fullnode.testnet.aptoslabs.com/v1'

export function configuredVotingModule() {
  return (import.meta.env.VITE_APTOS_MODULE_ADDRESS as string | undefined) || DEFAULT_TESTNET_MODULE
}

export function configuredAptosRpc() {
  const network = import.meta.env.VITE_APTOS_NETWORK as string | undefined
  return !network || network === 'testnet' ? TESTNET_RPC : ''
}

export async function aptosView(moduleName: string, functionName: string, args: unknown[] = [], ledgerVersion?: string) {
  const moduleAddress = configuredVotingModule()
  const rpcUrl = configuredAptosRpc()
  if (!moduleAddress || !rpcUrl) throw new Error('Aptos network is not configured')
  const query = ledgerVersion ? `?ledger_version=${encodeURIComponent(ledgerVersion)}` : ''
  const response = await fetch(`${rpcUrl}/view${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      function: `${moduleAddress}::${moduleName}::${functionName}`,
      type_arguments: [],
      arguments: args,
    }),
  })
  if (!response.ok) throw new Error(`Aptos RPC ${response.status}`)
  const result: unknown = await response.json()
  if (!Array.isArray(result)) throw new Error('Aptos returned an invalid view response')
  return result
}

function scalar(result: unknown[], label: string) {
  if (typeof result[0] !== 'string') throw new Error(`Aptos returned an invalid ${label}`)
  return result[0]
}

export function createAptosReadGateway(ledgerVersion?: string): AptosReadGateway {
  const call = (name: string, args: unknown[] = []) => aptosView('weighted_voting', name, args, ledgerVersion)
  return {
    isConfigured: () => Boolean(configuredVotingModule() && configuredAptosRpc()),
    adminThreshold: async () => scalar(await call('admin_threshold'), 'admin threshold'),
    async versions() {
      const result = await call('versions')
      if (result.length !== 3 || result.some((value) => typeof value !== 'string')) throw new Error('Aptos returned invalid versions')
      return result as [string, string, string]
    },
    category: (id) => call('category', [id]),
    categoryPolicy: (id) => call('category_policy', [id]),
    qualification: (account, categoryId) => call('current_qualification', [account, categoryId]),
    election: (id) => call('election', [id]),
    electionSnapshot: (id) => call('election_snapshot', [id]),
    electionTallies: (id) => call('election_tallies', [id]),
    electionResult: (id) => call('election_result', [id]),
    voteOf: (id, account) => call('vote_of', [id, account]),
    async admins() {
      const result = await call('admins')
      if (!Array.isArray(result[0]) || result[0].some((value) => typeof value !== 'string')) throw new Error('Aptos returned invalid administrators')
      return result[0] as string[]
    },
    async counters() {
      const result = await call('counters')
      if (result.length !== 8 || result.some((value) => typeof value !== 'string')) throw new Error('Aptos returned invalid counters')
      const [categories, adminChanges, categoryChanges, policyProposals, policyChanges, qualificationProposals, qualificationChanges, elections] = result as string[]
      return { categories, adminChanges, categoryChanges, policyProposals, policyChanges, qualificationProposals, qualificationChanges, elections } satisfies AptosVotingCounters
    },
    voteRevision: (electionId, historyId) => call('vote_revision', [electionId, historyId]),
  }
}
