import api from './api';

export const inventoryService = {
    async getAll(page = 1, limit = 10, search = '') {
        const response = await api.get('/inventory', {
            params: { page, limit, search }
        });
        return response.data.data;
    },

    async getOne(id: string) {
        const response = await api.get(`/inventory/${id}`);
        return response.data.data;
    },

    async create(data: any) {
        const response = await api.post('/inventory', data);
        return response.data.data;
    },

    async update(id: string, data: any) {
        const response = await api.put(`/inventory/${id}`, data);
        return response.data.data;
    },

    async delete(id: string) {
        const response = await api.delete(`/inventory/${id}`);
        return response.data;
    }
};
