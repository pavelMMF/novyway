import { aptosView } from './aptosReadGateway'

export type GovernanceAdminState = {
  address: string
  creator: string
  isCreator: boolean
  isAdmin: boolean
  administrators: string[]
  threshold: number
  versions: [string, string, string]
  counters: [string, string, string, string, string, string, string, string]
}

export async function readGovernanceAdminState(address: string): Promise<GovernanceAdminState> {
  const [creatorResult, isAdminResult, adminsResult, thresholdResult, versionsResult, countersResult] = await Promise.all([
    aptosView('weighted_voting', 'creator'),
    aptosView('weighted_voting', 'is_admin', [address]),
    aptosView('weighted_voting', 'admins'),
    aptosView('weighted_voting', 'admin_threshold'),
    aptosView('weighted_voting', 'versions'),
    aptosView('weighted_voting', 'counters'),
  ])
  const administrators = Array.isArray(adminsResult[0]) ? adminsResult[0].filter((value): value is string => typeof value === 'string') : []
  if (typeof creatorResult[0] !== 'string' || typeof isAdminResult[0] !== 'boolean' || typeof thresholdResult[0] !== 'string' || versionsResult.length !== 3 || countersResult.length !== 8) {
    throw new Error('Aptos returned invalid administrator state')
  }
  return {
    address,
    creator: creatorResult[0],
    isCreator: creatorResult[0].toLowerCase() === address.toLowerCase(),
    isAdmin: isAdminResult[0],
    administrators,
    threshold: Number(thresholdResult[0]),
    versions: versionsResult as [string, string, string],
    counters: countersResult as GovernanceAdminState['counters'],
  }
}
