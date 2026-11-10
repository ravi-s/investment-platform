import { Outlet } from 'react-router'
import AppHeader from '../components/AppHeader'
import AppNavigation from '../components/AppNavigation'

function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader />

      <AppNavigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout