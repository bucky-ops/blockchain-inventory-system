import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="80vh"
        >
            <Typography variant="h1" color="primary">404</Typography>
            <Typography variant="h5" gutterBottom>Page Not Found</Typography>
            <Button variant="contained" onClick={() => navigate('/')}>
                Go Home
            </Button>
        </Box>
    );
};

export default NotFoundPage;
