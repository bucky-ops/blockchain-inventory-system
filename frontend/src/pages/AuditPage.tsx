import React from 'react';
import { Box, Typography } from '@mui/material';

const AuditPage: React.FC = () => {
    return (
        <Box p={3}>
            <Typography variant="h4">Audit Logs</Typography>
            <Typography>System audit trails will appear here.</Typography>
        </Box>
    );
};

export default AuditPage;
