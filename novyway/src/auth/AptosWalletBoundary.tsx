import type { ReactNode } from 'react'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'

export function AptosWalletBoundary({ children }: { children: ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      disableTelemetry
      dappConfig={{ network: Network.TESTNET }}
      onError={(error) => console.warn('Aptos wallet:', error)}
    >
      {children}
    </AptosWalletAdapterProvider>
  )
}
