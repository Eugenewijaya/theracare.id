import React from 'react';
import ParentPortalHeader from '../../../shared/ui/ParentPortalHeader';

const Header = ({ title = 'Reschedule' }) => (
    <ParentPortalHeader title={title} icon="swap_horiz" className="rounded-b-xl lg:rounded-none" />
);

export default Header;
