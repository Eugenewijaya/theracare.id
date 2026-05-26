import React from 'react';
import Header from './components/Header';
import RescheduleForm from './components/RescheduleForm';

function App({ onLogout }) {
    return (
        <div className="flex h-full min-w-0 grow flex-col overflow-x-hidden">
            <div className="flex min-w-0 flex-1 justify-center px-4 py-5 md:px-10 lg:px-40">
                <div className="flex max-w-[960px] min-w-0 flex-1 flex-col">
                    <Header onLogout={onLogout} />
                    <RescheduleForm />
                </div>
            </div>
        </div>
    );
}

export default App;
