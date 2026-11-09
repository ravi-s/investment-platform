import { Link } from 'react-router'

function AppNavigation() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-3">
        <Link to="/login">Login</Link>
        <Link to="/portfolios">My Portfolios</Link>
      </div>
    </nav>
  )
}

export default AppNavigation