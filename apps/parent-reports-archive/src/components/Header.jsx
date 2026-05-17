import React from 'react';
import ParentPortalHeader from '../../../shared/ui/ParentPortalHeader';

const Header = ({ title = 'Reports Archive' }) => (
    <ParentPortalHeader title={title} icon="folder_open" className="rounded-b-xl lg:rounded-none" />
);

export default Header;
