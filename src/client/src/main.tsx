import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { NavigationGuardProvider } from './shared/NavigationGuardProvider';
import { App } from './App';
import './styles.css';

const router = createBrowserRouter([{ path: '*', element: <NavigationGuardProvider><App /></NavigationGuardProvider> }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>,
);
