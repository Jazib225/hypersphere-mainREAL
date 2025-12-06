import { RouterProvider } from 'react-router';
import { router } from './utils/routes';

function App() {
  return <RouterProvider router={router} />;
}

export default App;
