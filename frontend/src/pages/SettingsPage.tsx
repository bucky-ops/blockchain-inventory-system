import React from 'react';
import { Box, Typography } from '@mui/material';

const SettingsPage: React.FC = () => {
    return (
        <Box p={3}>
            <Typography variant="h4">Settings</Typography>
            <Typography>System configuration options will appear here.</Typography>
        </Box>
    );
};

export default SettingsPage;
