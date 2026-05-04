import React from 'react';
import Header from './components/Header';
import RescheduleForm from './components/RescheduleForm';

function App() {
    return (
        <div className="flex h-full grow flex-col">
            <div className="px-4 md:px-10 lg:px-40 flex flex-1 justify-center py-5">
                <div className="flex flex-col max-w-[960px] flex-1">
                    <Header />
                    <RescheduleForm />
                </div>
            </div>
        </div>
    );
}

export default App;
