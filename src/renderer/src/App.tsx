import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import AppLayout from './components/Layout/AppLayout'

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </ThemeProvider>
  )
}
