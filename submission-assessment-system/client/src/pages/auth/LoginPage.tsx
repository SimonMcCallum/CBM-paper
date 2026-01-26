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
  Divider,
  Alert,
} from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      enqueueSnackbar('Login successful!', { variant: 'success' });
      navigate('/student'); // Will redirect based on role
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
      enqueueSnackbar('Login failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      await loginWithGoogle(credentialResponse.credential);
      enqueueSnackbar('Google login successful!', { variant: 'success' });
      navigate('/student');
    } catch (err: any) {
      setError('Google login failed');
      enqueueSnackbar('Google login failed', { variant: 'error' });
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
            CBM Assessment System
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" mb={3}>
            Login to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              autoComplete="email"
              autoFocus
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            <Divider sx={{ my: 2 }}>OR</Divider>

            <Box display="flex" justifyContent="center" mb={2}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google login failed')}
                useOneTap
              />
            </Box>

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Link component={RouterLink} to="/register" underline="hover">
                  Register here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
