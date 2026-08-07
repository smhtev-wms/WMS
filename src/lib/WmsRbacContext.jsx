import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { loadWmsPermissionMatrix, canWmsRead, canWmsWrite } from './wmsRbacLib'

const WmsRbacContext = createContext({
  ready: false,
  canRead: () => false,
  canWrite: () => false,
  reload: () => {},
})

export function WmsRbacProvider({ children }) {
  const { session } = useAuth()
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    if (!session) {
      setReady(true)
      return
    }
    try {
      await loadWmsPermissionMatrix(true)
    } catch (e) {
      console.warn('WMS permissions load failed:', e.message)
    } finally {
      setReady(true)
    }
  }, [session])

  useEffect(() => {
    setReady(false)
    reload()
  }, [reload])

  const value = {
    ready,
    reload,
    canRead: (role, module) => canWmsRead(role, module),
    canWrite: (role, module) => canWmsWrite(role, module),
  }

  return <WmsRbacContext.Provider value={value}>{children}</WmsRbacContext.Provider>
}

export function useWmsRbac() {
  return useContext(WmsRbacContext)
}
