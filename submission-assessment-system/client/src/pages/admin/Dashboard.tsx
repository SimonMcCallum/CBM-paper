import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Paper,
} from '@mui/material';
import {
  AssignmentTurnedIn,
  QuestionAnswer,
  People,
  Download,
  TrendingUp,
  Assessment,
} from '@mui/icons-material';
import Layout from '../../components/Layout';

export default function Dashboard() {
  const navigate = useNavigate();

  const stats = [
    { label: 'Total Submissions', value: '0', icon: <AssignmentTurnedIn fontSize="large" />, color: '#1976d2' },
    { label: 'Active Students', value: '1', icon: <People fontSize="large" />, color: '#2e7d32' },
    { label: 'Question Bank', value: '0', icon: <QuestionAnswer fontSize="large" />, color: '#ed6c02' },
    { label: 'Assessments', value: '0', icon: <Assessment fontSize="large" />, color: '#9c27b0' },
  ];

  const quickActions = [
    {
      title: 'Question Bank',
      description: 'Manage MCQ questions, import from QTI, create new questions',
      icon: <QuestionAnswer sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
      action: () => navigate('/admin/questions'),
    },
    {
      title: 'View Submissions',
      description: 'Monitor student submissions and processing status',
      icon: <AssignmentTurnedIn sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      action: () => navigate('/admin/submissions'),
    },
    {
      title: 'Export Reports',
      description: 'Download novelty reports, oral questions, and score spreadsheets',
      icon: <Download sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
      action: () => navigate('/admin/exports'),
    },
    {
      title: 'Analytics',
      description: 'View system analytics and performance metrics',
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
      action: () => {},
    },
  ];

  return (
    <Layout title="Admin Dashboard">
      <Box mb={4}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to the CBM Assessment System administration panel
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper
              elevation={2}
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  bgcolor: `${stat.color}15`,
                  color: stat.color,
                  mr: 2,
                }}
              >
                {stat.icon}
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h5" gutterBottom fontWeight="bold" mb={2}>
        Quick Actions
      </Typography>
      <Grid container spacing={3}>
        {quickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: `${action.color}15`,
                    color: action.color,
                    mb: 2,
                  }}
                >
                  {action.icon}
                </Box>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  {action.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {action.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button fullWidth variant="contained" onClick={action.action}>
                  Open
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity */}
      <Box mt={4}>
        <Typography variant="h5" gutterBottom fontWeight="bold" mb={2}>
          Recent Activity
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No recent activity. Submissions will appear here once students start uploading.
          </Typography>
        </Paper>
      </Box>

      {/* System Info */}
      <Box mt={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                System Configuration
              </Typography>
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  <strong>LLM Provider:</strong> Claude Sonnet 4.5
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Novelty Detector:</strong> Running
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Database:</strong> SQLite (Development)
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Environment:</strong> Development
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                CBM Scoring Rules
              </Typography>
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Confidence 5:</strong> +2.0 / -2.0
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Confidence 4:</strong> +1.5 / -1.5
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Confidence 3:</strong> +1.0 / -1.0
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Confidence 2:</strong> +0.5 / -0.5
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <strong>Confidence 1:</strong> 0.0 / 0.0
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
}
