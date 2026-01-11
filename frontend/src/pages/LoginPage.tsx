import React, { useState } from 'react';
import { Box, Button, Typography, Paper, Alert } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { ethers } from 'ethers';

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        setError('');
        setLoading(true);

        try {
            if (!window.ethereum) {
                throw new Error('MetaMask is not installed');
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();

            // 1. Get Nonce
            const { nonce } = await authService.getNonce(address);

            // 2. Sign Message
            const message = `Login to Inventory System: ${nonce}`;
            const signature = await signer.signMessage(message);

            // 3. Login
            await login(address, signature, nonce);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
            bgcolor="#f5f5f5"
        >
            <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    Inventory System
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Connect your wallet to access the dashboard
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={handleConnect}
                    disabled={loading}
                    sx={{ mt: 2 }}
                >
                    {loading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
            </Paper>
        </Box>
    );
};

export default LoginPage;
