import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'admin',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(formData.email, formData.password, formData.name, formData.role);
      enqueueSnackbar('Registration successful!', { variant: 'success' });
      navigate(formData.role === 'student' ? '/student' : '/admin');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
      enqueueSnackbar('Registration failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        minHeight="100vh"
        py={4}
      >
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
            Create Account
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" mb={3}>
            Register for CBM Assessment System
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              margin="normal"
              required
              autoFocus
            />

            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="email"
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="new-password"
            />

            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              margin="normal"
              required
              autoComplete="new-password"
            />

            <FormControl component="fieldset" sx={{ mt: 2, mb: 1 }}>
              <FormLabel component="legend">I am a:</FormLabel>
              <RadioGroup
                row
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <FormControlLabel value="student" control={<Radio />} label="Student" />
                <FormControlLabel value="admin" control={<Radio />} label="Staff/Admin" />
              </RadioGroup>
            </FormControl>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register'}
            </Button>

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link component={RouterLink} to="/login" underline="hover">
                  Login here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
