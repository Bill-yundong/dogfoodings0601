import { Router, Route } from '@solidjs/router'
import { onMount } from 'solid-js'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import Analysis from '@/pages/Analysis'
import Timeline from '@/pages/Timeline'
import Control from '@/pages/Control'
import DataManage from '@/pages/DataManage'
import { initDB } from '@/db'
import { initDevices } from '@/stores/realtimeStore'

function App() {
  onMount(async () => {
    try {
      await initDB()
      initDevices()
    } catch (err) {
      console.error('Failed to initialize database:', err)
    }
  })

  return (
    <Router root={Layout}>
      <Route path="/" component={Dashboard} />
      <Route path="/analysis" component={Analysis} />
      <Route path="/timeline" component={Timeline} />
      <Route path="/control" component={Control} />
      <Route path="/data" component={DataManage} />
    </Router>
  )
}

export default App
