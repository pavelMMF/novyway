import { useCallback, useEffect, useState } from 'react'
import { loadLiveAudit, loadLiveVotingState, type LiveAuditEvent, type LiveVotingState } from './liveVotingData'

interface LoadState<T> {
  data?: T
  loading: boolean
  error?: string
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Unknown Aptos error'
}

export function useLiveVoting() {
  const [state, setState] = useState<LoadState<LiveVotingState>>({ loading: true })
  const load = useCallback((refresh = false) => {
    setState((current) => ({ ...current, loading: true, error: undefined }))
    loadLiveVotingState(refresh)
      .then((data) => setState({ data, loading: false }))
      .catch((reason: unknown) => setState({ loading: false, error: message(reason) }))
  }, [])
  useEffect(() => { load() }, [load])
  return { ...state, refresh: () => load(true) }
}

export function useLiveAudit() {
  const [state, setState] = useState<LoadState<LiveAuditEvent[]>>({ loading: true })
  const load = useCallback((refresh = false) => {
    setState((current) => ({ ...current, loading: true, error: undefined }))
    loadLiveAudit(refresh)
      .then((data) => setState({ data, loading: false }))
      .catch((reason: unknown) => setState({ loading: false, error: message(reason) }))
  }, [])
  useEffect(() => { load() }, [load])
  return { ...state, refresh: () => load(true) }
}
