import React from 'react';
import ParentPortalHeader from '../../../shared/ui/ParentPortalHeader';

const Header = ({ title = 'Dashboard' }) => (
    <ParentPortalHeader title={title} icon="sentiment_satisfied" />
);

export default Header;
