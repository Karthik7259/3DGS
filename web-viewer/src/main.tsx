import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Avoid React development StrictMode's effect remount, which would initiate
  // a second load of this very large local PLY during the smoke test.
  <App />,
);
