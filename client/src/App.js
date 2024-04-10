import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ColorModeContext, useMode } from './theme';

import Dashboard from './scenes/dashboard';
import Topbar from './scenes/global/Topbar';
import Sidebar from './scenes/global/Sidebar';
import Team from './scenes/team';
import Contacts from './scenes/contacts';
import Invoices from './scenes/invoices';
import Form from './scenes/form';
import Calendar from './scenes/calendar/';
import FAQ from './scenes/faq';
import Bar from './scenes/bar';
import Pie from './scenes/pie';
import Line from './scenes/line';
import Geography from './scenes/geography';
import LoginForm from './scenes/login/logIn';
import ActiveTabList from './scenes/ActiveTab';

function App() {
  const [theme, colorMode] = useMode();

  return (
    <Router>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div className="app">
            <Routes>
              <Route path="/" element={<LoginForm />} />
              <Route
                path="/*"
                element={
                  < >
                    <div className='flex relative'> <div >
                      <div className='fixed z-50 w-screen'
                      >                      <Topbar />
                      </div>
                    </div>
                      <main className="flex mt-20">
                        <div>
                          <Sidebar />
                        </div>



                        <div className="w-screen">
                          <ActiveTabList />
                        </div>

                      </main>
                    </div>
                  </>
                }
              />
            </Routes>
          </div>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </Router>
  );
}

export default App;
