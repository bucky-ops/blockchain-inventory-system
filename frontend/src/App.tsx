import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '@/hooks/useAuth'

import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import InventoryPage from '@/pages/InventoryPage'
import ItemDetailPage from '@/pages/ItemDetailPage'
import UsersPage from '@/pages/UsersPage'
import AuditPage from '@/pages/AuditPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

const App: React.FC = () => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={60} />
      </Box>
    )
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } 
      />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        
        <Route path="inventory">
          <Route index element={<InventoryPage />} />
          <Route path=":id" element={<ItemDetailPage />} />
        </Route>
        
        <Route 
          path="users" 
          element={
            <ProtectedRoute requiredRole={['ADMIN', 'MANAGER']}>
              <UsersPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="audit" 
          element={
            <ProtectedRoute requiredRole={['ADMIN', 'MANAGER', 'AUDITOR']}>
              <AuditPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="settings" 
          element={
            <ProtectedRoute requiredRole={['ADMIN']}>
              <SettingsPage />
            </ProtectedRoute>
          } 
        />
      </Route>
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App