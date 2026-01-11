import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Button
} from '@mui/material'
import {
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'
import { useQuery } from 'react-query'

import { getDashboardStats } from '@/services/dashboardService'
import { formatNumber, formatCurrency } from '@/utils/formatters'
import StatCard from '@/components/StatCard'
import InventoryChart from '@/components/charts/InventoryChart'
import ActivityFeed from '@/components/ActivityFeed'
import { DashboardStats } from '@/types'

const DashboardPage: React.FC = () => {
  const { t } = useTranslation()

  const {
    data: stats,
    isLoading,
    error,
    refetch
  } = useQuery<DashboardStats>('dashboard-stats', getDashboardStats, {
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading dashboard data. Please try again.
        <Button onClick={handleRefresh} sx={{ ml: 2 }}>
          <RefreshIcon />
        </Button>
      </Alert>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {t('dashboard.title')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          {t('common.refresh')}
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.stats.totalItems')}
            value={formatNumber(stats.totalItems)}
            icon={<InventoryIcon />}
            color="primary"
            trend={stats.itemsTrend}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.stats.totalValue')}
            value={formatCurrency(stats.totalValue)}
            icon={<TrendingUpIcon />}
            color="success"
            trend={stats.valueTrend}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.stats.lowStock')}
            value={formatNumber(stats.lowStockItems)}
            icon={<WarningIcon />}
            color="warning"
            subtitle={t('dashboard.stats.itemsBelowReorderPoint')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.stats.recentActivity')}
            value={formatNumber(stats.recentTransactions)}
            icon={<SecurityIcon />}
            color="info"
            subtitle={t('dashboard.stats.last24Hours')}
          />
        </Grid>
      </Grid>

      {/* Charts and Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.inventoryChart.title')}
            </Typography>
            <InventoryChart data={stats.inventoryTrends} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 400, overflow: 'hidden' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.recentActivity.title')}
            </Typography>
            <ActivityFeed activities={stats.recentActivities} />
          </Paper>
        </Grid>

        {/* Low Stock Alert */}
        {stats.lowStockItems > 0 && (
          <Grid item xs={12}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('dashboard.lowStockAlert.title', { count: stats.lowStockItems })}
              </Typography>
              <Typography variant="body2">
                {t('dashboard.lowStockAlert.message')}
              </Typography>
              <Button
                variant="contained"
                size="small"
                sx={{ mt: 1 }}
                href="/inventory?filter=low_stock"
              >
                {t('dashboard.lowStockAlert.viewItems')}
              </Button>
            </Alert>
          </Grid>
        )}

        {/* Critical Alerts */}
        {stats.criticalAlerts && stats.criticalAlerts.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('dashboard.criticalAlerts.title', { count: stats.criticalAlerts.length })}
              </Typography>
              {stats.criticalAlerts.map((alert, index) => (
                <Typography key={index} variant="body2">
                  • {alert.message}
                </Typography>
              ))}
            </Alert>
          </Grid>
        )}

        {/* Pending Approvals (for managers/admins) */}
        {stats.pendingApprovals && stats.pendingApprovals.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('dashboard.pendingApprovals.title', { count: stats.pendingApprovals.length })}
              </Typography>
              <Typography variant="body2">
                {t('dashboard.pendingApprovals.message')}
              </Typography>
              <Button
                variant="contained"
                size="small"
                sx={{ mt: 1 }}
                href="/inventory?filter=pending_approval"
              >
                {t('dashboard.pendingApprovals.reviewItems')}
              </Button>
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

export default DashboardPage