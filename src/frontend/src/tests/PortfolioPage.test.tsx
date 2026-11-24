
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PortfoliosPage from '../features/portfolios/PortfoliosPage'

import {
  getPortfolios,
  createPortfolio,
} from '../services/portfolio.service'

vi.mock('../services/portfolio.service', () => ({
  getPortfolios: vi.fn(),
  createPortfolio: vi.fn(),
}))

const mockPortfolios = [
  {
    id: 1,
    user_id: 1,
    name: 'Long Term Investments',
  },
  {
    id: 2,
    user_id: 1,
    name: 'Retirement Portfolio',
  },
]

describe('PortfoliosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays the loading state', () => {
    vi.mocked(getPortfolios).mockReturnValue(
      new Promise(() => {}),
    )

    render(<PortfoliosPage />)

    expect(
      screen.getByText('Loading portfolios...'),
    ).toBeInTheDocument()
  })

  it('displays portfolios after successful loading', async () => {
    vi.mocked(getPortfolios).mockResolvedValue(mockPortfolios)

    render(<PortfoliosPage />)

    expect(
      await screen.findByText('Long Term Investments'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Retirement Portfolio'),
    ).toBeInTheDocument()

    expect(screen.getByText('2 portfolios')).toBeInTheDocument()
  })

  it('displays an empty state when no portfolios exist', async () => {
    vi.mocked(getPortfolios).mockResolvedValue([])

    render(<PortfoliosPage />)

    expect(
      await screen.findByText('No portfolios yet'),
    ).toBeInTheDocument()
  })

  it('displays an error when portfolio loading fails', async () => {
    vi.mocked(getPortfolios).mockRejectedValue(
      new Error('Unable to retrieve portfolios'),
    )

    render(<PortfoliosPage />)

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Unable to retrieve portfolios')
  })

  it('creates and displays a new portfolio', async () => {
    const user = userEvent.setup()

    vi.mocked(getPortfolios).mockResolvedValue([])

    vi.mocked(createPortfolio).mockResolvedValue({
      id: 3,
      user_id: 1,
      name: 'Growth Portfolio',
    })

    render(<PortfoliosPage />)

    await screen.findByText('No portfolios yet')

    await user.type(
      screen.getByLabelText('Portfolio name'),
      'Growth Portfolio',
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Create Portfolio',
      }),
    )

    expect(createPortfolio).toHaveBeenCalledWith(
      'Growth Portfolio',
    )

    expect(
      await screen.findByText('Growth Portfolio'),
    ).toBeInTheDocument()
  })

  it('does not submit a whitespace-only portfolio name', async () => {
    const user = userEvent.setup()

    vi.mocked(getPortfolios).mockResolvedValue([])

    render(<PortfoliosPage />)

    await screen.findByText('No portfolios yet')

    await user.type(
      screen.getByLabelText('Portfolio name'),
      '   ',
    )

    const createButton = screen.getByRole('button', {
      name: 'Create Portfolio',
    })

    expect(createButton).toBeDisabled()

    await user.click(createButton)

    expect(createPortfolio).not.toHaveBeenCalled()
  })

  it('disables the create button while portfolio creation is in progress', async () => {
    const user = userEvent.setup()

    vi.mocked(getPortfolios).mockResolvedValue([])
    vi.mocked(createPortfolio).mockReturnValue(new Promise(() => {}))

    render(<PortfoliosPage />)

    await screen.findByText('No portfolios yet')

    await user.type(
      screen.getByLabelText('Portfolio name'),
      'New Portfolio',
    )

    const createButton = screen.getByRole('button', {
      name: 'Create Portfolio',
    })

    await user.click(createButton)

    expect(createButton).toBeDisabled()
  })

  it('displays an error when portfolio creation fails', async () => {
    const user = userEvent.setup()

    vi.mocked(getPortfolios).mockResolvedValue([])

    vi.mocked(createPortfolio).mockRejectedValue(
      new Error('Unable to create portfolio'),
    )

    render(<PortfoliosPage />)

    await screen.findByText('No portfolios yet')

    await user.type(
      screen.getByLabelText('Portfolio name'),
      'New Portfolio',
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Create Portfolio',
      }),
    )

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Unable to create portfolio')
  })
})
