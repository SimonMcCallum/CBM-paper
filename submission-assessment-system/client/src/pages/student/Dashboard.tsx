import Layout from '../../components/Layout';
import { Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <Layout title='Student Dashboard'>
      <Typography variant='h4' gutterBottom>Student Dashboard</Typography>
      <Box mt={3}>
        <Button variant='contained' onClick={() => navigate('/student/upload')}>
          Upload Submission
        </Button>
      </Box>
    </Layout>
  );
}
