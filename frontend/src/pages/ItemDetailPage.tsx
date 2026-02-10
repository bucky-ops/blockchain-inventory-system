import React, { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { inventoryService } from '@/services/inventoryService';

const ItemDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (id) loadItem(id);
    }, [id]);

    const loadItem = async (itemId: string) => {
        try {
            const data = await inventoryService.getOne(itemId);
            setItem(data);
        } catch (error) {
            console.error(error);
        }
    };

    if (!item) return <Typography>Loading...</Typography>;

    return (
        <Box p={3}>
            <Button onClick={() => navigate('/inventory')} sx={{ mb: 2 }}>Back</Button>
            <Typography variant="h4">{item.name}</Typography>
            <Typography variant="subtitle1" color="textSecondary">{item.sku}</Typography>

            <Box mt={3}>
                <Typography><strong>Quantity:</strong> {item.quantity}</Typography>
                <Typography><strong>Location:</strong> {item.location}</Typography>
                <Typography><strong>Category:</strong> {item.category}</Typography>
            </Box>
        </Box>
    );
};

export default ItemDetailPage;
