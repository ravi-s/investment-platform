import { NavLink } from "react-router";

function AppNavigation() {
  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-slate-100 text-slate-900'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-2 px-4 py-3 sm:px-6">
        <NavLink to="/login" end className={linkClasses}>
          Login
        </NavLink>

        <NavLink to="/portfolios" className={linkClasses}>
          My Portfolios
        </NavLink>
      </div>
    </nav>
  )
}

export default AppNavigation;
