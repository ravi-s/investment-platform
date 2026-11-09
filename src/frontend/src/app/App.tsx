import { Link, Route, Routes } from 'react-router'

import LoginPage from '../features/authentication/LoginPage'
import PortfoliosPage from '../features/portfolios/PortfoliosPage'

function App() {
  return (
    <div>
      <nav>
        <Link to="/login">Login</Link>
        {' | '}
        <Link to="/portfolios">My Portfolios</Link>
      </nav>

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/portfolios" element={<PortfoliosPage />} />
      </Routes>
    </div>
  )
}

export default App