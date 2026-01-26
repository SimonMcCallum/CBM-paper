import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Container,
  Box,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import { Menu as MenuIcon, AccountCircle } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDashboard = () => {
    navigate(user?.role === 'student' ? '/student' : '/admin');
    handleClose();
  };

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={handleDashboard}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CBM Assessment - {title}
          </Typography>
          <Box>
            <Button
              color="inherit"
              onClick={handleMenu}
              startIcon={<AccountCircle />}
            >
              {user?.name}
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleDashboard}>Dashboard</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
