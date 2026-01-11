import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableHead, TableRow, Paper } from '@mui/material';
import { inventoryService } from '@/services/inventoryService';
import { useNavigate } from 'react-router-dom';

const InventoryPage: React.FC = () => {
    const [items, setItems] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            const data = await inventoryService.getAll();
            setItems(data.items);
        } catch (error) {
            console.error('Failed to load inventory', error);
        }
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" mb={3}>
                <Typography variant="h4">Inventory</Typography>
                <Button variant="contained" color="primary">Add Item</Button>
            </Box>

            <Paper>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>SKU</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id} hover onClick={() => navigate(`/inventory/${item.id}`)} style={{ cursor: 'pointer' }}>
                                <TableCell>{item.sku}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{item.location}</TableCell>
                                <TableCell>
                                    <Button size="small">Edit</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>
        </Box>
    );
};

export default InventoryPage;
