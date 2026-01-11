import api from './api';
import { ethers } from 'ethers';

export const authService = {
    async getNonce(address: string) {
        const response = await api.post('/auth/nonce', { address });
        return response.data.data;
    },

    async login(address: string, signature: string, nonce: string) {
        const response = await api.post('/auth/login', { address, signature, nonce });
        return response.data.data;
    },

    async getProfile() {
        const response = await api.get('/auth/me');
        return response.data.data;
    },

    async logout() {
        return api.post('/auth/logout');
    }
};
