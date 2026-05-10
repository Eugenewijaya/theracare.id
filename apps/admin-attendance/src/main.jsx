import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AdminProvider } from '../../admin-app/src/context/AdminContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AdminProvider>
                <App />
            </AdminProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
