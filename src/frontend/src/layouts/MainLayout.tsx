import { Link, Outlet } from 'react-router'

function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-xl font-semibold">
            Investment Platform
          </h1>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-6 px-6 py-3">
          <Link to="/login">Login</Link>
          <Link to="/portfolios">My Portfolios</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout